/**
 * rateLimiter.js - Custom Sliding Window Rate Limiter
 *
 * Features:
 *  - Per-IP sliding window rate limiting
 *  - Configurable limits for different route groups
 *  - X-RateLimit-* response headers
 *  - Retry-After header on 429 responses
 *  - Status endpoint to expose current usage for the dashboard
 */

const { RateLimitError } = require('./errorHandler');

// ---------------------------------------------------------------------------
// In-Memory Rate Limit Store
// ---------------------------------------------------------------------------

/**
 * Store structure:
 * {
 *   [key]: {
 *     timestamps: [Number],   // array of request timestamps (ms)
 *     blocked: false           // whether currently blocked
 *   }
 * }
 */
const store = new Map();

// Global stats for the dashboard
const globalStats = {
  totalRequests: 0,
  blockedRequests: 0,
  activeWindows: 0,
  history: []       // last 60 data points for the chart
};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    // Remove entries that haven't been accessed in 10 minutes
    entry.timestamps = entry.timestamps.filter(ts => now - ts < 600000);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
  globalStats.activeWindows = store.size;
}, 300000);

// Record stats every 5 seconds for the live chart
setInterval(() => {
  globalStats.history.push({
    time: Date.now(),
    total: globalStats.totalRequests,
    blocked: globalStats.blockedRequests
  });
  // Keep last 60 data points (5 minutes of data)
  if (globalStats.history.length > 60) {
    globalStats.history.shift();
  }
}, 5000);

// ---------------------------------------------------------------------------
// Rate Limiter Factory
// ---------------------------------------------------------------------------

/**
 * Creates a rate limiter middleware with the given options.
 *
 * @param {Object} options
 * @param {number} options.windowMs   - Time window in milliseconds (default: 60000 = 1 min)
 * @param {number} options.maxRequests - Max requests per window (default: 30)
 * @param {string} options.prefix     - Key prefix for separating different limiters
 * @param {string} options.message    - Custom error message
 * @returns Express middleware
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60000,
    maxRequests = 30,
    prefix = 'global',
    message = 'Too many requests. Please slow down.'
  } = options;

  return (req, res, next) => {
    const identifier = req.user ? req.user.id : req.ip;
    const key = `${prefix}:${identifier}`;
    const now = Date.now();

    globalStats.totalRequests++;

    // Initialize or get existing entry
    if (!store.has(key)) {
      store.set(key, { timestamps: [], blocked: false });
    }

    const entry = store.get(key);

    // Remove timestamps outside the current window
    entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);

    // Check if limit exceeded
    if (entry.timestamps.length >= maxRequests) {
      globalStats.blockedRequests++;
      entry.blocked = true;

      const oldestInWindow = Math.min(...entry.timestamps);
      const retryAfterMs = windowMs - (now - oldestInWindow);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(now + retryAfterMs).toISOString());
      res.setHeader('Retry-After', retryAfterSec);

      const error = new RateLimitError(retryAfterSec);
      error.message = message;
      return next(error);
    }

    // Record this request
    entry.timestamps.push(now);
    entry.blocked = false;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - entry.timestamps.length);
    res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

    globalStats.activeWindows = store.size;
    next();
  };
}

// ---------------------------------------------------------------------------
// Pre-configured Limiters
// ---------------------------------------------------------------------------

/** General API: 60 requests per minute */
const apiLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 60,
  prefix: 'api',
  message: 'API rate limit exceeded. Max 60 requests per minute.'
});

/** Auth routes: 10 requests per minute (prevent brute force) */
const authLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  prefix: 'auth',
  message: 'Too many auth attempts. Max 10 per minute.'
});

/** External API proxy: 20 requests per minute */
const externalLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 20,
  prefix: 'external',
  message: 'External API rate limit exceeded. Max 20 requests per minute.'
});

// ---------------------------------------------------------------------------
// Rate Limit Status (for dashboard display)
// ---------------------------------------------------------------------------

function getRateLimitStatus(req) {
  const identifier = req.user ? req.user.id : req.ip;
  const now = Date.now();

  const limiters = ['api', 'auth', 'external'];
  const status = {};

  limiters.forEach(prefix => {
    const key = `${prefix}:${identifier}`;
    const entry = store.get(key);
    const config = {
      api: { windowMs: 60000, maxRequests: 60 },
      auth: { windowMs: 60000, maxRequests: 10 },
      external: { windowMs: 60000, maxRequests: 20 }
    }[prefix];

    if (entry) {
      const activeTimestamps = entry.timestamps.filter(ts => now - ts < config.windowMs);
      status[prefix] = {
        used: activeTimestamps.length,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - activeTimestamps.length),
        blocked: entry.blocked,
        windowMs: config.windowMs,
        resetsAt: activeTimestamps.length > 0
          ? new Date(Math.min(...activeTimestamps) + config.windowMs).toISOString()
          : null
      };
    } else {
      status[prefix] = {
        used: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        blocked: false,
        windowMs: config.windowMs,
        resetsAt: null
      };
    }
  });

  return {
    identifier,
    limiters: status,
    global: {
      totalRequests: globalStats.totalRequests,
      blockedRequests: globalStats.blockedRequests,
      activeWindows: globalStats.activeWindows,
      history: globalStats.history.slice(-30)
    }
  };
}

module.exports = {
  createRateLimiter,
  apiLimiter,
  authLimiter,
  externalLimiter,
  getRateLimitStatus
};
