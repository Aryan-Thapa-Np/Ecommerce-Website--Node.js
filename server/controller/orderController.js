/**
 * Order Controller
 * Handles order creation, tracking, and payment processing
 */

import { pool } from "../database/db.js";
import { pushNotification } from "../utils/notification.js";


import fs from 'fs';
import path from 'path';


// ========================================
// ORDER CREATION (CHECKOUT)
// ========================================

export const createOrder = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const userId = req.user.id;
    const {
      items,
      shipping,
      paymentMethod,
      paymentProof,
      orderReference,
      totalAmount
    } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items provided for order'
      });
    }

    if (!shipping || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Shipping information and payment method are required'
      });
    }

    await connection.beginTransaction();

    // Create order
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (
        user_id, order_type, item_id, quantity, total_amount, 
        currency, status, payment_method, payment_status, 
        order_reference, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId,
        items[0].item_type, // Assuming single item type for now
        items[0].item_id,
        items[0].quantity,
        totalAmount,
        'NPR',
        'pending',
        paymentMethod,
        'pending',
        orderReference
      ]
    );

    const orderId = orderResult.insertId;

    // Store shipping information
    await connection.execute(
      `INSERT INTO order_shipping (
        order_id, first_name, last_name, phone, address, 
        city, state, postal_code, country, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        orderId,
        shipping.first_name,
        shipping.last_name,
        shipping.phone,
        shipping.address,
        shipping.city,
        shipping.state,
        shipping.postal_code,
        shipping.country
      ]
    );

    // Store payment proof files
    if (paymentProof && paymentProof.length > 0) {
      for (const proof of paymentProof) {
        await connection.execute(
          `INSERT INTO order_payment_proof (
            order_id, file_url, file_name, file_size, created_at
          ) VALUES (?, ?, ?, ?, NOW())`,
          [orderId, proof, 'payment_proof', 0]
        );
      }
    }

    // Clear user's cart after successful order
    await connection.execute(
      'DELETE FROM cart WHERE user_id = ?',
      [userId]
    );

    await connection.commit();

    // Send notification to user
    await sendNotification(userId, 'order_placed', {
      title: 'Order Placed Successfully',
      message: `Your order #${orderId} has been placed and is pending payment verification.`,
      icon_class: 'fa-shopping-cart',
      icon_background: 'bg-success'
    });

    // Send notification to admin
    await sendNotification(1, 'new_order', { // Assuming admin user ID is 1
      title: 'New Order Received',
      message: `New order #${orderId} received from user.`,
      icon_class: 'fa-bell',
      icon_background: 'bg-info'
    });

    logger.info(`Order created successfully: Order #${orderId} by User #${userId}`);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        orderId,
        orderReference,
        totalAmount
      }
    });

  } catch (error) {
    await connection.rollback();
    logger.error('Error creating order:', error);

    res.status(200).json({
      status: "error",
      success: false,
      message: 'An error occurred while placing your order'
    });
  } finally {
    connection.release();
  }
};

// ========================================
// GET USER ORDERS
// ========================================

