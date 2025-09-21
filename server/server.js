/**
 * Main Server File
 * Sets up the Express server with all middleware and routes
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import expressMysqlSession from 'express-mysql-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import http from 'http';
import { WebSocketServer } from 'ws';
import url from 'url';

dotenv.config({ path: '../.env' });
import { verifyEmailConfig } from './utils/email.js';

const MySQLStore = expressMysqlSession(session);


// Import database connection
import {pool ,query , testConnection} from './database/db.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import pagesRoutes from './routes/pages.js';
import processRoutes from './routes/admin.route.js';
import productsRoutes from './routes/products.route.js';
import ordersRoutes from './routes/orders.route.js';
import vouchRoutes from './routes/vouch.route.js';
import supportRoutes from './routes/support.route.js';

// Import WebSocket handlers
import { handleWebSocketConnection as handleCustomerWebSocket } from './controller/customerChatController.js';
import { handleWebSocketConnection as handleAdminWebSocket } from './controller/adminChatController.js';

// Import chat routes
import customerChatRoutes from './routes/customerChatRoutes.js';
import adminChatRoutes from './routes/adminChatRoutes.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Store WebSocket server globally for access from controllers
global.wss = wss;

// Redirect HTTP to HTTPS (if behind proxy like Heroku or Nginx)
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});


app.use((req, res, next) => {
  if (req.path === '/server.js') {
    return render(500);
  }
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", 'https://cartify.bisup.com.np'],
      scriptSrc: [
        "'self'",
        "'sha256-iBoTqXc6ieexkY+Nomyv125XXuVw4j9hB+XRicb3uME='",
        "'sha256-IOHXDXJXTDxKvC+Ul0raIJXaupC1DX75ttF8khaYOVA='",
        "'sha256-wUr4BKVjnW5RvZmY9AJPuMdB9JLe9pSBGeNhtH2l2Dg='",
        'https://cartify.bisup.com.np',
        'https://cdnjs.cloudflare.com',
        'https://cdn.jsdelivr.net',
        'https://*.fontawesome.com',
        'https://cdn.cloudflare.steamstatic.com',
        'https://upload.wikimedia.org',
        'https://images.unsplash.com',
        'https://randomuser.me',
        'https://play-lh.googleusercontent.com'
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cartify.bisup.com.np', 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://*.fontawesome.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://*.fontawesome.com'],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        'https://cartify.bisup.com.np',
        'https://images.unsplash.com',
        'https://randomuser.me',
        'https://upload.wikimedia.org',
        'https://cdn.cloudflare.steamstatic.com',
        'https://cdn.steamstatic.com',
        'https://play-lh.googleusercontent.com',
        'https://via.placeholder.com',
        'https://cdn-icons-png.flaticon.com' // Added to allow images from this source
      ],
      connectSrc: ["'self'", 'https://cartify.bisup.com.np', 'http://cartify.bisup.com.np', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      frameSrc: ["'self'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:']
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGIN 
    : ['http://localhost:3000','https://cartify.bisup.com.np','http://cartify.bisup.com.np'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposedHeaders: ['Content-Length', 'X-Requested-With'
  ]
}));

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Cookie parser
app.use(cookieParser());









const mysqlOptions = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
};


const sessionStore = new MySQLStore({
    ...mysqlOptions,
    clearExpired: true, // Clean up expired sessions
    checkExpirationInterval: 900000, // Every 15 minutes
  });


app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true, // Create session for guests
    store: sessionStore,
    name:'SSID',
    cookie: {
      maxAge: 1000 * 60 * 60 * 3, // 3 hours
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'strict', // CSRF protection
    },
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    // Only select the fields you need
    const users = await query(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );
    if (!users || users.length === 0) {
      // User no longer exists
      return done(null, false);
    }
    done(null, users[0]); // Attach sanitized user object
  } catch (err) {
    console.error('Passport deserializeUser error:', err);
    done(null, false);
  }
});


// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:'/api/auth/oauth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {

  try {
    const email = profile.emails[0].value;
    const providerId = profile.id;
    // Check if user exists by provider/provider_id
    let users = await query('SELECT * FROM users WHERE provider = ? AND provider_id = ?', ['google', providerId]);
    if (users.length === 0) {
      // Check if user exists by email (manual registration)
      let existing = await query('SELECT * FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        await query(
          'UPDATE users SET provider = ?, provider_id = ? WHERE id = ?',
          ['google', providerId, existing[0].id]
        );
        users = await query('SELECT * FROM users WHERE id = ?', [existing[0].id]);
      } else {
        const username = profile.displayName || email.split('@')[0];
        const insertResult = await query(
          'INSERT INTO users (email, username, password, role_id, email_verified, provider, provider_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [email, username, '', 3, true, 'google', providerId]
        );
        // insertResult.insertId if your query returns an object, or insertResult[0].insertId if array
        const insertId = insertResult.insertId || (insertResult[0] && insertResult[0].insertId);
        users = await query('SELECT * FROM users WHERE id = ?', [insertId]);
      }
    }
  
    return done(null, users[0], { tokens: { accessToken, refreshToken } });
  } catch (err) {
    return done(err);
  }
}));

// // Facebook OAuth Strategy
// passport.use(new FacebookStrategy({
//   clientID: process.env.FACEBOOK_CLIENT_ID,
//   clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
//   callbackURL: '/api/auth/oauth/facebook/callback',
//   profileFields: ['id', 'emails', 'displayName']
// }, async (accessToken, refreshToken, profile, done) => {
//   try {
//     const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
//     const providerId = profile.id;
//     if (!email) return done(null, false, { message: 'No email from Facebook' });
//     // Check if user exists by provider/provider_id
//     let users = await query('SELECT * FROM users WHERE provider = ? AND provider_id = ?', ['facebook', providerId]);
//     if (users.length === 0) {
//       // Check if user exists by email (manual registration)
//       let existing = await query('SELECT * FROM users WHERE email = ?', [email]);
//       if (existing.length > 0) {
//         await query(
//           'UPDATE users SET provider = ?, provider_id = ? WHERE id = ?',
//           ['facebook', providerId, existing[0].id]
//         );
//         users = await query('SELECT * FROM users WHERE id = ?', [existing[0].id]);
//       } else {
//         const username = profile.displayName || email.split('@')[0];
//         const insertResult = await query(
//           'INSERT INTO users (email, username, password, role_id, email_verified, provider, provider_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
//           [email, username, '', 3, true, 'facebook', providerId]
//         );
//         const insertId = insertResult.insertId || (insertResult[0] && insertResult[0].insertId);
//         users = await query('SELECT * FROM users WHERE id = ?', [insertId]);
//       }
//     }
//     return done(null, users[0], { tokens: { accessToken, refreshToken } });
//   } catch (err) {
//     return done(err);
//   }
// }));

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from 'public' directory - MUST be before routes
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '..', 'admin')));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));




// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/process', processRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/vouch', vouchRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/customer/chat', customerChatRoutes);
app.use('/api/admin/chat', adminChatRoutes);

// Page routes
app.use('/', pagesRoutes);

// Serve frontend for all other routes (should be last)
app.get('/', (req, res) => {
  res.render('index');
});




// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  // Hide stack trace and sensitive info from client
  res.render('500');
});

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  const parsedUrl = url.parse(request.url);
  const pathname = parsedUrl.pathname;
  

  
  // Customer chat WebSocket
  if (pathname.startsWith('/ws/customer/chat/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      // Extract userId from URL path
      const pathParts = pathname.split('/').filter(part => part !== '');
      const userId = pathParts[pathParts.length - 1];
      
    
      
      if (!userId || userId === '') {
        console.error('Invalid userId in WebSocket URL:', pathname);
        socket.destroy();
        return;
      }
      
      request.params = { userId };
      wss.emit('connection', ws, request);
      handleCustomerWebSocket(ws, request);
    });
  }
  // Admin chat WebSocket
  else if (pathname.startsWith('/ws/admin/chat/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      // Extract adminId from URL path
      const pathParts = pathname.split('/').filter(part => part !== '');
      const adminId = pathParts[pathParts.length - 1];
      
     
      
      if (!adminId || adminId === '') {
        console.error('Invalid adminId in WebSocket URL:', pathname);
        socket.destroy();
        return;
      }
      
      request.params = { adminId };
      wss.emit('connection', ws, request);
      handleAdminWebSocket(ws, request);
    });
  }
  else {
    socket.destroy();
  }
});

// WebSocket ping to keep connections alive
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Start server
const startServer = async () => {
  try {
    await testConnection();
    await verifyEmailConfig();
   

    // Start listening for requests - bind to all network interfaces
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Local: http://localhost:${PORT}`);
      console.log(`Network: http://192.168.1.6:${PORT}`);
      console.log(`WebSocket: ws://localhost:${PORT}/ws/`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();