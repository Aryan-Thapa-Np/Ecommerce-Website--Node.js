/**
 * User Controller
 * Handles user management and profile operations
 */

import { query } from "../database/db.js";
import { logAccountStatusChange, logProfileUpdate } from "../utils/logger.js";

import { getUserNotifications, deleteOldNotifications } from "../utils/notification.js";

import fs from "fs";
import { sendVerificationEmail } from "../utils/email.js";
import { logLoginAttempt } from "../utils/logger.js";
import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  generateOTP,
} from "../utils/auth.js";

import { pushNotification } from "../utils/notification.js";

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user;

    let ordercheck =null

    // Get user data and profile
    const users = await query(
      `SELECT u.id, u.username, u.email, u.email_verified, u.two_factor_enabled, u.two_factor_method, 
              r.name as role, u.account_status, u.created_at,
              p.first_name, p.last_name, p.phone, p.address, p.city, p.state, p.country, p.postal_code, p.profile_image
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = ?`,
      [userId]
    );

    const order = await query(
      `SELECT id from order_headers
       WHERE user_id = ?`,
      [userId]
    );

    if(order && order.length > 0){
      ordercheck = true;
    }else{
      ordercheck = false;
    }


    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];

    // Remove sensitive information
    delete user.password;
    delete user.refresh_token;
    delete user.two_factor_secret;

    return res.status(200).json({
      success: true,
      profile: user,
      ordercheck: ordercheck,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error retrieving user profile",
    });
  }
};

const updateUserInfo = async (req, res) => {
  try {
    const userId = req.user;
    const { name, email } = req.body;

    


    // Validate that at least one field is provided
    if (!name && !email) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "vlaue  is required",
      });
    }

    // Build dynamic SQL query
    const updates = [];
    const params = [];
    let tempmail = "";

    if (name) {
      updates.push("username = ?");
      params.push(name);
    }
    if (email) {
      const [data] = await query(`select * from users where id=?`, [userId]);



      if (data.provider !== null) {
        

        return res.status(200).json({
          status: "error",
          success: false,
          message: "Oath logged in email cannot be changed.",
        });
      }



      const [checkEmail] = await query(`SELECT * FROM users WHERE email = ?`, [email]);
      if (checkEmail && checkEmail.length > 0) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: "Email already in use.",
        });
      }


      updates.push("email = ?");
      params.push(email);
    }


    // Add userId to params for the WHERE clause
    params.push(userId);

    // Construct the SET clause
    const setClause = updates.join(", ");

    // Execute the update query
    await query(`UPDATE users SET ${setClause} WHERE id = ?`, params);
    if (email) {
      await query(`UPDATE users SET email_verified=? WHERE id = ?`, [null, userId]);




      await logLoginAttempt(email, false, "Email not verified", req);

      const otp = generateOTP();
      const expiryTime = new Date(Date.now() + 2 * 60000); // 2 minutes

      // Store OTP in database
      await query(
        "INSERT INTO otps (user_id, email, otp, type, expires_at) VALUES (?, ?, ?, ?, ?)",
        [userId, email, otp, "Email_verification", expiryTime]
      );

      await sendVerificationEmail(email, otp);

      return res.status(200).json({
        success: true,
        message: "User information updated successfully",
        requireEmailVerification: true,
      });
    };
    await logLoginAttempt(name, true, "Name changed", req);
    await pushNotification(userId, "profile", "Your profile has been updated");

    return res.status(200).json({
      success: true,
      message: "User information updated successfully",
    });

  } catch (error) {
    console.error("Update user info error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error updating user information",
    });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      lastName,
      phone,
      address,
      city,
      state,
      country,
      postalCode,
    } = req.body;

    // Check if user exists
    const user = await query("SELECT id FROM users WHERE id = ?", [userId]);

    if (!user || user.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update profile
    await query(
      `UPDATE user_profiles 
       SET first_name = ?, last_name = ?, phone = ?, address = ?, 
           city = ?, state = ?, country = ?, postal_code = ?
       WHERE user_id = ?`,
      [
        firstName || null,
        lastName || null,
        phone || null,
        address || null,
        city || null,
        state || null,
        country || null,
        postalCode || null,
        userId,
      ]
    );

    // Log profile update
    await logProfileUpdate(userId, "Profile details", req);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error updating user profile",
    });
  }
};

