/**
 * Email Utility
 * Handles sending emails for various purposes like OTP verification, password reset, etc.
 */

import nodemailer from 'nodemailer';


// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify transporter configuration
const verifyEmailConfig = async () => {
  try {
    await transporter.verify();
    console.log('Email service is ready');
    return true;
  } catch (error) {
    console.error('Email service configuration error:', error);
    return false;
  }
};


const companyName = "Cartify";

// Send email verification OTP
const sendVerificationEmail = async (email, otp) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; padding-bottom: 20px;">
            <h1 style="color: #1a73e8; font-size: 24px; margin: 0;">Email Verification</h1>
            <p style="color: #555; font-size: 16px; margin: 10px 0;">Thank you for joining us!</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <p style="color: #333; font-size: 16px; margin: 0 0 10px 0;">Your One-Time Verification Code:</p>
            <span style="display: inline-block; background-color: #e8f0fe; color: #1a73e8; font-size: 28px; font-weight: bold; letter-spacing: 8px; padding: 10px 20px; border-radius: 4px;">
              ${otp}
            </span>
          </div>
          <p style="color: #555; font-size: 14px; text-align: center; margin: 20px 0;">This OTP is valid for <strong>2 minutes</strong>. Please enter it to verify your email address.</p>
          <p style="color: #777; font-size: 14px; text-align: center; margin: 20px 0;">If you did not request this verification, you can safely ignore this email.</p>
          <div style="text-align: center; border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #777; font-size: 12px; margin: 0;">This is an automated message, please do not reply.</p>
            <p style="color: #777; font-size: 12px; margin: 5px 0;">&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

// Send password reset OTP
const sendPasswordResetEmail = async (email, otp) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; padding-bottom: 20px;">
            <h1 style="color: #1a73e8; font-size: 24px; margin: 0;">Password Reset Request</h1>
            <p style="color: #555; font-size: 16px; margin: 10px 0;">Let's get your account secured!</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <p style="color: #333; font-size: 16px; margin: 0 0 10px 0;">Your One-Time Password Reset Code:</p>
            <span style="display: inline-block; background-color: #e8f0fe; color: #1a73e8; font-size: 28px; font-weight: bold; letter-spacing: 8px; padding: 10px 20px; border-radius: 4px;">
              ${otp}
            </span>
          </div>
          <p style="color: #555; font-size: 14px; text-align: center; margin: 20px 0;">This OTP is valid for <strong>10 minutes</strong>. Please enter it to proceed with resetting your password.</p>
          <p style="color: #555; font-size: 14px; text-align: center; margin: 20px 0;">If you did not request a password reset, please ignore this email or <a href="mailto:support@yourcompany.com" style="color: #1a73e8; text-decoration: none;">contact support</a> if you have concerns.</p>
          <div style="text-align: center; border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #777; font-size: 12px; margin: 0;">This is an automated message, please do not reply.</p>
            <p style="color: #777; font-size: 12px; margin: 5px 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
};

// Send 2FA verification email
const sendTwoFactorEmail = async (email, otp) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Your Two-Factor Authentication Code',
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align: center; padding-bottom: 20px;">
            <h1 style="color: #1a73e8; font-size: 24px; margin: 0;">Two-Factor Authentication</h1>
            <p style="color: #555; font-size: 16px; margin: 10px 0;">Secure your account with this code</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <p style="color: #333; font-size: 16px; margin: 0 0 10px 0;">Your Two-Factor Authentication Code:</p>
            <span style="display: inline-block; background-color: #e8f0fe; color: #1a73e8; font-size: 28px; font-weight: bold; letter-spacing: 8px; padding: 10px 20px; border-radius: 4px;">
              ${otp}
            </span>
          </div>
          <p style="color: #555; font-size: 14px; text-align: center; margin: 20px 0;">This code expires in <strong>5 minutes</strong>. Please enter it promptly to complete your login.</p>
          <p style="color: #555; font-size: 14px; text-align: center; margin: 20px 0;">If you did not attempt to log in, someone may be trying to access your account. Please <a href="mailto:support@yourcompany.com" style="color: #1a73e8; text-decoration: none;">contact support</a> immediately.</p>
          <div style="text-align: center; border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #777; font-size: 12px; margin: 0;">This is an automated message, please do not reply.</p>
            <p style="color: #777; font-size: 12px; margin: 5px 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending 2FA email:', error);
    return false;
  }
};



//2fa-disable req

