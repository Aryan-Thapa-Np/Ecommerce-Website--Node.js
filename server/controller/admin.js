/**
 * Admin Controller
 * Handles admin-specific operations for user management
 */

import { query, pool } from '../database/db.js';
import { logAccountStatusChange } from '../utils/logger.js';
import { sendAccountStatusEmail } from '../utils/email.js';
import { hashPassword } from '../utils/auth.js';

// Get all users with pagination and filtering
export const getAllUsers = async (req, res) => {
  try {
    const users = await query(
      `SELECT u.id, u.email, u.username, r.name as role, u.account_status, 
      u.email_verified, u.two_factor_enabled, u.two_factor_method, 
      u.two_factor_secret, u.login_attempts, u.last_login_attempt,
      u.account_status_reason, u.account_status_expiry, u.provider, 
      u.provider_id, u.created_at, u.updated_at,
      up.first_name, up.last_name, up.phone, up.address, up.city, 
      up.state, up.country, up.postal_code, up.profile_image
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      ORDER BY u.created_at DESC`
    );

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to fetch users' });
  }
};

// Create a new user
export const createUser = async (req, res) => {
  const { email, username, password, role } = req.body;

  try {
    // Check if email already exists
    const existingUser = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(200).json({ status: "error", success: false, message: 'Email already exists' });
    }

    // Get role_id from role name
    const roleResult = await query('SELECT id FROM roles WHERE name = ?', [role]);
    if (roleResult.length === 0) {
      return res.status(200).json({ status: "error", success: false, message: 'Invalid role' });
    }
    const roleId = roleResult[0].id;

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert new user
    const result = await query(
      `INSERT INTO users (email, username, password, role_id, account_status, email_verified) 
       VALUES (?, ?, ?, ?, 'active', false)`,
      [email, username, hashedPassword, roleId]
    );

    res.json({ status: 'success', userId: result.insertId });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to create user' });
  }
};

// Toggle email verification status
export const toggleEmailVerification = async (req, res) => {
  const { id } = req.params;
  const { verified } = req.body;

  try {
    await query('UPDATE users SET email_verified = ? WHERE id = ?', [verified, id]);

    // Log the change
    await logAccountStatusChange(id, `Email verification ${verified ? 'enabled' : 'disabled'}`);

    res.json({ status: 'success' });
  } catch (error) {
    console.error('Error toggling email verification:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to update email verification' });
  }
};

// Toggle 2FA status
export const toggle2FA = async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;

  try {
    await query(
      'UPDATE users SET two_factor_enabled = ?, two_factor_method = ? WHERE id = ?',
      [enabled, enabled ? 'authenticator' : null, id]
    );

    // Log the change
    await logAccountStatusChange(id, `2FA ${enabled ? 'enabled' : 'disabled'}`);

    res.json({ status: 'success' });
  } catch (error) {
    console.error('Error toggling 2FA:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to update 2FA status' });
  }
};

// Change user role
export const changeUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    // Get role_id from role name
    const roleResult = await query('SELECT id FROM roles WHERE name = ?', [role]);
    if (roleResult.length === 0) {
      return res.status(200).json({ status: "error", success: false, message: 'Invalid role' });
    }
    const roleId = roleResult[0].id;

    await query('UPDATE users SET role_id = ? WHERE id = ?', [roleId, id]);

    // Log the change
    await logAccountStatusChange(id, `Role changed to ${role}`);

    res.json({ status: 'success' });
  } catch (error) {
    console.error('Error changing role:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to update role' });
  }
};


