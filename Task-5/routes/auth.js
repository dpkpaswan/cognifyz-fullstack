/**
 * routes/auth.js - OAuth-Style Authentication Routes
 *
 * Endpoints:
 *  POST /api/oauth/register        - Register a new user, return token pair
 *  POST /api/oauth/authorize        - Login, return access + refresh tokens
 *  POST /api/oauth/token/refresh    - Exchange refresh token for new access token
 *  POST /api/oauth/token/revoke     - Revoke a refresh token (logout)
 *  GET  /api/oauth/userinfo         - Protected: return current user profile
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const {
  generateTokenPair,
  verifyRefreshToken,
  generateAccessToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  authenticateToken,
  getTokenInfo
} = require('../middleware/auth');

const {
  ValidationError,
  AuthError,
  asyncHandler
} = require('../middleware/errorHandler');

const { authLimiter } = require('../middleware/rateLimiter');

// ---------------------------------------------------------------------------
// In-Memory User Store
// ---------------------------------------------------------------------------

/** @type {Array<{id: string, name: string, email: string, password: string, createdAt: string}>} */
const users = [];

/** Simple password hash (for demo - use bcrypt in production) */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRegistration(body) {
  const errors = [];
  const { name, email, password, confirmPassword } = body;

  if (!name || name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters long.' });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.push({ field: 'email', message: 'Please provide a valid email address.' });
  } else if (users.find(u => u.email === email.trim().toLowerCase())) {
    errors.push({ field: 'email', message: 'An account with this email already exists.' });
  }

  if (!password || password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters.' });
  }
  if (password && !/[A-Z]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must contain an uppercase letter.' });
  }
  if (password && !/[0-9]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must contain a number.' });
  }
  if (password && !/[^A-Za-z0-9]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must contain a special character.' });
  }

  if (password !== confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Passwords do not match.' });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/oauth/register
 * Register a new user and return JWT token pair.
 */
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const errors = validateRegistration(req.body);

  if (errors.length > 0) {
    throw new ValidationError('Registration validation failed', errors);
  }

  const user = {
    id: generateId(),
    name: req.body.name.trim(),
    email: req.body.email.trim().toLowerCase(),
    password: hashPassword(req.body.password),
    createdAt: new Date().toISOString()
  };

  users.push(user);

  const tokens = generateTokenPair(user);

  res.status(201).json({
    success: true,
    message: 'Registration successful! OAuth tokens generated.',
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
    tokens: {
      access_token: tokens.accessToken.token,
      token_type: tokens.accessToken.type,
      expires_in: tokens.accessToken.expiresIn,
      refresh_token: tokens.refreshToken.token,
      refresh_expires_in: tokens.refreshToken.expiresIn
    }
  });
}));

/**
 * POST /api/oauth/authorize
 * Authenticate a user and return token pair. (OAuth2 authorization endpoint)
 */
router.post('/authorize', authLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ValidationError('Email and password are required', [
      ...(!email ? [{ field: 'email', message: 'Email is required' }] : []),
      ...(!password ? [{ field: 'password', message: 'Password is required' }] : [])
    ]);
  }

  const user = users.find(u => u.email === email.trim().toLowerCase());

  if (!user || user.password !== hashPassword(password)) {
    throw new AuthError('Invalid email or password');
  }

  const tokens = generateTokenPair(user);

  res.json({
    success: true,
    message: 'Authorization successful!',
    grant_type: 'authorization_code',
    user: { id: user.id, name: user.name, email: user.email },
    tokens: {
      access_token: tokens.accessToken.token,
      token_type: tokens.accessToken.type,
      expires_in: tokens.accessToken.expiresIn,
      refresh_token: tokens.refreshToken.token,
      refresh_expires_in: tokens.refreshToken.expiresIn
    }
  });
}));

/**
 * POST /api/oauth/token/refresh
 * Exchange a refresh token for a new access token (token rotation).
 */
router.post('/token/refresh', asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    throw new ValidationError('Refresh token is required', [
      { field: 'refresh_token', message: 'Refresh token must be provided in request body' }
    ]);
  }

  // Verify the refresh token
  const decoded = verifyRefreshToken(refresh_token);

  // Find the user
  const user = users.find(u => u.id === decoded.sub);
  if (!user) {
    throw new AuthError('User not found');
  }

  // Generate new access token (optionally rotate refresh token too)
  const newAccessToken = generateAccessToken(user);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    tokens: {
      access_token: newAccessToken.token,
      token_type: newAccessToken.type,
      expires_in: newAccessToken.expiresIn
    }
  });
}));

/**
 * POST /api/oauth/token/revoke
 * Revoke a refresh token (logout).
 */
router.post('/token/revoke', asyncHandler(async (req, res) => {
  const { refresh_token, revoke_all } = req.body;

  if (revoke_all && req.user) {
    revokeAllUserTokens(req.user.id);
    return res.json({
      success: true,
      message: 'All refresh tokens revoked for this user'
    });
  }

  if (!refresh_token) {
    throw new ValidationError('Refresh token is required', [
      { field: 'refresh_token', message: 'Provide the refresh token to revoke' }
    ]);
  }

  const revoked = revokeRefreshToken(refresh_token);

  res.json({
    success: true,
    message: revoked ? 'Token revoked successfully' : 'Token was already revoked or not found'
  });
}));

/**
 * GET /api/oauth/userinfo
 * Protected endpoint - returns current user profile.
 */
router.get('/userinfo', authenticateToken, asyncHandler(async (req, res) => {
  const user = users.find(u => u.id === req.user.id);

  if (!user) {
    throw new AuthError('User not found');
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    },
    tokenInfo: getTokenInfo()
  });
}));

// Export users array so server.js can reference it if needed
module.exports = router;
module.exports.users = users;
