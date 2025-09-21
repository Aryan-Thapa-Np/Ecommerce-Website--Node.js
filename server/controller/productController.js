import { pool } from '../database/db.js';

// ========================================
// SUBSCRIPTION CONTROLLERS
// ========================================

// Get all subscriptions with their plans
export const getSubscriptions = async (req, res) => {
  try {
    // Check if tables exist
    const [tables] = await pool.execute(`SHOW TABLES LIKE 'subscriptions'`);
    if (tables.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Get subscriptions with minimum price
    const [subscriptions] = await pool.execute(`
      SELECT 
        s.*,
        MIN(sp.price) as starting_price
      FROM subscriptions s
      LEFT JOIN subscription_plans sp ON s.id = sp.subscription_id AND sp.is_active = TRUE
      WHERE s.is_active = TRUE 
      GROUP BY s.id
      ORDER BY s.id
    `);

    // Get plans for each subscription
    const [plans] = await pool.execute(`
      SELECT * FROM subscription_plans 
      WHERE is_active = TRUE 
      ORDER BY subscription_id, sort_order
    `);

    // Group plans by subscription_id
    const plansBySubscription = {};
    plans.forEach(plan => {
      if (!plansBySubscription[plan.subscription_id]) {
        plansBySubscription[plan.subscription_id] = [];
      }
      plansBySubscription[plan.subscription_id].push({
        id: plan.id,
        plan_name: plan.plan_name,
        price: plan.price,
        currency: plan.currency,
        billing_cycle: plan.billing_cycle,
        features: plan.features,
        is_active: plan.is_active,
        sort_order: plan.sort_order
      });
    });

    // Combine subscriptions with their plans
    const subscriptionsWithPlans = subscriptions.map(subscription => ({
      ...subscription,
      plans: plansBySubscription[subscription.id] || []
    }));

    res.json({
      success: true,
      data: subscriptionsWithPlans
    });
  } catch (error) {
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch subscriptions'
    });
  }
};

// Get subscription by ID with plans
export const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get subscription
    const [subscriptions] = await pool.execute(`
      SELECT * FROM subscriptions 
      WHERE id = ? AND is_active = TRUE
    `, [id]);

    if (subscriptions.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Subscription not found'
      });
    }

    // Get plans for this subscription
    const [plans] = await pool.execute(`
      SELECT * FROM subscription_plans 
      WHERE subscription_id = ? AND is_active = TRUE 
      ORDER BY sort_order
    `, [id]);

    const subscription = {
      ...subscriptions[0],
      plans: plans.map(plan => ({
        id: plan.id,
        plan_name: plan.plan_name,
        price: plan.price,
        currency: plan.currency,
        billing_cycle: plan.billing_cycle,
        features: plan.features,
        is_active: plan.is_active,
        sort_order: plan.sort_order
      }))
    };

    res.status(200).json({
      status: "success",
      success: true,
      message: "Subscription details fetched successfully",
      data: subscription
    });
  } catch (error) {
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch subscription details'
    });
  }
};

