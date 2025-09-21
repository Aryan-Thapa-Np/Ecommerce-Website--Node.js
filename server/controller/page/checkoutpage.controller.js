import { pool } from "../../database/db.js";

/**
 * Render the checkout page with cart items and user data
 */
export const checkoutController = async (req, res) => {
  try {
    // If user is not logged in, redirect to login page
    if (!req.user) {
      return res.redirect('/login');
    }

    const userId = req.user;
    
    // Get cart items with detailed information
    const cartQuery = `
      SELECT c.*, 
        CASE 
          WHEN c.item_type = 'subscription_plan' THEN 
            (SELECT CONCAT(s.name, ' - ', sp.plan_name) 
             FROM subscription_plans sp 
             JOIN subscriptions s ON sp.subscription_id = s.id 
             WHERE sp.id = c.item_id)
          WHEN c.item_type = 'game_topup_variant' THEN 
            (SELECT CONCAT(g.game_name, ' - ', gtv.variant_name) 
             FROM game_topup_variants gtv 
             JOIN games g ON gtv.game_id = g.id 
             WHERE gtv.id = c.item_id)
          WHEN c.item_type = 'product' THEN 
            (SELECT name FROM featured_products WHERE id = c.item_id)
        END AS item_name,
        CASE 
          WHEN c.item_type = 'subscription_plan' THEN 
            (SELECT REPLACE(REPLACE(REPLACE(REPLACE(s.logo_url, '/public/', '/'), '\\\\public\\\\', '/'), 'public/', '/'), 'public\\\\', '/') 
             FROM subscription_plans sp 
             JOIN subscriptions s ON sp.subscription_id = s.id 
             WHERE sp.id = c.item_id)
          WHEN c.item_type = 'game_topup_variant' THEN 
            (SELECT REPLACE(REPLACE(REPLACE(REPLACE(g.game_image_url, '/public/', '/'), '\\\\public\\\\', '/'), 'public/', '/'), 'public\\\\', '/') 
             FROM game_topup_variants gtv 
             JOIN games g ON gtv.game_id = g.id 
             WHERE gtv.id = c.item_id)
          WHEN c.item_type = 'product' THEN 
            (SELECT REPLACE(REPLACE(REPLACE(REPLACE(image_url, '/public/', '/'), '\\\\public\\\\', '/'), 'public/', '/'), 'public\\\\', '/') FROM featured_products WHERE id = c.item_id)
        END AS item_image
      FROM cart c
      WHERE c.user_id = ?
    `;
    
    const [cartItems] = await pool.query(cartQuery, [userId]);
    
    // Process cart items to fix any remaining image path issues
    cartItems.forEach(item => {
      if (item.item_image) {
        // Fix image paths that might still have public prefix without leading slash
        item.item_image = item.item_image
          .replace('/public/', '/')
          .replace('\\public\\', '/')
          .replace('public/', '/')
          .replace('public\\', '/');
          
        // Ensure path starts with a slash
        if (!item.item_image.startsWith('/')) {
          item.item_image = '/' + item.item_image;
        }
      }
    });
    
    // Calculate cart totals
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Check if any physical products are in the cart
    const hasPhysicalProducts = cartItems.some(item => item.item_type === 'product');
    
    // Set shipping cost based on cart contents
    const shipping = hasPhysicalProducts ? 120 : 0; // NPR 120 for physical products, free for digital items
    
    const total = subtotal + shipping;
    
    // Get user data for pre-filling shipping form
    const [userData] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    const user = userData[0];
    
    // Render checkout page with data
    res.render('checkout', {
      title: 'Checkout',
      user: req.userData || null,
      cartItems,
      subtotal,
      shipping,
      total,
      userData: user,
      hasPhysicalProducts
    });
    
  } catch (error) {
    console.error('Checkout controller error:', error);
    res.status(500).render('404', { 
      title: 'Error',
      user: req.userData || null,
      error: 'An error occurred while processing your request.'
    });
  }
};
