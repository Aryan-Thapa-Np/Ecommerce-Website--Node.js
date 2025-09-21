/**
 * Logger Utility
 * Handles audit logging and security event tracking
 */

import { query } from '../database/db.js';

// Log security events to database
const logSecurityEvent = async (userId, eventType, description, req) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    await query(
      'INSERT INTO audit_logs (user_id, event_type, description, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [userId, eventType, description, ipAddress, userAgent]
    );
    
    return true;
  } catch (error) {
    console.error('Error logging security event:', error);
    return false;
  }
};

// Log authentication events
const logAuthEvent = async (userId, eventType, description, req) => {
  const authEvents = [
    'login_success',
    'login_failure',
    'logout',
    'password_reset_request',
    'password_reset_success',
    'account_locked',
    'account_unlocked',
    'email_verification',
    '2fa_enabled',
    '2fa_disabled',
    '2fa_verification_success',
    '2fa_verification_failure'
  ];
  
  if (authEvents.includes(eventType)) {
    return await logSecurityEvent(userId, eventType, description, req);
  }
  
  return false;
};

// Log account status changes
const logAccountStatusChange = async (userId, oldStatus, newStatus, reason, adminId, req) => {
  const description = `Account status changed from ${oldStatus} to ${newStatus}${reason ? ` - Reason: ${reason}` : ''}${adminId ? ` - By admin ID: ${adminId}` : ''}`;
  
  return await logSecurityEvent(userId, 'account_status_change', description, req);
};

// Log profile updates
const logProfileUpdate = async (userId, fieldChanged, req) => {
  const description = `Profile updated - Field changed: ${fieldChanged}`;
  
  return await logSecurityEvent(userId, 'profile_update', description, req);
};

// Log failed login attempts
const logLoginAttempt = async (email, success, reason, req) => {
  try {
    // Get user ID if available
    let userId = null;
    if (email) {
      const user = await query('SELECT id FROM users WHERE email = ?', [email]);
      if (user && user.length > 0) {
        userId = user[0].id;
      }
    }
    
    const eventType = success ? 'login_success' : 'login_failure';
    const description = success 
      ? 'Successful login' 
      : `Failed login attempt${reason ? ` - Reason: ${reason}` : ''}`;
    
    await logSecurityEvent(userId, eventType, description, req);
    
    // If login failed and user exists, increment login attempts
    if (!success && userId) {
      await query(
        'UPDATE users SET login_attempts = login_attempts + 1, last_login_attempt = CURRENT_TIMESTAMP WHERE id = ?',
        [userId]
      );
      
      // Check if account should be locked
      const user = await query(
        'SELECT login_attempts FROM users WHERE id = ?',
        [userId]
      );
      
      if (user && user.length > 0 && user[0].login_attempts >= parseInt(process.env.MAX_LOGIN_ATTEMPTS || 5)) {
        // Lock account
        await query(
          'UPDATE users SET account_status = "locked", account_status_reason = "Too many failed login attempts", account_status_expiry = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND) WHERE id = ?',
          [parseInt(process.env.ACCOUNT_LOCK_DURATION || 1800) / 1000, userId]
        );
        
        // Log account lock event
        await logSecurityEvent(userId, 'account_locked', 'Account locked due to too many failed login attempts', req);
      }
    }
    
    // If login succeeded, reset login attempts
    if (success && userId) {
      await query(
        'UPDATE users SET login_attempts = 0, last_login_attempt = NULL WHERE id = ?',
        [userId]
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error logging login attempt:', error);
    return false;
  }
};

// Log session activity
const logSessionActivity = async (sessionId, activityType, req) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    await query(
      'INSERT INTO session_activities (session_id, activity_type, ip_address) VALUES (?, ?, ?)',
      [sessionId, activityType, ipAddress]
    );
    
    return true;
  } catch (error) {
    console.error('Error logging session activity:', error);
    return false;
  }
};

export {
  logSecurityEvent,
  logAuthEvent,
  logAccountStatusChange,
  logProfileUpdate,
  logLoginAttempt,
  logSessionActivity
};