export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      status,
      dateRange,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = ['o.user_id = ?'];
    let params = [userId];

    // Status filter
    if (status) {
      whereConditions.push('o.status = ?');
      params.push(status);
    }

    // Date range filter
    if (dateRange) {
      const days = parseInt(dateRange);
      whereConditions.push('o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)');
      params.push(days);
    }

    // Search filter
    if (search) {
      whereConditions.push('(o.id LIKE ? OR i.name LIKE ? OR o.order_type LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get orders with item details
    const [orders] = await pool.execute(
      `SELECT 
        o.id, o.order_type, o.item_id, o.quantity, o.total_amount,
        o.currency, o.status, o.payment_method, o.payment_status,
        o.order_reference, o.created_at, o.updated_at,
        i.name as item_name, i.image_url as item_image_url,
        sp.name as subscription_name, sp.logo_url as subscription_logo,
        g.game_name, g.game_image_url,
        fp.name as product_name, fp.image_url as product_image_url
      FROM orders o
      LEFT JOIN subscription_plans sp ON o.order_type = 'subscription_plan' AND o.item_id = sp.id
      LEFT JOIN game_topup_variants gtv ON o.order_type = 'game_topup_variant' AND o.item_id = gtv.id
      LEFT JOIN games g ON gtv.game_id = g.id
      LEFT JOIN featured_products fp ON o.order_type = 'product' AND o.item_id = fp.id
      LEFT JOIN (
        SELECT 
          CASE 
            WHEN sp.id IS NOT NULL THEN sp.name
            WHEN gtv.id IS NOT NULL THEN CONCAT(g.game_name, ' - ', gtv.variant_name)
            WHEN fp.id IS NOT NULL THEN fp.name
          END as name,
          CASE 
            WHEN sp.id IS NOT NULL THEN sp.logo_url
            WHEN gtv.id IS NOT NULL THEN g.game_image_url
            WHEN fp.id IS NOT NULL THEN fp.image_url
          END as image_url,
          CASE 
            WHEN sp.id IS NOT NULL THEN sp.id
            WHEN gtv.id IS NOT NULL THEN gtv.id
            WHEN fp.id IS NOT NULL THEN fp.id
          END as item_id
        FROM subscription_plans sp
        LEFT JOIN game_topup_variants gtv ON 1=0
        LEFT JOIN games g ON 1=0
        LEFT JOIN featured_products fp ON 1=0
      ) i ON o.item_id = i.item_id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Get total count for pagination
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}`,
      params
    );

    const totalOrders = countResult[0].total;
    const totalPages = Math.ceil(totalOrders / limit);

    // Process orders to include item details
    const processedOrders = orders.map(order => {
      let itemName = '';
      let itemImageUrl = '';

      if (order.order_type === 'subscription_plan') {
        itemName = order.subscription_name;
        itemImageUrl = order.subscription_logo;
      } else if (order.order_type === 'game_topup_variant') {
        itemName = `${order.game_name} - Top-up`;
        itemImageUrl = order.game_image_url;
      } else if (order.order_type === 'product') {
        itemName = order.product_name;
        itemImageUrl = order.product_image_url;
      }

      // Normalize the image URL
      if (itemImageUrl) {
        // Use the same normalization as productController.js
        itemImageUrl = itemImageUrl.replace(/\\\\/g, '/').replace(/\\/g, '/');
        if (itemImageUrl.startsWith('public/')) itemImageUrl = '/' + itemImageUrl.slice(7);
        if (itemImageUrl.startsWith('/public/')) itemImageUrl = '/' + itemImageUrl.slice(8);
      }

      return {
        ...order,
        item_name: itemName,
        item_image_url: itemImageUrl
      };
    });

    res.json({
      success: true,
      data: processedOrders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalOrders,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    logger.error('Error fetching user orders:', error);

    res.status(200).json({
      status: "error",
      success: false,
      message: 'An error occurred while fetching orders'
    });
  }
};

// ========================================
// GET ORDER BY ID
// ========================================

export const getOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.orderId;

    // Get order details with shipping information
    const [orders] = await pool.execute(
      `SELECT 
        o.*, os.*
      FROM orders o
      LEFT JOIN order_shipping os ON o.id = os.order_id
      WHERE o.id = ? AND o.user_id = ?`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];

    // Get payment proof files
    const [paymentProof] = await pool.execute(
      'SELECT * FROM order_payment_proof WHERE order_id = ?',
      [orderId]
    );

    // Get item details based on order type
    let itemDetails = {};

    if (order.order_type === 'subscription_plan') {
      const [subscription] = await pool.execute(
        `SELECT sp.*, s.name as subscription_name, s.logo_url
         FROM subscription_plans sp
         JOIN subscriptions s ON sp.subscription_id = s.id
         WHERE sp.id = ?`,
        [order.item_id]
      );
      if (subscription.length > 0) {
        itemDetails = subscription[0];
      }
    } else if (order.order_type === 'game_topup_variant') {
      const [gameVariant] = await pool.execute(
        `SELECT gtv.*, g.game_name, g.game_image_url
         FROM game_topup_variants gtv
         JOIN games g ON gtv.game_id = g.id
         WHERE gtv.id = ?`,
        [order.item_id]
      );
      if (gameVariant.length > 0) {
        itemDetails = gameVariant[0];
      }
    } else if (order.order_type === 'product') {
      const [product] = await pool.execute(
        'SELECT * FROM featured_products WHERE id = ?',
        [order.item_id]
      );
      if (product.length > 0) {
        itemDetails = product[0];
      }
    }

    const orderData = {
      ...order,
      item_details: itemDetails,
      payment_proof: paymentProof
    };

    res.json({
      success: true,
      data: orderData
    });

  } catch (error) {
    logger.error('Error fetching order details:', error);

    res.status(200).json({
      status: "error",
      success: false,
      message: 'An error occurred while fetching order details'
    });
  }
};

