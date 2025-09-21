/**
 * Custom Rate Limiting Middleware
 * Protects against brute-force and abuse by limiting requests per IP per route
 */

const rateLimiters = new Map();

/**
 * Rate limit middleware factory
 * @param {number} limit - Max requests allowed in window
 * @param {number} windowMs - Time window in ms
 */
function rateLimit(limit = 5, windowMs = 60 * 1000) {
  return (req, res, next) => {
    const ip = req.ip;
    const route = req.originalUrl;
    const key = `${ip}:${route}`;
    const now = Date.now();

    if (!rateLimiters.has(key)) {
      rateLimiters.set(key, []);
    }
    const timestamps = rateLimiters.get(key);

    // Remove timestamps outside window
    while (timestamps.length && timestamps[0] <= now - windowMs) {
      timestamps.shift();
    }

    if (timestamps.length >= limit) {
      return res.status(429).json({
        success: false,
        message: `Too many requests. Please try again later.`
      });
    }

    timestamps.push(now);
    rateLimiters.set(key, timestamps);
    next();
  };
}

// Named rate limiters for different routes
// 5 requests per minute for login
const loginRateLimit = rateLimit(5, 60 * 1000);
// 5 requests per minute for registration
const registerRateLimit = rateLimit(5, 60 * 1000);
// 5 requests per minute for OTP-related actions
const otpRateLimit = rateLimit(5, 60 * 1000);
// 5 requests per minute for vouch
const vouchRateLimit = rateLimit(10, 60 * 1000);
// 5 requests per minute for support tickets
const supportTicketRateLimit = rateLimit(5, 60 * 1000);
const profileInfo = rateLimit(10, 60 * 1000); // 10 requests per minute for profile info updates

const messageRateLimit = rateLimit(20, 60 * 1000); // 20 requests per minute for messages
const adminMessageRateLimit = rateLimit(30, 60 * 1000); // 30 requests per minute for admin messages


export {
  rateLimit,
  loginRateLimit,
  registerRateLimit,
  profileInfo,
  otpRateLimit,
  vouchRateLimit,
  supportTicketRateLimit,
  messageRateLimit,
  adminMessageRateLimit
};