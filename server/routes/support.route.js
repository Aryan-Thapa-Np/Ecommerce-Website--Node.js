import express from 'express';
import { getSupportTickets, getSupportTicketById, updateSupportTicketStatus, deleteSupportTicket, replySupportTicket, createSupportTicket, getMySupportTickets } from '../controller/supportController.js';
import { verifyToken, checkRole,checkAdminOrStaff } from '../middleware/auth.js';
import { supportTicketValidation } from '../middleware/validator.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { supportTicketRateLimit } from '../middleware/rateLimit.js';
const router = express.Router();

// Allow ticket creation for any authenticated user
router.post('/create-support-ticket', verifyToken, verifyCsrf, supportTicketRateLimit, supportTicketValidation, createSupportTicket);
// Allow customers to fetch their own tickets
router.get('/my-tickets', verifyToken, verifyCsrf, getMySupportTickets);

// All routes below require admin/staff
router.use(verifyToken);
router.use(verifyCsrf);

router.get('/support-tickets', getSupportTickets); // List tickets (with filters)
router.get('/support-tickets/:id', getSupportTicketById); // Get single ticket
router.patch('/support-tickets/:id/status',checkAdminOrStaff, updateSupportTicketStatus); // Change status
router.delete('/support-tickets/:id',checkAdminOrStaff, deleteSupportTicket); // Delete ticket
router.post('/support-tickets/:id/reply',checkAdminOrStaff, replySupportTicket); // Reply to ticket

export default router; 