// ========================================
// UPDATE ORDER STATUS (ADMIN ONLY)
// ========================================

export const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { status, payment_status } = req.body;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const updateFields = [];
    const params = [];

    if (status) {
      updateFields.push('status = ?');
      params.push(status);
    }

    if (payment_status) {
      updateFields.push('payment_status = ?');
      params.push(payment_status);
    }

    if (updateFields.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'No fields to update'
      });
    }

    params.push(orderId);

    await pool.execute(
      `UPDATE orders SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    // Get order details for notification
    const [orders] = await pool.execute(
      'SELECT user_id, status, payment_status FROM orders WHERE id = ?',
      [orderId]
    );

    if (orders.length > 0) {
      const order = orders[0];

      // Send notification to user about status update
      await sendNotification(order.user_id, 'order_status_updated', {
        title: 'Order Status Updated',
        message: `Your order #${orderId} status has been updated to ${status || order.status}.`,
        icon_class: 'fa-info-circle',
        icon_background: 'bg-info'
      });
    }

    logger.info(`Order status updated: Order #${orderId} - Status: ${status}, Payment: ${payment_status}`);

    res.json({
      success: true,
      message: 'Order status updated successfully'
    });

  } catch (error) {
    logger.error('Error updating order status:', error);

    res.status(200).json({
      status: "error",
      success: false,
      message: 'An error occurred while updating order status'
    });
  }
};

// ========================================
// DOWNLOAD INVOICE
// ========================================

export const downloadInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.orderId;

    // Get order details
    const [orders] = await pool.execute(
      `SELECT o.*, os.*, u.email, u.username
       FROM orders o
       LEFT JOIN order_shipping os ON o.id = os.order_id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ? AND o.user_id = ?`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[0];

    // Check if order is completed
    if (order.status !== 'completed') {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Invoice is only available for completed orders'
      });
    }

    // Generate PDF invoice (simplified - you might want to use a proper PDF library)
    const invoiceData = {
      orderId: order.id,
      orderDate: order.created_at,
      customerName: `${order.first_name} ${order.last_name}`,
      customerEmail: order.email,
      customerAddress: `${order.address}, ${order.city}, ${order.state} ${order.postal_code}`,
      totalAmount: order.total_amount,
      paymentMethod: order.payment_method,
      orderReference: order.order_reference
    };

    // For now, return JSON data. In a real implementation, you'd generate a PDF
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${orderId}.json"`);

    res.json({
      success: true,
      data: invoiceData,
      message: 'Invoice data generated. PDF generation would be implemented here.'
    });

  } catch (error) {
    logger.error('Error generating invoice:', error);

    res.status(200).json({
      status: "error",
      success: false,
      message: 'An error occurred while generating invoice'
    });
  }
};

// ========================================
// UPLOAD PAYMENT PROOF
// ========================================

export const uploadPaymentProof = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      size: file.size
    }));

    res.json({
      success: true,
      message: 'Payment proof uploaded successfully',
      data: {
        files: uploadedFiles
      }
    });

  } catch (error) {
    logger.error('Error uploading payment proof:', error);

    res.status(200).json({
      status: "error",
      success: false,
      message: 'An error occurred while uploading payment proof'
    });
  }
};

