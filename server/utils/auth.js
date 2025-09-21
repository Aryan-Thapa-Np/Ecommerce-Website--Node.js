/**
 * Authentication Utilities
 * Provides functions for JWT, password hashing, and OTP generation
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';


// Generate JWT access token
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      id: user.id,
      email: user.email,
      username: user.username
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
};

// Generate JWT refresh token
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
};

// Hash password using bcrypt
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password with hashed password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate a 6-digit OTP
const generateOTP = () => {
  // Generate a random 6-digit number
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate secret for 2FA
const generateTwoFactorSecret = () => {
  return speakeasy.generateSecret({
    name: process.env.APP_NAME || 'SecureAuthSystem'
  });
};

// Generate QR code for 2FA
const generateQRCode = async (secret, email) => {
  const otpauth = speakeasy.otpauthURL({
    secret: secret.ascii,
    label: email,
    issuer: process.env.APP_NAME || 'SecureAuthSystem',
    algorithm: 'sha1'
  });
  
  return await qrcode.toDataURL(otpauth);
};

// Verify 2FA token
const verifyTwoFactorToken = (token, secret) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1 // Allow 1 time step before/after for clock drift
  });
};

// Generate a secure random token
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

export {
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
  generateOTP,
  generateTwoFactorSecret,
  generateQRCode,
  verifyTwoFactorToken,
  generateSecureToken
};