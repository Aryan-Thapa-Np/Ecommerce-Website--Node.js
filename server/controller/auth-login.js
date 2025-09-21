/**
 * Authentication Controller - Login Function
 * Enhanced version with multiple session support
 */

import { query } from "../database/db.js";
import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  generateOTP,
} from "../utils/auth.js";

import { sendTwoFactorEmail } from "../utils/email.js";
import { logLoginAttempt } from "../utils/logger.js";

// Login user
const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const SSID = req.cookies?.SSID;

    // Find user by email
    const users = await query(
      `SELECT u.*, r.name as role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ?`,
      [email]
    );

    if (!users || users.length === 0) {
      await logLoginAttempt(email, false, "User not found", req);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    // Check account status
    if (user.account_status !== 'active') {
      if (user.account_status_expiry && new Date(user.account_status_expiry) < new Date()) {
        // Reactivate account if lock/suspension period has expired
        await query(
          'UPDATE users SET account_status = "active", account_status_reason = NULL, account_status_expiry = NULL WHERE id = ?',
          [user.id]
        );
      } else {
        await logLoginAttempt(email, false, `Account ${user.account_status}`, req);
        return res.status(200).json({
          status: "error",
          success: false,
          message: `Account is ${user.account_status}. Reason: ${user.account_status_reason}`,
          status: user.account_status,
          expiry: user.account_status_expiry
        });
      }
    }

    // Verify password
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      await logLoginAttempt(email, false, "Invalid password", req);
      return res.status(200).json({
        status: "error",
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check if email is verified
    if (!user.email_verified) {
      const otp = generateOTP();
      const expiryTime = new Date(Date.now() + 2 * 60000); // 2 minutes

      await query(
        "INSERT INTO otps (user_id, email, otp, type, expires_at) VALUES (?, ?, ?, ?, ?)",
        [user.id, user.email, otp, "email_verification", expiryTime]
      );

      // Send verification email here
      return res.status(200).json({
        status: "error",
        success: false,
        message: "Please verify your email before logging in",
        requiresEmailVerification: true
      });
    }

    // Handle 2FA if enabled
    if (user.two_factor_enabled) {
      if (user.two_factor_method === "email") {
        const otp = generateOTP();
        const expiryTime = new Date(Date.now() + 5 * 60000); // 5 minutes

        await query(
          "INSERT INTO otps (user_id, email, otp, type, expires_at) VALUES (?, ?, ?, ?, ?)",
          [user.id, user.email, otp, "two_factor", expiryTime]
        );

        await sendTwoFactorEmail(user.email, otp);
      }

      return res.status(200).json({
        success: true,
        message: "Two-factor authentication required",
        requiresTwoFactor: true,
        twoFactorMethod: user.two_factor_method
      });
    }

    // Get device information
    const deviceInfo = {
      deviceType: req.headers['sec-ch-ua-mobile'] === '?1' ? 'mobile' : 'desktop',
      browser: req.headers['user-agent'],
      os: req.headers['sec-ch-ua-platform'] || 'unknown'
    };

    // Generate tokens
    const accessToken = generateAccessToken(user);


    // Calculate session expiry
    const sessionExpiry = new Date();
    let refToken = null;
    if (rememberMe) {
      refToken = generateRefreshToken(user);
      sessionExpiry.setDate(sessionExpiry.getDate() + 7); // 7 days
    } else {
      sessionExpiry.setMinutes(sessionExpiry.getMinutes() + 15); // 15 minutes
    }

    await query("DELETE FROM user_sessions WHERE SSID = ?", [req.cookies?.SSID]);


    const sessionResult = await query(
      `INSERT INTO user_sessions (
      user_id, refresh_token, device_info, ip_address,
      expires_at, remember_me, SSID
    ) VALUES (?, ?, ?, ?, ?, ?,?)`,
      [
        user.id,
        refToken,
        JSON.stringify(deviceInfo),
        req.ip,
        sessionExpiry,
        rememberMe,
        SSID
      ]
    );

    // Log session activity
    await query(
      'INSERT INTO session_activities (session_id, activity_type, ip_address) VALUES (?, ?, ?)',
      [sessionResult.insertId, 'login', req.ip]
    );

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    if (rememberMe) {
      res.cookie('refreshToken', refToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      });
    }

    // Log successful login
    await logLoginAttempt(email, true, null, req);

    // Get active sessions count
    const [{ count }] = await query(
      'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ? AND is_active = true',
      [user.id]
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      redirect: '/',
      activeSessions: count
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(200).json({
      status: "error",
      success: false,
      message: "Error during login"
    });
  }
};

export { login };