// Create new subscription
export const createSubscription = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { name, description } = req.body;
    // Set logo_url from uploaded file if present
    let logo_url = null;
    if (req.file) {
      logo_url = req.file.path.replace(/\\/g, '/').replace('public/', '/');
    }

    // Insert subscription
    const [result] = await connection.execute(`
      INSERT INTO subscriptions (name, logo_url, description)
      VALUES (?, ?, ?)
    `, [name, logo_url, description]);
    const subscriptionId = result.insertId;

    // --- PLAN HANDLING ---
    let plans = [];
    if (req.body.plans) {
      try {
        plans = typeof req.body.plans === 'string' ? JSON.parse(req.body.plans) : req.body.plans;
      } catch (e) {
        res.status(200).json({
          status: "error",
          success: false,
          message: 'Invalid plan data format'
        });
        return;
      }
    }
    for (const plan of plans) {
      let features = plan.features ? JSON.stringify(plan.features) : '[]';
      await connection.execute(
        `INSERT INTO subscription_plans 
          (subscription_id, plan_name, price, currency, billing_cycle, is_active, sort_order, features)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          subscriptionId,
          plan.plan_name,
          plan.price,
          plan.currency || 'NPR',
          plan.billing_cycle,
          plan.is_active ? 1 : 0,
          plan.sort_order || 0,
          features
        ]
      );
    }

    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: { id: subscriptionId }
    });
  } catch (error) {
    await connection.rollback();
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to create subscription'
    });
  } finally {
    connection.release();
  }
};

// Update subscription
export const updateSubscription = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { name, description, is_active } = req.body;

    // Handle logo_url
    let logo_url;
    if (req.file) {
      logo_url = req.file.path.replace(/\\/g, '/').replace('public/', '/');
    } else if (typeof req.body.logo_url !== 'undefined' && req.body.logo_url) {
      logo_url = req.body.logo_url;
    } else {
      // Fetch current logo_url from DB
      const [rows] = await connection.execute('SELECT logo_url FROM subscriptions WHERE id = ?', [id]);
      logo_url = rows.length > 0 ? rows[0].logo_url : null;
    }

    const isActiveValue = typeof is_active !== 'undefined' ? is_active : 1;

    // Update subscription
    await connection.execute(`
      UPDATE subscriptions 
      SET name = ?, logo_url = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, logo_url, description, isActiveValue, id]);

    // --- PLAN HANDLING ---
    let plans = [];
    let deletedPlans = [];
    if (req.body.plans) {
      try {
        plans = typeof req.body.plans === 'string' ? JSON.parse(req.body.plans) : req.body.plans;
      } catch (e) {
        throw new Error('Invalid plans data');
      }
    }
    if (req.body.deleted_plans) {
      try {
        deletedPlans = typeof req.body.deleted_plans === 'string' ? JSON.parse(req.body.deleted_plans) : req.body.deleted_plans;
      } catch (e) {
        deletedPlans = [];
      }
    }

    // Delete removed plans
    if (deletedPlans.length > 0) {
      await connection.execute(
        'DELETE FROM subscription_plans WHERE id IN (?) AND subscription_id = ?',
        [deletedPlans, id]
      );
    }

    // Upsert plans
    for (const plan of plans) {
      let features = plan.features ? JSON.stringify(plan.features) : '[]';
      if (plan.id) {
        // Update
        await connection.execute(
          `UPDATE subscription_plans SET 
            plan_name = ?, price = ?, currency = ?, billing_cycle = ?, is_active = ?, sort_order = ?, features = ?
            WHERE id = ? AND subscription_id = ?`,
          [
            plan.plan_name,
            plan.price,
            plan.currency || 'NPR',
            plan.billing_cycle,
            plan.is_active ? 1 : 0,
            plan.sort_order || 0,
            features,
            plan.id,
            id
          ]
        );
      } else {
        // Insert
        await connection.execute(
          `INSERT INTO subscription_plans 
            (subscription_id, plan_name, price, currency, billing_cycle, is_active, sort_order, features)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            plan.plan_name,
            plan.price,
            plan.currency || 'NPR',
            plan.billing_cycle,
            plan.is_active ? 1 : 0,
            plan.sort_order || 0,
            features
          ]
        );
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Subscription updated successfully'
    });
  } catch (error) {
    await connection.rollback();
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to update subscription'
    });
  } finally {
    connection.release();
  }
};

// Delete subscription
export const deleteSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(`
      DELETE FROM subscriptions WHERE id = ?
    `, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      message: 'Subscription deleted successfully'
    });
  } catch (error) {
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to delete subscription'
    });
  }
};

// ========================================
// GAME CONTROLLERS
// ========================================

// Get all games with their variants
export const getGames = async (req, res) => {
  try {
    // Check if tables exist
    const [tables] = await pool.execute(`SHOW TABLES LIKE 'games'`);
    if (tables.length === 0) {
      return res.json({
        status: "error",
        success: true,
        data: []
      });
    }

    // Get games with minimum price
    const [games] = await pool.execute(`
      SELECT 
        g.*,
        MIN(gtv.price) as starting_price
      FROM games g
      LEFT JOIN game_topup_variants gtv ON g.id = gtv.game_id AND gtv.is_active = TRUE
      WHERE g.is_active = TRUE 
      GROUP BY g.id
      ORDER BY g.id
    `);

    // Get variants for each game
    const [variants] = await pool.execute(`
      SELECT * FROM game_topup_variants 
      WHERE is_active = TRUE 
      ORDER BY game_id, sort_order
    `);

    // Group variants by game_id
    const variantsByGame = {};
    variants.forEach(variant => {
      if (!variantsByGame[variant.game_id]) {
        variantsByGame[variant.game_id] = [];
      }
      variantsByGame[variant.game_id].push({
        id: variant.id,
        topup_type: variant.topup_type,
        variant_name: variant.variant_name,
        description: variant.description,
        price: variant.price,
        currency: variant.currency,
        quantity: variant.quantity,
        is_active: variant.is_active,
        sort_order: variant.sort_order
      });
    });

    // Combine games with their variants
    const gamesWithVariants = games.map(game => ({
      ...game,
      variants: variantsByGame[game.id] || []
    }));

    res.status(200).json({
      status: "success",
      success: true,
      data: gamesWithVariants
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch games'
    });
  }
};

// Get game by ID with variants
export const getGameById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get game
    const [games] = await pool.execute(`
      SELECT * FROM games 
      WHERE id = ? AND is_active = TRUE
    `, [id]);

    if (games.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Game not found'
      });
    }

    // Get variants for this game
    const [variants] = await pool.execute(`
      SELECT * FROM game_topup_variants 
      WHERE game_id = ? AND is_active = TRUE 
      ORDER BY sort_order
    `, [id]);

    const game = {
      ...games[0],
      variants: variants.map(variant => ({
        id: variant.id,
        topup_type: variant.topup_type,
        variant_name: variant.variant_name,
        description: variant.description,
        price: variant.price,
        currency: variant.currency,
        quantity: variant.quantity,
        is_active: variant.is_active,
        sort_order: variant.sort_order
      }))
    };

    res.status(200).json({
      status: "success",
      success: true,
      data: game
    });
  } catch (error) {
    
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch game'
    });
  }
};

// Create new game
export const createGame = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { game_name, description, is_active } = req.body;
    const variants = JSON.parse(req.body.variants || '[]');
    const game_image_url = req.file ? normalizeMediaUrl(req.file.path) : null;

    if (!game_name || !game_image_url) {
      throw new Error('Game name and image are required');
    }

    // Insert game
    const [gameResult] = await connection.query(
      'INSERT INTO games (game_name, game_image_url, description, is_active) VALUES (?, ?, ?, ?)',
      [game_name, game_image_url, description, is_active === 'true' || is_active === true]
    );

    const gameId = gameResult.insertId;

    // Insert variants
    if (variants.length > 0) {
      const variantValues = variants.map(v => [
        gameId,
        v.topup_type,
        v.variant_name,
        v.description,
        v.price,
        v.currency || 'NPR',
        v.quantity,
        v.is_active,
        v.sort_order
      ]);

      await connection.query(
        `INSERT INTO game_topup_variants 
         (game_id, topup_type, variant_name, description, price, currency, quantity, is_active, sort_order) 
         VALUES ?`,
        [variantValues]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Game created successfully',
      data: { id: gameId }
    });
  } catch (error) {
    await connection.rollback();
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to create game'
    });
  } finally {
    connection.release();
  }
};

// Update game
export const updateGame = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { game_name, description } = req.body;
    const is_active = req.body.is_active === '1' || req.body.is_active === 1 || req.body.is_active === true || req.body.is_active === 'true';
    
    let variants = [];
    let deletedVariants = [];
    
    // Parse variants data
    try {
      const variantsStr = req.body.variants;
      const deletedVariantsStr = req.body.deleted_variants;
      
      
      
      if (typeof variantsStr === 'string') {
        try {
          variants = JSON.parse(variantsStr);
          // Ensure variants is an array and not a string
          if (typeof variants === 'string') {
            variants = JSON.parse(variants);
          }
        } catch (e) {
          console.error('Error parsing variants JSON:', e);
          throw new Error('Invalid variants data format');
        }
      }
      
      if (typeof deletedVariantsStr === 'string') {
        try {
          deletedVariants = JSON.parse(deletedVariantsStr);
        } catch (e) {
          console.error('Error parsing deleted variants:', e);
          deletedVariants = [];
        }
      }
      
      // Validate variants array
      if (!Array.isArray(variants)) {
        console.error('Variants is not an array:', variants);
        throw new Error('Invalid variants data format');
      }
      if (!Array.isArray(deletedVariants)) {
        console.error('DeletedVariants is not an array:', deletedVariants);
        deletedVariants = [];
      }

      
    } catch (e) {
      console.error('Error processing variants data:', e);
      throw new Error('Invalid variants data');
    }

    const game_image_url = req.file ? normalizeMediaUrl(req.file.path) : null;

    if (!game_name) {
      throw new Error('Game name is required');
    }

    // Update game
    const updateFields = ['game_name = ?', 'description = ?', 'is_active = ?'];
    const updateValues = [game_name, description || '', is_active];

    if (game_image_url) {
      updateFields.push('game_image_url = ?');
      updateValues.push(game_image_url);
    }

    updateValues.push(id);

    await connection.query(
      `UPDATE games SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Delete removed variants first
    if (deletedVariants.length > 0) {
      await connection.query(
        'DELETE FROM game_topup_variants WHERE id IN (?) AND game_id = ?',
        [deletedVariants, id]
      );
    }

    // Process each variant
    for (const variant of variants) {
      try {
        // Validate required fields
        if (!variant.variant_name || !variant.quantity) {
        
          continue;
        }

        // Convert variant active status
        const variantIsActive = variant.is_active === 1 || variant.is_active === true || variant.is_active === '1' || variant.is_active === 'true' || variant.is_active === 'on';

        if (variant.id) {
          // Update existing variant
          const [result] = await connection.query(
            `UPDATE game_topup_variants SET 
             topup_type = ?,
             variant_name = ?,
             description = ?,
             price = ?,
             currency = ?,
             quantity = ?,
             is_active = ?,
             sort_order = ?
             WHERE id = ? AND game_id = ?`,
            [
              variant.topup_type,
              variant.variant_name,
              variant.description || '',
              parseFloat(variant.price) || 0,
              variant.currency || 'NPR',
              variant.quantity,
              variantIsActive ? 1 : 0,
              parseInt(variant.sort_order) || 0,
              variant.id,
              id
            ]
          );
          
        } else {
          // Insert new variant
          const [result] = await connection.query(
            `INSERT INTO game_topup_variants 
             (game_id, topup_type, variant_name, description, price, currency, quantity, is_active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              variant.topup_type,
              variant.variant_name,
              variant.description || '',
              parseFloat(variant.price) || 0,
              variant.currency || 'NPR',
              variant.quantity,
              variantIsActive ? 1 : 0,
              parseInt(variant.sort_order) || 0
            ]
          );
        
        }
      } catch (variantError) {
        console.error('Error processing variant:', variant, variantError);
        throw variantError;
      }
    }

    await connection.commit();

    // Fetch updated game with variants
    const [updatedGames] = await connection.query(
      `SELECT g.*, 
        GROUP_CONCAT(
          CONCAT_WS('::',
            v.id,
            v.topup_type,
            v.variant_name,
            v.description,
            v.price,
            v.currency,
            v.quantity,
            v.is_active,
            v.sort_order
          )
        ) as variants
      FROM games g
      LEFT JOIN game_topup_variants v ON g.id = v.game_id
      WHERE g.id = ?
      GROUP BY g.id`,
      [id]
    );

    if (!updatedGames || updatedGames.length === 0) {
      throw new Error('Failed to fetch updated game data');
    }

    const updatedGame = updatedGames[0];
    
    // Parse the variants string into array of objects
    if (updatedGame.variants) {
      try {
        const variantStrings = updatedGame.variants.split(',');
        updatedGame.variants = variantStrings
          .filter(str => str && str.trim()) // Filter out empty strings
          .map(variantStr => {
            const [
              id,
              topup_type,
              variant_name,
              description,
              price,
              currency,
              quantity,
              is_active,
              sort_order
            ] = variantStr.split('::').map(s => s === 'null' ? null : s);

            return {
              id: id ? parseInt(id) : null,
              topup_type,
              variant_name,
              description: description || '',
              price: parseFloat(price) || 0,
              currency: currency || 'NPR',
              quantity,
              is_active: is_active === '1' || is_active === 'true',
              sort_order: parseInt(sort_order) || 0
            };
          });
      } catch (e) {
        console.error('Error parsing updated variants:', e);
        updatedGame.variants = [];
      }
    } else {
      updatedGame.variants = [];
    }

    res.json({
      success: true,
      message: 'Game updated successfully',
      data: updatedGame
    });
  } catch (error) {
    await connection.rollback();
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to update game'
    });
  } finally {
    connection.release();
  }
};

// Delete game
export const deleteGame = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Delete variants first (due to foreign key constraint)
    await connection.query('DELETE FROM game_topup_variants WHERE game_id = ?', [id]);

    // Delete the game
    await connection.query('DELETE FROM games WHERE id = ?', [id]);

    await connection.commit();

    res.json({
      success: true,
      message: 'Game deleted successfully'
    });
  } catch (error) {
    await connection.rollback();
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to delete game'
    });
  } finally {
    connection.release();
  }
};

// ========================================
// PRODUCT CONTROLLERS
// ========================================

// Get all featured products
export const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 12, category, search } = req.query;

    let query = `
      SELECT * FROM featured_products 
      WHERE is_active = TRUE AND is_featured = TRUE
    `;
    const params = [];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (name LIKE ? OR description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [products] = await pool.execute(query, params);

    res.status(200).json({
      status: "success",
      success: true,
      data: products
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch featured products'
    });
  }
};

// Get product by ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const [products] = await pool.execute(`
      SELECT * FROM featured_products 
      WHERE id = ? AND is_active = TRUE
    `, [id]);
    if (products.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Product not found'
      });
    }
    const product = products[0];
    product.image_url = normalizeMediaUrl(product.image_url);
    // Get media
    const [media] = await pool.execute('SELECT id, media_url, media_type, media_order FROM featured_product_media WHERE product_id = ? ORDER BY media_order', [product.id]);
    product.media = media.map(m => ({ ...m, media_url: normalizeMediaUrl(m.media_url) }));
    res.status(200).json({
      status: "success",
      success: true,
      data: product
    });
  } catch (error) {
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch product'
    });
  }
};

// Get product by slug
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const [products] = await pool.query(`
      SELECT * FROM featured_products 
      WHERE slug = ? AND is_active = TRUE
    `, [slug]);
    if (products.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Product not found'
      });
    }
    const product = products[0];
    product.image_url = normalizeMediaUrl(product.image_url);
    // Get media
    const [media] = await pool.execute('SELECT id, media_url, media_type, media_order FROM featured_product_media WHERE product_id = ? ORDER BY media_order', [product.id]);
    product.media = media.map(m => ({ ...m, media_url: normalizeMediaUrl(m.media_url) }));
    // Parse tags JSON if exists
    product.tags = product.tags ? JSON.parse(product.tags) : [];
    res.status(200).json({
      status: "success",
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch product'
    });
  }
};

// Create new product (with multiple media)
export const createProduct = async (req, res) => {
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const {
      name, slug, description, long_description, meta_description,
      current_price, original_price, category, tags,
      seo_title, seo_keywords, stock_status, is_featured, is_active, currency
    } = req.body;
    
    // Enforce 5-image limit
    if (req.files && req.files.length > 5) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Maximum 5 images allowed per product' 
      });
    }
    
    // Determine featured image URL (first image)
    let imageUrl = '';
    if (req.files && req.files.length > 0) {
      imageUrl = req.files[0].path.replace(/^public\//, '/');
    }
    
    // --- FIX: Ensure tags is an array, not a stringified array ---
    let fixedTags = tags;
    if (typeof fixedTags === 'string') {
      try {
        fixedTags = JSON.parse(fixedTags);
      } catch (e) {
        // fallback: treat as comma-separated string
        fixedTags = fixedTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }
    // Insert product
    const [result] = await connection.execute(`
      INSERT INTO featured_products (
        name, slug, image_url, description, long_description, meta_description,
        current_price, original_price, category, tags,
        seo_title, seo_keywords, stock_status, is_featured, is_active, currency
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, slug, imageUrl, description, long_description || null, meta_description,
      current_price, original_price, category, JSON.stringify(fixedTags || []),
      seo_title, seo_keywords, stock_status, is_featured, is_active, currency]);
    const productId = result.insertId;
    
    // Insert media
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const ext = file.originalname.split('.').pop().toLowerCase();
        const mediaType = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext) ? 'video' : 'image';
        await connection.execute(
          'INSERT INTO featured_product_media (product_id, media_url, media_type, media_order) VALUES (?, ?, ?, ?)',
          [productId, file.path.replace(/^public\//, '/'), mediaType, i]
        );
      }
    }
    
    await connection.commit();
    res.status(204).end();
  } catch (error) {
    await connection.rollback();
    console.error('Error creating product:', error);
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to create product'
    });
  } finally {
    connection.release();
  }
};

// Update product (with media)
export const updateProduct = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const {
      name, slug, description, long_description, meta_description,
      current_price, original_price, category, tags,
      seo_title, seo_keywords, is_active, is_featured, stock_status, currency,
      existing_media_ids, media_order, featured_image_url
    } = req.body;
    
   
    // Enforce 5-image limit
    const newMediaCount = req.files ? req.files.length : 0;
    const existingMediaCount = existing_media_ids ? JSON.parse(existing_media_ids).length : 0;
    
    if (newMediaCount + existingMediaCount > 5) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Maximum 5 images allowed per product' 
      });
    }
    
    // Determine featured image URL
    let imageUrl = '';
    if (featured_image_url) {
      // Use client-provided featured image URL
      imageUrl = featured_image_url;
    } else if (existingMediaCount > 0) {
      // Get the first existing media as featured image
      const [firstMedia] = await connection.execute(
        'SELECT media_url FROM featured_product_media WHERE product_id = ? ORDER BY media_order LIMIT 1',
        [id]
      );
      if (firstMedia && firstMedia.length > 0) {
        imageUrl = firstMedia[0].media_url;
      }
    } else if (newMediaCount > 0) {
      // First new image will be featured
      imageUrl = req.files[0].path.replace(/^public\//, '/');
    }
    
    // --- FIX: Ensure tags is an array, not a stringified array ---
    let fixedTags = tags;
    if (typeof fixedTags === 'string') {
      try {
        fixedTags = JSON.parse(fixedTags);
      } catch (e) {
        // fallback: treat as comma-separated string
        fixedTags = fixedTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }
    // Update product
    const [result] = await connection.execute(`
      UPDATE featured_products 
      SET name = ?, slug = ?, description = ?, long_description = ?, meta_description = ?,
          current_price = ?, original_price = ?, category = ?, tags = ?,
          seo_title = ?, seo_keywords = ?, is_active = ?, is_featured = ?, 
          stock_status = ?, currency = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, slug, description, long_description || null, meta_description,
      current_price, original_price, category, JSON.stringify(fixedTags || []),
      seo_title, seo_keywords, is_active, is_featured, stock_status, currency, 
      imageUrl, id]);
   
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Handle media updates
    let mediaIdsToKeep = [];
    if (existing_media_ids) {
      try {
        mediaIdsToKeep = JSON.parse(existing_media_ids);
      } catch (e) {
        console.error('Error parsing existing_media_ids:', e);
      }
    }
    
    // Process media ordering if provided
    if (media_order) {
      try {
        const orderData = JSON.parse(media_order);
        // Update each media item's order
        for (const item of orderData) {
          if (item.id && mediaIdsToKeep.includes(item.id)) {
            await connection.execute(
              'UPDATE featured_product_media SET media_order = ? WHERE id = ? AND product_id = ?',
              [item.order, item.id, id]
            );
          }
        }
      } catch (e) {
        console.error('Error processing media_order:', e);
      }
    }
    
    // If we have existing media IDs to keep, only delete media NOT in that list
    if (mediaIdsToKeep.length > 0) {
      const placeholders = mediaIdsToKeep.map(() => '?').join(',');
      await connection.execute(
        `DELETE FROM featured_product_media WHERE product_id = ? AND id NOT IN (${placeholders})`,
        [id, ...mediaIdsToKeep]
      );
    } else {
      // Otherwise delete all media for this product
      await connection.execute('DELETE FROM featured_product_media WHERE product_id = ?', [id]);
    }
    
    // Add new media files
    if (req.files && req.files.length > 0) {
      // Get the highest current order value
      const [orderResult] = await connection.execute(
        'SELECT COALESCE(MAX(media_order), -1) as max_order FROM featured_product_media WHERE product_id = ?',
        [id]
      );
      let startOrder = orderResult[0].max_order + 1;
      // Add new media files
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const ext = file.originalname.split('.').pop().toLowerCase();
        const mediaType = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext) ? 'video' : 'image';
        // Check for duplicate file names to avoid duplicates
        const mediaPath = file.path.replace(/^public\//, '/');
        const [existingMedia] = await connection.execute(
          'SELECT id FROM featured_product_media WHERE product_id = ? AND media_url LIKE ?',
          [id, `%${file.originalname.replace(/\.[^/.]+$/, '')}%`]
        );
        if (existingMedia.length === 0) {
          // Only add if not a duplicate
          await connection.execute(
            'INSERT INTO featured_product_media (product_id, media_url, media_type, media_order) VALUES (?, ?, ?, ?)',
            [id, mediaPath, mediaType, startOrder + i]
          );
        }
      }
    }
    
    await connection.commit();
  
    // Instead of 204, return a JSON response
    return res.status(200).json({ success: true, message: 'Product updated successfully' });
  } catch (error) {
    await connection.rollback();
  
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Delete product (and all media)
export const deleteProduct = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    await connection.execute('DELETE FROM featured_product_media WHERE product_id = ?', [id]);
    const [result] = await connection.execute('DELETE FROM featured_products WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    await connection.commit();
    res.status(204).end();
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting product:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to delete product' });
  } finally {
    connection.release();
  }
};

// ========================================
// CATEGORY CONTROLLERS
// ========================================

// Get category hierarchy
export const getCategoryHierarchy = async (req, res) => {
  try {
    const [categories] = await pool.execute(`
      SELECT 
        mc.id as main_category_id,
        mc.name as main_category_name,
        mc.icon as main_category_icon,
        sc.id as sub_category_id,
        sc.name as sub_category_name,
        sc.sort_order
      FROM main_categories mc
      LEFT JOIN sub_categories sc ON mc.id = sc.main_category_id
      WHERE mc.is_active = TRUE AND (sc.is_active = TRUE OR sc.is_active IS NULL)
      ORDER BY mc.sort_order, sc.sort_order
    `);

    res.status(200).json({
      status: "success",
      success: true,
      data: categories
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch category hierarchy'
    });
  }
};

// ========================================
// PROMO & SLIDER CONTROLLERS
// ========================================

// Get promo images
export const getPromoImages = async (req, res) => {
  try {
    const { type = 'marquee' } = req.query;

    const [images] = await pool.execute(`
      SELECT * FROM promo_images 
      WHERE is_active = TRUE AND promo_type = ?
      ORDER BY sort_order
    `, [type]);

    res.status(200).json({
      status: "success",
      success: true,
      data: images
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch promo images'
    });
  }
};

// Get slider images
export const getSliderImages = async (req, res) => {
  try {
    const [images] = await pool.execute(`
      SELECT * FROM slider_images 
      WHERE is_active = TRUE
      ORDER BY sort_order
    `);

    res.status(200).json({
      status: "success",
      success: true,
      data: images
    });
  } catch (error) {
    console.error('Error fetching slider images:', error);
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch slider images'
    });
  }
};

// ========================================
// NEWSLETTER CONTROLLERS
// ========================================

// Subscribe to newsletter
export const subscribeNewsletter = async (req, res) => {
  try {
    const { email, first_name, last_name } = req.body;

    // Check if table exists first
    const [tables] = await pool.execute(`SHOW TABLES LIKE 'newsletter_subscribers'`);
    if (tables.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Newsletter functionality not available'
      });
    }

    const [result] = await pool.execute(`
      INSERT INTO newsletter_subscribers (email, first_name, last_name)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        is_active = TRUE,
        unsubscribed_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `, [email, first_name, last_name]);

    res.status(200).json({
      status: "success",
      success: true,
      message: 'Successfully subscribed to newsletter'
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to subscribe to newsletter'
    });
  }
};

// Unsubscribe from newsletter
export const unsubscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.params;

    const [result] = await pool.execute(`
      UPDATE newsletter_subscribers 
      SET is_active = FALSE, unsubscribed_at = CURRENT_TIMESTAMP
      WHERE email = ?
    `, [email]);

    if (result.affectedRows === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Email not found in newsletter subscribers'
      });
    }

    res.status(200).json({
      status: "success",
      success: true,
      message: 'Successfully unsubscribed from newsletter'
    });
  } catch (error) {
    console.error('Error unsubscribing from newsletter:', error);
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to unsubscribe from newsletter'
    });
  }
};

// ========================================
// HOMEPAGE DATA CONTROLLER
// ========================================

// Get all homepage data
export const getHomepageData = async (req, res) => {
  try {
    // Fetch slider images
    const [sliderImagesRaw] = await pool.execute(
      'SELECT * FROM slider_images WHERE is_active = 1 ORDER BY sort_order'
    );
    const sliderImages = sliderImagesRaw.map(img => ({
      ...img,
      image_url: normalizeMediaUrl(img.image_url)
    }));

    // Fetch promo images
    const [promoImagesRaw] = await pool.execute(
      'SELECT * FROM promo_images WHERE is_active = 1 AND promo_type = "marquee" ORDER BY sort_order'
    );
    const promoImages = promoImagesRaw.map(img => ({
      ...img,
      image_url: normalizeMediaUrl(img.image_url)
    }));

    // Fetch subscriptions with plans
    const [subscriptionsRaw] = await pool.execute(
      'SELECT * FROM subscriptions WHERE is_active = 1 ORDER BY id LIMIT 10'
    );
    const subscriptions = [];
    for (const subscription of subscriptionsRaw) {
      const [plansRaw] = await pool.execute(
        'SELECT * FROM subscription_plans WHERE subscription_id = ? AND is_active = 1',
        [subscription.id]
      );
      const plans = plansRaw.map(plan => ({
        ...plan,
        // If you have plan images, normalize here
      }));
      subscriptions.push({
        ...subscription,
        logo_url: normalizeMediaUrl(subscription.logo_url),
        plans
      });
    }

    // Fetch games with variants
    const [gamesRaw] = await pool.execute(
      'SELECT * FROM games WHERE is_active = 1 ORDER BY id LIMIT 6'
    );
    const games = [];
    for (const game of gamesRaw) {
      const [variantsRaw] = await pool.execute(
        'SELECT * FROM game_topup_variants WHERE game_id = ? AND is_active = 1',
        [game.id]
      );
      const variants = variantsRaw.map(variant => ({
        ...variant,
        // If you have variant images, normalize here
      }));
      games.push({
        ...game,
        game_image_url: normalizeMediaUrl(game.game_image_url),
        variants
      });
    }

    // Fetch featured products with ratings and review counts
    const [products] = await pool.execute(`
      SELECT p.*, COALESCE(AVG(r.rating), 0) as rating, COUNT(r.id) as review_count
      FROM featured_products p
      LEFT JOIN product_reviews r ON p.id = r.product_id AND r.is_active = 1
      WHERE p.is_active = 1 AND p.is_featured = 1
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 8
    `);

    for (const product of products) {
      product.image_url = normalizeMediaUrl(product.image_url);
      // If image_url is empty or points to a video file, find an image to use instead
      if (!product.image_url || isVideoFile(product.image_url)) {
        const [mediaFiles] = await pool.execute(
          'SELECT * FROM featured_product_media WHERE product_id = ? AND media_type = "image" ORDER BY media_order',
          [product.id]
        );
        if (mediaFiles && mediaFiles.length > 0) {
          // Use the first image found
          product.image_url = normalizeMediaUrl(mediaFiles[0].media_url);
        }
      }
    }

    res.json({
      success: true,
      data: {
        sliderImages,
        promoImages,
        subscriptions,
        games,
        products
      }
    });
  } catch (error) {
   
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch homepage data'
    });
  }
};

// Helper function to check if a file is a video based on extension
function isVideoFile(url) {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  return videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
}

// ========================================
// CART CONTROLLERS
// ========================================

// Get user's cart
export const getUserCart = async (req, res) => {
  try {
    const userId = req.user;

    const [cartItems] = await pool.execute(`
      SELECT 
        c.id,
        c.quantity,
        c.price,
        c.currency,
        c.added_at,
        c.item_type,
        c.item_id,
        CASE 
          WHEN c.item_type = 'product' THEN p.name
          WHEN c.item_type = 'subscription_plan' THEN CONCAT(s.name, ' - ', sp.plan_name)
          WHEN c.item_type = 'game_topup_variant' THEN CONCAT(g.game_name, ' - ', gtv.variant_name)
        END as item_name,
        CASE 
          WHEN c.item_type = 'product' THEN p.image_url
          WHEN c.item_type = 'subscription_plan' THEN s.logo_url
          WHEN c.item_type = 'game_topup_variant' THEN g.game_image_url
        END as item_image,
        CASE 
          WHEN c.item_type = 'product' THEN p.original_price
          ELSE NULL
        END as original_price,
        CASE 
          WHEN c.item_type = 'product' THEN p.stock_status
          ELSE 'in_stock'
        END as stock_status
      FROM cart c
      LEFT JOIN featured_products p ON c.item_type = 'product' AND c.item_id = p.id
      LEFT JOIN subscription_plans sp ON c.item_type = 'subscription_plan' AND c.item_id = sp.id
      LEFT JOIN subscriptions s ON sp.subscription_id = s.id
      LEFT JOIN game_topup_variants gtv ON c.item_type = 'game_topup_variant' AND c.item_id = gtv.id
      LEFT JOIN games g ON gtv.game_id = g.id
      WHERE c.user_id = ?
      ORDER BY c.added_at DESC
    `, [userId]);

    // Normalize all item_image URLs
    const normalizedCartItems = cartItems.map(item => ({
      ...item,
      item_image: normalizeMediaUrl(item.item_image)
    }));

    const totalItems = normalizedCartItems.length;
    const totalAmount = normalizedCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.status(200).json({
      status: "success",
      success: true,
      data: {
        items: normalizedCartItems,
        totalItems,
        totalAmount
      }
    });
  } catch (error) {
    // ... existing code ...
  }
};

// Add item to cart
export const addToCart = async (req, res) => {
  try {
    const userId = req.user;
    const { itemType, itemId, quantity = 1 } = req.body;

    let price = 0;
    let itemExists = false;

   

    // Check if item exists and get price based on type
    if (itemType === 'product') {
      const [products] = await pool.execute(`
        SELECT id, current_price, stock_status FROM featured_products 
        WHERE id = ? AND is_active = TRUE
      `, [itemId]);

      if (products.length === 0) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: 'Product not found'
        });
      }

      if (products[0].stock_status !== 'in_stock') {
        return res.status(200).json({
          status: "error",
          success: false,
          message: 'Product is out of stock'
        });
      }

      price = products[0].current_price;
      itemExists = true;
    } else if (itemType === 'subscription_plan') {
      const [plans] = await pool.execute(`
        SELECT sp.id, sp.price, s.name 
        FROM subscription_plans sp
        JOIN subscriptions s ON sp.subscription_id = s.id
        WHERE sp.id = ? AND sp.is_active = TRUE
      `, [itemId]);

      if (plans.length === 0) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: 'Subscription plan not found'
        });
      }

      price = plans[0].price;
      itemExists = true;
    } else if (itemType === 'game_topup_variant') {
      const [variants] = await pool.execute(`
        SELECT id, price FROM game_topup_variants 
        WHERE id = ? AND is_active = TRUE
      `, [itemId]);

      if (variants.length === 0) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: 'Game variant not found'
        });
      }

      price = variants[0].price;
      itemExists = true;
    }

    if (!itemExists) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Invalid item type'
      });
    }

    // Check if item already exists in cart
    const [existingItems] = await pool.execute(`
      SELECT id, quantity FROM cart 
      WHERE user_id = ? AND item_type = ? AND item_id = ?
    `, [userId, itemType, itemId]);

    if (existingItems.length > 0) {
      // Update quantity
      const newQuantity = existingItems[0].quantity + quantity;
      await pool.execute(`
        UPDATE cart SET quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newQuantity, existingItems[0].id]);

      res.status(200).json({
        status: "success",
        success: true,
        message: 'Cart updated successfully',
        data: { quantity: newQuantity }
      });
    } else {
      // Add new item
      const [result] = await pool.execute(`
        INSERT INTO cart (user_id, item_type, item_id, quantity, price)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, itemType, itemId, quantity, price]);

      res.status(200).json({
        status: "success",
        success: true,
        message: 'Item added to cart successfully',
        data: { id: result.insertId }
      });
    }
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to add item to cart'
    });
  }
};

// Update cart item quantity
export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (quantity <= 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }

    const [result] = await pool.execute(`
      UPDATE cart SET quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [quantity, itemId, userId]);

    if (result.affectedRows === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Cart item not found'
      });
    }

    res.status(200).json({
      status: "success",
      success: true,
      message: 'Cart item updated successfully'
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to update cart item'
    });
  }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {

  try {

    
    const userId = req.user;
    const { itemId } = req.params;

    const [result] = await pool.execute(`
      DELETE FROM cart WHERE id = ? AND user_id = ?
    `, [itemId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    res.status(200).json({
      status: "success",
      success: true,
      message: 'Item removed from cart successfully'
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to remove item from cart'
    });
  }
};

// Clear user's cart
export const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.execute(`
      DELETE FROM cart WHERE user_id = ?
    `, [userId]);

    res.json({
      success: true,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
  
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to clear cart'
    });
  }
};

