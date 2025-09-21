import { query } from "../../database/db.js";

const homepage = async (req, res) => {
    try {
        // Fetch all homepage data
        // Get subscriptions
        const subscriptionsData = await query(`
            SELECT * FROM subscriptions 
            WHERE is_active = TRUE 
            ORDER BY id 
            LIMIT 4
        `);

        // Get plans for subscriptions
        const plansData = await query(`
            SELECT * FROM subscription_plans 
            WHERE is_active = TRUE 
            ORDER BY subscription_id, sort_order
        `);

        // Group plans by subscription_id
        const plansBySubscription = {};
        if (Array.isArray(plansData)) {
            plansData.forEach(plan => {
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
        }

        // Combine subscriptions with their plans
        const subscriptions = Array.isArray(subscriptionsData) ? subscriptionsData.map(subscription => ({
            ...subscription,
            plans: plansBySubscription[subscription.id] || []
        })) : [];

        // Get games
        const gamesData = await query(`
            SELECT * FROM games 
            WHERE is_active = TRUE 
            ORDER BY id 
            LIMIT 8
        `);

        // Get variants for games
        const variantsData = await query(`
            SELECT * FROM game_topup_variants 
            WHERE is_active = TRUE 
            ORDER BY game_id, sort_order
        `);

        // Group variants by game_id
        const variantsByGame = {};
        if (Array.isArray(variantsData)) {
            variantsData.forEach(variant => {
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
        }

        // Combine games with their variants
        const games = Array.isArray(gamesData) ? gamesData.map(game => ({
            ...game,
            variants: variantsByGame[game.id] || []
        })) : [];

        const products = await query(`
            SELECT * FROM featured_products 
            WHERE is_active = TRUE AND is_featured = TRUE
            ORDER BY created_at DESC 
            LIMIT 12
        `);

        const sliderImages = await query(`
            SELECT * FROM slider_images 
            WHERE is_active = TRUE
            ORDER BY sort_order
        `);

        const promoImages = await query(`
            SELECT * FROM promo_images 
            WHERE is_active = TRUE AND promo_type = 'marquee'
            ORDER BY sort_order
        `);

       

        res.render("index", {
            title: "Home",
            currentPage: "home",
            user: req.userData || null,
            subscriptions: subscriptions || [],
            games: games || [],
            products: Array.isArray(products) ? products : [],
            sliderImages: Array.isArray(sliderImages) ? sliderImages : [],
            promoImages: Array.isArray(promoImages) ? promoImages : []
        });
    } catch (error) {
        console.error('Error loading homepage data:', error);
        // Render with empty data if there's an error
        res.render("index", {
            title: "Home",
            currentPage: "home",
            user: req.userData || null,
            subscriptions: [],
            games: [],
            products: [],
            sliderImages: [],
            promoImages: []
        });
    }
};

export { homepage };