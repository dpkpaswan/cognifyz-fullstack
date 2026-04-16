/**
 * routes/external.js - External API Integration Routes
 *
 * Integrates three external APIs through the circuit breaker:
 *  1. GitHub REST API     - User profiles & repositories
 *  2. Open-Meteo API      - Weather forecasts (free, no key)
 *  3. ExchangeRate API    - Live currency exchange rates (free, no key)
 *
 * All routes are protected by JWT authentication and rate limiting.
 * Each request goes through a circuit breaker for fault tolerance.
 */

const express = require('express');
const https = require('https');
const http = require('http');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');
const { externalLimiter } = require('../middleware/rateLimiter');
const { breakers } = require('../middleware/circuitBreaker');
const { ExternalAPIError, asyncHandler } = require('../middleware/errorHandler');

// ---------------------------------------------------------------------------
// HTTP Fetch Helper (using built-in Node modules, no external deps)
// ---------------------------------------------------------------------------

/**
 * Make an HTTP(S) GET request and return parsed JSON.
 * Implements retry with exponential backoff.
 *
 * @param {string} url          - The URL to fetch
 * @param {Object} options
 * @param {number} options.maxRetries  - Max retry attempts (default: 2)
 * @param {number} options.baseDelay   - Base delay in ms for backoff (default: 1000)
 * @param {Object} options.headers     - Additional headers
 * @returns {Promise<Object>} Parsed JSON response
 */
function fetchJSON(url, options = {}) {
  const { maxRetries = 2, baseDelay = 1000, headers = {} } = options;

  return new Promise((resolve, reject) => {
    function attempt(retryCount) {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NexusAPI-Dashboard/1.0',
          ...headers
        }
      };

      const req = client.request(reqOptions, (res) => {
        let data = '';

        res.on('data', chunk => { data += chunk; });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);

            if (res.statusCode >= 400) {
              const errorMsg = parsed.message || parsed.error || `HTTP ${res.statusCode}`;

              // Don't retry client errors (4xx) except 429
              if (res.statusCode < 500 && res.statusCode !== 429) {
                return reject(new ExternalAPIError('external', `${errorMsg} (${res.statusCode})`));
              }

              // Retry server errors and 429s
              if (retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                console.log(`[Retry] ${url} - Attempt ${retryCount + 1}/${maxRetries} in ${delay}ms`);
                return setTimeout(() => attempt(retryCount + 1), delay);
              }

              return reject(new ExternalAPIError('external', `${errorMsg} after ${maxRetries} retries`));
            }

            // Attach rate limit info from GitHub headers
            if (res.headers['x-ratelimit-remaining']) {
              parsed._rateLimit = {
                limit: res.headers['x-ratelimit-limit'],
                remaining: res.headers['x-ratelimit-remaining'],
                reset: res.headers['x-ratelimit-reset']
              };
            }

            resolve(parsed);
          } catch (e) {
            if (retryCount < maxRetries) {
              const delay = baseDelay * Math.pow(2, retryCount);
              return setTimeout(() => attempt(retryCount + 1), delay);
            }
            reject(new ExternalAPIError('external', `Failed to parse response from ${parsedUrl.hostname}`));
          }
        });
      });

      req.on('error', (err) => {
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount);
          console.log(`[Retry] ${url} - Network error, attempt ${retryCount + 1}/${maxRetries} in ${delay}ms`);
          return setTimeout(() => attempt(retryCount + 1), delay);
        }
        reject(new ExternalAPIError('external', `Network error: ${err.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount);
          return setTimeout(() => attempt(retryCount + 1), delay);
        }
        reject(new ExternalAPIError('external', 'Request timed out'));
      });

      req.end();
    }

    attempt(0);
  });
}

// ---------------------------------------------------------------------------
// Simple In-Memory Cache
// ---------------------------------------------------------------------------

const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  // Limit cache size
  if (cache.size > 100) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

// ---------------------------------------------------------------------------
// API Call Log (for dashboard display)
// ---------------------------------------------------------------------------

const apiCallLog = [];

function logAPICall(service, endpoint, status, latency, cached = false) {
  apiCallLog.push({
    service,
    endpoint,
    status,
    latency,
    cached,
    timestamp: new Date().toISOString()
  });
  // Keep last 50 entries
  if (apiCallLog.length > 50) {
    apiCallLog.shift();
  }
}

// Apply auth and rate limiting to all external routes
router.use(authenticateToken);
router.use(externalLimiter);

// ==================== GITHUB API ====================

/**
 * GET /api/external/github/user/:username
 * Fetch a GitHub user's profile.
 */
router.get('/github/user/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;
  const cacheKey = `github:user:${username}`;
  const startTime = Date.now();

  // Check cache first
  const cached = getCached(cacheKey);
  if (cached) {
    logAPICall('GitHub', `/users/${username}`, 200, Date.now() - startTime, true);
    return res.json({
      success: true,
      source: 'cache',
      data: cached
    });
  }

  // Execute through circuit breaker
  const data = await breakers.github.execute(async () => {
    return fetchJSON(`https://api.github.com/users/${username}`);
  });

  const rateLimit = data._rateLimit;
  delete data._rateLimit;

  // Shape the response
  const profile = {
    login: data.login,
    id: data.id,
    avatar_url: data.avatar_url,
    html_url: data.html_url,
    name: data.name,
    company: data.company,
    blog: data.blog,
    location: data.location,
    bio: data.bio,
    public_repos: data.public_repos,
    public_gists: data.public_gists,
    followers: data.followers,
    following: data.following,
    created_at: data.created_at,
    updated_at: data.updated_at
  };

  setCache(cacheKey, profile);
  const latency = Date.now() - startTime;
  logAPICall('GitHub', `/users/${username}`, 200, latency);

  res.json({
    success: true,
    source: 'api',
    latency: `${latency}ms`,
    gitHubRateLimit: rateLimit,
    circuitBreaker: breakers.github.state,
    data: profile
  });
}));