// ========================================
// WISHLIST CONTROLLERS
// ========================================

// Get user's wishlist
export const getUserWishlist = async (req, res) => {
  try {
    const userId = req.user;

    const [wishlistItems] = await pool.execute(`
      SELECT 
        w.id,
        w.added_at,
        w.item_type,
        w.item_id,
        CASE 
          WHEN w.item_type = 'product' THEN p.name
          WHEN w.item_type = 'subscription_plan' THEN CONCAT(s.name, ' - ', sp.plan_name)
          WHEN w.item_type = 'game_topup_variant' THEN CONCAT(g.game_name, ' - ', gtv.variant_name)
        END as item_name,
        CASE 
          WHEN w.item_type = 'product' THEN p.image_url
          WHEN w.item_type = 'subscription_plan' THEN s.logo_url
          WHEN w.item_type = 'game_topup_variant' THEN g.game_image_url
        END as item_image,
        CASE 
          WHEN w.item_type = 'product' THEN p.current_price
          WHEN w.item_type = 'subscription_plan' THEN sp.price
          WHEN w.item_type = 'game_topup_variant' THEN gtv.price
        END as item_price,
        CASE 
          WHEN w.item_type = 'product' THEN p.original_price
          ELSE NULL
        END as original_price,
        CASE 
          WHEN w.item_type = 'product' THEN p.stock_status
          ELSE 'in_stock'
        END as stock_status,
        CASE 
          WHEN w.item_type = 'product' THEN p.rating
          ELSE NULL
        END as rating,
        CASE 
          WHEN w.item_type = 'product' THEN p.review_count
          ELSE NULL
        END as review_count,
        CASE 
          WHEN w.item_type = 'product' THEN p.slug
          ELSE NULL
        END as slug
      FROM wishlist w
      LEFT JOIN featured_products p ON w.item_type = 'product' AND w.item_id = p.id
      LEFT JOIN subscription_plans sp ON w.item_type = 'subscription_plan' AND w.item_id = sp.id
      LEFT JOIN subscriptions s ON sp.subscription_id = s.id
      LEFT JOIN game_topup_variants gtv ON w.item_type = 'game_topup_variant' AND w.item_id = gtv.id
      LEFT JOIN games g ON gtv.game_id = g.id
      WHERE w.user_id = ?
      ORDER BY w.added_at DESC
    `, [userId]);

    // Normalize all item_image URLs
    const normalizedWishlistItems = wishlistItems.map(item => ({
      ...item,
      item_image: normalizeMediaUrl(item.item_image)
    }));

    res.status(200).json({
      status: "success",
      success: true,
      data: normalizedWishlistItems
    });
  } catch (error) {
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch wishlist'
    });
  }
};