// Update user status (active, suspended, banned, locked)
export const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status, reason, duration } = req.body;

  // Validate status
  const validStatuses = ['active', 'suspended', 'banned', 'locked'];
  if (!validStatuses.includes(status)) {
    return res.status(200).json({ status: "error", success: false, message: 'Invalid account status' });
  }

  try {
    let statusExpiry = null;

    // Handle duration for different statuses
    if (duration && parseInt(duration) > 0) {
      statusExpiry = new Date();
      statusExpiry.setDate(statusExpiry.getDate() + parseInt(duration));
    }

    // Update user status
    await query(
      'UPDATE users SET account_status = ?, account_status_reason = ?, account_status_expiry = ? WHERE id = ?',
      [status, reason || null, statusExpiry, id]
    );

    // Log the change
    await logAccountStatusChange(id, `${status.charAt(0).toUpperCase() + status.slice(1)} ${reason ? `Reason: ${reason}` : ''}${duration ? ` for ${duration} days` : ''}`);

    // Send email notification
    const user = await query('SELECT email FROM users WHERE id = ?', [id]);
    if (user.length > 0) {
      await sendAccountStatusEmail(user[0].email, status, { reason, duration });
    }

    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Error updating user status to ${status}:`, error);
    res.status(200).json({ status: "error", success: false, message: `Failed to update user status to ${status}` });
  }
};

// For backward compatibility, keep suspendUser as a wrapper
export const suspendUser = async (req, res) => {
  req.body.status = 'suspended';
  return updateUserStatus(req, res);
};

// ========================================
// ACTIVE SUBSCRIPTION MANAGEMENT
// ========================================

// Get all active subscriptions
export const getActiveSubscriptions = async (req, res) => {
  try {
    const { search, sort_by = 'end_date', sort_order = 'ASC', page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = `
        WHERE u.username LIKE ? 
        OR u.email LIKE ? 
        OR s.name LIKE ? 
        OR sp.plan_name LIKE ?
      `;
      const searchTerm = `%${search}%`;
      params = [searchTerm, searchTerm, searchTerm, searchTerm];
    }

    // Get total count for pagination
    const [countResult] = await query(`
      SELECT COUNT(*) as total 
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      JOIN subscription_plans sp ON us.subscription_plan_id = sp.id
      JOIN subscriptions s ON sp.subscription_id = s.id
      ${whereClause}
    `, params);

    // Valid columns for sorting
    const validSortColumns = ['end_date', 'start_date', 'username', 'subscription_name'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'end_date';

    // Mapping of sort columns to actual DB columns
    const sortColumnMap = {
      'end_date': 'us.end_date',
      'start_date': 'us.start_date',
      'username': 'u.username',
      'subscription_name': 's.name'
    };

    // Get subscriptions with pagination and sorting
    const subscriptions = await query(`
      SELECT 
        us.id,
        us.user_id,
        us.subscription_plan_id,
        us.start_date,
        us.end_date,
        us.status,
        us.auto_renew,
        us.subscription_email,
        us.subscription_password,
        us.subscription_pin,
        us.notes,
        u.username,
        u.email as user_email,
        s.name as subscription_name,
        s.logo_url,
        sp.plan_name,
        sp.price,
        sp.currency,
        sp.billing_cycle,
        DATEDIFF(us.end_date, CURDATE()) as days_left
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      JOIN subscription_plans sp ON us.subscription_plan_id = sp.id
      JOIN subscriptions s ON sp.subscription_id = s.id
      ${whereClause}
      ORDER BY ${sortColumnMap[sortColumn]} ${sort_order === 'DESC' ? 'DESC' : 'ASC'}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    res.json({
      status: 'success',
      data: subscriptions,
      pagination: {
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(countResult.total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching active subscriptions:', error);
      res.status(200).json({ status: "error", success: false, message: 'Failed to fetch active subscriptions' });
  }
};

// Get a single active subscription by ID
export const getActiveSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;

  

    const [subscription] = await pool.execute(`
      SELECT 
        us.id,
        us.user_id,
        us.subscription_plan_id,
        us.start_date,
        us.end_date,
        us.status,
        us.auto_renew,
        us.subscription_email,
        us.subscription_password,
        us.subscription_pin,
        us.notes,
        u.username,
        u.email as user_email,
        s.name as subscription_name,
        s.logo_url,
        sp.plan_name,
        sp.price,
        sp.currency,
        sp.billing_cycle,
        DATEDIFF(us.end_date, CURDATE()) as days_left
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      JOIN subscription_plans sp ON us.subscription_plan_id = sp.id
      JOIN subscriptions s ON sp.subscription_id = s.id
      WHERE us.user_id = ?
    `, [id]);

    

    if (!subscription) {
      return res.status(200).json({ status: "error", success: false, message: 'Subscription not found' });
    }

    res.json({
      status: 'success',
      data: subscription
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to fetch subscription details' });
  }
};

// Create a new active subscription
export const createActiveSubscription = async (req, res) => {
  try {
    const {
      user_id,
      subscription_plan_id,
      start_date,
      end_date,
      status = 'active',
      auto_renew = false,
      subscription_email,
      subscription_password,
      subscription_pin,
      notes
    } = req.body;

    // Validate required fields
    if (!user_id || !subscription_plan_id || !start_date || !end_date) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'User ID, subscription plan ID, start date, and end date are required'
      });
    }

    // Validate user exists
    const [userExists] = await query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (!userExists) {
      return res.status(200).json({ status: "error", success: false, message: 'User not found' });
    }

    // Validate subscription plan exists
    const [planExists] = await query('SELECT id FROM subscription_plans WHERE id = ?', [subscription_plan_id]);
    if (!planExists) {
      return res.status(200).json({ status: "error", success: false, message: 'Subscription plan not found' });
    }

    // Insert new subscription
    const result = await query(
      `INSERT INTO user_subscriptions (
        user_id, subscription_plan_id, start_date, end_date, 
        status, auto_renew, subscription_email, subscription_password, 
        subscription_pin, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        user_id, subscription_plan_id, start_date, end_date,
        status, auto_renew, subscription_email, subscription_password,
        subscription_pin, notes
      ]
    );

    res.json({
      status: 'success',
      message: 'Subscription created successfully',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to create subscription' });
  }
};

// Update an active subscription
export const updateActiveSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      user_id,
      subscription_plan_id,
      start_date,
      end_date,
      status,
      auto_renew,
      subscription_email,
      subscription_password,
      subscription_pin,
      notes
    } = req.body;


   

    // Check if subscription exists
    const [subscriptionExists] = await query('SELECT id FROM user_subscriptions WHERE id = ?', [id]);
    if (!subscriptionExists) {
      return res.status(200).json({ status: "error", success: false, message: 'Subscription not found' });
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];

    if (user_id !== undefined) {
      updates.push('user_id = ?');
      params.push(user_id);
    }

    if (subscription_plan_id !== undefined) {
      updates.push('subscription_plan_id = ?');
      params.push(subscription_plan_id);
    }

    if (start_date !== undefined) {
      updates.push('start_date = ?');
      params.push(start_date);
    }

    if (end_date !== undefined) {
      updates.push('end_date = ?');
      params.push(end_date);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (auto_renew !== undefined) {
      updates.push('auto_renew = ?');
      params.push(auto_renew);
    }

    if (subscription_email !== undefined) {
      updates.push('subscription_email = ?');
      params.push(subscription_email);
    }

    if (subscription_password !== undefined) {
      updates.push('subscription_password = ?');
      params.push(subscription_password);
    }

    if (subscription_pin !== undefined) {
      updates.push('subscription_pin = ?');
      params.push(subscription_pin);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    // Add updated_at timestamp
    updates.push('updated_at = NOW()');

    // If no fields to update
    if (updates.length === 1) { // Only updated_at
      return res.status(200).json({ status: "error", success: false, message: 'No fields to update' });
    }

    // Add ID to params
    params.push(id);

    // Update subscription
    await query(
      `UPDATE user_subscriptions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      status: 'success',
      message: 'Subscription updated successfully'
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to update subscription' });
  }
};

// Delete an active subscription
export const deleteActiveSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if subscription exists
    const [subscriptionExists] = await query('SELECT id FROM user_subscriptions WHERE id = ?', [id]);
    if (!subscriptionExists) {
      return res.status(200).json({ status: "error", success: false, message: 'Subscription not found' });
    }

    // Delete subscription
    await query('DELETE FROM user_subscriptions WHERE id = ?', [id]);

    res.json({
      status: 'success',
      message: 'Subscription deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to delete subscription' });
  }
};

// Get available users for subscription
export const getAvailableUsers = async (req, res) => {
  try {
    const users = await query(
      `SELECT id, username, email FROM users WHERE account_status = 'active' ORDER BY username`
    );

    res.json({
      status: 'success',
      data: users
    });
  } catch (error) {
    console.error('Error fetching available users:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to fetch users' });
  }
};

// Get available subscription plans
export const getAvailableSubscriptionPlans = async (req, res) => {
  try {
    const plans = await query(`
      SELECT 
        sp.id, 
        sp.plan_name, 
        sp.price, 
        sp.currency, 
        sp.billing_cycle,
        s.id as subscription_id,
        s.name as subscription_name,
        s.logo_url
      FROM subscription_plans sp
      JOIN subscriptions s ON sp.subscription_id = s.id
      WHERE sp.is_active = 1
      ORDER BY s.name, sp.plan_name
    `);

    res.json({
      status: 'success',
      data: plans
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to fetch subscription plans' });
  }
};


