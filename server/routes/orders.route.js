/**
 * Orders Routes
 * Handles order creation, tracking, and payment processing
 */

import express from 'express';
import { pool } from '../database/db.js';
import { verifyToken, requireAdmin,permission,checkAdminOrStaff } from '../middleware/auth.js';

import { upload, uploadPaymentProof } from '../middleware/upload.js';
import { verifyCsrf } from '../middleware/csrf.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
    getAllOrdersAdmin,
    adminUpdateOrderStatus,
    adminDeleteOrder,
    adminDownloadInvoice
} from "../controller/orderController.js";

import{pushNotification} from "../utils/notification.js";


const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all orders for a user
router.get('/', verifyToken, verifyCsrf, async (req, res) => {
    try {
       
        const userId = req.user;

        // Get all orders with basic item info for all items in each order
        const [orders] = await pool.query(`
            SELECT 
                oh.*,
                (SELECT COUNT(*) FROM order_items WHERE order_id = oh.id) as item_count,
                GROUP_CONCAT(
                    DISTINCT
                    CONCAT(
                        '{"item_type":"', oi.item_type,
                        '","item_id":', oi.item_id,
                        ',"item_name":"',
                CASE 
                            WHEN oi.item_type = 'subscription_plan' THEN 
                                CONCAT(s.name, ' - ', sp.plan_name)
                            WHEN oi.item_type = 'game_topup_variant' THEN 
                                CONCAT(g.game_name, ' - ', gtv.variant_name)
                            WHEN oi.item_type = 'product' THEN 
                                fp.name
                    ELSE 'Unknown Item'
                        END,
                        '","image_url":"',
                CASE 
                            WHEN oi.item_type = 'subscription_plan' THEN 
                            REPLACE(
                                REPLACE(s.logo_url, '/public/', ''),
                                '\\\\public\\\\', ''
                            )
                            WHEN oi.item_type = 'game_topup_variant' THEN 
                            REPLACE(
                                REPLACE(g.game_image_url, '/public/', ''),
                                '\\\\public\\\\', ''
                            )
                            WHEN oi.item_type = 'product' THEN 
                            REPLACE(
                                    REPLACE(fp.image_url, '/public/', ''),
                                '\\\\public\\\\', ''
                            )
                            ELSE ''
                        END,
                        '","quantity":', oi.quantity,
                        ',"price":', oi.price,
                        '}'
                    )
                ) as items
            FROM order_headers oh
            LEFT JOIN order_items oi ON oh.id = oi.order_id
            LEFT JOIN subscription_plans sp ON oi.item_type = 'subscription_plan' AND oi.item_id = sp.id
            LEFT JOIN subscriptions s ON sp.subscription_id = s.id
            LEFT JOIN game_topup_variants gtv ON oi.item_type = 'game_topup_variant' AND oi.item_id = gtv.id
            LEFT JOIN games g ON gtv.game_id = g.id
            LEFT JOIN featured_products fp ON oi.item_type = 'product' AND oi.item_id = fp.id
            WHERE oh.user_id = ?
            GROUP BY oh.id
            ORDER BY oh.created_at DESC
        `, [userId]);

   

        // Process the orders to convert the GROUP_CONCAT string to JSON array
        const processedOrders = orders.map(order => {
            let parsedItems;
            try {
                // Check if items is already a JSON object
                if (order.items && order.items.startsWith('{')) {
                    // Single item case - wrap in array
                    parsedItems = [JSON.parse(order.items)];
                } else if (order.items) {
                    // Multiple items case - wrap in brackets and parse
                    parsedItems = JSON.parse(`[${order.items}]`);
                } else {
                    parsedItems = [];
                }
            } catch (error) {
                console.error('Error parsing order items:', error);
                parsedItems = [];
            }
            
            return {
                ...order,
                items: parsedItems
            };
        });

        res.status(200).json({
            success: true,
            orders: processedOrders
        });
    } catch (error) {
        res.status(200).json({
            status: 'error',
            success: false,
            message: 'Failed to create order'
        });
    }
});