// Add item to wishlist
export const addToWishlist = async (req, res) => {
  try {
    const userId = req.user;
    const { itemType, itemId } = req.body;

    let itemExists = false;

    // Check if item exists based on type
    if (itemType === 'product') {
      const [products] = await pool.execute(`
        SELECT id FROM featured_products 
        WHERE id = ? AND is_active = TRUE
      `, [itemId]);

      if (products.length === 0) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: 'Product not found'
        });
      }
      itemExists = true;
    } else if (itemType === 'subscription_plan') {
      const [plans] = await pool.execute(`
        SELECT id FROM subscription_plans 
        WHERE id = ? AND is_active = TRUE
      `, [itemId]);

      if (plans.length === 0) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: 'Subscription plan not found'
        });
      }
      itemExists = true;
    } else if (itemType === 'game_topup_variant') {
      const [variants] = await pool.execute(`
        SELECT id FROM game_topup_variants 
        WHERE id = ? AND is_active = TRUE
      `, [itemId]);

      if (variants.length === 0) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: 'Game variant not found'
        });
      }
      itemExists = true;
    }

    if (!itemExists) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Invalid item type'
      });
    }

    // Check if already in wishlist
    const [existingItems] = await pool.execute(`
      SELECT id FROM wishlist 
      WHERE user_id = ? AND item_type = ? AND item_id = ?
    `, [userId, itemType, itemId]);

    if (existingItems.length > 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Item already in wishlist'
      });
    }

    // Add to wishlist
    const [result] = await pool.execute(`
      INSERT INTO wishlist (user_id, item_type, item_id)
      VALUES (?, ?, ?)
    `, [userId, itemType, itemId]);

    res.status(200).json({
      status: "success",
      success: true,
      message: 'Item added to wishlist successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to add item to wishlist'
    });
  }
};

