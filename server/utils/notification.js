import { query } from '../database/db.js';

// Custom relative time formatter
function getRelativeTime(createdAt) {
    const now = new Date();
    const diffMs = now - new Date(createdAt);
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
        return `${diffSeconds}s ago`;
    } else if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return new Date(createdAt).toLocaleDateString();
    }
}

// Notification configuration using switch-case
function getNotificationConfig(type, itemName) {
    switch (type) {
        case 'wishlist':
            return {
                type: 'wishlist',
                title: 'Added to Wishlist',
                message: `${itemName} added to your wishlist`,
                icon_class: 'fas fa-heart',
                icon_background: '#3b82f6'
            };
        case 'cart':
            return {
                type: 'cart',
                title: 'Added to Cart',
                message: `${itemName} added to your cart`,
                icon_class: 'fas fa-shopping-cart',
                icon_background: '#10b981'
            };
        case 'profile':
            return {
                type: 'profile',
                title: 'Profile Updated',
                message: 'Your profile information was updated',
                icon_class: 'fas fa-user',
                icon_background: '#f59e0b'
            };
        case '2fa_enable':
            return {
                type: '2fa_enable',
                title: '2FA Enabled',
                message: 'Two-factor authentication has been enabled',
                icon_class: 'fas fa-shield-alt',
                icon_background: '#8b5cf6'
            };
        case '2fa_disable':
            return {
                type: '2fa_disable',
                title: '2FA Disabled',
                message: 'Two-factor authentication has been disabled',
                icon_class: 'fas fa-shield-alt',
                icon_background: '#ef4444'
            };
        case 'order_created':
            return {
                type: 'order_created',
                title: 'Order Created',
                message: `Order for ${itemName} has been created`,
                icon_class: 'fas fa-shopping-bag',
                icon_background: '#6366f1'
            };
        case 'order_shipped':
            return {
                type: 'order_shipped',
                title: 'Order Shipped',
                message: `Order for ${itemName} has been shipped`,
                icon_class: 'fas fa-truck',
                icon_background: '#06b6d4'
            };
        case 'order_delivered':
            return {
                type: 'order_delivered',
                title: 'Order Delivered',
                message: `Order for ${itemName} has been delivered`,
                icon_class: 'fas fa-check-circle',
                icon_background: '#22c55e'
            };
        case 'order_cancelled':
            return {
                type: 'order_cancelled',
                title: 'Order Cancelled',
                message: `Order for ${itemName} has been cancelled`,
                icon_class: 'fas fa-times-circle',
                icon_background: '#ef4444'
            };
        case 'order_failed':
            return {
                type: 'order_failed',
                title: 'Order Failed',
                message: `Order for ${itemName} has been failed`,
                icon_class: 'fas fa-times-circle',
                icon_background: '#ef4444'
            };
        case 'coupon':
            return {
                type: 'coupon',
                title: 'New Coupon Available',
                message: itemName,
                icon_class: 'fas fa-ticket-alt',
                icon_background: '#ec4899'
            };
        case 'announcement':
            return {
                type: 'announcement',
                title: 'Announcement',
                message: itemName,
                icon_class: 'fas fa-bullhorn',
                icon_background: '#f97316'
            };
        case 'password_reset':
            return {
                type: 'password_reset',
                title: 'Password Reset',
                message: 'Your password has been successfully reset',
                icon_class: 'fas fa-key',
                icon_background: '#4b5563'
            };
        default:
            throw new Error('Invalid notification type');
    }
}

// Push a notification (user-specific or to all users)
async function pushNotification(userId, type, itemName = null) {
    try {
        const config = getNotificationConfig(type, itemName);
        const isAdminNotification = ['coupon', 'announcement'].includes(type);

        if (isAdminNotification) {
            const users = await query('SELECT id FROM users');
            const notifications = [];

            (users || []).forEach(async user => {
                if (!user.id) return;
                const result = await query(
                    'INSERT INTO notifications (user_id, type, title, message, icon_class, icon_background) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        user.id,
                        config.type,
                        config.title,
                        config.message,
                        config.icon_class,
                        config.icon_background
                    ]
                );
                notifications.push({
                    id: result.insertId,
                    user_id: user.id,
                    ...config,
                    created_at: new Date(),
                        relative_time: getRelativeTime(new Date())
                    });
                });
            


            if (notifications.length === 0) {
                console.warn('No users found for admin notification');
            }
            return notifications;
        } else {
            if (!userId) throw new Error('Invalid user ID');
            const result = await query(
                'INSERT INTO notifications (user_id, type, title, message, icon_class, icon_background) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    userId,
                    config.type,
                    config.title,
                    config.message,
                    config.icon_class,
                    config.icon_background
                ]
            );

            return [{
                id: result.insertId,
                user_id: userId,
                ...config,
                created_at: new Date(),
                relative_time: getRelativeTime(new Date())
            }];
        }
    } catch (error) {
        console.error('Error pushing notification:', error);
        throw error;
    }
}
async function getUserNotifications(userId, limit) {
    try {
        const rows = await query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            [userId, limit]
        );

        const notificationRows = Array.isArray(rows) ? rows : rows ? [rows] : [];

        // Mark as not new
        // await query(
        //     'UPDATE notifications SET is_new = 0 WHERE user_id = ? AND is_new = 1',
        //     [userId]
        // );

        return notificationRows.map(row => ({
            ...row,
            relative_time: getRelativeTime(row.created_at)
        }));
    } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }
}


// Delete notifications older than 7 days
async function deleteOldNotifications(userId = null) {
    try {
        const [check] = userId
            ? await query('SELECT * FROM notifications WHERE user_id = ?', [userId])
            : await query('SELECT * FROM notifications');

        // Normalize to array to handle single object or array
        const notifications = Array.isArray(check) ? check : check && typeof check === 'object' ? [check] : [];

        if (notifications.length === 0) {
         
            return { deleted: 0 };
        }

        // Check if any notifications are older than 7 days
        const now = new Date();
        let hasOldNotifications = false;
        notifications.forEach(notification => {
            const createdAt = new Date(notification.created_at);
            const diffMs = now - createdAt;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays >= 7) {
                hasOldNotifications = true;
            }
        });

        if (!hasOldNotifications) {
           
            return { deleted: 0 };
        }

        const [result] = userId
            ? await query(
                'DELETE FROM notifications WHERE user_id = ? AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)',
                [userId]
            )
            : await query(
                'DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
            );

       
        return { deleted: result.affectedRows || 0 };
    } catch (error) {
        console.error('Error deleting old notifications:', error);
        throw error;
    }
}

export {
    pushNotification,
    getUserNotifications,
    deleteOldNotifications
};

