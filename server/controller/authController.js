/**
 * Authentication Controller
 * Enhanced version with multiple session support
 */

import { register } from "./auth-register.js";
import { login } from "./auth-login.js";
import {
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetPassword,
} from "./auth-password.js";
import {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  disableTwoFactor,
  verifyTwoFactor,
  disableTwoFactorRequest,
} from "./auth-2fa.js";
import { query } from "../database/db.js";
import { logAuthEvent } from "../utils/logger.js";
import { generateOTP, generateAccessToken, generateRefreshToken } from "../utils/auth.js";
import { sendVerificationEmail } from "../utils/email.js";
import jwt from "jsonwebtoken";

// Email verification
const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Check if OTP exists and is valid
    const otpRecord = await query(
      "SELECT * FROM otps WHERE email = ? AND otp = ? AND type = ? AND expires_at > NOW()",
      [email, otp, "email_verification"]
    );

    if (!otpRecord || otpRecord.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    const userId = otpRecord[0].user_id;

    // Update user's email verification status
    await query("UPDATE users SET email_verified = TRUE WHERE id = ?", [
      userId,
    ]);

    // Delete used OTP
    await query("DELETE FROM otps WHERE id = ?", [otpRecord[0].id]);

    // Log email verification event
    await logAuthEvent(
      userId,
      "email_verification",
      "Email verified successfully",
      req
    );

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error verifying email",
    });
  }
};

// Resend verification email
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists and is not verified
    const user = await query(
      "SELECT id, email_verified FROM users WHERE email = ?",
      [email]
    );

    if (!user || user.length === 0) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: "User not found",
      });
    }

    if (user[0].email_verified) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: "Email is already verified",
      });
    }

    const userId = user[0].id;

    // Delete any existing OTPs for this user
    await query("DELETE FROM otps WHERE user_id = ? AND type = ?", [
      userId,
      "email_verification",
    ]);

    // Generate new OTP
    const otp = generateOTP();
    const expiryTime = new Date(
      Date.now() + parseInt(process.env.OTP_EXPIRY || 120000)
    ); // 2 minutes

    // Store OTP in database
    await query(
      "INSERT INTO otps (user_id, email, otp, type, expires_at) VALUES (?, ?, ?, ?, ?)",
      [userId, email, otp, "email_verification", expiryTime]
    );

    // Send verification email
    await sendVerificationEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: "Verification email resent successfully",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error resending verification email",
    });
  }
};

// Enhanced refresh token to work with sessions
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "Refresh token is required"
      });
    }

    // Verify refresh token and check if session is active
    const [session] = await query(
      `SELECT s.*, u.id as user_id, u.email, u.username, u.role_id
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.refresh_token = ? AND s.is_active = true AND s.expires_at > NOW()`,
      [token]
    );

    if (!session) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "Invalid or expired session"
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      id: session.user_id,
      email: session.email,
      username: session.username,
      role_id: session.role_id
    });

    // Update session last activity
    await query(
      'UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?',
      [session.id]
    );

    // Log refresh activity
    await query(
      'INSERT INTO session_activities (session_id, activity_type, ip_address) VALUES (?, ?, ?)',
      [session.id, 'refresh', req.ip]
    );

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 1000 // 1 hour
    });

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully"
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return res.status(200).json({
      status: 'error',
      success: false,
      message: "Invalid refresh token"
    });
  }
};

// Enhanced logout to handle multiple sessions
const logout = async (req, res) => {
  try {
    const userId = req.user;
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      // Deactivate the current session
      await query(
        `UPDATE user_sessions 
         SET is_active = false 
         WHERE refresh_token = ? AND user_id = ?`,
        [refreshToken, userId]
      );

      // Log session activity
      const [session] = await query(
        'SELECT id FROM user_sessions WHERE refresh_token = ?',
        [refreshToken]
      );

      if (session) {
        await query(
          'INSERT INTO session_activities (session_id, activity_type, ip_address) VALUES (?, ?, ?)',
          [session.id, 'logout', req.ip]
        );
      }
    }

    // Clear cookies and session
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    req.session.destroy();

    return res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error during logout"
    });
  }
};

const logoutcurrent = async (req, res) => {

  const userID = req.user;

  if (userID) {


    // Log logout event
    await logAuthEvent(userID, "logout", "User logged out", req);


    // Clear session
    req.session.destroy();

    res.clearCookie('SSID', { path: '/' });
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
  }
  return res.status(200).json({
    success: true,
    message: "Logout successful",
  });
};


// Helper: Check if user is authenticated (for frontend)
const getCurrentUser = async (req, res) => {
  try {
    // // 1. Get access token from cookie


    const token = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;



    let decoded;
    let checkToken = false;




    if (!token && !refreshToken) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: "Unauthorized",
      });
    }

    if (token) {
      checkToken = true;
    }

    if (refreshToken) {

      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: "Invalid or expired token",
        });
      }

      // 3. Fetch user from database
      const userRows = await query("SELECT * FROM users WHERE id = ?", [
        decoded.id,
      ]);
      if (!userRows || userRows.length === 0) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: "Error looks like ***",
        });
      }

      // 4. Remove sensitive fields
      const { id, email, username, role_id } = userRows[0];
      const safeUser = { id, email, username, role_id };
      const user = { id, email, username };


      if (!checkToken) {
        const newToken = generateAccessToken(user);


        res.cookie('accessToken', newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Strict',
          maxAge: 15 * 60 * 1000 // 15 minutes
        });
      }

      // 5. Return user info
      return res.status(200).json({
        success: true,
        user: safeUser,
      });



    } else if (token) {

      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);

      } catch (err) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: "Invalid or expired token",
        });
      }

      // 3. Fetch user from database
      const userRows = await query("SELECT * FROM users WHERE id = ?", [
        decoded.id,
      ]);
      if (!userRows || userRows.length === 0) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: "Error looks like ***",
        });
      }

      // 4. Remove sensitive fields
      const { id, email, username, role_id } = userRows[0];
      const safeUser = { id, email, username, role_id };


      // 5. Return user info
      return res.status(200).json({
        success: true,
        user: safeUser,
      });
    }





  } catch (error) {
    console.error("getCurrentUser error:", error);
    return res.status(200).json({
      status: 'error',
      success: false,
      message: "Server error",
    });
  }

};