// Remove item from wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user;
    const { itemId } = req.params;
  


    const [result] = await pool.execute(`
      DELETE FROM wishlist WHERE id = ? AND user_id = ?
    `, [itemId, userId]);

  
    if (result.affectedRows === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Wishlist item not found'
      });
    }

    res.status(200).json({
      status: "success",
      success: true,
      message: 'Item removed from wishlist successfully'
    });
  } catch (error) {
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to remove item from wishlist'
    });
  }
};

// Clear user's wishlist
export const clearWishlist = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.execute(`
      DELETE FROM wishlist WHERE user_id = ?
    `, [userId]);

    res.status(200).json({
      status: "success",
      success: true,
      message: 'Wishlist cleared successfully'
    });
  } catch (error) {
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to clear wishlist'
    });
  }
};

// ========================================
// SEARCH CONTROLLERS
// ========================================

// Search products, subscriptions, and games
export const searchProducts = async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, sortBy = 'name', order = 'ASC', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let result = { products: [], subscriptions: [], games: [], pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, totalPages: 1 } };

    // Helper: get games with pass variant boosting
    async function getAllGames(searchTerm, boostPass = false) {
      let gamesQuery = 'SELECT * FROM games WHERE is_active = TRUE';
      let params = [];
      if (searchTerm) {
        gamesQuery += ' AND (game_name LIKE ? OR description LIKE ? OR seo_keywords LIKE ?)';
        params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }
      gamesQuery += ' ORDER BY id';
      const [games] = await pool.execute(gamesQuery, params);
      const [variants] = await pool.execute('SELECT * FROM game_topup_variants WHERE is_active = TRUE ORDER BY game_id, sort_order');
      const variantsByGame = {};
      variants.forEach(variant => {
        if (!variantsByGame[variant.game_id]) variantsByGame[variant.game_id] = [];
        variantsByGame[variant.game_id].push(variant);
      });
      let gamesWithVariants = games.map(game => ({ ...game, variants: variantsByGame[game.id] || [] }));
      if (boostPass) {
        // Boost games that have a pass variant
        const boosted = [];
        const normal = [];
        gamesWithVariants.forEach(game => {
          const hasPass = (game.variants || []).some(v => v.topup_type === 'pass' && v.is_active);
          if (hasPass) {
            boosted.push(game);
          } else {
            normal.push(game);
          }
        });
        gamesWithVariants = [...boosted, ...normal];
      }
      return gamesWithVariants;
    }
    // Helper: get subscriptions with boosting
    async function getAllSubscriptions(searchTerm, boostSubscription = false) {
      let subsQuery = 'SELECT * FROM subscriptions WHERE is_active = TRUE';
      let params = [];
      if (searchTerm) {
        subsQuery += ' AND (name LIKE ? OR description LIKE ? OR seo_keywords LIKE ?)';
        params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }
      subsQuery += ' ORDER BY id';
      const [subs] = await pool.execute(subsQuery, params);
      const [plans] = await pool.execute('SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY subscription_id, sort_order');
      const plansBySub = {};
      plans.forEach(plan => {
        if (!plansBySub[plan.subscription_id]) plansBySub[plan.subscription_id] = [];
        plansBySub[plan.subscription_id].push(plan);
      });
      let subscriptions = subs.map(sub => ({ ...sub, plans: plansBySub[sub.id] || [] }));
      if (boostSubscription) {
        // Boost subscriptions whose name or plans include 'subscription'
        const boosted = [];
        const normal = [];
        subscriptions.forEach(sub => {
          const hasBoost = sub.name.toLowerCase().includes('subscription') ||
            (sub.plans || []).some(plan => (plan.plan_name || '').toLowerCase().includes('subscription'));
          if (hasBoost) {
            boosted.push(sub);
          } else {
            normal.push(sub);
          }
        });
        subscriptions = [...boosted, ...normal];
      }
      return subscriptions;
    }
    // Helper: get products with keyword boosting
    async function getAllProducts(searchTerm, boostKeywords = []) {
      let productWhere = ['is_active = TRUE'];
      let productParams = [];
      if (searchTerm) {
        productWhere.push('(name LIKE ? OR description LIKE ? OR tags LIKE ? OR seo_keywords LIKE ?)');
        productParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
      }
      if (minPrice) { productWhere.push('current_price >= ?'); productParams.push(minPrice); }
      if (maxPrice) { productWhere.push('current_price <= ?'); productParams.push(maxPrice); }
      const productWhereClause = productWhere.join(' AND ');
      const [products] = await pool.execute(
        `SELECT * FROM featured_products WHERE ${productWhereClause} ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`,
        [...productParams, parseInt(limit), offset]
      );
      // Boost products with exact tag or seo_keyword matches
      if (boostKeywords && boostKeywords.length > 0) {
        // Parse tags and seo_keywords for each product
        const boosted = [];
        const normal = [];
        products.forEach(product => {
          let tags = [];
          let seoKeywords = [];
          try { tags = product.tags ? JSON.parse(product.tags) : []; } catch { tags = []; }
          try { seoKeywords = product.seo_keywords ? product.seo_keywords.split(',').map(s => s.trim().toLowerCase()) : []; } catch { seoKeywords = []; }
          const hasBoost = boostKeywords.some(kw =>
            tags.map(t => t.toLowerCase()).includes(kw) ||
            seoKeywords.includes(kw)
          );
          if (hasBoost) {
            boosted.push(product);
          } else {
            normal.push(product);
          }
        });
        return [...boosted, ...normal];
      }
      return products;
    }

    // Intent-based search logic
    let boostKeywords = [];
    let boostPass = false;
    let boostSubscription = false;
    // (Remove all searchType and intent-based logic)

    if (q) {
      // Always search all three tables by query
      const products = await getAllProducts(q, boostKeywords);
      const subscriptions = await getAllSubscriptions(q, boostSubscription);
      const games = await getAllGames(q, boostPass);
      result = {
        products,
        subscriptions,
        games,
        pagination: { page: parseInt(page), limit: parseInt(limit), total: products.length + subscriptions.length + games.length, totalPages: Math.ceil((products.length + subscriptions.length + games.length) / limit) }
      };
      return res.status(200).json({ status: "success", success: true, data: result });
    }

    // If category is Subscriptions
    if (category && category.toLowerCase().includes('subscription')) {
      const subscriptions = await getAllSubscriptions();
      result = {
        products: [],
        subscriptions,
        games: [],
        pagination: { page: 1, limit: subscriptions.length, total: subscriptions.length, totalPages: 1 }
      };
      return res.status(200).json({ status: "success", success: true, data: result });
    }
    // If category is Game Top-up
    if (category && category.toLowerCase().includes('game')) {
      const games = await getAllGames();
      result = {
        products: [],
        subscriptions: [],
        games,
        pagination: { page: 1, limit: games.length, total: games.length, totalPages: 1 }
      };
      return res.status(200).json({ status: "success", success: true, data: result });
    }
    // If category is Products or not specified
    // Products
    let productWhere = ['is_active = TRUE'];
    let productParams = [];
    if (minPrice) { productWhere.push('current_price >= ?'); productParams.push(minPrice); }
    if (maxPrice) { productWhere.push('current_price <= ?'); productParams.push(maxPrice); }
    const productWhereClause = productWhere.join(' AND ');
    const [products] = await pool.execute(
      `SELECT * FROM featured_products WHERE ${productWhereClause} ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`,
      [...productParams, parseInt(limit), offset]
    );
    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM featured_products WHERE ${productWhereClause}`,
      productParams
    );
    const total = countResult[0].total;
    result = {
      products,
      subscriptions: [],
      games: [],
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
    };
    return res.status(200).json({ status: "success", success: true, data: result });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to search products'
    });
  }
};

// Get products by category
export const getProductsByCategory = async (req, res) => {
  try {
    const { categoryName } = req.params;
    const { page = 1, limit = 20, sortBy = 'name', order = 'ASC' } = req.query;
    const offset = (page - 1) * limit;




    // Check if category exists
    const [categories] = await pool.execute(`
      SELECT id, name, description FROM main_categories 
      WHERE name = ? AND is_active = TRUE
    `, [categoryName]);



    if (categories.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Category not found'
      });
    }

    // Get total count
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM featured_products 
      WHERE category = ? AND is_active = TRUE
    `, [categories[0].name]);

    const total = countResult[0].total;



    // Get products
    const [products] = await pool.execute(`
      SELECT * FROM featured_products 
      WHERE category = ? AND is_active = TRUE
      ORDER BY ${sortBy} ${order}
      LIMIT ? OFFSET ?
    `, [categories[0].name, parseInt(limit), offset]);

    res.status(200).json({
      status: "success",
      success: true,
      data: {
        category: categories[0],
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch category products'
    });
  }
};

