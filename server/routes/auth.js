/**
 * Authentication Routes
 * Handles all authentication-related endpoints
 */

import express from "express";
const router = express.Router();
import {
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
  disableTwoFactorRequest,
  getOAuthTokens,
  logoutcurrent,
  // Add new session management functions
  getUserSessions,
  revokeSession,
  revokeAllOtherSessions
} from "../controller/authController.js";
import { sendTwoFactorEmail } from "../utils/email.js";
import {
  registerValidation,
  loginValidation,
  passwordResetRequestValidation,
  otpValidation,
  passwordUpdateValidation,
  twoFactorSetupValidation,
  twoFactorVerifyValidation,
} from "../middleware/validator.js";
import { verifyToken } from "../middleware/auth.js";
import { query } from "../database/db.js";
import { getCsrf, verifyCsrf } from "../middleware/csrf.js";
import {
  loginRateLimit,
  registerRateLimit,
  otpRateLimit,
} from "../middleware/rateLimit.js";

import { generateAccessToken, generateOTP, generateRefreshToken } from "../utils/auth.js";
import passport from "passport";



// Get current authenticated user (for frontend)

router.get("/authenticate-me", getCurrentUser);

// Apply CSRF protection to all routes
router.use(verifyCsrf);

// CSRF token initialization
router.get("/get-csrf", getCsrf);

// Registration and email verification
router.post(
  "/register",
  registerRateLimit,
  verifyCsrf,
  registerValidation,
  register
);
router.post("/verify-email", otpRateLimit, otpValidation, verifyEmail);
router.post("/resend-verification", otpRateLimit, resendVerification);

// Login and authentication
router.post("/login", loginRateLimit, loginValidation, login);

router.post(
  "/verify-2fa",
  twoFactorVerifyValidation,
  verifyCsrf,
  verifyTwoFactor
);

router.post("/refresh-token", refreshToken);
router.post("/logout", verifyToken, logout);
router.post("/logoutcurrent", verifyToken, logoutcurrent);

// Password reset
router.post(
  "/password-reset-request",
  otpRateLimit,
  passwordResetRequestValidation,
  requestPasswordReset
);
router.post(
  "/verify-password-reset",
  otpRateLimit,
  otpValidation,
  verifyPasswordResetOTP
);
router.post(
  "/reset-password",
  otpRateLimit,
  passwordUpdateValidation,
  resetPassword
);

// 2FA setup (requires authentication)
router.post(
  "/2fa/setup",
  verifyToken,
  verifyCsrf,
  twoFactorSetupValidation,
  setupTwoFactor
);
router.post(
  "/2fa/verify",
  verifyToken,
  verifyCsrf,
  twoFactorVerifyValidation,
  verifyAndEnableTwoFactor
);
router.post("/2fa/disable-request", verifyToken, verifyCsrf, disableTwoFactorRequest);
router.get("/2fa/disable", disableTwoFactor);

// Session Management Routes (Protected)
router.get("/sessions", verifyToken, getUserSessions);
router.delete("/sessions/:sessionId", verifyToken, revokeSession);
router.delete("/sessions", verifyToken, revokeAllOtherSessions);

// --- OAuth routes (Google & Facebook) ---

// Google OAuth
router.get(
  "/oauth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/oauth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: true,
  }),
  async (req, res) => {
    try {
      // Store Google tokens if needed
      if (req.authInfo && req.authInfo.tokens) {
        req.session.oauthTokens = req.authInfo.tokens;

      }

      const accessToken = generateAccessToken(req.user);
      const refreshToken = generateRefreshToken(req.user);
    

     

      // Handle 2FA if enabled
      if (req.user.two_factor_enabled) {
        if (req.user.two_factor_method === "email") {
          const otp = generateOTP();
          const expiryTime = new Date(Date.now() + 5 * 60000); // 5 minutes

          await query(
            "INSERT INTO otps (user_id, email, otp, type, expires_at) VALUES (?, ?, ?, ?, ?)",
            [req.user.id, req.user.email, otp, "two_factor", expiryTime]
          );

          await sendTwoFactorEmail(req.user.email, otp);
        }

        return res.redirect("/login?requiresTwoFactor=true&email=" + req.user.email + "&twoFactorMethod=" + req.user.two_factor_method + "&rememberMe=" + true);
      }



      // Create new session
      const deviceInfo = {
        deviceType: 'browser',
        browser: req.headers['user-agent'],
        os: req.headers['sec-ch-ua-platform'] || 'unknown'
      };

      const sessionExpiry = new Date();
      sessionExpiry.setDate(sessionExpiry.getDate() + 7); // 7 days

    
      await query(
        `INSERT INTO user_sessions (
          user_id, refresh_token, device_info, ip_address,
          expires_at, remember_me,SSID
        ) VALUES (?, ?, ?, ?, ?, ?,?)`,
        [
          req.user.id,
          refreshToken,
          JSON.stringify(deviceInfo),
          req.ip,
          sessionExpiry,
          true,
          req.cookies?.SSID
        ]
      );
      
     
   


      // Set cookies
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      });


      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
   
      res.redirect("/user/dashboard");
    } catch (error) {
    
      res.redirect("/login?error=oauth_failed");
    }
  }
);

// (Optional) Route to get OAuth tokens for debugging/advanced use
// router.get("/oauth-tokens", getOAuthTokens);

export default router;