// Optional: Expose Google/Facebook OAuth tokens (for advanced use/debugging)
// Only works if you store them in req.session during the OAuth callback
const getOAuthTokens = (req, res) => {
  if (req.session && req.session.oauthTokens) {
    return res
      .status(200)
      .json({ success: true, tokens: req.session.oauthTokens });
  }
  res.status(200).json({ status: 'error', success: false, message: "No OAuth tokens found" });
};

// Get all active sessions for current user
const getUserSessions = async (req, res) => {
  try {
    const userId = req.user;
    const currentRefreshToken = req.cookies?.refreshToken;
    const SSID = req.cookies?.SSID;

    const sessions = await query(
      `SELECT s.*, sa.created_at as last_activity
       FROM user_sessions s
       LEFT JOIN (
           SELECT session_id, MAX(created_at) as created_at
           FROM session_activities
           GROUP BY session_id
       ) sa ON s.id = sa.session_id
       WHERE s.user_id = ? AND s.is_active = true
       ORDER BY sa.created_at DESC`,
      [userId]
    );


    // Format sessions for frontend
    const formattedSessions = sessions.map(session => ({
      id: session.id,
      deviceInfo: JSON.parse(session.device_info),
      ipAddress: session.ip_address,
      lastActivity: session.last_activity || session.created_at,
      isCurrentSession: session.refresh_token === currentRefreshToken || session.SSID === SSID,
      createdAt: session.created_at,
      expiresAt: session.expires_at
    }));



    return res.status(200).json({
      success: true,
      sessions: formattedSessions
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    return res.status(200).json({
      status: 'error',
      success: false,
      message: "Error fetching sessions"
    });
  }
};

// Revoke a specific session
const revokeSession = async (req, res) => {
  try {
    const userId = req.user;
    const { sessionId } = req.params;
    const SSID = req.cookies?.SSID;

    // Get current session's refresh token
    const currentRefreshToken = req.cookies?.refreshToken;

    // Get session details
    const [session] = await query(
      'SELECT * FROM user_sessions WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    );

    if (!session) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: "Session not found"
      });
    }




    // Deactivate the session
    await query(
      'UPDATE user_sessions SET is_active = false WHERE id = ?',
      [sessionId]
    );

    // Log session activity
    await query(
      'INSERT INTO session_activities (session_id, activity_type, ip_address) VALUES (?, ?, ?)',
      [sessionId, 'revoked', req.ip]
    );



    if (session.refresh_token === currentRefreshToken) {
      res.clearCookie('refreshToken');
      res.clearCookie('accessToken');
      res.clearCookie('SSID');
    }

    if (session.SSID === SSID) {
      res.clearCookie('refreshToken');
      res.clearCookie('accessToken');
      res.clearCookie('SSID');
    }

    return res.status(200).json({
      success: true,
      message: "Session revoked successfully"
    });
  } catch (error) {
    console.error("Session revocation error:", error);
    return res.status(200).json({
      status: 'error',
      success: false,
      message: "Error revoking session"
    });
  }
};

// Revoke all other sessions
const revokeAllOtherSessions = async (req, res) => {
  try {
    const userId = req.user;
    const currentRefreshToken = req.cookies?.refreshToken;

    // Get all active sessions except current
    const sessions = await query(
      'SELECT id FROM user_sessions WHERE user_id = ? AND refresh_token != ? AND is_active = true',
      [userId, currentRefreshToken]
    );

    // Deactivate all other sessions
    await query(
      'UPDATE user_sessions SET is_active = false WHERE user_id = ? AND refresh_token != ?',
      [userId, currentRefreshToken]
    );

    // Log activity for each revoked session
    for (const session of sessions) {
      await query(
        'INSERT INTO session_activities (session_id, activity_type, ip_address) VALUES (?, ?, ?)',
        [session.id, 'revoked', req.ip]
      );
    }

    return res.status(200).json({
      success: true,
      message: "All other sessions revoked successfully"
    });
  } catch (error) {
    console.error("Session revocation error:", error);
    return res.status(200).json({
      status: 'error',
      success: false,
      message: "Error revoking sessions"
    });
  }
};

export {
  register,
  verifyEmail,
  resendVerification,
  login,
  verifyTwoFactor,
  refreshToken,
  logout,
  requestPasswordReset,
  verifyPasswordResetOTP,
  resetPassword,
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  disableTwoFactor,
  getCurrentUser,
  getOAuthTokens,
  disableTwoFactorRequest,
  logoutcurrent,
  // New session management functions
  getUserSessions,
  revokeSession,
  revokeAllOtherSessions
};