// ========================================
// PRODUCT REVIEWS CONTROLLERS
// ========================================

/**
 * Get reviews for a specific product
 */
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = 'newest' } = req.query;
    const offset = (page - 1) * limit;

    let sortClause = 'created_at DESC'; // default sort by newest
    if (sort === 'helpful') {
      sortClause = 'helpful_count DESC, created_at DESC';
    } else if (sort === 'rating') {
      sortClause = 'rating DESC, created_at DESC';
    }

    const [reviews] = await pool.query(
      `SELECT 
                pr.*,
                u.username,
                CASE 
                    WHEN up.profile_image IS NOT NULL AND up.profile_image != '' 
                    THEN CONCAT('/', REPLACE(up.profile_image, 'public/', ''))
                    ELSE NULL
                END as avatar_url
            FROM product_reviews pr
            JOIN users u ON pr.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE pr.product_id = ? AND pr.is_active = true
            ORDER BY ${sortClause}
            LIMIT ? OFFSET ?`,
      [productId, parseInt(limit), offset]
    );

    // Get total count for pagination
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM product_reviews WHERE product_id = ? AND is_active = true',
      [productId]
    );

    res.status(200).json({
      status: "success",
      success: true,
      data: {
        reviews,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch product reviews'
    });
  }
};

/**
 * Create a new product review
 */
export const createProductReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user;
    const { rating, title, review_text, pros, cons } = req.body;

    // Check if user has already reviewed this product
    const [[existingReview]] = await pool.query(
      'SELECT id FROM product_reviews WHERE product_id = ? AND user_id = ?',
      [productId, userId]
    );

    if (existingReview) {
      await pool.query(`DELETE FROM product_reviews WHERE product_id = ? AND user_id = ?`, [productId, userId]);
    }

    // Check if user has purchased the product
    const [[verifiedPurchase]] = await pool.query(
      `SELECT oh.id
       FROM order_headers oh
       INNER JOIN order_items oi ON oh.id = oi.order_id
       LEFT JOIN featured_products fp ON oi.item_type = 'product' AND oi.item_id = fp.id
       LEFT JOIN subscription_plans sp ON oi.item_type = 'subscription_plan' AND oi.item_id = sp.id
       LEFT JOIN subscriptions s ON sp.subscription_id = s.id
       LEFT JOIN game_topup_variants gtv ON oi.item_type = 'game_topup_variant' AND oi.item_id = gtv.id
       LEFT JOIN games g ON gtv.game_id = g.id
       WHERE oh.user_id = ? 
       AND oi.item_id = ? 
       AND oh.status = 'completed' 
       AND oh.payment_status = 'paid'
       LIMIT 1`,
      [userId, productId]
    );

    const [result] = await pool.query(
      `INSERT INTO product_reviews 
            (product_id, user_id, rating, title, review_text, pros, cons, is_verified_purchase) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, userId, rating, title, review_text, pros, cons, !!verifiedPurchase]
    );

    // No need to manually update aggregates - trigger handles it

    res.status(200).json({
      status: "success",
      success: true,
      message: 'Review added successfully',
      data: {
        id: result.insertId,
        is_verified_purchase: !!verifiedPurchase
      }
    });
  } catch (error) {
    console.error('Error in createProductReview:', error);
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to create review'
    });
  }
};

/**
 * Update an existing product review
 */
export const updateProductReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const userId = req.user;
    const { rating, title, review_text, pros, cons } = req.body;

    // Check if review exists and belongs to user
    const [[review]] = await pool.query(
      'SELECT id FROM product_reviews WHERE id = ? AND product_id = ? AND user_id = ?',
      [reviewId, productId, userId]
    );

    if (!review) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Review not found or unauthorized'
      });
    }

    await pool.query(
      `UPDATE product_reviews 
            SET rating = ?, title = ?, review_text = ?, pros = ?, cons = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      [rating, title, review_text, pros, cons, reviewId]
    );

    // No need to manually update aggregates - trigger handles it

    res.status(200).json({
      status: "success",
      success: true,
      message: 'Review updated successfully'
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to update review'
    });
  }
};

