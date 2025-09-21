import express from 'express';
import { getVouches, addOrUpdateVouch, deleteVouch } from '../controller/vouchController.js';
import { verifyToken } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';
import { vouchRateLimit } from '../middleware/rateLimit.js';
import { vouchValidation } from '../middleware/validator.js';

import { query } from '../database/db.js';

const router = express.Router();

// Get all vouches (public)
router.get('/', getVouches);

// Add/Update vouch (requires auth)
router.post('/', 
    verifyToken,
    verifyCsrf,
    vouchValidation,
    vouchRateLimit,
    addOrUpdateVouch
);

// // Delete vouch (requires auth)
// router.delete('/', 
//     verifyToken,
//     verifyCsrf,
//     vouchRateLimit,
//     deleteVouch
// );

// Delete a vouch
router.delete('/:id', verifyToken, verifyCsrf, vouchRateLimit, async (req, res) => {
    try {
        const vouchId = req.params.id;
        
    
        
        // First check if the vouch exists and belongs to the user
        const [vouch] = await query(
            'SELECT user_id FROM vouches WHERE id = ?',
            [vouchId]
        );

        if (vouch.length > 0) {
            return res.status(404).json({
                success: false,
                message: 'Vouch not found'
            });
        }

        

        if (vouch.user_id !== req.user) {
            return res.status(200).json({
                status: "error",
                success: false,
                message: 'You are not authorized to delete this vouch'
            });
        }

        // Delete the vouch
        await query(
            'DELETE FROM vouches WHERE user_id = ?',
            [req.user]
        );

        res.status(200).json({
            status: "success",
            success: true,
            message: 'Vouch deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting vouch:', error);
        res.status(200).json({
            status: "error",
            success: false,
            message: 'An error occurred while deleting the vouch'
        });
    }
});

export default router; 