// Get a single order with items
router.get('/:id', verifyToken, verifyCsrf, async (req, res) => {
    try {
        const userId = req.user;
        const orderId = req.params.id;

        // Get order details with all items
        const [orders] = await pool.query(`
            SELECT 
                oh.*,
                GROUP_CONCAT(
                    DISTINCT
                    CONCAT(
                        '{"item_type":"', oi.item_type,
                        '","item_id":', oi.item_id,
                        ',"item_name":"',
                        CASE 
                            WHEN oi.item_type = 'subscription_plan' THEN 
                                CONCAT(s.name, ' - ', sp.plan_name)
                            WHEN oi.item_type = 'game_topup_variant' THEN 
                                CONCAT(g.game_name, ' - ', gtv.variant_name)
                            WHEN oi.item_type = 'product' THEN 
                                fp.name
                            ELSE 'Unknown Item'
                        END,
                        '","image_url":"',
                        CASE 
                            WHEN oi.item_type = 'subscription_plan' THEN 
                                REPLACE(
                                    REPLACE(s.logo_url, '/public/', ''),
                                    '\\\\public\\\\', ''
                                )
                            WHEN oi.item_type = 'game_topup_variant' THEN 
                                REPLACE(
                                    REPLACE(g.game_image_url, '/public/', ''),
                                    '\\\\public\\\\', ''
                                )
                            WHEN oi.item_type = 'product' THEN 
                                REPLACE(
                                    REPLACE(fp.image_url, '/public/', ''),
                                    '\\\\public\\\\', ''
                                )
                            ELSE ''
                        END,
                        '","quantity":', oi.quantity,
                        ',"price":', oi.price,
                        '}'
                    )
                ) as items
            FROM order_headers oh
            LEFT JOIN order_items oi ON oh.id = oi.order_id
            LEFT JOIN subscription_plans sp ON oi.item_type = 'subscription_plan' AND oi.item_id = sp.id
            LEFT JOIN subscriptions s ON sp.subscription_id = s.id
            LEFT JOIN game_topup_variants gtv ON oi.item_type = 'game_topup_variant' AND oi.item_id = gtv.id
            LEFT JOIN games g ON gtv.game_id = g.id
            LEFT JOIN featured_products fp ON oi.item_type = 'product' AND oi.item_id = fp.id
            WHERE oh.id = ? AND oh.user_id = ?
            GROUP BY oh.id
        `, [orderId, userId]);

        if (orders.length === 0) {
            return res.status(200).json({
                status: 'error',
                success: false,
                message: 'Order not found'
            });
        }

        const order = orders[0];

        // Parse the items string into a JSON array
        try {
            if (order.items && order.items.startsWith('{')) {
                // Single item case - wrap in array
                order.items = [JSON.parse(order.items)];
            } else if (order.items) {
                // Multiple items case - wrap in brackets and parse
                order.items = JSON.parse(`[${order.items}]`);
            } else {
                order.items = [];
            }
        } catch (error) {
            console.error('Error parsing order items:', error);
            order.items = [];
        }

        // Get shipping details
        const [shipping] = await pool.query(`
            SELECT * FROM order_shipping WHERE order_id = ?
        `, [orderId]);

        // Get payment proof
        const [paymentProof] = await pool.query(`
            SELECT * FROM order_payment_proof WHERE order_id = ?
        `, [orderId]);

        res.status(200).json({
            success: true,
            order,
            shipping: shipping[0] || null,
            paymentProof: paymentProof[0] || null
        });
    } catch (error) {
        res.status(200).json({
            status: 'error',
            success: false,
            message: 'Failed to create order'
        });
    }
});

