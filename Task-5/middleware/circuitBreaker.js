/**
 * circuitBreaker.js - Circuit Breaker Pattern for External APIs
 *
 * Implements the three-state circuit breaker:
 *  - CLOSED   : Normal operation, requests pass through
 *  - OPEN     : Service is failing, requests are immediately rejected
 *  - HALF_OPEN: Testing if service has recovered (allow one request through)
 *
 * Each external service gets its own circuit breaker instance.
 */

const { CircuitOpenError, ExternalAPIError } = require('./errorHandler');

// ---------------------------------------------------------------------------
// Circuit Breaker States
// ---------------------------------------------------------------------------

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

// ---------------------------------------------------------------------------
// Circuit Breaker Class
// ---------------------------------------------------------------------------

class CircuitBreaker {
  /**
   * @param {string} serviceName - Name of the external service
   * @param {Object} options
   * @param {number} options.failureThreshold - Failures before opening (default: 5)
   * @param {number} options.recoveryTimeMs   - Time in OPEN state before trying HALF_OPEN (default: 30000)
   * @param {number} options.requestTimeoutMs - Max time to wait for a request (default: 10000)
   */
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.lastError = null;

    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeMs = options.recoveryTimeMs || 30000;
    this.requestTimeoutMs = options.requestTimeoutMs || 10000;

    // Stats
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.totalRejected = 0;
    this.stateHistory = [];

    this._recordState('INIT');
  }

  /**
   * Execute a request through the circuit breaker.
   * @param {Function} requestFn - Async function that makes the external request
   * @returns {Promise<*>} The result of the request
   * @throws {CircuitOpenError} If the circuit is open
   */
  async execute(requestFn) {
    this.totalRequests++;

    // Check if circuit is OPEN
    if (this.state === STATES.OPEN) {
      // Check if recovery time has elapsed
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeMs) {
        this._transitionTo(STATES.HALF_OPEN);
      } else {
        this.totalRejected++;
        throw new CircuitOpenError(this.serviceName);
      }
    }

    try {
      // Add timeout wrapper
      const result = await this._withTimeout(requestFn(), this.requestTimeoutMs);
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  /**
   * Wrap a promise with a timeout.
   */
  _withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ExternalAPIError(this.serviceName, `Request to ${this.serviceName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Handle a successful request.
   */
  _onSuccess() {
    this.successCount++;
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();
    this.failureCount = 0;

    if (this.state === STATES.HALF_OPEN) {
      this._transitionTo(STATES.CLOSED);
    }
  }

  /**
   * Handle a failed request.
   */
  _onFailure(err) {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.lastError = err.message;

    if (this.state === STATES.HALF_OPEN) {
      // Failed during test, reopen
      this._transitionTo(STATES.OPEN);
    } else if (this.failureCount >= this.failureThreshold) {
      this._transitionTo(STATES.OPEN);
    }
  }

  /**
   * Transition to a new state.
   */
  _transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    this._recordState(`${oldState} -> ${newState}`);
    console.log(`[CircuitBreaker] ${this.serviceName}: ${oldState} -> ${newState}`);
  }

  /**
   * Record a state change for history.
   */
  _recordState(transition) {
    this.stateHistory.push({
      transition,
      state: this.state,
      timestamp: new Date().toISOString(),
      failureCount: this.failureCount
    });

    // Keep last 20 entries
    if (this.stateHistory.length > 20) {
      this.stateHistory.shift();
    }
  }

  /**
   * Manually reset the circuit breaker.
   */
  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this._recordState('MANUAL RESET');
  }

  /**
   * Get the current status for dashboard display.
   */
  getStatus() {
    return {
      service: this.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      lastSuccess: this.lastSuccessTime ? new Date(this.lastSuccessTime).toISOString() : null,
      lastError: this.lastError,
      config: {
        failureThreshold: this.failureThreshold,
        recoveryTimeMs: this.recoveryTimeMs,
        requestTimeoutMs: this.requestTimeoutMs
      },
      stats: {
        totalRequests: this.totalRequests,
        totalSuccesses: this.totalSuccesses,
        totalFailures: this.totalFailures,
        totalRejected: this.totalRejected,
        successRate: this.totalRequests > 0
          ? Math.round((this.totalSuccesses / this.totalRequests) * 100)
          : 100
      },
      history: this.stateHistory.slice(-10)
    };
  }
}

// ---------------------------------------------------------------------------
// Pre-configured Circuit Breakers (one per external service)
// ---------------------------------------------------------------------------

const breakers = {
  github: new CircuitBreaker('GitHub API', {
    failureThreshold: 5,
    recoveryTimeMs: 30000,
    requestTimeoutMs: 10000
  }),
  weather: new CircuitBreaker('Open-Meteo API', {
    failureThreshold: 5,
    recoveryTimeMs: 30000,
    requestTimeoutMs: 8000
  }),
  exchange: new CircuitBreaker('ExchangeRate API', {
    failureThreshold: 5,
    recoveryTimeMs: 30000,
    requestTimeoutMs: 8000
  })
};

/**
 * Get the status of all circuit breakers.
 */
function getAllBreakerStatus() {
  const result = {};
  for (const [name, breaker] of Object.entries(breakers)) {
    result[name] = breaker.getStatus();
  }
  return result;
}

module.exports = {
  CircuitBreaker,
  breakers,
  getAllBreakerStatus,
  STATES
};
