/**
 * File Upload Middleware
 * Handles secure file uploads using multer
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Set up base upload directory
const uploadDir = process.env.UPLOAD_PATH || './public/uploads';

// Define specific upload directories
const UPLOAD_DIRS = {
  USER: 'users',
  PRODUCT: 'products',
  SLIDER: 'sliders',
  PROMO: 'promos',
  SUBSCRIPTION: 'subscriptions',
  GAME: 'games',
  PAYMENT_PROOF: 'payment_proofs'
};

// Create all necessary directories
Object.values(UPLOAD_DIRS).forEach(dir => {
  const fullPath = path.join(uploadDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
  }
});

// Helper function to create storage configuration
const createStorage = (uploadType) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      let targetDir;
      
      switch (uploadType) {
        case 'product':
          targetDir = path.join(uploadDir, UPLOAD_DIRS.PRODUCT);
          break;
        case 'slider':
          targetDir = path.join(uploadDir, UPLOAD_DIRS.SLIDER);
          break;
        case 'promo':
          targetDir = path.join(uploadDir, UPLOAD_DIRS.PROMO);
          break;
        case 'subscription':
          targetDir = path.join(uploadDir, UPLOAD_DIRS.SUBSCRIPTION);
          break;
        case 'game':
          targetDir = path.join(uploadDir, UPLOAD_DIRS.GAME);
          break;
        case 'payment_proof':
          targetDir = path.join(uploadDir, UPLOAD_DIRS.PAYMENT_PROOF);
          break;
        case 'user':
        default:
          // For user-specific uploads, create user directory
          targetDir = path.join(uploadDir, UPLOAD_DIRS.USER, `user_${req.user}`);
          break;
      }

      // Create directory if it doesn't exist
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      // Generate a secure random filename
      const randomName = crypto.randomBytes(16).toString('hex');
      const fileExt = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomName}${fileExt}`);
    }
  });
};

// Define allowed file types by category
const ALLOWED_TYPES = {
  image: {
    mimetypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  },
  video: {
    mimetypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    extensions: ['.mp4', '.webm', '.mov']
  }
};

// Helper function to check file type
const isAllowedFile = (file, types) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return types.mimetypes.includes(file.mimetype) && types.extensions.includes(ext);
};

// File filter to allow only certain file types
const fileFilter = (req, file, cb) => {
  // Profile image specific validation
  if (req.baseUrl?.includes('/user/profile')) {
    // Only allow images for profile pictures, with stricter size limit
    if (isAllowedFile(file, ALLOWED_TYPES.image)) {
      const sizeInMB = file.size / (1024 * 1024);
      if (sizeInMB > 2) { // 2MB limit for profile images
        cb(new Error('Profile image must be less than 2MB'), false);
      } else {
        cb(null, true);
      }
    } else {
      cb(new Error('Only images (.jpg, .jpeg, .png, .gif, .webp) are allowed for profile pictures'), false);
    }
    return;
  }

  // Product media specific validation
  if (req.baseUrl?.includes('/products') || req.baseUrl?.includes('/admin/products')) {
    if (isAllowedFile(file, ALLOWED_TYPES.image) || isAllowedFile(file, ALLOWED_TYPES.video)) {
      req.mediaCount = req.mediaCount || { images: 0, videos: 0, total: 0 };
      
      if (isAllowedFile(file, ALLOWED_TYPES.image)) {
        req.mediaCount.images++;
      } else {
        req.mediaCount.videos++;
      }
      req.mediaCount.total++;

      if (req.mediaCount.total > 5) {
        cb(new Error('Maximum 5 media files allowed'), false);
      } else if (req.mediaCount.videos > 2) {
        cb(new Error('Maximum 2 videos allowed'), false);
      } else {
        cb(null, true);
      }
    } else {
      cb(new Error('Only images (.jpg, .jpeg, .png, .gif, .webp) and videos (.mp4, .webm, .mov) are allowed for products'), false);
    }
    return;
  }

  // For other upload types, use appropriate validation
  switch (req.baseUrl) {
    case '/admin/sliders':
    case '/admin/promos':
      if (isAllowedFile(file, ALLOWED_TYPES.image)) {
        cb(null, true);
      } else {
        cb(new Error('Only images (.jpg, .jpeg, .png, .gif, .webp) are allowed'), false);
      }
      break;

    case '/admin/subscriptions':
      if (isAllowedFile(file, ALLOWED_TYPES.image)) {
        cb(null, true);
      } else {
        cb(new Error('Only images (.jpg, .jpeg, .png, .gif, .webp) are allowed for logos'), false);
      }
      break;

    case '/admin/games':
      if (isAllowedFile(file, ALLOWED_TYPES.image)) {
        cb(null, true);
      } else {
        cb(new Error('Only images (.jpg, .jpeg, .png, .gif, .webp) are allowed for game covers'), false);
      }
      break;

    default:
      // For any other uploads, only allow images
      if (isAllowedFile(file, ALLOWED_TYPES.image)) {
        cb(null, true);
      } else {
        cb(new Error('Only images are allowed'), false);
      }
  }
};

// Create different multer instances for different upload types
const createUploader = (uploadType, limits = {}) => {
  return multer({
    storage: createStorage(uploadType),
    fileFilter: fileFilter,
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE) || 524288000, // 500MB default
      ...limits
    }
  });
};

// Configure different upload instances
const upload = createUploader('user', {
  fileSize: 2 * 1024 * 1024, // 2MB limit for profile images
  files: 1
});

const uploadProductMedia = createUploader('product', {
  fileSize: 100 * 1024 * 1024, // 100MB per file for videos
  files: 5, // Maximum 5 files total
  fileFilter: (req, file, cb) => {
    // Reset media count on first file
    if (!req.mediaCount) {
      req.mediaCount = { images: 0, videos: 0, total: 0 };
    }
    fileFilter(req, file, cb);
  }
});

// Middleware to validate product media requirements
const validateProductMedia = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one image is required'
    });
  }

  // Check if we have at least one image
  const hasImage = req.files.some(file => 
    file.mimetype.startsWith('image/')
  );

  if (!hasImage) {
    return res.status(400).json({
      success: false,
      message: 'At least one image is required for the product'
    });
  }

  next();
};

const uploadSliderImage = createUploader('slider', {
  fileSize: 10 * 1024 * 1024, // 10MB per file
  files: 1
});
const uploadPromoImage = createUploader('promo', {
  fileSize: 10 * 1024 * 1024, // 10MB per file
  files: 1
});

const uploadSubscriptionImage = createUploader('subscription', {
  fileSize: 5 * 1024 * 1024, // 5MB per file - logos are usually smaller
  files: 1
});

const uploadGameImage = createUploader('game', {
  fileSize: 20 * 1024 * 1024, // 20MB per file - game images might be higher quality
  files: 1
});

const uploadPaymentProof = createUploader('payment_proof', {
  fileSize: 200 * 1024 * 1024, // 200MB per file for payment proofs
  files: 1
});

// Error handling middleware for multer
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 500MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

// Middleware to sanitize uploaded files
const sanitizeFile = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }
  
  try {
    const files = req.files || [req.file];
    const fileInfos = [];
    
    for (const file of files) {
      const filePath = file.path;
      const fileStats = fs.statSync(filePath);
      
      // Check if file is empty
      if (fileStats.size === 0) {
        fs.unlinkSync(filePath); // Delete the empty file
        return res.status(400).json({
          success: false,
          message: 'Empty file detected'
        });
      }
      
      fileInfos.push({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: fileStats.size,
        path: file.path.replace(/\\/g, '/') // Normalize path for cross-platform
      });
    }
    
    // Add file metadata to request
    req.fileInfo = req.files ? fileInfos : fileInfos[0];
    
    next();
  } catch (error) {
    console.error('File sanitization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing uploaded file'
    });
  }
};

export {
  upload,
  uploadProductMedia,
  validateProductMedia,
  uploadSliderImage,
  uploadPromoImage,
  uploadSubscriptionImage,
  uploadGameImage,
  uploadPaymentProof,
  handleUploadErrors,
  sanitizeFile,
  ALLOWED_TYPES,
  UPLOAD_DIRS
};