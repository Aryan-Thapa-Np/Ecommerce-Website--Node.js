import { pool } from '../database/db.js';

// Get all vouches with user info
export const getVouches = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'newest' } = req.query;
        const offset = (page - 1) * limit;

        let sortClause = 'v.created_at DESC'; // default sort by newest
        if (sort === 'rating') {
            sortClause = 'v.rating DESC, v.created_at DESC';
        }

        // Get vouches with user info
        const [vouches] = await pool.execute(`
            SELECT 
                v.*,
                u.username,
                CASE 
                    WHEN up.profile_image IS NOT NULL AND up.profile_image != '' 
                    THEN CONCAT('/', REPLACE(up.profile_image, 'public/', ''))
                    ELSE NULL
                END as avatar_url
            FROM vouches v
            JOIN users u ON v.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE v.is_active = TRUE
            ORDER BY ${sortClause}
            LIMIT ? OFFSET ?
        `, [parseInt(limit), offset]);

        // Get total count and stats
        const [[stats]] = await pool.execute('SELECT * FROM vouch_stats');

        // Calculate total pages
        const totalPages = Math.ceil(stats.total_vouches / limit);

        res.json({
            success: true,
            data: {
                vouches,
                stats,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalVouches: stats.total_vouches,
                    hasNextPage: parseInt(page) < totalPages,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });
    } catch (error) {
        
        res.status(200).json({
            status: "error",
            success: false,
            message: 'Failed to fetch vouches'
        });
    }
};

// Add or update vouch
export const addOrUpdateVouch = async (req, res) => {
   
    try {
        const userId = req.user;
        const { rating, vouch_text } = req.body;

       

        if (!rating || rating < 1 || rating > 5) {
            return res.status(200).json({
                status: "error",
                success: false,
                message: 'Invalid rating. Must be between 1 and 5'
            });
        }

        // Check if user has already vouched
        const [existingVouch] = await pool.execute(
            'SELECT id FROM vouches WHERE user_id = ?',
            [userId]
        );

        if (existingVouch.length > 0) {
            // Update existing vouch
            await pool.execute(`
                UPDATE vouches 
                SET rating = ?, vouch_text = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `, [rating, vouch_text, userId]);

            res.status(200).json({
                status: "success",
                success: true,
                message: 'Vouch updated successfully'
            });
        } else {
            // Add new vouch
            await pool.execute(`
                INSERT INTO vouches (user_id, rating, vouch_text)
                VALUES (?, ?, ?)
            `, [userId, rating, vouch_text]);

            res.status(200).json({
                status: "success",
                success: true,
                message: 'Vouch added successfully'
            });
        }
    } catch (error) {

        res.status(200).json({
            status: "error",
            success: false,
            message: 'Failed to add/update vouch'
        });
    }
};

// Delete vouch
export const deleteVouch = async (req, res) => {
    try {
        const userId = req.user;

        const [result] = await pool.execute(
            'UPDATE vouches SET is_active = FALSE WHERE user_id = ?',
            [userId]
        );

        if (result.affectedRows === 0) {
            return res.status(200).json({
                status: "error",
                success: false,
                message: 'Vouch not found'
            });
        }

        res.json({
            success: true,
            message: 'Vouch deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting vouch:', error);
        res.status(200).json({
            status: "error",
            success: false,
            message: 'Failed to delete vouch'
        });
    }
}; 