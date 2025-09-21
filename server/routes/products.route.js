/**
 * Products Routes
 * Handles all product-related endpoints including subscriptions, games, and featured products
 */

import express from "express";
const router = express.Router();

import {
  // Subscription controllers
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getAdminSubscriptions,
  getAdminSubscriptionById,

  // Game controllers
  getGames,
  getGameById,

  // Admin Game controllers
  getAdminGames,
  createGame,
  updateGame,
  deleteGame,


  // Product controllers
  getFeaturedProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductListForAdmin,
  getAllProductSubCategories,

  // Category controllers
  getCategoryHierarchy,

  // Promo & Slider controllers
  getPromoImages,
  getSliderImages,
  
  // Admin Slider controllers
  getSliderImageById,
  getAdminSliderImages,
  createSliderImage,
  updateSliderImage,
  deleteSliderImage,
  
  // Admin Promo controllers
  getPromoImageById,
  getAdminPromoImages,
  createPromoImage,
  updatePromoImage,
  deletePromoImage,

  // Newsletter controllers
  subscribeNewsletter,
  unsubscribeNewsletter,

  // Homepage data controller
  getHomepageData,

  // Cart controllers
  getUserCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,

  // Wishlist controllers
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,

  // Search controllers
  searchProducts,
  getProductsByCategory,

  // Review controllers
  getProductReviews,
  createProductReview,
  updateProductReview,
  deleteProductReview,
  markReviewHelpful,

  // Similar products controllers
  getSimilarProducts,

  // Notification controllers
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications
} from "../controller/productController.js";


import {
  getSubscriptionDetails,
  getGameTopUpDetails,
  getGamePassDetails,
  getProductDetails
} from "../controller/page/product-details.controller.js";

import {
  verifyToken,
  checkAuth,permission
} from "../middleware/auth.js";

import {
  upload,
  uploadProductMedia,
  uploadSliderImage,
  uploadPromoImage,
  uploadSubscriptionImage,
  uploadGameImage,
  handleUploadErrors,
  sanitizeFile,
  validateProductMedia,
  UPLOAD_DIRS
} from "../middleware/upload.js";

import { verifyCsrf } from "../middleware/csrf.js";

import{searchValidation} from "../middleware/validator.js";

// ========================================
// PUBLIC ROUTES (No authentication required)
// ========================================

// Homepage data
router.get('/homepage', getHomepageData);

// Subscriptions
router.get('/subscriptions', getSubscriptions);
router.get('/subscriptions/:id', getSubscriptionById);

// Games
router.get('/games', getGames);
router.get('/games/:id', getGameById);

// Products
router.get('/products', checkAuth, getFeaturedProducts);
router.get('/products/slug/:slug', checkAuth, getProductBySlug); // More specific route first
router.get('/products/:id', checkAuth, getProductById); // Generic route second



// Categories
router.get('/categories', getCategoryHierarchy);

// Promo & Slider
router.get('/promos', getPromoImages);
router.get('/sliders', getSliderImages);

// Newsletter
router.post('/newsletter/subscribe', subscribeNewsletter);
router.delete('/newsletter/unsubscribe/:email', unsubscribeNewsletter);

// Product reviews (public read access)
router.get('/products/:productId/reviews', getProductReviews);

// Similar products
router.get('/products/:productId/similar', getSimilarProducts);

// Search functionality
router.get('/search', searchValidation, searchProducts);
router.get('/categories/:categoryName/products', getProductsByCategory);

// ========================================
// PROTECTED ROUTES (Authentication required)
// ========================================

// Apply authentication middleware to protected routes
router.use(verifyToken);
router.use(verifyCsrf);

// User-specific product operations (cart, wishlist, etc.)
router.get('/cart', getUserCart);
router.post('/cart/add', addToCart);
router.put('/cart/update/:itemId', updateCartItem);
router.delete('/cart/remove/:itemId', removeFromCart);
// router.delete('/cart/clear', clearCart);

router.get('/wishlist', getUserWishlist);
router.post('/wishlist/add', addToWishlist);
router.delete('/wishlist/remove/:itemId', removeFromWishlist);
// router.delete('/wishlist/clear', clearWishlist);

// Notification routes
router.get('/notifications', getUserNotifications);
router.put('/notifications/:id/read', markNotificationAsRead);
router.put('/notifications/read-all', markAllNotificationsAsRead);
router.delete('/notifications/clear', clearAllNotifications);



// Product reviews (authenticated write access)
router.post('/products/:productId/reviews', createProductReview);
router.put('/products/:productId/reviews/:reviewId', updateProductReview);
router.delete('/products/:productId/reviews/:reviewId', deleteProductReview);
// router.post('/products/:productId/reviews/:reviewId/helpful', markReviewHelpful);








// ========================================
// ADMIN ROUTES (Admin authentication required)
// ========================================

