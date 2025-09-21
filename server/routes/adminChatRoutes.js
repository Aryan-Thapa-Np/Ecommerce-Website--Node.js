import express from 'express';
import { verifyToken, requireAdmin,checkAdminOrStaff } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import * as adminChatController from '../controller/adminChatController.js';
import { chatInputValidation, searchValidation } from '../middleware/validator.js';
import { adminMessageRateLimit } from '../middleware/rateLimit.js';
const router = express.Router();

// Middleware to check if user is admin
const adminCheck = [verifyToken, checkAdminOrStaff,verifyCsrf];

// File upload route
router.post('/upload', adminCheck, adminChatController.uploadFile);

// Get all conversations
router.get('/conversations', adminCheck, adminChatController.getConversations);

// Get chat history for a conversation
router.get('/history/:conversationId', adminCheck, adminChatController.getChatHistory);

// Get unread message count across all conversations
router.get('/unread', adminCheck, adminChatController.getUnreadCount);

// Mark message as read
router.put('/read/:messageId', adminCheck, adminChatController.markMessageAsRead);

// Create new message
router.post('/message', adminCheck, chatInputValidation, adminMessageRateLimit, adminChatController.createMessage);

// Update conversation priority
router.put('/priority/:conversationId', adminCheck, adminChatController.updatePriority);

// Filter conversations
router.get('/filter', adminCheck, adminChatController.filterConversations);

// Search conversations
router.get('/search', adminCheck, searchValidation, adminChatController.searchConversations);

// // Add block and timeout user routes
// router.post('/block-user/:id', adminCheck, adminChatController.blockUser);
// router.post('/timeout-user/:id', adminCheck, adminChatController.timeoutUser);
// router.post('/unblock-user/:id', adminCheck, adminChatController.unblockUser);

export default router; 