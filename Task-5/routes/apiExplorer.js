/**
 * routes/apiExplorer.js - API Documentation & Health Routes
 *
 * Provides:
 *  GET /api/explorer/endpoints  - List all API endpoints with documentation
 *  GET /api/health              - System health check with circuit breaker states
 *  GET /api/rate-limit/status   - Current rate limit usage for the caller
 */

const express = require('express');
const router = express.Router();

const { getAllBreakerStatus } = require('../middleware/circuitBreaker');
const { getRateLimitStatus } = require('../middleware/rateLimiter');
const { getTokenInfo, optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// ---------------------------------------------------------------------------
// API Endpoint Documentation
// ---------------------------------------------------------------------------

const API_DOCS = [
  {
    group: 'OAuth Authentication',
    icon: 'shield-lock',
    description: 'OAuth2-style JWT authentication with access & refresh tokens',
    endpoints: [
      {
        method: 'POST',
        path: '/api/oauth/register',
        description: 'Register a new user account',
        auth: false,
        rateLimit: '10/min',
        body: { name: 'string', email: 'string', password: 'string', confirmPassword: 'string' },
        response: '{ success, user, tokens: { access_token, refresh_token } }'
      },
      {
        method: 'POST',
        path: '/api/oauth/authorize',
        description: 'Login and obtain token pair',
        auth: false,
        rateLimit: '10/min',
        body: { email: 'string', password: 'string' },
        response: '{ success, user, tokens: { access_token, refresh_token } }'
      },
      {
        method: 'POST',
        path: '/api/oauth/token/refresh',
        description: 'Exchange refresh token for new access token',
        auth: false,
        rateLimit: '10/min',
        body: { refresh_token: 'string' },
        response: '{ success, tokens: { access_token } }'
      },
      {
        method: 'POST',
        path: '/api/oauth/token/revoke',
        description: 'Revoke a refresh token (logout)',
        auth: false,
        rateLimit: '10/min',
        body: { refresh_token: 'string' },
        response: '{ success, message }'
      },
      {
        method: 'GET',
        path: '/api/oauth/userinfo',
        description: 'Get current authenticated user profile',
        auth: true,
        rateLimit: '60/min',
        body: null,
        response: '{ success, user, tokenInfo }'
      }
    ]
  },
  {
    group: 'External APIs',
    icon: 'globe',
    description: 'Third-party API integrations with circuit breaker protection',
    endpoints: [
      {
        method: 'GET',
        path: '/api/external/github/user/:username',
        description: 'Fetch GitHub user profile',
        auth: true,
        rateLimit: '20/min',
        body: null,
        response: '{ success, source, latency, data: { login, name, bio, ... } }'
      },
      {
        method: 'GET',
        path: '/api/external/github/repos/:username',
        description: 'Fetch GitHub user repositories',
        auth: true,
        rateLimit: '20/min',
        body: null,
        params: { sort: 'updated | stars | pushed' },
        response: '{ success, count, data: [{ name, language, stars, ... }] }'
      },
      {
        method: 'GET',
        path: '/api/external/weather',
        description: 'Fetch weather forecast by city or coordinates',
        auth: true,
        rateLimit: '20/min',
        body: null,
        params: { city: 'string', lat: 'number', lon: 'number' },
        response: '{ success, data: { location, current, daily } }'
      },
      {
        method: 'GET',
        path: '/api/external/exchange',
        description: 'Fetch currency exchange rates',
        auth: true,
        rateLimit: '20/min',
        body: null,
        params: { base: 'USD', target: 'EUR', amount: '100' },
        response: '{ success, data: { base, rates, conversion } }'
      },
      {
        method: 'GET',
        path: '/api/external/log',
        description: 'View recent external API call history',
        auth: true,
        rateLimit: '20/min',
        body: null,
        response: '{ success, count, calls: [...] }'
      }
    ]
  },
  {
    group: 'System',
    icon: 'gear',
    description: 'Health checks, rate limit status, and API documentation',
    endpoints: [
      {
        method: 'GET',
        path: '/api/health',
        description: 'System health check with circuit breaker states',
        auth: false,
        rateLimit: '60/min',
        body: null,
        response: '{ success, status, uptime, circuitBreakers, tokenInfo }'
      },
      {
        method: 'GET',
        path: '/api/rate-limit/status',
        description: 'View your current rate limit usage',
        auth: false,
        rateLimit: '60/min',
        body: null,
        response: '{ success, rateLimits: { api, auth, external } }'
      },
      {
        method: 'GET',
        path: '/api/explorer/endpoints',
        description: 'List all API endpoints with documentation',
        auth: false,
        rateLimit: '60/min',
        body: null,
        response: '{ success, groups: [...] }'
      }
    ]
  }
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/explorer/endpoints
 * Return full API documentation.
 */
router.get('/explorer/endpoints', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    title: 'NexusAPI Documentation',
    version: '1.0.0',
    description: 'Advanced API Dashboard demonstrating OAuth, external API integration, rate limiting, and circuit breaker patterns.',
    totalEndpoints: API_DOCS.reduce((sum, g) => sum + g.endpoints.length, 0),
    groups: API_DOCS
  });
}));

/**
 * GET /api/health
 * System health check.
 */
router.get('/health', asyncHandler(async (req, res) => {
  const circuitBreakers = getAllBreakerStatus();
  const tokenInfo = getTokenInfo();

  // Overall status is degraded if any circuit is OPEN
  const allBreakers = Object.values(circuitBreakers);
  const anyOpen = allBreakers.some(b => b.state === 'OPEN');
  const anyHalfOpen = allBreakers.some(b => b.state === 'HALF_OPEN');

  let status = 'healthy';
  if (anyOpen) status = 'degraded';
  else if (anyHalfOpen) status = 'recovering';

  res.json({
    success: true,
    status,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    circuitBreakers,
    tokenInfo,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
  });
}));

/**
 * GET /api/rate-limit/status
 * Return current rate limit usage for the calling IP/user.
 */
router.get('/rate-limit/status', optionalAuth, asyncHandler(async (req, res) => {
  const status = getRateLimitStatus(req);

  res.json({
    success: true,
    rateLimits: status
  });
}));

module.exports = router;