/**
 * GET /api/external/github/repos/:username
 * Fetch a GitHub user's public repositories.
 */
router.get('/github/repos/:username', asyncHandler(async (req, res) => {
  const { username } = req.params;
  const sort = req.query.sort || 'updated';
  const cacheKey = `github:repos:${username}:${sort}`;
  const startTime = Date.now();

  const cached = getCached(cacheKey);
  if (cached) {
    logAPICall('GitHub', `/users/${username}/repos`, 200, Date.now() - startTime, true);
    return res.json({
      success: true,
      source: 'cache',
      data: cached
    });
  }

  const data = await breakers.github.execute(async () => {
    return fetchJSON(`https://api.github.com/users/${username}/repos?sort=${sort}&per_page=10`);
  });

  const repos = (Array.isArray(data) ? data : []).map(repo => ({
    name: repo.name,
    full_name: repo.full_name,
    html_url: repo.html_url,
    description: repo.description,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
    watchers_count: repo.watchers_count,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
    topics: repo.topics || []
  }));

  setCache(cacheKey, repos);
  const latency = Date.now() - startTime;
  logAPICall('GitHub', `/users/${username}/repos`, 200, latency);

  res.json({
    success: true,
    source: 'api',
    latency: `${latency}ms`,
    circuitBreaker: breakers.github.state,
    count: repos.length,
    data: repos
  });
}));

// ==================== WEATHER API (Open-Meteo) ====================

/**
 * GET /api/external/weather
 * Fetch weather data by latitude/longitude or city name.
 * Query params: lat, lon, city
 */
