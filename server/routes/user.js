/**
 * User Routes
 * Handles user profile and management endpoints
 */

import express from "express";
const router = express.Router();

import {
  getUserProfile,
  updateUserProfile,
  updateProfileImage,
  updateUserInfo,
  getUserById,
  getUserActivity,
  sendUserNotifications,
  markNotificationAsViewed,
  deleteNotification,
  getusershortinfo,
} from "../controller/userController.js";

import {
  verifyToken,
  checkAccountStatus,
  checkRole,
  checkOwnershipOrAdmin,
  checkAdminOrStaff,
} from "../middleware/auth.js";

import {
  profileUpdateValidation,
  userIdValidation,
  accountStatusValidation,
  profileValidation,
  checkSubscribeEmail,
} from "../middleware/validator.js";

import {
  upload,
  handleUploadErrors,
  sanitizeFile,
} from "../middleware/upload.js";
import { verifyCsrf } from "../middleware/csrf.js";

import { profileInfo } from "../middleware/rateLimit.js";
import { pushNotification } from "../utils/notification.js";
/**
 * User Routes
 * Handles client-side endpoints for user subscriptions
 */

import {
  getActiveSubscriptions,
  getActiveSubscriptionById
} from "../controller/admin.js";

// Import email marketing controller functions
import {
  getNewsletterSubscribers,
  sendMarketingEmailToUsers,
  getEmailHistory,
  searchUsers,
  unsubscribeUser,
  lesSubscribeIt,
  getUnsubscribeLink
} from "../controller/emailMarketingController.js";


router.get('/email/unsubscribe/token', getUnsubscribeLink);
// Apply CSRF protection and authentication to all routes
router.use(verifyCsrf);
router.use(verifyToken);

// User profile routes
router.get("/profile", getUserProfile);
router.get("/profile/userid", getusershortinfo);

// Profile image upload route with enhanced validation
router.post(
  "/profile/image",
  profileInfo,
  upload.single("profileImage"),
  handleUploadErrors,
  (req, res, next) => {
    // Additional validation for profile image
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Profile image is required'
      });
    }

    next();
  },
  sanitizeFile,
  updateProfileImage
);

router.patch("/profile/info", profileValidation, updateUserInfo);

router.get("/recentactivity", getUserActivity);
router.get("/notifications", sendUserNotifications);
router.post('/notifications/viewed/:id', markNotificationAsViewed);
router.post('/notifications/delete/:id', deleteNotification);

// Client-side active subscriptions (GET only)
router.get('/user/my/active-subscriptions', getActiveSubscriptions);
router.get('/user/my/new/active-subscriptions/:id', getActiveSubscriptionById);


//send notification to user
router.post('/notifications/admin/send',verifyToken, verifyCsrf, checkAdminOrStaff, async (req, res) => {
  try{
  const { message } = req.body;
  const userID = req.user;
  if (!userID) {
    return res.status(200).json({ status: 'error', message: 'Invalid user ID' });
  }
  await pushNotification(userID, "announcement", message);
  return res.status(200).json({ status: 'success', message: 'Notification sent successfully' });
  }catch(error){
    
    return res.status(200).json({ status: 'error', message: 'Failed to send notification' });
  }
});




router.post('/email/les/subscriber/it',checkSubscribeEmail, lesSubscribeIt);


// Email marketing routes (admin only)
router.get('/email/subscribers',  checkAdminOrStaff, getNewsletterSubscribers);
router.post('/email/send',  checkAdminOrStaff, sendMarketingEmailToUsers);
router.get('/email/history', checkAdminOrStaff, getEmailHistory);
router.get('/email/search-users', checkAdminOrStaff, searchUsers);
router.post('/email/unsubscribe/:id', unsubscribeUser);

export default router;
