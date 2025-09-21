import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import * as customerChatController from '../controller/customerChatController.js';
import { chatInputValidation } from '../middleware/validator.js';
import { messageRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

// File upload route
router.post('/upload', verifyToken, verifyCsrf,messageRateLimit, customerChatController.uploadFile);

// Get chat history
router.get('/history/:userId', verifyToken, verifyCsrf, customerChatController.getChatHistory);

// Get unread message count
router.get('/unread/:userId', verifyToken, verifyCsrf, customerChatController.getUnreadCount);

// Mark message as read
router.put('/read/:messageId', verifyToken, verifyCsrf, customerChatController.markMessageAsRead);

// Create new message
router.post('/message', verifyToken, verifyCsrf, messageRateLimit, chatInputValidation, customerChatController.createMessage);

export default router; 