// Update profile image
const updateProfileImage = async (req, res) => {
  try {
    const userId = req.user;

    // Get current profile image path from DB
    const userProfile = await query(
      "SELECT profile_image FROM user_profiles WHERE user_id = ?",
      [userId]
    );
    if (userProfile && userProfile[0] && userProfile[0].profile_image) {
      const oldImagePath = userProfile[0].profile_image;
      // Only delete if file exists and is not empty
      if (oldImagePath && fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
        } catch (err) {
          console.warn("Failed to delete old profile image:", err);
        }
      }
    }

    if (!req.fileInfo) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "No file uploaded",
      });
    }

    await query(
      "UPDATE user_profiles SET profile_image = ? WHERE user_id = ?",
      [req.fileInfo.path, userId]
    );

    await logProfileUpdate(userId, "Profile image", req);
    await pushNotification(userId, "profile", "Your profile has been updated");

    return res.status(200).json({
      success: true,
      message: "Profile image updated successfully",
      file: req.fileInfo,
    });
  } catch (error) {
    console.error("Update profile image error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error updating profile image",
    });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user data and profile
    const users = await query(
      `SELECT u.id, u.username, u.email, u.email_verified, u.two_factor_enabled, u.two_factor_method, 
              r.name as role, u.account_status, u.account_status_reason, u.account_status_expiry, u.created_at,
              p.first_name, p.last_name, p.phone, p.address, p.city, p.state, p.country, p.postal_code, p.profile_image
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = ?`,
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];

    // Remove sensitive information
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      email_verified: user.email_verified,
      two_factor_enabled: user.two_factor_enabled,
      two_factor_method: user.two_factor_method,
      role: user.role,
      account_status: user.account_status,
      account_status_reason: user.account_status_reason,
      account_status_expiry: user.account_status_expiry,
      created_at: user.created_at,
    };

    return res.status(200).json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error retrieving user",
    });
  }
};

async function getUserActivity(req, res) {
  try {
    const userId = req.user;
    if (!userId) { return res.status(200).json({ status: 'error', message: 'Invalid user ID' }); }
    await deleteOldNotifications(userId);
    const notifications = await getUserNotifications(userId, 4);
    return res.json(notifications); // add return here
  } catch (error) {
    console.error('Error fetching activity notifications:', error);
    return res.status(200).json({ status: 'error', success: false, message: 'Failed to fetch notifications' });
  }
}




const sendUserNotifications = async (req, res) => {
  try {
    const userID = req.user;

    if (!userID) {
      return res.status(200).json({ status: 'error', message: 'Invalid user ID' });

    }


    const notifications = await getUserNotifications(userID, 20);

    return res.json(notifications);

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(200).json({ status: 'error', success: false, message: 'Failed to fetch notifications' });
  }

};


const markNotificationAsViewed = async (req, res) => {
  try {
    const userId = req.user;
    const id = req.params.id;
    if (!userId) return res.status(400).json({ status: 'error', message: 'Invalid user ID' });

    const result = await query(
      'UPDATE notifications SET viewed = 1 WHERE user_id = ? AND id=? AND viewed = 0',
      [userId, id]
    );

    return res.json({ status: 'success', updated: result.affectedRows || 0 });
  } catch (error) {
    console.error('Error marking notifications as viewed:', error);
    return res.status(200).json({ status: 'error', success: false, message: 'Failed to update notifications' });
  }
}



const deleteNotification = async (req, res) => {
  try {
    const userID = req.user;
    if (!userID) {
      return res.status(200).json({ status: 'error', message: 'Invalid user ID' });
    }
    const id = req.params.id;
    if (!id) {
      return res.status(200).json({ status: 'error', message: 'Invalid notification ID' });
    }

  
    const result = await query(
      'DELETE FROM notifications WHERE user_id = ? AND id=?',
      [userID, id]
    );

    return res.json({ status: 'success', deleted: result.affectedRows || 0 });


  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(200).json({ status: 'error', success: false, message: 'Failed to delete notification' });
  }
}

const getusershortinfo = async(req,res)=>{
  try{
    const userId = req.user;
    
    const user = await query("SELECT id, username FROM users WHERE id = ?", [userId]);
    if(!user){
      return res.status(200).json({ status: 'error',success: false, message: 'User not found' });
    }
    return res.json({ status: 'success', success: true, user: user });
  }catch(error){
    console.error('Error fetching user short info:', error);
    return res.status(200).json({ status: 'error', success: false, message: 'Failed to fetch user short info' });
  }
}


export {
  getUserProfile,
  updateUserProfile,
  updateProfileImage,
  getUserById,
  updateUserInfo,
  getUserActivity,
  markNotificationAsViewed,
  sendUserNotifications,
  deleteNotification,
  getusershortinfo,
};
