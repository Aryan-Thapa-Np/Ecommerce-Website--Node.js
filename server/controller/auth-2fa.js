/**
 * Authentication Controller - Two-Factor Authentication Functions
 */

import { query } from "../database/db.js";
import {
  generateOTP,
  generateTwoFactorSecret,
  generateQRCode,
  verifyTwoFactorToken,
  generateAccessToken,
  generateRefreshToken,
  generateSecureToken,

} from "../utils/auth.js";
import { sendTwoFactorEmail, sendTwoFactorDisable } from "../utils/email.js";
import { logAuthEvent, logLoginAttempt } from "../utils/logger.js";
import { pushNotification } from "../utils/notification.js";

// Setup 2FA
const setupTwoFactor = async (req, res) => {
  try {
    const userId = req.user;
    const { method } = req.body;

    // Check if user exists
    const user = await query("SELECT email,provider,two_factor_enabled,two_factor_method FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user || user.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "User not found",
      });
    }

    const userMain = user[0];
 
    // if (userMain.provider !== null) {
      
    //   return res.status(200).json({
    //     status: "error",
    //     success: false,
    //     message: "OAuth users: Please Enable 2FA in Your Gmail.",
    //   });
    // }

    if(user[0].two_factor_enabled == true){
      return res.status(200).json({
        status: "error",
        success: false,
        message: "2FA is already enabled",
      });
    }


    const email = user[0].email;

    if (method === "app") {
      // Generate secret for authenticator app
      const secret = generateTwoFactorSecret();


      await query(`UPDATE users SET two_factor_secret = ? WHERE id = ?`, [
        secret.base32,
        userId,
      ]);

      // Generate QR code
      const qrCode = await generateQRCode(secret, email);

      return res.status(200).json({
        success: true,
        message: "2FA setup initiated",
        secret: secret.base32,
        qrCode,
      });
    } else if (method === "email") {
      // Generate OTP
      const otp = generateOTP();
      const expiryTime = new Date(Date.now() + 5 * 60000); // 5 minutes

      // Store OTP in database
      await query(
        "INSERT INTO otps (user_id, email, otp, type, expires_at) VALUES (?, ?, ?, ?, ?)",
        [userId, email, otp, "two_factor", expiryTime]
      );

      // Send 2FA verification email
      await sendTwoFactorEmail(email, otp);

      return res.status(200).json({
        success: true,
        message: "2FA setup initiated. Check your email for verification code.",
      });
    } else {
      return res.status(200).json({
        status:"error",
        success: false,
        message: "Invalid 2FA method",
      });
    }
  } catch (error) {
    console.error("2FA setup error:", error);
    return res.status(200).json({
      status:"error",
      success: false,
      message: "Error setting up 2FA",
    });
  }
};

// Verify and enable 2FA
const verifyAndEnableTwoFactor = async (req, res) => {
  try {
    const { email, otp, method } = req.body;
    const user_id = req.user;





    let isValid = false;
    let secretcode = "";

    if (method === "app") {
      const secret = await query(
        `select two_factor_secret  from users where email = ?`,
        [email]
      );

      secretcode = secret[0].two_factor_secret;
     


      // Verify TOTP token
      isValid = verifyTwoFactorToken(otp, secretcode);
      if (!isValid) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: "Invalid verification code",
        });
      } else {
        await query(
          "UPDATE users SET two_factor_enabled = TRUE, two_factor_method = ?, two_factor_secret = ? WHERE id = ?",
          [method, method === "app" ? secretcode : null, user_id]
        );
        await logAuthEvent(
          user_id,
          "2fa_enabled",
          `2FA enabled with ${method} method`,
          req
        );
        return res.status(200).json({
          status: "success",
          success: true,
          message: "Verification code verified successfully",
        });
      }




    } else if (method === "email") {
      // Verify email OTP
      const otpRecord = await query(
        "SELECT * FROM otps WHERE user_id = ? AND otp = ? AND type = ? AND expires_at > NOW()",
        [user_id, otp, "two_factor"]
      );

      isValid = otpRecord && otpRecord.length > 0;

      if (isValid) {
        // Delete used OTP
        await query("DELETE FROM otps WHERE id = ?", [otpRecord[0].id]);
      }
    }

    if (!isValid) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "Invalid verification code",
      });
    }

    // Enable 2FA
    await query(
      "UPDATE users SET two_factor_enabled = TRUE, two_factor_method = ?, two_factor_secret = ? WHERE id = ?",
      [method, method === "app" ? secretcode : null, user_id]
    );

    // Log 2FA enabled event
    await logAuthEvent(
      user_id,
      "2fa_enabled",
      `2FA enabled with ${method} method`,
      req
    );
    await pushNotification(user_id, "2fa_enable", "2fa_enable");
    return res.status(200).json({
      success: true,
      message: "Two-factor authentication enabled successfully",
    });
  } catch (error) {
    console.error("2FA verification error:", error);
    return res.status(200).json({
      status:"error",
      success: false,
      message: "Error enabling 2FA",
    });
  }
};

