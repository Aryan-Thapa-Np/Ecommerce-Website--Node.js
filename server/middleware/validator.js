/**
 * Input Validation Middleware
 * Provides validation rules for various API endpoints
 */

import { body, param, validationResult, query } from "express-validator";
import { query as queryValidator } from "express-validator";
import { pool } from "../database/db.js";

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

// Registration validation rules
const registerValidation = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_ ]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    )
    .not()
    .contains(" ")
    .withMessage("Password must not contain spaces"),

  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Password confirmation does not match password");
    }
    return true;
  }),

  handleValidationErrors,
];

// Login validation rules
const loginValidation = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),

  handleValidationErrors,
];

// Password reset request validation
const passwordResetRequestValidation = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  handleValidationErrors,
];

// OTP verification validation
const otpValidation = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("otp")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),

  handleValidationErrors,
];

// Password update validation
const passwordUpdateValidation = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("otp")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),

  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Password confirmation does not match password");
    }
    return true;
  }),

  handleValidationErrors,
];

// 2FA setup validation
const twoFactorSetupValidation = [
  body("method")
    .isIn(["app", "email"])
    .withMessage('2FA method must be either "app" or "email"'),

  handleValidationErrors,
];

// 2FA verification validation (for /verify-2fa endpoint)
const twoFactorVerifyValidation = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("otp")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),
  body("method")
    .isIn(["app", "email"])
    .withMessage('2FA method must be either "app" or "email"'),
  handleValidationErrors,
];

// User profile update validation
const profileUpdateValidation = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("First name cannot exceed 100 characters"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Last name cannot exceed 100 characters"),

  body("phone")
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/)
    .withMessage("Please provide a valid phone number"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Address cannot exceed 255 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters"),

  body("state")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("State cannot exceed 100 characters"),

  body("country")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),

  body("postalCode")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Postal code cannot exceed 20 characters"),

  handleValidationErrors,
];

// User ID validation
const userIdValidation = [
  param("userId")
    .isInt()
    .withMessage("User ID must be an integer")
    .custom(async (value) => {
      const user = await pool.execute("SELECT id FROM users WHERE id = ?", [value]);
      if (!user || user.length === 0) {
        throw new Error("User not found");
      }
      return true;
    }),

  handleValidationErrors,
];

// Account status update validation
const accountStatusValidation = [
  body("status")
    .isIn(["active", "banned", "suspended"])
    .withMessage('Status must be either "active", "banned", or "suspended"'),

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Reason cannot exceed 255 characters"),

  body("duration")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Duration must be a positive integer (days)")
    .custom((value, { req }) => {
      if (req.body.status === "suspended" && !value) {
        throw new Error("Duration is required for suspension");
      }
      return true;
    }),

  handleValidationErrors,
];

// Validation middleware for profile updates
const profileValidation = [
  // Log the request body before validation

  // Name validation
  body("name")
    .optional()
    .trim()
    .customSanitizer((value) => (value ? value.replace(/\s+/g, " ") : value))
    .isLength({ min: 3, max: 30 })
    .withMessage("Name must be between 3 and 30 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(
      "Name can only contain letters, spaces, hyphens, and apostrophes"
    ),
  // Email validation
  body("email")
    .optional()
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail({ all_lowercase: true }),
  handleValidationErrors,
];

// Validation for creating a new user by admin
const validateCreateUser = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_ ]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),

  body("role")
    .isIn(["admin", "staff", "customer"])
    .withMessage("Invalid role specified"),

  handleValidationErrors,
];

// Validation for toggling email verification
const validateToggleEmailVerification = [
  param("id").isInt().withMessage("Invalid user ID"),
  body("verified").isBoolean().withMessage("Verified must be a boolean"),
  handleValidationErrors,
];

// Validation for toggling 2FA
const validateToggle2FA = [
  param("id").isInt().withMessage("Invalid user ID"),
  body("enabled").isBoolean().withMessage("Enabled must be a boolean"),
  handleValidationErrors,
];

// Validation for changing user role
const validateChangeRole = [
  param("id").isInt().withMessage("Invalid user ID"),
  body("role")
    .isIn(["admin", "staff", "customer"])
    .withMessage("Invalid role specified"),
  handleValidationErrors,
];

// Validation for updating user status
const validateUpdateUserStatus = [
  param("id").isInt().withMessage("Invalid user ID"),
  body("status")
    .isIn(["active", "suspended", "banned", "locked"])
    .withMessage("Status must be active, suspended, banned, or locked"),
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Reason cannot exceed 255 characters"),
  body("duration")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Duration must be between 1 and 365 days"),
  handleValidationErrors,
];