// ========================
// ADMIN: Get all orders
// ========================
export const getAllOrdersAdmin = async (req, res) => {
  try {


    // Get all orders with user info
    const [orders] = await pool.query(`
      SELECT 
        oh.*, u.username as customer_name, u.email as customer_email
      FROM order_headers oh
      LEFT JOIN users u ON oh.user_id = u.id
      ORDER BY oh.created_at DESC
    `);

    // Get all order items with details
    const [orderItems] = await pool.query(`
      SELECT 
        oi.order_id,
        oi.item_type,
        oi.item_id,
        oi.quantity,
        oi.price,
        CASE 
          WHEN oi.item_type = 'subscription_plan' THEN CONCAT(s.name, ' - ', sp.plan_name)
          WHEN oi.item_type = 'game_topup_variant' THEN CONCAT(g.game_name, ' - ', gtv.variant_name)
          WHEN oi.item_type = 'product' THEN fp.name
          ELSE 'Unknown Item'
        END as item_name,
        CASE 
          WHEN oi.item_type = 'subscription_plan' THEN s.logo_url
          WHEN oi.item_type = 'game_topup_variant' THEN g.game_image_url
          WHEN oi.item_type = 'product' THEN fp.image_url
          ELSE ''
        END as image_url
      FROM order_items oi
      LEFT JOIN subscription_plans sp ON oi.item_type = 'subscription_plan' AND oi.item_id = sp.id
      LEFT JOIN subscriptions s ON sp.subscription_id = s.id
      LEFT JOIN game_topup_variants gtv ON oi.item_type = 'game_topup_variant' AND oi.item_id = gtv.id
      LEFT JOIN games g ON gtv.game_id = g.id
      LEFT JOIN featured_products fp ON oi.item_type = 'product' AND oi.item_id = fp.id
    `);

    // Group items by order_id
    const itemsByOrder = {};
    orderItems.forEach(item => {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }

      // Normalize image URL
      let normalizedImageUrl = item.image_url || '';
      if (normalizedImageUrl) {
        // Remove 'public/' or 'public\\' at the start, normalize all slashes
        normalizedImageUrl = normalizedImageUrl
          .replace(/^public[\\/]+/i, '') // removes 'public/' or 'public\\'
          .replace(/\\/g, '/'); // normalize all slashes to forward
        if (!normalizedImageUrl.startsWith('/')) {
          normalizedImageUrl = '/' + normalizedImageUrl;
        }
      }

      itemsByOrder[item.order_id].push({
        item_type: item.item_type,
        item_id: item.item_id,
        item_name: item.item_name,
        image_url: normalizedImageUrl,
        quantity: item.quantity,
        price: item.price
      });
    });

    // Combine orders with their items and get additional data
    for (const order of orders) {
      // Add items to order
      order.items = itemsByOrder[order.id] || [];

      // Get shipping info
      const [shipping] = await pool.query('SELECT * FROM order_shipping WHERE order_id = ?', [order.id]);
      order.shipping = shipping[0] || null;

      // Get payment proof
      const [paymentProof] = await pool.query('SELECT * FROM order_payment_proof WHERE order_id = ?', [order.id]);
      // Normalize file_url for each payment proof
      order.payment_proof = (paymentProof || []).map(proof => {
        let url = proof.file_url || '';
        if (url) {
          url = url.replace(/^public[\\/]+/i, '').replace(/\\/g, '/');
          if (!url.startsWith('/')) url = '/' + url;
        }
        return { ...proof, file_url: url };
      });
    }

    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to fetch orders' });
  }
};

// ========================
// ADMIN: Update order/payment status
// ========================
export const adminUpdateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, payment_status } = req.body;
    const updateFields = [];
    const params = [];
    if (status) { updateFields.push('status = ?'); params.push(status); }
    if (payment_status) { updateFields.push('payment_status = ?'); params.push(payment_status); }
    if (updateFields.length === 0) {
      return res.status(200).json({ status: "error", success: false, message: 'No fields to update' });
    }
    params.push(orderId);
    await pool.query(`UPDATE order_headers SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`, params);

    const [order] = await pool.query('SELECT user_id, order_reference FROM order_headers WHERE id = ?', [orderId]);
   
    if (order.length > 0) {
     
      if (status === "processing") {
     
        await pushNotification(order[0].user_id, "order_shipped", order[0].order_reference);
      }
      if (status === "completed") {
   
        await pushNotification(order[0].user_id, "order_delivered", order[0].order_reference);
      }
      if (status === "cancelled") {
    
        await pushNotification(order[0].user_id, "order_cancelled", order[0].order_reference);
      }
      if (status === "failed") {
     
        await pushNotification(order[0].user_id, "order_failed", order[0].order_reference);
      }
    }
    res.json({ success: true, message: 'Order status updated' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to update order status' });
  }
};

// ========================
// ADMIN: Delete order
// ========================
export const adminDeleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    // Delete order items, shipping, payment proof, then order header
    await pool.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    await pool.query('DELETE FROM order_shipping WHERE order_id = ?', [orderId]);
    await pool.query('DELETE FROM order_payment_proof WHERE order_id = ?', [orderId]);
    await pool.query('DELETE FROM order_headers WHERE id = ?', [orderId]);
    res.json({ success: true, message: 'Order deleted' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to delete order' });
  }
};