// Create a new order
router.post('/', verifyToken, verifyCsrf, async (req, res) => {
    try {
        const userId = req.user;
        const { shipping, payment_method } = req.body;

        // Start a transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Get cart items
            const [cartItems] = await connection.query(`
                SELECT * FROM cart WHERE user_id = ?
            `, [userId]);

            if (cartItems.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

            // Calculate total amount
            const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // Check if any physical products are in the cart
            const hasPhysicalProducts = cartItems.some(item => item.item_type === 'product');

            // Set shipping cost based on cart contents
            const shippingCost = hasPhysicalProducts ? 120 : 0; // NPR 120 for physical products, free for digital items

            const totalAmount = subtotal + shippingCost;

            // Generate order reference with timestamp to ensure uniqueness
            const timestamp = Date.now().toString(36);
            const orderReference = `ORD-${timestamp}-${uuidv4().substring(0, 6).toUpperCase()}`;

            // Create order header
            const [orderHeaderResult] = await connection.query(`
                INSERT INTO order_headers (
                    user_id, order_reference, total_amount, 
                    currency, status, payment_method, payment_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                userId, orderReference, totalAmount,
                'NPR', 'pending', payment_method, 'pending'
            ]);

            const orderId = orderHeaderResult.insertId;

            // Add shipping information
            await connection.query(`
                INSERT INTO order_shipping (
                    order_id, first_name, last_name, phone,
                    address, city, state, postal_code, country
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                orderId, shipping.first_name, shipping.last_name, shipping.phone,
                shipping.address, shipping.city, shipping.state, shipping.postal_code, shipping.country
            ]);

            // Add order items
            for (const item of cartItems) {
                await connection.query(`
                    INSERT INTO order_items (
                        order_id, item_type, item_id, 
                        quantity, price, currency
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    orderId, item.item_type, item.item_id,
                    item.quantity, item.price, 'NPR'
                ]);
            }

            // Commit the transaction
            await connection.commit();
            await pushNotification(userId, "order_created", orderReference);

            // Return the order ID
            res.status(201).json({
                success: true,
                message: 'Order created successfully',
                order_id: orderId,
                order_reference: orderReference
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
   
        res.status(200).json({
            status: 'error',
            success: false,
            message: 'Failed to create order'
        });
    }
});

// Upload payment proof
router.post('/payment-proof', verifyToken, verifyCsrf, uploadPaymentProof.single('payment_proof'), async (req, res) => {
    try {
        const userId = req.user;
        const { order_id } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Check if order exists and belongs to user
        const [orders] = await pool.query(`
            SELECT * FROM order_headers WHERE id = ? AND user_id = ?
        `, [order_id, userId]);

        if (orders.length === 0) {
            // Delete uploaded file
            fs.unlinkSync(req.file.path);

            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Save payment proof to database
        await pool.query(`
            INSERT INTO order_payment_proof (
                order_id, file_url, file_name, file_size
            ) VALUES (?, ?, ?, ?)
        `, [
            order_id, req.file.path.replace(/\\/g, '/'), req.file.originalname, req.file.size
        ]);

        // Update order status
        await pool.query(`
            UPDATE order_headers SET status = 'processing', payment_status = 'pending'
            WHERE id = ?
        `, [order_id]);

        res.status(200).json({
            success: true,
            message: 'Payment proof uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading payment proof:', error);

        // Delete uploaded file if it exists
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: 'Failed to upload payment proof'
        });
    }
});

// Clear cart after successful order
router.post('/clear-cart', verifyToken, verifyCsrf, async (req, res) => {
    try {
        const userId = req.user;

        await pool.query(`
            DELETE FROM cart WHERE user_id = ?
        `, [userId]);

        res.status(200).json({
            success: true,
            message: 'Cart cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear cart'
        });
    }
});

// ========================
// ADMIN ORDER ROUTES
// ========================

// List all orders (admin)
router.get('/admin/orders', verifyToken, verifyCsrf, checkAdminOrStaff, getAllOrdersAdmin);

// Update order/payment status (admin)
router.patch('/admin/orders/:id/status', verifyToken, verifyCsrf, permission, adminUpdateOrderStatus);

// Delete order (admin)
router.delete('/admin/orders/:id', verifyToken, verifyCsrf, permission, adminDeleteOrder);

// Download invoice (admin)
router.get('/admin/orders/:id/invoice', verifyToken, verifyCsrf, checkAdminOrStaff, adminDownloadInvoice);

export default router; 