// Disable 2FA
const disableTwoFactor = async (req, res) => {
  try {
    const userId = req.query.userId;
    const token = req.query.token;

    // Check if user exists and has 2FA enabled
    const user = await query(
      "SELECT two_factor_enabled,role_id FROM users WHERE id = ?",
      [userId]
    );

    if (!user || user.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "User not found",
      });
    }

    if (!user[0].two_factor_enabled) {

      res.render("404", {
        status: "error",
        success: false,
        message: "2FA is not enabled",
      });

      return;
    }

    const otpRecord = await query(
      "SELECT * FROM otps WHERE user_id = ? AND tokens = ?  AND expires_at > NOW()",
      [userId, token]
    );

    if (!otpRecord || otpRecord.length === 0) {
      res.render("2fa-disable", {
        status: "error",
        success: false,
        message: "Invalid or expired OTP",
      });
      return;
    }

    // Disable 2FA
    await query(
      "UPDATE users SET two_factor_enabled = FALSE, two_factor_method = NULL, two_factor_secret = NULL WHERE id = ?",
      [userId]
    );

    // Log 2FA disabled event
    await logAuthEvent(userId, "2fa_disabled", "2FA disabled", req);
    await pushNotification(userId, "2fa_disable", "2fa_disable");

    res.render("2fa-disable", {
      status: "success",
      link: user[0].role_id === 3 ? "/customer" : "/admin",
      message: "Two-factor authentication disabled successfully",
    });
    return;
  } catch (error) {
    console.error("2FA disable error:", error);
    return res.status(200).json({
      status:"error",
      success: false,
      message: "Error disabling 2FA",
    });
  }
};

// Verify 2FA during login
const verifyTwoFactor = async (req, res) => {
  try {
    // Extract required fields from request body
    const { email, otp, method, rememberMe } = req.body;

    if (!email || !otp || !method) {
      return res.status(200).json({
        status: "error",
        message: "Missing required fields",
      });
    }

    // Get user data by email
    const users = await query(
      `SELECT u.*, r.name as role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ?`,
      [email]
    );

    if (!users || users.length === 0) {
      return res.status(200).json({
        status: "error",
        message: "User not found",
      });
    }

    const user = users[0];



    let isValid = false;

    // Verify token based on 2FA method
    if (method === "app") {
      isValid = verifyTwoFactorToken(otp, user.two_factor_secret);
    } else if (method === "email") {
      const otpRecord = await query(
        "SELECT * FROM otps WHERE user_id = ? AND otp = ? AND type = ? AND expires_at > NOW()",
        [user.id, otp, "two_factor"]
      );
      isValid = otpRecord && otpRecord.length > 0;
      if (isValid) {
        await query("DELETE FROM otps WHERE id = ?", [otpRecord[0].id]);
      }
    } else {
      return res.status(200).json({
        status: "error",
        message: "Invalid 2FA method",
      });
    }

    if (!isValid) {
      await logAuthEvent(
        user.id,
        "2fa_verification_failure",
        "Invalid 2FA token",
        req
      );
      return res.status(200).json({
        status: "error",
        message: "Invalid verification code",
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    let refreshTokenValue = null;

    if (rememberMe) {
      refreshTokenValue = generateRefreshToken(user);
  

      await query("INSERT INTO user_sessions (user_id, refresh_token, device_info, ip_address, expires_at, remember_me, SSID) VALUES (?, ?, ?, ?, ?, ?, ?)", [
        user.id,
        refreshTokenValue,
        JSON.stringify({
          deviceType: 'browser',
          browser: req.headers['user-agent'],
          os: req.headers['sec-ch-ua-platform'] || 'unknown'
        }),
        req.ip,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        rememberMe,
        req.cookies?.SSID
      ]);

      res.cookie("refreshToken", refreshTokenValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }

    await logAuthEvent(
      user.id,
      "2fa_verification_success",
      "2FA verified successfully",
      req
    );
    await logLoginAttempt(email, true, null, req);
    await query("DELETE FROM otps WHERE user_id = ?", [user.id]);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });



    return res.status(200).json({
      status: "success",
      message: "Two-factor authentication successful",
      redirect: '/',
    });
  } catch (error) {
    console.error("2FA verification error:", error);
    return res.status(200).json({
      status: "error",
      message: "Error during 2FA verification",
    });
  }
};



const disableTwoFactorRequest = async (req, res) => {
  try {
    const userId = req.user;
    const user = await query("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user || user.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "User not found",
      });
    }

    const token = generateSecureToken();
    const expiryTime = new Date(Date.now() + 2 * 60000); // 2 minutes
    await query(
      "INSERT INTO otps (user_id, email, token, expires_at) VALUES (?, ?, ?, ?)",
      [userId, user[0].email, token, expiryTime]
    );

    await sendTwoFactorDisable(user[0].email, token, userId);


    return res.status(200).json({
      status: "success",
      success: true,
      message: "Two-factor authentication disable request sent successfully",
    });



  } catch (error) {
    console.error("Error disabling 2FA request:", error);
    return res.status(200).json({
      status: "error",
      message: "Error disabling 2FA request",
    });
  }
}

export {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  disableTwoFactor,
  verifyTwoFactor,
  disableTwoFactorRequest,
};
