/**
 * Custom CSRF Protection Middleware
 * Provides protection against Cross-Site Request Forgery attacks
 */

import crypto from 'crypto';
import { query } from '../database/db.js';

// Generate a secure random token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Middleware to verify CSRF token
const verifyCsrf = async (req, res, next) => {
  try {
    // Skip CSRF check for GET requests
    if (req.method === 'GET') {
      return next();
    }

    const rawHeader = req.headers['x-csrf-token'];
    let csrfToken;

 

    if (rawHeader && rawHeader.startsWith('bearer')) {
      csrfToken = rawHeader.split(' ')[1];
    } else {
      csrfToken = rawHeader;
    }

    const SSID = req.sessionID;
    const refreshToken = req.cookies?.refreshToken;
   

    if (!csrfToken || (!SSID && !refreshToken)) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Invalid  CSRF token, please refresh the page and try again.',
      });
    }

  

    let rows;
    if (refreshToken) {
      // Get user ID from active session
      const [session] = await query(
        'SELECT user_id FROM user_sessions WHERE refresh_token = ? AND is_active = true',
        [refreshToken]
      );

      if (!session) {
        return res.status(200).json({
          status: 'error',
          success: false,
          message: 'Invalid or expired session.',
        });
      }

      // For authenticated users, check both user_id and SSID
      rows = await query(
        'SELECT * FROM csrf_tokens WHERE token = ? AND (user_id = ? OR SSID = ?) AND expires_at > NOW()',
        [csrfToken, session.user_id, SSID]
      );
    } else {
      // For guest users, only check SSID
      rows = await query(
        'SELECT * FROM csrf_tokens WHERE token = ? AND SSID = ? AND user_id IS NULL AND expires_at > NOW()',
        [csrfToken, SSID]
      );
    }

    if (rows.length === 0) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Invalid or expired CSRF token.',
      });
    }

  

    // Token is valid; proceed to the next middleware
    next();
  } catch (error) {
   
    return res.status(200).json({
      status: 'error',
      success: false,
      message: 'Server error during CSRF verification.',
    });
  }
};

// Endpoint to generate and return a CSRF token
const getCsrf = async (req, res) => {
  try {
    const SSID = req.sessionID;
    const refreshToken = req.cookies?.refreshToken;

    if (!SSID) {
      return res.status(401).json({
        status: 'error',
        success: false,
        message: 'Invalid session.',
      });
    }

    const csrfToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Token expires in 24 hours

    let userId = null;
    if (refreshToken) {
      // If user is logged in, get their user_id from the session
      const [session] = await query(
        'SELECT user_id FROM user_sessions WHERE refresh_token = ? AND is_active = true',
        [refreshToken]
      );
      if (session) {
        userId = session.user_id;
      }
    }

    // Delete any existing tokens for this session/user
    if (userId) {
      await query('DELETE FROM csrf_tokens WHERE user_id = ? OR SSID = ?', [userId, SSID]);
    } else {
      await query('DELETE FROM csrf_tokens WHERE SSID = ? AND user_id IS NULL', [SSID]);
    }

    // Insert new token
    const result = await query(
      'INSERT INTO csrf_tokens (token, SSID, user_id, expires_at) VALUES (?, ?, ?, ?)',
      [csrfToken, SSID, userId, expiresAt]
    );

    if (!result || result.affectedRows === 0) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Failed to store CSRF token.',
      });
    }

    return res.status(200).json({
      success: true,
      token: csrfToken,
    });
  } catch (error) {
    console.error('CSRF generation error:', error);
    return res.status(200).json({
      status: 'error',
      success: false,
      message: 'Server error during CSRF token generation.',
    });
  }
};

export {
  verifyCsrf,
  generateToken,
  getCsrf
};