router.get('/weather', asyncHandler(async (req, res) => {
  let { lat, lon, city } = req.query;
  const startTime = Date.now();

  // If city is provided, geocode it first
  if (city && (!lat || !lon)) {
    const geoKey = `geo:${city.toLowerCase()}`;
    let geoData = getCached(geoKey);

    if (!geoData) {
      const geoResult = await breakers.weather.execute(async () => {
        return fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      });

      if (!geoResult.results || geoResult.results.length === 0) {
        const latency = Date.now() - startTime;
        logAPICall('Open-Meteo', `/geocoding/${city}`, 404, latency);
        return res.status(404).json({
          success: false,
          error: { type: 'NOT_FOUND', message: `City "${city}" not found` }
        });
      }

      geoData = geoResult.results[0];
      setCache(geoKey, geoData);
    }

    lat = geoData.latitude;
    lon = geoData.longitude;
    city = geoData.name;
  }

  if (!lat || !lon) {
    return res.status(400).json({
      success: false,
      error: { type: 'VALIDATION_ERROR', message: 'Provide lat & lon or city name' }
    });
  }

  const cacheKey = `weather:${lat}:${lon}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logAPICall('Open-Meteo', `/weather/${lat},${lon}`, 200, Date.now() - startTime, true);
    return res.json({ success: true, source: 'cache', data: cached });
  }

  const weatherData = await breakers.weather.execute(async () => {
    return fetchJSON(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=5`
    );
  });

  const result = {
    location: {
      city: city || null,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      timezone: weatherData.timezone,
      elevation: weatherData.elevation
    },
    current: weatherData.current,
    daily: weatherData.daily,
    units: {
      ...weatherData.current_units,
      ...weatherData.daily_units
    }
  };

  setCache(cacheKey, result);
  const latency = Date.now() - startTime;
  logAPICall('Open-Meteo', `/weather/${lat},${lon}`, 200, latency);

  res.json({
    success: true,
    source: 'api',
    latency: `${latency}ms`,
    circuitBreaker: breakers.weather.state,
    data: result
  });
}));

// ==================== EXCHANGE RATE API ====================

/**
 * GET /api/external/exchange
 * Fetch exchange rates for a base currency.
 * Query params: base (default: USD), target (optional, for single rate)
 */
router.get('/exchange', asyncHandler(async (req, res) => {
  const { base = 'USD', target, amount } = req.query;
  const startTime = Date.now();
  const cacheKey = `exchange:${base.toUpperCase()}`;

  const cached = getCached(cacheKey);
  if (cached) {
    logAPICall('ExchangeRate', `/exchange/${base}`, 200, Date.now() - startTime, true);
    const responseData = { ...cached };

    if (target && responseData.rates[target.toUpperCase()]) {
      const rate = responseData.rates[target.toUpperCase()];
      responseData.conversion = {
        from: base.toUpperCase(),
        to: target.toUpperCase(),
        rate,
        amount: parseFloat(amount) || 1,
        result: ((parseFloat(amount) || 1) * rate).toFixed(4)
      };
    }

    return res.json({ success: true, source: 'cache', data: responseData });
  }

  const data = await breakers.exchange.execute(async () => {
    return fetchJSON(`https://open.er-api.com/v6/latest/${base.toUpperCase()}`);
  });

  if (data.result === 'error') {
    throw new ExternalAPIError('ExchangeRate', data['error-type'] || 'Unknown error');
  }

  const result = {
    base: data.base_code,
    lastUpdate: data.time_last_update_utc,
    nextUpdate: data.time_next_update_utc,
    rates: data.rates
  };

  setCache(cacheKey, result);
  const latency = Date.now() - startTime;
  logAPICall('ExchangeRate', `/exchange/${base}`, 200, latency);

  // If target currency specified, include conversion
  if (target && result.rates[target.toUpperCase()]) {
    const rate = result.rates[target.toUpperCase()];
    result.conversion = {
      from: base.toUpperCase(),
      to: target.toUpperCase(),
      rate,
      amount: parseFloat(amount) || 1,
      result: ((parseFloat(amount) || 1) * rate).toFixed(4)
    };
  }

  res.json({
    success: true,
    source: 'api',
    latency: `${latency}ms`,
    circuitBreaker: breakers.exchange.state,
    data: result
  });
}));

// ==================== API CALL LOG ====================

/**
 * GET /api/external/log
 * Return recent API call history for the dashboard.
 */
router.get('/log', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    count: apiCallLog.length,
    calls: apiCallLog.slice().reverse()
  });
}));

module.exports = router;