const sendTwoFactorDisable = async (email, token,userId) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Two-Factor Authentication Disable Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333;">Two-Factor Authentication Disable Request</h2>
          <p>Your two-factor authentication code is:</p>
          <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            <a href="${process.env.FRONTEND_URL}/api/auth/2fa/disable?token=${token}&userId=${userId}">Click here to disable 2FA</a>
          </div>
          <p>This code will expire in 2 minutes.</p>
          <p>If you didn't attempt to login, someone may be trying to access your account.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending 2FA disable request email:', error);
    return false;
  }
};

// Send account status change notification
const sendAccountStatusEmail = async (email, status, reason, expiryDate = null) => {
  try {
    let subject, message;
    
    switch (status) {
      case 'locked':
        subject = 'Account Locked';
        message = `
          <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
          <p>You can try logging in again after 30 minutes.</p>
        `;
        break;
      case 'banned':
        subject = 'Account Banned';
        message = `
          <p>Your account has been banned.</p>
          <p>Reason: ${reason || 'Violation of terms of service'}</p>
          <p>If you believe this is an error, please contact support.</p>
        `;
        break;
      case 'suspended':
        subject = 'Account Suspended';
        message = `
          <p>Your account has been temporarily suspended.</p>
          <p>Reason: ${reason || 'Violation of terms of service'}</p>
          <p>Your account will be reactivated on: ${new Date(expiryDate).toLocaleDateString()}</p>
          <p>If you believe this is an error, please contact support.</p>
        `;
        break;
      case 'active':
        subject = 'Account Reactivated';
        message = `
          <p>Your account has been reactivated and is now in good standing.</p>
          <p>You can now log in and use all features of your account.</p>
        `;
        break;
      default:
        return false;
    }
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333;">Account Status Update</h2>
          ${message}
          <p style="margin-top: 30px; font-size: 12px; color: #777;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending account status email:', error);
    return false;
  }
};

// Send marketing email to subscribers or customers
const sendMarketingEmail = async (recipients, subject, content, template = 'custom', unsubscribe_token) => {
  try {
    // Determine email template based on the selected type
    let htmlTemplate = '';
    
    switch (template) {
      case 'newsletter':
        htmlTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #333;">Newsletter</h1>
            </div>
            <div style="padding: 20px; background-color: #f9f9f9; border-radius: 5px;">
              ${content}
            </div>
            <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #777;">
              <p>You received this email because you're subscribed to our newsletter.</p>
                <p>To unsubscribe, <a href="${process.env.FRONTEND_URL}/api/users/email/unsubscribe/token?token=${unsubscribe_token}" style="color: #333;">click here</a>.</p>
            </div>
          </div>
        `;
        break;
      
      case 'promotion':
        htmlTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px; background-color: #ff6b6b; padding: 15px; border-radius: 5px;">
              <h1 style="color: white;">Special Offer!</h1>
            </div>
            <div style="padding: 20px; background-color: #f9f9f9; border-radius: 5px;">
              ${content}
            </div>
            <div style="margin-top: 20px; text-align: center;">
              <a href="{promotion_link}" style="background-color: #ff6b6b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Shop Now</a>
            </div>
            <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #777;">
              <p>You received this email because you're subscribed to our promotional emails.</p>
              <p>To unsubscribe, <a href="${process.env.FRONTEND_URL}/api/users/email/unsubscribe/token?token=${unsubscribe_token}" style="color: #333;">click here</a>.</p>
            </div>
          </div>
        `;
        break;
      
      case 'announcement':
        htmlTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px; background-color: #4dabf7; padding: 15px; border-radius: 5px;">
              <h1 style="color: white;">Announcement</h1>
            </div>
            <div style="padding: 20px; background-color: #f9f9f9; border-radius: 5px;">
              ${content}
            </div>
            <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #777;">
              <p>You received this email because you're part of the valued customers of ${companyName}.</p>
              <p>Thank you for your continued support.</p>
            </div>
          </div>
        `;
        break;
      
      case 'custom':
      default:
        htmlTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            ${content}
            <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #777;">
              <p>You received this email because you're subscribed to our emails.</p>
                <p>To unsubscribe, <a href="${process.env.FRONTEND_URL}/api/users/email/unsubscribe/token?token=${unsubscribe_token}" style="color: #333;">click here</a>.</p>
            </div>
          </div>
        `;
    }
    
    // If recipients is an array, join with commas
    const to = Array.isArray(recipients) ? recipients.join(',') : recipients;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html: htmlTemplate
    };
    
    // Send email
    const result = await transporter.sendMail(mailOptions);
   
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending marketing email:', error);
    return { success: false, error: error.message };
  }
};

export {
  verifyEmailConfig,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTwoFactorEmail,
  sendAccountStatusEmail,
  sendTwoFactorDisable,
  sendMarketingEmail,
};