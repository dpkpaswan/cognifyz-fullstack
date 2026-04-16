/**
 * errorHandler.js - Global Error Handling Middleware
 *
 * Provides:
 *  - Custom error classes (AppError, ValidationError, AuthError, RateLimitError, ExternalAPIError)
 *  - Structured JSON error responses with status codes, timestamps, and request IDs
 *  - Catch-all handler for unhandled errors
 */

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Custom Error Classes
// ---------------------------------------------------------------------------

class AppError extends Error {
  constructor(message, statusCode = 500, type = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.type = type;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message, fields = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

class AuthError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN_ERROR');
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super('Too many requests. Please slow down.', 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

class ExternalAPIError extends AppError {
  constructor(service, message = 'External service unavailable') {
    super(message, 502, 'EXTERNAL_API_ERROR');
    this.name = 'ExternalAPIError';
    this.service = service;
  }
}

class CircuitOpenError extends AppError {
  constructor(service) {
    super(`Service "${service}" is temporarily unavailable. Circuit breaker is OPEN.`, 503, 'CIRCUIT_OPEN');
    this.name = 'CircuitOpenError';
    this.service = service;
  }
}

// ---------------------------------------------------------------------------
// Request ID Middleware
// ---------------------------------------------------------------------------

function requestIdMiddleware(req, res, next) {
  req.requestId = crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

// ---------------------------------------------------------------------------
// Global Error Handler Middleware
// ---------------------------------------------------------------------------

function globalErrorHandler(err, req, res, _next) {
  // Default values
  let statusCode = err.statusCode || 500;
  let type = err.type || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';

  // Log the error (in production you would send to a logging service)
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${req.requestId || 'no-id'}] ${type}: ${message}`);
  if (!err.isOperational) {
    console.error(err.stack);
  }

  // Build response
  const errorResponse = {
    success: false,
    error: {
      type,
      message,
      statusCode,
      timestamp,
      requestId: req.requestId || null
    }
  };

  // Add extra fields for specific error types
  if (err instanceof ValidationError && err.fields.length > 0) {
    errorResponse.error.fields = err.fields;
  }

  if (err instanceof RateLimitError) {
    res.setHeader('Retry-After', err.retryAfter);
    errorResponse.error.retryAfter = err.retryAfter;
  }

  if (err instanceof ExternalAPIError || err instanceof CircuitOpenError) {
    errorResponse.error.service = err.service;
  }

  res.status(statusCode).json(errorResponse);
}

// ---------------------------------------------------------------------------
// Async Route Wrapper (catches async errors automatically)
// ---------------------------------------------------------------------------

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ExternalAPIError,
  CircuitOpenError,
  requestIdMiddleware,
  globalErrorHandler,
  asyncHandler
};