/**
 * Delete a product review
 */
export const deleteProductReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const userId = req.user.id;

    // Check if review exists and belongs to user
    const [[review]] = await pool.query(
      'SELECT id FROM product_reviews WHERE id = ? AND product_id = ? AND user_id = ?',
      [reviewId, productId, userId]
    );

    if (!review) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Review not found or unauthorized'
      });
    }

    // Soft delete the review
    await pool.query(
      'UPDATE product_reviews SET is_active = false WHERE id = ?',
      [reviewId]
    );

    // No need to manually update aggregates - trigger handles it

    res.status(200).json({
      status: "success",
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to delete review'
    });
  }
};

/**
 * Mark a review as helpful
 */
export const markReviewHelpful = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;

    await pool.query(
      'UPDATE product_reviews SET helpful_count = helpful_count + 1 WHERE id = ? AND product_id = ?',
      [reviewId, productId]
    );

    res.status(200).json({
      status: "success",
      success: true,
      message: 'Review marked as helpful'
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to mark review as helpful'
    });
  }
};

// ========================================
// SIMILAR PRODUCTS CONTROLLERS
// ========================================

/**
 * Get similar products for a specific product
 */
export const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 4 } = req.query;

    const [similarProducts] = await pool.query(
      `SELECT 
                fp.*,
                sp.similarity_score
            FROM similar_products sp
            JOIN featured_products fp ON sp.similar_product_id = fp.id
            WHERE sp.product_id = ? AND sp.is_active = true AND fp.is_active = true
            ORDER BY sp.similarity_score DESC
            LIMIT ?`,
      [productId, parseInt(limit)]
    );

    res.status(200).json({
      status: "success",
      success: true,
      data: similarProducts
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch similar products'
    });
  }
};

// Import notification utilities
import { getUserNotifications as getNotifications, deleteOldNotifications } from '../utils/notification.js';
import { query } from '../database/db.js';

