import { pool } from "../../database/db.js";

export const getSubscriptionDetails = async (req, res) => {
    try {
        const subscriptionId = req.params.id;
        
        // First get the subscription details
        const [subscriptions] = await pool.query(`
            SELECT * FROM subscriptions WHERE id = ?
        `, [subscriptionId]);

        if (!subscriptions || subscriptions.length === 0) {
            return res.redirect('/404');
        }

        const subscription = subscriptions[0];

        // Then get the subscription plans
        const [plans] = await pool.query(`
            SELECT 
                id,
                plan_name,
                price,
                billing_cycle,
                features,
                is_active,
                sort_order
            FROM subscription_plans 
            WHERE subscription_id = ? 
            ORDER BY sort_order ASC
        `, [subscriptionId]);

        // Parse features JSON for each plan
        subscription.plans = plans.map(plan => ({
            ...plan,
            features: JSON.parse(plan.features || '[]')
        }));

        res.render('subscription-details', {
            title: `${subscription.name} Subscription`,
            subscription: subscription,
            user: req.userData || null
        });

    } catch (error) {
        console.error('Error in getSubscriptionDetails:', error);
        res.redirect('/404');
    }
};

export const getGameTopUpDetails = async (req, res) => {
    try {
        const gameId = req.params.id;
        const selectedVariantId = req.query.variant ? parseInt(req.query.variant) : null;

        const [game] = await pool.query(
            `SELECT g.*, GROUP_CONCAT(
                JSON_OBJECT(
                    'id', gt.id,
                    'topup_type', gt.topup_type,
                    'variant_name', gt.variant_name,
                    'description', gt.description,
                    'price', gt.price,
                    'quantity', gt.quantity,
                    'sort_order', gt.sort_order,
                    'is_active', gt.is_active
                )
            ) as variants
            FROM games g
            LEFT JOIN game_topup_variants gt ON g.id = gt.game_id
            WHERE g.id = ? AND g.is_active = true
            GROUP BY g.id`,
            [gameId]
        );

        if (!game[0]) {
            return res.redirect('/404');
        }

        // Parse the variants JSON string
        const product = {
            ...game[0],
            variants: game[0].variants ? JSON.parse(`[${game[0].variants}]`) : []
        };
       
        res.render("game-topup-details", {
            title: `${product.game_name} Top-up`,
            user: req.userData || null,
            product,
            selectedVariant: selectedVariantId,
            isGamePass: false,
            currentUrl: req.originalUrl
        });
    } catch (error) {
        console.error('Error fetching game top-up details:', error);
        res.redirect('/404');
    }
};

export const getGamePassDetails = async (req, res) => {
    try {
        const gameId = req.params.id;
        const selectedVariantId = req.query.variant ? parseInt(req.query.variant) : null;

        const [game] = await pool.query(
            `SELECT g.*, GROUP_CONCAT(
                JSON_OBJECT(
                    'id', gt.id,
                    'topup_type', gt.topup_type,
                    'variant_name', gt.variant_name,
                    'description', gt.description,
                    'price', gt.price,
                    'quantity', gt.quantity,
                    'sort_order', gt.sort_order,
                    'is_active', gt.is_active
                )
            ) as variants
            FROM games g
            LEFT JOIN game_topup_variants gt ON g.id = gt.game_id
            WHERE g.id = ? AND g.is_active = true AND gt.topup_type = 'pass'
            GROUP BY g.id`,
            [gameId]
        );

        if (!game[0]) {
            return res.redirect('/404');
        }

        // Parse the variants JSON string
        const product = {
            ...game[0],
            variants: game[0].variants ? JSON.parse(`[${game[0].variants}]`) : []
        };

        res.render("game-topup-details", {
            title: `${product.game_name} Pass`,
            user: req.userData || null,
            product,
            selectedVariant: selectedVariantId,
            isGamePass: true,
            currentUrl: req.originalUrl
        });
    } catch (error) {
        console.error('Error fetching game pass details:', error);
        res.redirect('/404');
    }
};

export const getProductDetails = async (req, res) => {
  try {
    const { slug } = req.params;
    // Get product by slug
    const [products] = await pool.query(
      `SELECT * FROM featured_products WHERE slug = ? AND is_active = TRUE`,
      [slug]
    );
    if (products.length === 0) {
      return res.status(404).render('404', { title: 'Product Not Found' });
    }
    const product = products[0];
    // Normalize image_url
    product.image_url = normalizeMediaUrl(product.image_url);
    // Get media gallery
    const [media] = await pool.execute(
      'SELECT id, media_url, media_type, media_order FROM featured_product_media WHERE product_id = ? ORDER BY media_order',
      [product.id]
    );
    product.media = media.map(m => ({ ...m, media_url: normalizeMediaUrl(m.media_url) }));
    // Parse tags JSON if exists, fallback to []
    if (Array.isArray(product.tags)) {
      // ok
    } else if (typeof product.tags === 'string') {
      try {
        const parsed = JSON.parse(product.tags);
        product.tags = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        product.tags = product.tags ? [product.tags] : [];
      }
    } else {
      product.tags = [];
    }
    // Ensure rating and review_count are numbers
    product.rating = typeof product.rating === 'number' ? product.rating : parseFloat(product.rating) || 0;
    product.review_count = typeof product.review_count === 'number' ? product.review_count : parseInt(product.review_count) || 0;
    // Render EJS with product, user, and currentUrl
    res.render('product-details', {
      title: product.seo_title || product.name,
      product,
      user: req.userData || null,
      currentUrl: req.originalUrl
    });
  } catch (error) {
    console.error('Error in getProductDetails:', error);
    res.status(500).render('404', { title: 'Product Not Found' });
  }
};

// Helper to normalize image/media URLs
function normalizeMediaUrl(url) {
  if (!url) return url;
  url = url.replace(/\\/g, '/').replace(/\\/g, '/');
  if (url.startsWith('public/')) return '/' + url.slice(7);
  if (url.startsWith('/public/')) return '/' + url.slice(8);
  return url;
} 