// Apply admin middleware to admin routes
// router.use('/admin', verifyAdmin);

// Subscription management
router.post(
  '/admin/subscriptions', 
  permission,
  uploadSubscriptionImage.single('logo'),
  handleUploadErrors,
  sanitizeFile,
  createSubscription
);

router.put(
  '/admin/subscriptions/:id',
  permission,
  uploadSubscriptionImage.single('logo'),
  handleUploadErrors,
  sanitizeFile,
  updateSubscription
);

// Game management
router.get('/admin/games', getAdminGames);

router.post(
  '/admin/games',
  permission,
  uploadGameImage.single('image'),
  handleUploadErrors,
  sanitizeFile,
  createGame
);

router.put(
  '/admin/games/:id',
  permission,
  uploadGameImage.single('image'),
  handleUploadErrors,
  sanitizeFile,
  updateGame
);

router.delete('/admin/games/:id', permission, deleteGame);

// Admin Subscription management
router.get('/admin/subscriptions', getAdminSubscriptions);
router.get('/admin/subscriptions/:id', getAdminSubscriptionById);
router.post(
  '/admin/subscriptions',
  permission,
  uploadSubscriptionImage.single('logo'),
  handleUploadErrors,
  sanitizeFile,
  createSubscription
);
router.put(
  '/admin/subscriptions/:id',
  permission,
  uploadSubscriptionImage.single('logo'),
  handleUploadErrors,
  sanitizeFile,
  updateSubscription
);
router.delete('/admin/subscriptions/:id', deleteSubscription);

// Product management
router.post(
  '/admin/products', 
  permission,
  uploadProductMedia.array('media', 5), 
  handleUploadErrors, 
  validateProductMedia,
  sanitizeFile, 
  createProduct
);

router.put(
  '/admin/products/:id', 
  permission,
  uploadProductMedia.array('media', 5), 
  handleUploadErrors, 
  validateProductMedia,
  sanitizeFile, 
  updateProduct
);

router.delete('/admin/products/:id', permission, deleteProduct);
// New endpoint for fetching all sub-categories for featured products
router.get('/sub-categories', getAllProductSubCategories);

// New admin product list endpoint
router.get('/products-list', getProductListForAdmin);

// ========================================
// SLIDER IMAGE ADMIN ROUTES
// ========================================

// Get all slider images (admin)
router.get('/admin/sliders', getAdminSliderImages);

// Get slider image by ID (admin)
router.get('/admin/sliders/:id', getSliderImageById);

// Create slider image
router.post(
  '/admin/sliders',
  permission,
  uploadSliderImage.single('image'),
  handleUploadErrors,
  sanitizeFile,
  createSliderImage
);

// Update slider image
router.put(
  '/admin/sliders/:id',
  permission,
  uploadSliderImage.single('image'),
  handleUploadErrors,
  sanitizeFile,
  updateSliderImage
);

// Delete slider image
router.delete('/admin/sliders/:id', permission, deleteSliderImage);

// ========================================
// PROMO IMAGE ADMIN ROUTES
// ========================================

// Get all promo images (admin)
router.get('/admin/promos', getAdminPromoImages);

// Get promo image by ID (admin)
router.get('/admin/promos/:id', getPromoImageById);

// Create promo image
router.post(
  '/admin/promos',
  permission,
  uploadPromoImage.single('image'),
  handleUploadErrors,
  sanitizeFile,
  createPromoImage
);

// Update promo image
router.put(
  '/admin/promos/:id',
  permission,
  uploadPromoImage.single('image'),
  handleUploadErrors,
  sanitizeFile,
  updatePromoImage
);

// Delete promo image
router.delete('/admin/promos/:id', permission, deletePromoImage);

// ========================================
// FILE UPLOAD ROUTES (Admin only)
// ========================================

// Upload product images
router.post('/admin/upload/product-image',
  permission,
  uploadProductMedia.single('image'),
  handleUploadErrors,
  sanitizeFile,
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename: req.file.filename,
        path: `/uploads/products/${req.file.filename}`,
        size: req.file.size
      }
    });
  }
);

// Upload subscription logos
router.post('/admin/upload/subscription-logo',
  permission,
  uploadSubscriptionImage.single('logo'),
  handleUploadErrors,
  sanitizeFile,
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        filename: req.file.filename,
        path: `/uploads/subscriptions/${req.file.filename}`,
        size: req.file.size
      }
    });
  }
);

// Upload game images
router.post('/admin/upload/game-image',
  permission,
  uploadGameImage.single('image'),
  handleUploadErrors,
  sanitizeFile,
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    res.json({
      success: true,
      message: 'Game image uploaded successfully',
      data: {
        filename: req.file.filename,
        path: `/uploads/games/${req.file.filename}`,
        size: req.file.size
      }
    });
  }
);

export default router;
