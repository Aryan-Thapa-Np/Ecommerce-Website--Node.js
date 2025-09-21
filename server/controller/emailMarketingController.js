/**
 * Email Marketing Controller
 * Handles email marketing functionality
 */

import { sendMarketingEmail } from '../utils/email.js';
import { pool } from '../database/db.js';
import { query } from 'express-validator';
import { generateSecureToken } from '../utils/auth.js';
/**
 * Get all newsletter subscribers
 */
export const getNewsletterSubscribers = async (req, res) => {
  try {


    const [subscribers] = await pool.execute(
      'SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC'
    );

    return res.status(200).json({
      success: true,
      subscribers
    });
  } catch (error) {
    console.error('Error in getNewsletterSubscribers:', error);
    return res.status(200).json({
      status: 'error',
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


/**
 * subscribe to marketing email
 */
export const lesSubscribeIt = async (req, res) => {
  try {
    const { email } = req.body;
    const userID = req.user;


    if (!email) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Email is required'
      });

    }

    let first_name = null;
    let last_name = null;
    if (userID) {
      const [user] = await pool.execute(
        'SELECT username FROM users WHERE id = ?',
        [userID]
      );
      if (user.length > 0) {
        first_name = user[0].username;
      }
    }

    const [existingSubscriber] = await pool.execute(
      'SELECT * FROM newsletter_subscribers WHERE email = ?',
      [email]
    );

    if (existingSubscriber.length > 0 && existingSubscriber[0].is_active === 1) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Email already subscribed and active'
      });
    }
    if (existingSubscriber.length > 0 && existingSubscriber[0].is_active === 0) {
      const [result] = await pool.execute(
        'UPDATE newsletter_subscribers SET is_active = 1, subscribed_at = NOW() WHERE email = ?',
        [email]
      );

      if (result.affectedRows === 0) {
        return res.status(200).json({
          status: 'error',
          success: false,
          message: 'Failed to activate subscription'
        });
      }
    }

    const [result] = await pool.execute(
      'INSERT INTO newsletter_subscribers (email,first_name,last_name, is_active, subscribed_at, created_at) VALUES (?, ?, ?, 1, NOW(), NOW())',
      [email, first_name, last_name]
    );

    if (result.affectedRows === 0) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Failed to subscribe to newsletter'
      });
    }

    return res.status(200).json({
      status: 'success',
      success: true,
      message: 'Subscribed to newsletter successfully'
    });




  } catch (error) {
    return res.status(200).json({
      status: 'error',
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};



/**
 * Send marketing email to users
 */
export const sendMarketingEmailToUsers = async (req, res) => {
  try {
    const { recipientType, recipients, subject, content, template } = req.body;

    if (!subject || !content) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Subject and content are required'
      });
    }


    let emailRecipients = [];

    // Get email recipients based on type
    if (recipientType === 'all_subscribers') {
      const [subscribers] = await pool.execute(
        'SELECT email FROM newsletter_subscribers WHERE is_active = 1'
      );
      emailRecipients = subscribers.map(sub => sub.email);
    } else if (recipientType === 'all_customers') {
      const [customers] = await pool.execute(
        'SELECT email FROM users WHERE role_id = 3'
      );
      emailRecipients = customers.map(user => user.email);
    } else if (recipientType === 'specific_user' && recipients) {
      emailRecipients = Array.isArray(recipients) ? recipients : [recipients];
    } else {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Invalid recipient type or missing recipients'
      });
    }

    if (emailRecipients.length === 0) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'No recipients found'
      });
    }

   

    const unsubscribe_token =  generateSecureToken();
    
    await pool.execute('UPDATE newsletter_subscribers SET unsubscribe_token = ? WHERE email = ?', [unsubscribe_token, emailRecipients[0]]);
    // Send the email
    const result = await sendMarketingEmail(emailRecipients, subject, content, template, unsubscribe_token);

    if (!result.success) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Failed to send email',
        error: result.error
      });
    }

    // Log the email in the database
    const [logResult] = await pool.execute(
      'INSERT INTO email_marketing_logs (user_id, subject, content, recipient_type, recipient_count, template, sent_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [req.user, subject, content, recipientType, emailRecipients.length, template]
    );

    // Update last_email_sent for subscribers if sending to all subscribers
    if (recipientType === 'all_subscribers') {
      await pool.execute(
        'UPDATE newsletter_subscribers SET last_email_sent = NOW() WHERE is_active = 1'
      );
    }

    return res.status(200).json({
      success: true,
      message: `Email sent successfully to ${emailRecipients.length} recipients`,
      messageId: result.messageId
    });
  } catch (error) {
    console.error('Error in sendMarketingEmailToUsers:', error);
    return res.status(200).json({
      status: 'error',
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get email marketing history
 */
export const getEmailHistory = async (req, res) => {
  try {


    const [history] = await pool.execute(
      `SELECT eml.*, u.username 
       FROM email_marketing_logs eml
       LEFT JOIN users u ON eml.user_id = u.id
       ORDER BY eml.sent_at DESC`
    );

    return res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Error in getEmailHistory:', error);
    return res.status(200).json({
      status: 'error',
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Search users by email or username
 */
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }



    const [users] = await pool.execute(
      `SELECT id, email, username FROM users 
       WHERE email LIKE ? OR username LIKE ? 
       LIMIT 10`,
      [`%${query}%`, `%${query}%`]
    );

    return res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error in searchUsers:', error);
    return res.status(200).json({
      status: 'error',
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Unsubscribe a user from the newsletter
 */
export const unsubscribeUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Subscriber ID is required'
      });
    }



    const [result] = await pool.execute(
      'UPDATE newsletter_subscribers SET is_active = 0, unsubscribed_at = NOW() WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Subscriber not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User unsubscribed successfully'
    });
  } catch (error) {
    console.error('Error in unsubscribeUser:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}; 



export const getUnsubscribeLink = async (req, res) => {
  try {
    const { token } = req.query;
    console.log(token); 
    if (!token) {
      return res.status(200).render('unsubscribe', {
        status: 'error',
        success: false,
        message: 'Unsubscribe token is required'
      });
    }
  
    const [subscriber] = await pool.execute(
      'SELECT * FROM newsletter_subscribers WHERE unsubscribe_token  = ?',
      [token]
    );
    if (subscriber.length === 0) {
      return res.status(200).render('unsubscribe', {
        status: 'error',
        success: false,
        message: 'Subscriber not found'
      });
    }
    const [deleteSubscriber] = await pool.execute('DELETE FROM newsletter_subscribers WHERE id = ?', [subscriber[0].id]);
    if (deleteSubscriber.affectedRows === 0) {
      return res.status(200).json({
        status: 'error',
        success: false,
        message: 'Failed to delete subscriber'
      });
    }
    return res.status(200).render('unsubscribe', {
      status: 'success',
      success: true,
      message: 'Subscriber unsubscribed successfully'
    });
  } catch (error) {
    console.error('Error in getUnsubscribeLink:', error);
  }
};