// Validation for suspending a user (for backward compatibility)
const validateSuspendUser = [
  param("id").isInt().withMessage("Invalid user ID"),
  body("reason")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("Reason is required and cannot exceed 255 characters"),
  body("duration")
    .isInt({ min: 1, max: 365 })
    .withMessage("Duration must be between 1 and 365 days"),
  handleValidationErrors,
];

// Add search query validation middleware
const searchValidation = [
  queryValidator('q')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 100 }).withMessage('Query too long')
    .matches(/^[a-zA-Z0-9 _\-.,]*$/).withMessage('Invalid characters in search query')
    .customSanitizer(value => value ? value.replace(/[;}\]\[<>~"'|\\]/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;') : value),
  handleValidationErrors,
];

// Add chat input validation middleware
const chatInputValidation = [
  body('message')
    .trim()
    .escape()
    .isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters')
    .customSanitizer(value => value ? value.replace(/[<>]/g, '').replace(/\s+/g, ' ') : value),
  handleValidationErrors,
];

// Add vouch validation middleware
const vouchValidation = [
  body("rating")
    .isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("vouch_text")
    .trim()
    .isLength({ min: 1, max: 500 }).withMessage("Vouch text must be 1-500 characters")
    .customSanitizer(value => value.replace(/[;}\]\[<\/~"'|\\]/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;')),
  handleValidationErrors,
];

// Validation for creating/updating active subscriptions (admin)
const activeSubscriptionValidation = [
  body("user_id")
    .optional({ checkFalsy: true }) // required for POST, optional for PUT
    .isInt({ min: 1 }).withMessage("User ID must be a positive integer"),
  body("subscription_plan_id")
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage("Subscription plan ID must be a positive integer"),
  body("start_date")
    .optional({ checkFalsy: true })
    .isISO8601().withMessage("Start date must be a valid date (YYYY-MM-DD)"),
  body("end_date")
    .optional({ checkFalsy: true })
    .isISO8601().withMessage("End date must be a valid date (YYYY-MM-DD)"),
  body("status")
    .optional()
    .isIn(["active", "expired", "cancelled"]).withMessage("Status must be active, expired, or cancelled"),
  body("auto_renew")
    .optional()
    .isBoolean().withMessage("Auto renew must be a boolean"),
  body("subscription_email")
    .optional({ checkFalsy: true })
    .isEmail().withMessage("Subscription email must be a valid email address")
    .normalizeEmail(),
  body("subscription_password")
    .optional({ checkFalsy: true })
    .isLength({ max: 100 }).withMessage("Password cannot exceed 100 characters")
    .matches(/^[^<>]*$/).withMessage("Password cannot contain < or >"),
  body("subscription_pin")
    .optional({ checkFalsy: true })
    .isLength({ max: 20 }).withMessage("PIN cannot exceed 20 characters")
    .matches(/^[^<>]*$/).withMessage("PIN cannot contain < or >"),
  body("notes")
    .optional({ checkFalsy: true })
    .isLength({ max: 500 }).withMessage("Notes cannot exceed 500 characters")
    .customSanitizer(value => value.replace(/[<>]/g, '')),
  handleValidationErrors,
];

// Support ticket creation validation (customer)
const supportTicketValidation = [
  body('subject')
    .trim()
    .isLength({ min: 3, max: 255 }).withMessage('Subject must be 3-255 characters')
    .matches(/^[^<>;}{\[\]~|]+$/).withMessage('Subject contains invalid characters')
    .customSanitizer(value => value.replace(/[<>;}{\[\]~|]/g, '')),
  body('message')
    .trim()
    .isLength({ min: 10, max: 1000 }).withMessage('Message must be 10-1000 characters')
    .matches(/^[^<>;}{\[\]~|]+$/).withMessage('Message contains invalid characters')
    .customSanitizer(value => value.replace(/[<>;}{\[\]~|]/g, '')),
  handleValidationErrors,
];



const checkSubscribeEmail = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
]


export {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  passwordResetRequestValidation,
  otpValidation,
  passwordUpdateValidation,
  twoFactorSetupValidation,
  twoFactorVerifyValidation,
  profileUpdateValidation,
  userIdValidation,
  accountStatusValidation,
  profileValidation,
  validateCreateUser,
  validateToggleEmailVerification,
  validateToggle2FA,
  validateChangeRole,
  validateSuspendUser,
  validateUpdateUserStatus,
  searchValidation,
  chatInputValidation,
  vouchValidation,
  activeSubscriptionValidation,
  supportTicketValidation,
  checkSubscribeEmail,
};
