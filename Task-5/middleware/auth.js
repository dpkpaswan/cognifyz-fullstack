/**
 * auth.js - JWT Authentication Middleware
 *
 * Implements OAuth2-style token-based authentication:
 *  - Access tokens (short-lived, 15 minutes)
 *  - Refresh tokens (long-lived, 7 days)
 *  - Token generation, verification, and refresh
 *  - Bearer token extraction from Authorization header
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { AuthError } = require('./errorHandler');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// In production these would be environment variables
const JWT_SECRET = crypto.randomBytes(32).toString('hex');
const REFRESH_SECRET = crypto.randomBytes(32).toString('hex');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// ---------------------------------------------------------------------------
// Refresh Token Store (in-memory)
// ---------------------------------------------------------------------------

/** @type {Map<string, {userId: string, token: string, expiresAt: Date, revoked: boolean}>} */
const refreshTokens = new Map();

// Clean up expired/revoked refresh tokens every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of refreshTokens.entries()) {
    if (entry.revoked || new Date(entry.expiresAt).getTime() < now) {
      refreshTokens.delete(key);
    }
  }
}, 1800000);

// ---------------------------------------------------------------------------
// Token Generation
// ---------------------------------------------------------------------------

/**
 * Generate an access token for a user.
 * @param {Object} user - { id, name, email }
 * @returns {{ token: string, expiresIn: string }}
 */
function generateAccessToken(user) {
  const token = jwt.sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY, issuer: 'nexusapi' }
  );

  return {
    token,
    type: 'Bearer',
    expiresIn: ACCESS_TOKEN_EXPIRY
  };
}

/**
 * Generate a refresh token for a user.
 * @param {Object} user - { id }
 * @returns {{ token: string, expiresIn: string }}
 */
function generateRefreshToken(user) {
  const tokenId = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign(
    {
      sub: user.id,
      jti: tokenId,
      type: 'refresh'
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY, issuer: 'nexusapi' }
  );

  const decoded = jwt.decode(token);
  refreshTokens.set(tokenId, {
    userId: user.id,
    token,
    expiresAt: new Date(decoded.exp * 1000).toISOString(),
    revoked: false,
    createdAt: new Date().toISOString()
  });

  return {
    token,
    expiresIn: REFRESH_TOKEN_EXPIRY
  };
}

/**
 * Generate both access and refresh tokens.
 * @param {Object} user - { id, name, email }
 * @returns {Object} Token pair
 */
function generateTokenPair(user) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user)
  };
}

// ---------------------------------------------------------------------------
// Token Verification
// ---------------------------------------------------------------------------

/**
 * Verify an access token and return the decoded payload.
 * @param {string} token
 * @returns {Object} decoded payload
 * @throws {AuthError}
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'nexusapi' });
    if (decoded.type !== 'access') {
      throw new AuthError('Invalid token type');
    }
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthError('Access token has expired. Please refresh.');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new AuthError('Invalid access token');
    }
    throw err;
  }
}

/**
 * Verify a refresh token and return the decoded payload.
 * @param {string} token
 * @returns {Object} decoded payload
 * @throws {AuthError}
 */
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET, { issuer: 'nexusapi' });
    if (decoded.type !== 'refresh') {
      throw new AuthError('Invalid token type');
    }

    // Check if the token has been revoked
    const storedToken = refreshTokens.get(decoded.jti);
    if (!storedToken || storedToken.revoked) {
      throw new AuthError('Refresh token has been revoked');
    }

    return decoded;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    if (err.name === 'TokenExpiredError') {
      throw new AuthError('Refresh token has expired. Please log in again.');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new AuthError('Invalid refresh token');
    }
    throw err;
  }
}

/**
 * Revoke a refresh token.
 * @param {string} token - The raw JWT refresh token
 * @returns {boolean} success
 */
function revokeRefreshToken(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.jti && refreshTokens.has(decoded.jti)) {
      refreshTokens.get(decoded.jti).revoked = true;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user.
 * @param {string} userId
 */
function revokeAllUserTokens(userId) {
  for (const [, entry] of refreshTokens) {
    if (entry.userId === userId) {
      entry.revoked = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Authentication Middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that verifies the JWT access token from the
 * Authorization header and attaches `req.user`.
 *
 * Usage: app.get('/protected', authenticateToken, handler)
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return next(new AuthError('Authorization header is required'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(new AuthError('Authorization header must be: Bearer <token>'));
  }

  const token = parts[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      id: decoded.sub,
      name: decoded.name,
      email: decoded.email
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional auth — if a token is present it's verified, otherwise request continues.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    try {
      const decoded = verifyAccessToken(parts[1]);
      req.user = {
        id: decoded.sub,
        name: decoded.name,
        email: decoded.email
      };
    } catch {
      // Token invalid, continue without user
    }
  }
  next();
}

// ---------------------------------------------------------------------------
// Token Info (for dashboard display)
// ---------------------------------------------------------------------------

function getTokenInfo() {
  const active = [];
  for (const [jti, entry] of refreshTokens) {
    if (!entry.revoked) {
      active.push({
        jti,
        userId: entry.userId,
        expiresAt: entry.expiresAt,
        createdAt: entry.createdAt
      });
    }
  }
  return {
    activeRefreshTokens: active.length,
    accessTokenExpiry: ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiry: REFRESH_TOKEN_EXPIRY
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  authenticateToken,
  optionalAuth,
  getTokenInfo
};
