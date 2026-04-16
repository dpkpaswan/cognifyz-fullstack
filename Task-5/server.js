/**
 * server.js - NexusAPI Express Server (Task 5)
 *
 * Advanced API Dashboard demonstrating:
 *  - OAuth2-style JWT authentication (access + refresh tokens)
 *  - External API integration (GitHub, Open-Meteo, ExchangeRate)
 *  - Custom sliding-window rate limiting with dashboard
 *  - Circuit breaker pattern for external service resilience
 *  - Comprehensive error handling with typed errors & request IDs
 *
 * Architecture:
 *  ┌─────────────┐     ┌──────────────┐     ┌────────────────┐
 *  │  SPA Client  │────▶│  Express API  │────▶│  External APIs  │
 *  └─────────────┘     └──────────────┘     └────────────────┘
 *        │                    │
 *        │              ┌────┴────┐
 *        │              │ Middleware│
 *        │              ├──────────┤
 *        │              │ Auth JWT  │
 *        │              │ Rate Limit│
 *        │              │ Circuit Bk│
 *        │              │ Error Hndl│
 *        │              └──────────┘
 *        │
 *  Hash-based SPA Router (#/login, #/dashboard, #/github, etc.)
 */

const express = require('express');
const path = require('path');

// Middleware
const { requestIdMiddleware, globalErrorHandler, NotFoundError } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/auth');
const externalRoutes = require('./routes/external');
const explorerRoutes = require('./routes/apiExplorer');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Global Middleware
// ---------------------------------------------------------------------------

// Request ID for tracing
app.use(requestIdMiddleware);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// General API rate limiter (applied to all /api routes)
app.use('/api', apiLimiter);

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// OAuth Authentication
app.use('/api/oauth', authRoutes);

// External API Integration
app.use('/api/external', externalRoutes);

// API Explorer, Health, Rate Limit Status
app.use('/api', explorerRoutes);

// ---------------------------------------------------------------------------
// 404 Handler for unknown API routes
// ---------------------------------------------------------------------------

app.use('/api/*', (req, res, next) => {
  next(new NotFoundError(`API endpoint ${req.method} ${req.originalUrl}`));
});

// ---------------------------------------------------------------------------
// SPA - Serve the single page for all non-API routes
// ---------------------------------------------------------------------------

app.get('*', (req, res) => {
  res.render('index', {
    pageTitle: 'NexusAPI - Advanced API Dashboard'
  });
});

// ---------------------------------------------------------------------------
// Global Error Handler (must be last middleware)
// ---------------------------------------------------------------------------

app.use(globalErrorHandler);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n  ⚡ NexusAPI server running at http://localhost:${PORT}\n`);
  console.log(`  OAuth Endpoints:`);
  console.log(`    POST   /api/oauth/register`);
  console.log(`    POST   /api/oauth/authorize`);
  console.log(`    POST   /api/oauth/token/refresh`);
  console.log(`    POST   /api/oauth/token/revoke`);
  console.log(`    GET    /api/oauth/userinfo`);
  console.log(`\n  External API Endpoints:`);
  console.log(`    GET    /api/external/github/user/:username`);
  console.log(`    GET    /api/external/github/repos/:username`);
  console.log(`    GET    /api/external/weather?city=...`);
  console.log(`    GET    /api/external/exchange?base=USD&target=EUR`);
  console.log(`    GET    /api/external/log`);
  console.log(`\n  System Endpoints:`);
  console.log(`    GET    /api/health`);
  console.log(`    GET    /api/rate-limit/status`);
  console.log(`    GET    /api/explorer/endpoints\n`);
});