/**
 * Get notifications for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get notifications from the database (limit to 20)
    const notifications = await getNotifications(userId, 20);

    return res.status(200).json({
      status: "success",
      success: true,
      message: 'Notifications retrieved successfully',
      data: notifications
    });
  } catch (error) {
   
    return res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to retrieve notifications',
      error: error.message
    });
  }
};

/**
 * Mark a specific notification as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user;
    const notificationId = req.params.id;

    if (!userId || !notificationId) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'User ID and notification ID are required'
      });
    }

    // Update the notification in the database
    const result = await query(
      'UPDATE notifications SET viewed = 1, is_new = 0 WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Notification not found or not owned by user'
      });
    }

    return res.status(200).json({
      status: "success",
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
  
    return res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

/**
 * Mark all notifications for a user as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user;

    if (!userId) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Authentication required'
      });
    }

    // Update all unread notifications for the user
    const result = await query(
      'UPDATE notifications SET viewed = 1, is_new = 0 WHERE user_id = ? AND (viewed = 0 OR is_new = 1)',
      [userId]
    );

    return res.status(200).json({
      status: "success",
      success: true,
      message: 'All notifications marked as read',
      data: {
        count: result.affectedRows
      }
    });
  } catch (error) {
   
    return res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
};

/**
 * Clear all notifications for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user;

    if (!userId) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Authentication required'
      });
    }

    // Delete all notifications for the user
    const result = await query(
      'DELETE FROM notifications WHERE user_id = ?',
      [userId]
    );

    return res.status(200).json({
      status: "success",
      success: true,
      message: 'All notifications cleared',
      data: {
        count: result.affectedRows
      }
    });
  } catch (error) {
   
    return res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to clear notifications',
      error: error.message
    });
  }
}; 

// New controller for admin product list
export const getProductListForAdmin = async (req, res) => {
  try {
    const [products] = await pool.execute('SELECT * FROM featured_products ORDER BY created_at DESC');
    for (let product of products) {
      // Parse tags from JSON string to array
      if (product.tags) {
        try {
          if (typeof product.tags === 'string') {
            product.tags = JSON.parse(product.tags);
          }
          if (!Array.isArray(product.tags)) {
            if (typeof product.tags === 'string') {
              product.tags = product.tags.split(',').map(tag => tag.trim());
            } else {
              product.tags = [];
            }
          }
        } catch (e) {
          if (typeof product.tags === 'string') {
            product.tags = product.tags.split(',').map(tag => tag.trim());
          } else {
            product.tags = [];
          }
        }
      } else {
        product.tags = [];
      }
      // Normalize image_url
      product.image_url = normalizeMediaUrl(product.image_url);
      // Get media for product
      const [media] = await pool.execute('SELECT id, media_url, media_type, media_order FROM featured_product_media WHERE product_id = ? ORDER BY media_order', [product.id]);
      product.media = media.map(m => ({ ...m, media_url: normalizeMediaUrl(m.media_url) }));
    }
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(200).json({ status: "error", success: false, message: 'Failed to fetch products' });
  }
}; 

// Controller: Get all sub-categories for featured products
export const getAllProductSubCategories = async (req, res) => {
  try {
    // Find the main_category_id for 'Products'
    const [mainCat] = await pool.execute("SELECT id FROM main_categories WHERE name = 'Products' AND is_active = TRUE LIMIT 1");
    if (!mainCat.length) {
      return res.status(200).json({ success: true, data: [] });
    }
    const mainCategoryId = mainCat[0].id;
    // Get all sub-categories for this main category
    const [subCats] = await pool.execute(
      'SELECT id, name, sort_order FROM sub_categories WHERE main_category_id = ? AND is_active = TRUE ORDER BY sort_order',
      [mainCategoryId]
    );
    res.status(200).json({ success: true, data: subCats });
  } catch (error) {
    res.status(200).json({ status: "error", success: false, message: 'Failed to fetch sub-categories' });
  }
}; 

// Helper to normalize image/media URLs
function normalizeMediaUrl(url) {
  if (!url) return url;
  // Replace all backslashes with forward slashes
  url = url.replace(/\\\\/g, '/').replace(/\\/g, '/');
  if (url.startsWith('public/')) return '/' + url.slice(7);
  if (url.startsWith('/public/')) return '/' + url.slice(8);
  return url;
}

// ========================================
// ADMIN SLIDER CONTROLLERS
// ========================================

// Get slider image by ID (admin)
export const getSliderImageById = async (req, res) => {
  try {
    const { id } = req.params;

    const [images] = await pool.execute(`
      SELECT * FROM slider_images 
      WHERE id = ?
    `, [id]);

    if (images.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Slider image not found'
      });
    }

    res.json({
      success: true,
      data: images[0]
    });
  } catch (error) {
    
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch slider image'
    });
  }
};

// Get all slider images for admin (including inactive)
export const getAdminSliderImages = async (req, res) => {
  try {
    const [images] = await pool.execute(`
      SELECT * FROM slider_images 
      ORDER BY sort_order
    `);

    res.json({
      success: true,
      data: images
    });
  } catch (error) {
   
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch slider images'
    });
  }
};

// Create slider image
export const createSliderImage = async (req, res) => {
  try {
    const { 
      title, 
      alt_text, 
      link_url, 
      description, 
      button_text, 
      button_url, 
      is_active, 
      sort_order 
    } = req.body;

    // Get image URL from uploaded file
    if (!req.file) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Image is required'
      });
    }

    // Construct proper image URL from the uploads/sliders directory
    const imageUrl = req.file.path.replace(/\\/g, '/').replace('public/', '/');

    const [result] = await pool.execute(`
      INSERT INTO slider_images 
      (title, image_url, alt_text, link_url, description, button_text, button_url, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title || null, 
      imageUrl, 
      alt_text || null, 
      link_url || null, 
      description || null, 
      button_text || null, 
      button_url || null, 
      is_active !== undefined ? is_active : true, 
      sort_order || 0
    ]);

    res.status(201).json({
      success: true,
      message: 'Slider image created successfully',
      data: { 
        id: result.insertId,
        image_url: imageUrl
      }
    });
  } catch (error) {

    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to create slider image'
    });
  }
};

// Update slider image
export const updateSliderImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      alt_text, 
      link_url, 
      description, 
      button_text, 
      button_url, 
      is_active, 
      sort_order 
    } = req.body;

    // Convert is_active to boolean
    const activeStatus = is_active === 'true' || is_active === true || is_active === 1 || is_active === '1';
    
    // Get current image URL if no new file uploaded
    let imageUrl;
    if (req.file) {
      // New image uploaded - use new path
      imageUrl = req.file.path.replace(/\\/g, '/').replace('public/', '/');
    } else {
      // No new image - get existing image URL
      const [currentImage] = await pool.execute('SELECT image_url FROM slider_images WHERE id = ?', [id]);
      if (currentImage.length === 0) {
        return res.status(200).json({
          status: "error",
          success: false,
          message: 'Slider image not found'
        });
      }
      imageUrl = currentImage[0].image_url;
    }

    const [result] = await pool.execute(`
      UPDATE slider_images 
      SET 
        title = ?,
        image_url = ?,
        alt_text = ?,
        link_url = ?,
        description = ?,
        button_text = ?,
        button_url = ?,
        is_active = ?,
        sort_order = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title || null, 
      imageUrl, 
      alt_text || null, 
      link_url || null, 
      description || null, 
      button_text || null, 
      button_url || null, 
      activeStatus, 
      sort_order || 0,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Slider image not found'
      });
    }

    res.json({
      success: true,
      message: 'Slider image updated successfully',
      data: {
        image_url: imageUrl,
        is_active: activeStatus
      }
    });
  } catch (error) {
 
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to update slider image'
    });
  }
};

// Delete slider image
export const deleteSliderImage = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(`
      DELETE FROM slider_images WHERE id = ?
    `, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Slider image not found'
      });
    }

    res.json({
      success: true,
      message: 'Slider image deleted successfully'
    });
  } catch (error) {
   
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to delete slider image'
    });
  }
};

// ========================================
// ADMIN PROMO IMAGE CONTROLLERS
// ========================================

// Get promo image by ID (admin)
export const getPromoImageById = async (req, res) => {
  try {
    const { id } = req.params;

    const [images] = await pool.execute(`
      SELECT * FROM promo_images 
      WHERE id = ?
    `, [id]);

    if (images.length === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Promo image not found'
      });
    }

    res.json({
      success: true,
      data: images[0]
    });
  } catch (error) {
   
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch promo image'
    });
  }
};

// Get all promo images for admin (including inactive)
export const getAdminPromoImages = async (req, res) => {
  try {
    const { type } = req.query;
    
    let query = `SELECT * FROM promo_images ORDER BY sort_order`;
    let params = [];
    
    if (type) {
      query = `SELECT * FROM promo_images WHERE promo_type = ? ORDER BY sort_order`;
      params = [type];
    }

    const [images] = await pool.execute(query, params);

    res.json({
      success: true,
      data: images
    });
  } catch (error) {
    console.error('Error fetching promo images:', error);
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch promo images'
    });
  }
};

// Create promo image
export const createPromoImage = async (req, res) => {
  try {
    const { 
      title, 
      alt_text, 
      link_url, 
      promo_type, 
      is_active, 
      sort_order 
    } = req.body;

    // Get image URL from uploaded file
    if (!req.file) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Image is required'
      });
    }

    // Construct proper image URL from the uploads/promos directory
    const imageUrl = req.file.path.replace(/\\/g, '/').replace('public/', '/');

    const [result] = await pool.execute(`
      INSERT INTO promo_images 
      (title, image_url, alt_text, link_url, promo_type, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      title || null, 
      imageUrl, 
      alt_text || null, 
      link_url || null, 
      promo_type || 'marquee', 
      is_active !== undefined ? is_active : true, 
      sort_order || 0
    ]);

    res.status(201).json({
      success: true,
      message: 'Promo image created successfully',
      data: { 
        id: result.insertId,
        image_url: imageUrl
      }
    });
  } catch (error) {
   
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to create promo image'
    });
  }
};

// Update promo image
export const updatePromoImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      alt_text, 
      link_url, 
      promo_type, 
      is_active, 
      sort_order 
    } = req.body;

    // Convert is_active to boolean
    const activeStatus = is_active === 'true' || is_active === true || is_active === 1 || is_active === '1';

    // Get current image URL if no new file uploaded
    let imageUrl;
    if (req.file) {
      // New image uploaded - use new path
      imageUrl = req.file.path.replace(/\\/g, '/').replace('public/', '/');
    } else {
      // No new image - get existing image URL
      const [currentImage] = await pool.execute('SELECT image_url FROM promo_images WHERE id = ?', [id]);
      if (currentImage.length === 0) {
          return res.status(200).json({
          status: "error",
          success: false,
          message: 'Promo image not found'
        });
      }
      imageUrl = currentImage[0].image_url;
    }

    const [result] = await pool.execute(`
      UPDATE promo_images 
      SET 
        title = ?,
        image_url = ?,
        alt_text = ?,
        link_url = ?,
        promo_type = ?,
        is_active = ?,
        sort_order = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title || null, 
      imageUrl, 
      alt_text || null, 
      link_url || null, 
      promo_type || 'marquee', 
      activeStatus, 
      sort_order || 0,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Promo image not found'
      });
    }

    res.json({
      success: true,
      message: 'Promo image updated successfully',
      data: {
        image_url: imageUrl,
        is_active: activeStatus
      }
    });
  } catch (error) {
   
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to update promo image'
    });
  }
};

// Delete promo image
export const deletePromoImage = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(`
      DELETE FROM promo_images WHERE id = ?
    `, [id]);

    if (result.affectedRows === 0) {
      return res.status(200).json({
        status: "error",
        success: false,
        message: 'Promo image not found'
      });
    }

    res.json({
      success: true,
      message: 'Promo image deleted successfully'
    });
  } catch (error) {
   
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to delete promo image'
    });
  }
};

export const getAdminGames = async (req, res) => {
  try {
    const query = `
      SELECT 
        g.*,
        GROUP_CONCAT(
          CONCAT_WS('::',
            v.id,
            v.topup_type,
            v.variant_name,
            v.description,
            v.price,
            v.currency,
            v.quantity,
            v.is_active,
            v.sort_order
          )
        ) as variants
      FROM games g
      LEFT JOIN game_topup_variants v ON g.id = v.game_id
      GROUP BY g.id
      ORDER BY g.created_at DESC`;

    const [games] = await pool.query(query);

    // Parse the variants string for each game
    games.forEach(game => {
      if (game.variants) {
        const variantStrings = game.variants.split(',');
        game.variants = variantStrings.map(variantStr => {
          const [
            id,
            topup_type,
            variant_name,
            description,
            price,
            currency,
            quantity,
            is_active,
            sort_order
          ] = variantStr.split('::');

          return {
            id: parseInt(id),
            topup_type,
            variant_name,
            description,
            price: parseFloat(price),
            currency,
            quantity,
            is_active: is_active === '1',
            sort_order: parseInt(sort_order)
          };
        });
      } else {
        game.variants = [];
      }
    });

    res.json({
      success: true,
      data: games
    });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(200).json({
      status: "error",
      success: false,
      message: 'Failed to fetch games'
    });
  }
};

// ADMIN: Get all subscriptions with all plans (including inactive)
export const getAdminSubscriptions = async (req, res) => {
  try {
    // Get all subscriptions
    const [subscriptions] = await pool.execute(`SELECT * FROM subscriptions ORDER BY id DESC`);
    // Get all plans (including inactive)
    const [plans] = await pool.execute(`SELECT * FROM subscription_plans ORDER BY subscription_id, sort_order`);
    // Group plans by subscription_id
    const plansBySubscription = {};
    plans.forEach(plan => {
      if (!plansBySubscription[plan.subscription_id]) plansBySubscription[plan.subscription_id] = [];
      let features = [];
      try {
        features = plan.features ? JSON.parse(plan.features) : [];
      } catch {
        features = [];
      }
      plansBySubscription[plan.subscription_id].push({
        ...plan,
        features
      });
    });
    // Combine subscriptions with their plans
    const subscriptionsWithPlans = subscriptions.map(sub => ({
      ...sub,
      plans: plansBySubscription[sub.id] || []
    }));
    res.json({ success: true, data: subscriptionsWithPlans });
  } catch (error) {
    console.error('Error fetching admin subscriptions:', error);
    res.status(200).json({ status: "error", success: false, message: 'Failed to fetch subscriptions' });
  }
};

// ADMIN: Get subscription by ID with all plans (including inactive)
export const getAdminSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    // Get subscription
    const [subscriptions] = await pool.execute(`SELECT * FROM subscriptions WHERE id = ?`, [id]);
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    // Get all plans for this subscription
    const [plans] = await pool.execute(`SELECT * FROM subscription_plans WHERE subscription_id = ? ORDER BY sort_order`, [id]);
    const plansWithFeatures = plans.map(plan => {
      let features = [];
      try {
        features = plan.features ? JSON.parse(plan.features) : [];
      } catch {
        features = [];
      }
      return { ...plan, features };
    });
    const subscription = { ...subscriptions[0], plans: plansWithFeatures };
    res.json({ success: true, data: subscription });
  } catch (error) {
    
    res.status(200).json({ status: "error", success: false, message: 'Failed to fetch subscription' });
  }
};