// ========================
// ADMIN: Download Invoice
// ========================
export const adminDownloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;

  

    // Add a 1-second delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get order details
    const [orders] = await pool.execute(
      `SELECT oh.*, u.email, u.username
       FROM order_headers oh
       LEFT JOIN users u ON oh.user_id = u.id
       WHERE oh.id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(200).json({status:"error", success: false, message: 'Order not found' });
    }

    const order = orders[0];

    // Get shipping
    const [shippingRows] = await pool.execute('SELECT * FROM order_shipping WHERE order_id = ?', [orderId]);
    const shipping = shippingRows[0] || {};

    // Get items
    const [items] = await pool.execute(
      `SELECT 
        oi.item_type, oi.item_id, oi.quantity, oi.price,
        CASE 
          WHEN oi.item_type = 'subscription_plan' THEN CONCAT(s.name, ' - ', sp.plan_name)
          WHEN oi.item_type = 'game_topup_variant' THEN CONCAT(g.game_name, ' - ', gtv.variant_name)
          WHEN oi.item_type = 'product' THEN fp.name
          ELSE 'Unknown Item'
        END as item_name
      FROM order_items oi
      LEFT JOIN subscription_plans sp ON oi.item_type = 'subscription_plan' AND oi.item_id = sp.id
      LEFT JOIN subscriptions s ON sp.subscription_id = s.id
      LEFT JOIN game_topup_variants gtv ON oi.item_type = 'game_topup_variant' AND oi.item_id = gtv.id
      LEFT JOIN games g ON gtv.game_id = g.id
      LEFT JOIN featured_products fp ON oi.item_type = 'product' AND oi.item_id = fp.id
      WHERE oi.order_id = ?`,
      [orderId]
    );

    // Calculate shipping cost: 120 if any item is a product, else 0
    let shippingCost = 0;
    if (items.some(i => i.item_type === 'product')) {
      shippingCost = 120;
    }

    // Generate PDF invoice using pdfkit
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.order_reference || order.id}.pdf"`);
    doc.pipe(res);

    // Color palette - Modern clean theme
    const colors = {
      primary: '#2563eb',      // Royal blue
      secondary: '#1e293b',    // Dark slate
      accent: '#3b82f6',       // Bright blue
      text: '#334155',         // Slate gray
      lightText: '#64748b',    // Medium gray
      background: '#f1f5f9',   // Light cool gray
      border: '#cbd5e1',       // Light border
      headerText: '#ffffff',   // White for headers
      tableHeader: '#e2e8f0'   // Table header background
    };

    // Helper function to format date
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Header Section with Company Branding
    doc.rect(0, 0, 612, 80).fill(colors.primary);

    // Company Logo (if exists)
    const logoPath = './controller/logo/nice.jpg'; // Path to logo file
    const logoExists = true; // Set this to true when you have a logo file

    let logoWidth = 0;
    if (logoExists) {
      try {
        // Try different possible paths for the logo
        let logoFilePath = logoPath;
        const alternativePaths = [
          './controller/logo/nice.jpg',
          '../controller/logo/nice.jpg',
          './server/controller/logo/nice.jpg',
          '../server/controller/logo/nice.jpg',
          './logo/nice.jpg',
          '/server/public/logo/nice.jpg',
          './server/public/logo/nice.jpg',
          './public/logo/nice.jpg'
        ];

        // Logo dimensions
        logoWidth = 50;
        const logoHeight = 50;

        // Draw logo on the left side
        doc.image(logoFilePath, 50, 15, {
          width: logoWidth,
          height: logoHeight,
          fit: [logoWidth, logoHeight],
          align: 'center'
        });

        logoWidth += 15; // Add some spacing after logo
      } catch (error) {

        // Try alternative paths as fallback
        try {
         

          // Check if server/public/logo/nice.jpg exists
          const publicLogoPath = path.resolve('./server/public/logo/nice.jpg');
          if (fs.existsSync(publicLogoPath)) {


            // Logo dimensions
            logoWidth = 50;
            const logoHeight = 50;

            // Draw logo on the left side
            doc.image(publicLogoPath, 50, 15, {
              width: logoWidth,
              height: logoHeight,
              fit: [logoWidth, logoHeight],
              align: 'center'
            });

            logoWidth += 15; // Add some spacing after logo
          } else {

            logoWidth = 0;
          }
        } catch (fallbackError) {

          logoWidth = 0;
        }
      }
    }

    // Company Name (positioned after logo if it exists)
    doc.fontSize(32)
      .fillColor(colors.headerText)
      .font('Helvetica-Bold')
      .text('CARTIFY', 50 + logoWidth, 25);

    doc.fontSize(12)
      .fillColor(colors.headerText)
      .font('Helvetica')
      .text('Your Digital Commerce Partner', 50 + logoWidth, 55);

    // Invoice Title and Number (Right side of header)
    doc.fontSize(24)
      .fillColor(colors.headerText)
      .font('Helvetica-Bold')
      .text('INVOICE', 400, 25, { align: 'right', width: 150 });

    doc.fontSize(12)
      .fillColor(colors.headerText)
      .font('Helvetica')
      .text(`#INV-${orderId}`, 400, 55, { align: 'right', width: 150 });

    // Reset position after header
    doc.y = 120;

    // Invoice Details Section with proper labels
    const detailsY = doc.y;

    // Invoice Date
    doc.fontSize(10)
      .fillColor(colors.lightText)
      .font('Helvetica-Bold')
      .text('INVOICE DATE:', 400, detailsY);

    doc.fontSize(11)
      .fillColor(colors.text)
      .font('Helvetica')
      .text(formatDate(order.created_at), 400, detailsY + 12);

    // Order Reference
    doc.fontSize(10)
      .fillColor(colors.lightText)
      .font('Helvetica-Bold')
      .text('ORDER REFERENCE:', 400, detailsY + 30);

    doc.fontSize(11)
      .fillColor(colors.text)
      .font('Helvetica')
      .text(order.order_reference || 'N/A', 400, detailsY + 42);

    // Payment Method
    doc.fontSize(10)
      .fillColor(colors.lightText)
      .font('Helvetica-Bold')
      .text('PAYMENT METHOD:', 400, detailsY + 60);

    doc.fontSize(11)
      .fillColor(colors.text)
      .font('Helvetica')
      .text(order.payment_method || 'N/A', 400, detailsY + 72);

    // Customer Information Section with proper label
    doc.fontSize(10)
      .fillColor(colors.lightText)
      .font('Helvetica-Bold')
      .text('CUSTOMER DETAILS', 50, detailsY);

    doc.fontSize(12)
      .fillColor(colors.secondary)
      .font('Helvetica-Bold')
      .text('BILL TO:', 50, detailsY + 18);

    doc.fontSize(12)
      .fillColor(colors.text)
      .font('Helvetica-Bold')
      .text(order.username || 'N/A', 50, detailsY + 36);

    doc.fontSize(10)
      .fillColor(colors.lightText)
      .font('Helvetica')
      .text(order.email || 'N/A', 50, detailsY + 50);

    // Shipping Information Section with proper label
    if (shipping.first_name || shipping.address) {
      doc.fontSize(10)
        .fillColor(colors.lightText)
        .font('Helvetica-Bold')
        .text('DELIVERY INFORMATION', 50, detailsY + 75);

      doc.fontSize(12)
        .fillColor(colors.secondary)
        .font('Helvetica-Bold')
        .text('SHIP TO:', 50, detailsY + 93);

      let shipY = detailsY + 111;

      // Name
      doc.fontSize(9)
        .fillColor(colors.lightText)
        .font('Helvetica-Bold')
        .text('NAME:', 50, shipY);

      doc.fontSize(10)
        .fillColor(colors.text)
        .font('Helvetica')
        .text(`${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || 'N/A', 120, shipY);

      shipY += 16;

      // Address
      doc.fontSize(9)
        .fillColor(colors.lightText)
        .font('Helvetica-Bold')
        .text('ADDRESS:', 50, shipY);

      doc.fontSize(10)
        .fillColor(colors.text)
        .font('Helvetica')
        .text(shipping.address || 'N/A', 120, shipY, { width: 210 });

      shipY += 16;

      // phone
      doc.fontSize(9)
        .fillColor(colors.lightText)
        .font('Helvetica-Bold')
        .text('PHONE:', 50, shipY);

      doc.fontSize(10)
        .fillColor(colors.text)
        .font('Helvetica')
        .text(shipping.phone || 'N/A', 120, shipY);

      shipY += 16;

      // City/State
      doc.fontSize(9)
        .fillColor(colors.lightText)
        .font('Helvetica-Bold')
        .text('CITY/STATE:', 50, shipY);

      doc.fontSize(10)
        .fillColor(colors.text)
        .font('Helvetica')
        .text([shipping.city, shipping.state].filter(Boolean).join(', ') || 'N/A', 120, shipY);

      shipY += 16;

      // Postal Code
      doc.fontSize(9)
        .fillColor(colors.lightText)
        .font('Helvetica-Bold')
        .text('POSTAL CODE:', 50, shipY);

      doc.fontSize(10)
        .fillColor(colors.text)
        .font('Helvetica')
        .text(shipping.postal_code || 'N/A', 120, shipY);

      shipY += 16;

      // Country
      doc.fontSize(9)
        .fillColor(colors.lightText)
        .font('Helvetica-Bold')
        .text('COUNTRY:', 50, shipY);

      doc.fontSize(10)
        .fillColor(colors.text)
        .font('Helvetica')
        .text(shipping.country || 'N/A', 120, shipY);
    }

    // Items Table Section with proper column layout
    doc.y = Math.max(doc.y, detailsY + 190);
    doc.moveDown(1.5);

    // Table Header Background
    const tableTop = doc.y;
    doc.rect(50, tableTop - 8, 512, 35).fill(colors.tableHeader).stroke(colors.border);

    // Define column positions and widths for proper alignment
    const columns = {
      description: { x: 60, width: 240 },
      quantity: { x: 310, width: 50 },
      unitPrice: { x: 370, width: 80 },
      amount: { x: 460, width: 92 }
    };

    // Table Headers with proper positioning
    doc.fontSize(11)
      .fillColor(colors.secondary)
      .font('Helvetica-Bold')
      .text('DESCRIPTION', columns.description.x, tableTop + 5, {
        width: columns.description.width,
        align: 'left'
      })
      .text('QTY', columns.quantity.x, tableTop + 5, {
        width: columns.quantity.width,
        align: 'center'
      })
      .text('UNIT PRICE', columns.unitPrice.x, tableTop + 5, {
        width: columns.unitPrice.width,
        align: 'right'
      })
      .text('AMOUNT', columns.amount.x, tableTop + 5, {
        width: columns.amount.width,
        align: 'right'
      });

    let currentY = tableTop + 27;
    let subtotal = 0;

    // Table Items with proper column constraints
    items.forEach((item, index) => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;

      // Row height calculation based on content
      const rowHeight = 28;

      // Alternating row colors
      const rowColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(50, currentY, 512, rowHeight).fill(rowColor).stroke(colors.border);

      // Item description with text wrapping and ellipsis
      doc.fontSize(10)
        .fillColor(colors.text)
        .font('Helvetica')
        .text(item.item_name || 'Unknown Item', columns.description.x, currentY + 8, {
          width: columns.description.width - 10,
          height: rowHeight - 10,
          ellipsis: true,
          lineBreak: false
        });

      // Quantity (centered)
      doc.text(item.quantity.toString(), columns.quantity.x, currentY + 8, {
        width: columns.quantity.width,
        align: 'center'
      });

      // Unit Price (right aligned)
      doc.text(`${Number(item.price).toFixed(2)} NPR`, columns.unitPrice.x, currentY + 8, {
        width: columns.unitPrice.width,
        align: 'right'
      });

      // Amount (right aligned)
      doc.font('Helvetica-Bold')
        .text(`${Number(itemTotal).toFixed(2)} NPR`, columns.amount.x, currentY + 8, {
          width: columns.amount.width,
          align: 'right'
        });

      currentY += rowHeight;
    });

    // Table bottom border
    doc.rect(50, tableTop - 8, 512, currentY - tableTop + 8).stroke(colors.border);

    // Summary Section with improved styling
    currentY += 25;
    const summaryX = 340;
    const labelWidth = 110;
    const valueWidth = 100;

    // Summary background with rounded corners effect
    doc.rect(summaryX - 15, currentY - 15, 235, 180)
      .fill(colors.background)
      .stroke(colors.border);

    // Add subtle inner border
    doc.rect(summaryX - 10, currentY - 10, 225, 170)
      .stroke(colors.border);

    currentY += 5;

    // Subtotal
    doc.fontSize(11)
      .fillColor(colors.text)
      .font('Helvetica')
      .text('Subtotal:', summaryX, currentY, { width: labelWidth, align: 'left' });

    doc.font('Helvetica-Bold')
      .text(`${subtotal.toFixed(2)} NPR`, summaryX + labelWidth, currentY, { width: valueWidth, align: 'right' });
    currentY += 18;

    // Shipping
    doc.font('Helvetica')
      .text('Shipping:', summaryX, currentY, { width: labelWidth, align: 'left' });

    doc.font('Helvetica-Bold')
      .text(`${shippingCost.toFixed(2)} NPR`, summaryX + labelWidth, currentY, { width: valueWidth, align: 'right' });
    currentY += 18;

    // Separator line
    doc.moveTo(summaryX, currentY + 5)
      .lineTo(summaryX + 210, currentY + 5)
      .stroke(colors.accent);
    currentY += 15;

    // Total Amount with clean border
    doc.rect(summaryX - 5, currentY - 2, 220, 25)
      .lineWidth(1)
      .stroke(colors.border);

    doc.fillOpacity(1);
    doc.fontSize(14)
      .fillColor(colors.secondary)
      .font('Helvetica-Bold')
      .text('TOTAL:', summaryX + 5, currentY + 5, { width: labelWidth, align: 'left' });

    doc.fontSize(14)
      .text(`${(subtotal + shippingCost).toFixed(2)} NPR`, summaryX + labelWidth, currentY + 5, { width: valueWidth, align: 'right' });
    currentY += 35;

    // Status Information with better formatting
    currentY += 25;

    // Draw a separator line
    doc.moveTo(summaryX, currentY - 10)
      .lineTo(summaryX + 210, currentY - 10)
      .lineWidth(0.5)
      .stroke(colors.border);

    doc.fontSize(10)
      .fillColor(colors.secondary)
      .font('Helvetica-Bold')
      .text('ORDER STATUS:', summaryX, currentY);

    // Simple status display with color
    const orderStatusText = order.status || 'N/A';
    const orderStatusX = summaryX + 100;

    let statusColor;
    switch (orderStatusText.toLowerCase()) {
      case 'completed':
        statusColor = '#10b981'; // green
        break;
      case 'pending':
        statusColor = '#f59e0b'; // amber
        break;
      case 'cancelled':
        statusColor = '#ef4444'; // red
        break;
      default:
        statusColor = '#6b7280'; // gray
    }

    doc.fillColor(statusColor)
      .font('Helvetica-Bold')
      .text(orderStatusText, orderStatusX, currentY);

    currentY += 25;

    doc.fillColor(colors.secondary)
      .font('Helvetica-Bold')
      .text('PAYMENT STATUS:', summaryX, currentY);

    // Simple payment status display with color
    const paymentStatusText = order.payment_status || 'N/A';
    const paymentStatusX = summaryX + 100;

    let paymentColor;
    switch (paymentStatusText.toLowerCase()) {
      case 'paid':
        paymentColor = '#10b981'; // green
        break;
      case 'pending':
        paymentColor = '#f59e0b'; // amber
        break;
      case 'failed':
        paymentColor = '#ef4444'; // red
        break;
      default:
        paymentColor = '#6b7280'; // gray
    }

    doc.fillColor(paymentColor)
      .font('Helvetica-Bold')
      .text(paymentStatusText, paymentStatusX, currentY);

    // Footer Section with enhanced styling
    doc.y = Math.max(doc.y, currentY + 60);

    // Footer border with accent color
    doc.moveTo(50, doc.y)
      .lineTo(562, doc.y)
      .strokeColor(colors.accent)
      .lineWidth(2)
      .stroke();
    doc.moveDown(1);

    // Thank you message with better typography
    doc.fontSize(14)
      .fillColor(colors.primary)
      .font('Helvetica-Bold')
      .text('Thank you for your business!', { align: 'center' });

    doc.fontSize(10)
      .fillColor(colors.lightText)
      .font('Helvetica')
      .text('For any questions regarding this invoice, please contact our support team.', { align: 'center' });

    // Company contact info
    doc.moveDown(0.5);
    doc.fontSize(9)
      .fillColor(colors.lightText)
      .font('Helvetica')
      .text('support@cartify.com | +977-1-4XXXXXX | www.cartify.com', { align: 'center' });

    // Page numbering with better positioning
    doc.fontSize(8)
      .fillColor(colors.lightText)
      .font('Helvetica')
      .text(`Page 1 of 1 | Invoice #INV-${orderId} | Generated on ${formatDate(new Date())}`,
        50, 750, { align: 'center', width: 512 });

    doc.end();

   

  } catch (error) {
    console.error('Error generating admin invoice:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to generate invoice' });
  }
};