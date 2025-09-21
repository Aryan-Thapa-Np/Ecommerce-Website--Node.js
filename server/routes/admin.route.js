/**
 * Admin Routes
 * Handles admin-only endpoints for user management
 */

import express from "express";
const router = express.Router();

import {
  getAllUsers,
  createUser,
  toggleEmailVerification,
  toggle2FA,
  changeUserRole,
  updateUserStatus,
  getActiveSubscriptions,
  getActiveSubscriptionById,
  createActiveSubscription,
  updateActiveSubscription,
  deleteActiveSubscription,
  getAvailableUsers,
  getAvailableSubscriptionPlans
} from "../controller/admin.js";

import {
  verifyToken,
  requireAdmin,
} from "../middleware/auth.js";

import {
  validateCreateUser,
  validateToggleEmailVerification,
  validateToggle2FA,
  validateChangeRole,
  validateUpdateUserStatus,
  activeSubscriptionValidation
} from "../middleware/validator.js";

import { verifyCsrf } from "../middleware/csrf.js";

// Apply CSRF protection and authentication to all routes
router.use(verifyCsrf);
router.use(verifyToken);



router.use(requireAdmin);

// User management routes
router.get('/users', getAllUsers);
router.post('/users', validateCreateUser, createUser);
router.post('/users/:id/email-verification', validateToggleEmailVerification, toggleEmailVerification);
router.post('/users/:id/2fa', validateToggle2FA, toggle2FA);
router.post('/users/:id/role', validateChangeRole, changeUserRole);
router.post('/users/:id/status', validateUpdateUserStatus, updateUserStatus);

// Active subscription management routes
router.get('/active-subscriptions', getActiveSubscriptions);
router.get('/active-subscriptions/:id', getActiveSubscriptionById);
router.post('/active-subscriptions',activeSubscriptionValidation, createActiveSubscription);
router.put('/active-subscriptions/:id',activeSubscriptionValidation, updateActiveSubscription);
router.delete('/active-subscriptions/:id', deleteActiveSubscription);

// Helper routes for subscription creation/editing
router.get('/available-users', getAvailableUsers);
router.get('/available-subscription-plans', getAvailableSubscriptionPlans);

export default router;