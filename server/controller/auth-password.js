/**
 * Authentication Controller - Password Reset Functions
 */

import { query } from "../database/db.js";
import { hashPassword, generateOTP } from "../utils/auth.js";
import { sendPasswordResetEmail } from "../utils/email.js";
import { logAuthEvent } from "../utils/logger.js";
import { pushNotification } from "../utils/notification.js";

// Request password reset
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
  

    // Check if user exists
    const user = await query("SELECT id, password FROM users WHERE email = ?", [
      email,
    ]);

    if (!user || user.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "Invalid Email Address",
      });
    }
    const userIddd = user[0].password;


    if (!userIddd) {
      // User registered via OAuth and has not set a password
      return res.status(200).json({
        status: "error",
        success: false,
        message: "Please log in with OAuth Google/Facebook Login.",
      });
    }

    const userId = user[0].id;

   
    // Generate OTP
    const otp = generateOTP();
    const expiryTime = new Date(
      Date.now() + parseInt(process.env.OTP_EXPIRY || 600000)
    ); // 10 minutes

    // Store OTP in database
    await query(
      "INSERT INTO otps (user_id, email, otp, type, expires_at) VALUES (?, ?, ?, ?, ?)",
      [userId, email, otp, "password_reset", expiryTime]
    );

    // Send password reset email
    await sendPasswordResetEmail(email, otp);

    // Log password reset request
    await logAuthEvent(
      userId,
      "password_reset_request",
      "Password reset requested",
      req
    );

    return res.status(200).json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error requesting password reset",
    });
  }
};

// Verify password reset OTP
const verifyPasswordResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;


    // Check if OTP exists and is valid
    const otpRecord = await query(
      "SELECT * FROM otps WHERE email = ? AND otp = ? AND type = ? AND expires_at > NOW()",
      [email, otp, "password_reset"]
    );

    if (!otpRecord || otpRecord.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error verifying OTP",
    });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    // Check if OTP exists and is valid
    const otpRecord = await query(
      "SELECT * FROM otps WHERE email = ? AND otp = ? AND type = ? AND expires_at > NOW()",
      [email, otp, "password_reset"]
    );

    if (!otpRecord || otpRecord.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    const userId = otpRecord[0].user_id;

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update password
    await query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      userId,
    ]);

    // Delete used OTP
    await query("DELETE FROM otps WHERE id = ?", [otpRecord[0].id]);

    // Log password reset success
    await logAuthEvent(
      userId,
      "password_reset_success",
      "Password reset successfully",
      req
    );
    await pushNotification(userId, "password_reset", "Your password has been successfully reset");

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error resetting password",
    });
  }
};

export { requestPasswordReset, verifyPasswordResetOTP, resetPassword };
