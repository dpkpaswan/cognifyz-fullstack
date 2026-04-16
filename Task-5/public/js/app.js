/**
 * app.js - NexusAPI Client-Side SPA Application
 *
 * Features:
 *  - Hash-based router (#/login, #/dashboard, #/github, #/weather, #/exchange, #/api-docs)
 *  - OAuth JWT token management (storage, auto-refresh, Bearer auth)
 *  - Dynamic page rendering via DOM manipulation
 *  - Real-time rate limit gauges & circuit breaker status
 *  - External API integration UIs (GitHub, Weather, Exchange)
 *  - Toast notifications and modal dialogs
 */

(function () {
  'use strict';

  // ===========================================================================
  // Token Manager - OAuth JWT Handling
  // ===========================================================================

  const TokenManager = {
    getAccessToken() { return localStorage.getItem('nexus_access_token'); },
    getRefreshToken() { return localStorage.getItem('nexus_refresh_token'); },
    getUser() {
      try { return JSON.parse(localStorage.getItem('nexus_user')); }
      catch { return null; }
    },

    setTokens(tokens, user) {
      if (tokens.access_token) localStorage.setItem('nexus_access_token', tokens.access_token);
      if (tokens.refresh_token) localStorage.setItem('nexus_refresh_token', tokens.refresh_token);
      if (user) localStorage.setItem('nexus_user', JSON.stringify(user));
    },

    clear() {
      localStorage.removeItem('nexus_access_token');
      localStorage.removeItem('nexus_refresh_token');
      localStorage.removeItem('nexus_user');
    },

    isLoggedIn() {
      return !!this.getAccessToken();
    },

    async refreshAccessToken() {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      try {
        const res = await fetch('/api/oauth/token/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (!res.ok) {
          this.clear();
          return false;
        }

        const data = await res.json();
        if (data.success && data.tokens) {
          localStorage.setItem('nexus_access_token', data.tokens.access_token);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
  };

  // ===========================================================================
  // API Client - Handles all requests with auth & error handling
  // ===========================================================================

  const API = {
    async request(url, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      // Attach Bearer token if logged in
      const token = TokenManager.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      try {
        let res = await fetch(url, { ...options, headers });

        // If 401 and we have a refresh token, try refreshing
        if (res.status === 401 && TokenManager.getRefreshToken()) {
          const refreshed = await TokenManager.refreshAccessToken();
          if (refreshed) {
            headers['Authorization'] = `Bearer ${TokenManager.getAccessToken()}`;
            res = await fetch(url, { ...options, headers });
          } else {
            TokenManager.clear();
            Router.navigate('/login');
            Toast.show('Session expired. Please log in again.', 'warning');
            throw new Error('Session expired');
          }
        }

        const data = await res.json();

        // Extract rate limit headers
        data._rateLimit = {
          limit: res.headers.get('X-RateLimit-Limit'),
          remaining: res.headers.get('X-RateLimit-Remaining'),
          reset: res.headers.get('X-RateLimit-Reset')
        };

        data._requestId = res.headers.get('X-Request-Id');
        data._status = res.status;

        if (!res.ok) {
          const errMsg = data.error?.message || data.errors?.[0]?.message || data.errors?.[0] || 'Request failed';
          const err = new Error(errMsg);
          err.data = data;
          err.status = res.status;
          throw err;
        }

        return data;
      } catch (err) {
        if (err.data) throw err; // already structured
        throw new Error(err.message || 'Network error');
      }
    },

    get(url) { return this.request(url); },

    post(url, body) {
      return this.request(url, {
        method: 'POST',
        body: JSON.stringify(body)
      });
    }
  };

  // ===========================================================================
  // Toast Notifications
  // ===========================================================================

  const Toast = {
    container: null,

    init() {
      this.container = document.getElementById('toastContainer');
    },

    show(message, type = 'info', title = '') {
      if (!this.container) this.init();

      const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-exclamation-triangle-fill',
        warning: 'bi-exclamation-circle-fill',
        info: 'bi-info-circle-fill'
      };

      const titles = {
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Info'
      };

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `
        <i class="toast-icon bi ${icons[type]}"></i>
        <div class="toast-body">
          <div class="toast-title">${title || titles[type]}</div>
          <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.classList.add('toast-exit'); setTimeout(() => this.parentElement.remove(), 300)">
          <i class="bi bi-x"></i>
        </button>
      `;

      this.container.appendChild(toast);

      // Auto remove after 5s
      setTimeout(() => {
        if (toast.parentElement) {
          toast.classList.add('toast-exit');
          setTimeout(() => toast.remove(), 300);
        }
      }, 5000);
    }
  };

  // ===========================================================================
  // Helper Functions
  // ===========================================================================

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function getWeatherEmoji(code) {
    if (code === undefined || code === null) return '🌍';
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 49) return '🌫️';
    if (code <= 59) return '🌧️';
    if (code <= 69) return '🌨️';
    if (code <= 79) return '❄️';
    if (code <= 82) return '🌧️';
    if (code <= 86) return '🌨️';
    if (code <= 99) return '⛈️';
    return '🌍';
  }

  function getWeatherDescription(code) {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code <= 49) return 'Foggy';
    if (code <= 59) return 'Drizzle';
    if (code <= 69) return 'Rain';
    if (code <= 79) return 'Snow';
    if (code <= 82) return 'Rain showers';
    if (code <= 86) return 'Snow showers';
    if (code <= 99) return 'Thunderstorm';
    return 'Unknown';
  }

  function getLangColor(lang) {
    const colors = {
      JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
      Java: '#b07219', Go: '#00ADD8', Rust: '#dea584',
      'C++': '#f34b7d', C: '#555555', 'C#': '#178600',
      Ruby: '#701516', PHP: '#4F5D95', Swift: '#ffac45',
      Kotlin: '#A97BFF', Dart: '#00B4AB', HTML: '#e34c26',
      CSS: '#563d7c', Shell: '#89e051', Vue: '#41b883',
      Svelte: '#ff3e00'
    };
    return colors[lang] || '#8b8b8b';
  }

  function getPasswordStrength(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { level: 'weak', text: 'Weak', color: 'var(--neon-red)' };
    if (score <= 2) return { level: 'fair', text: 'Fair', color: 'var(--neon-orange)' };
    if (score <= 3) return { level: 'good', text: 'Good', color: 'var(--neon-yellow)' };
    return { level: 'strong', text: 'Strong', color: 'var(--neon-green)' };
  }

  // ===========================================================================
  // Router
  // ===========================================================================

  const Router = {
    routes: {},

    register(path, handler) {
      this.routes[path] = handler;
    },

    navigate(path) {
      window.location.hash = path;
    },

    getCurrentRoute() {
      const hash = window.location.hash || '#/';
      return hash.replace('#', '') || '/';
    },

    async handleRoute() {
      const path = this.getCurrentRoute();
      const app = document.getElementById('app');

      // Hide loader
      const loader = document.getElementById('pageLoader');
      if (loader) loader.style.display = 'none';

      // Auth guard: redirect to login if not logged in (except public routes)
      const publicRoutes = ['/login', '/register', '/'];
      if (!publicRoutes.includes(path) && !TokenManager.isLoggedIn()) {
        this.navigate('/login');
        return;
      }

      // If logged in and visiting login/register, redirect to dashboard
      if ((path === '/login' || path === '/register' || path === '/') && TokenManager.isLoggedIn()) {
        this.navigate('/dashboard');
        return;
      }

      // Update active nav link
      document.querySelectorAll('.nav-link').forEach(link => {
        const route = link.getAttribute('data-route');
        link.classList.toggle('active', path === `/${route}`);
      });

      // Update nav actions
      this.updateNavActions();

      // Find and execute route handler
      const handler = this.routes[path];
      if (handler) {
        app.innerHTML = '<div class="page-enter"><div class="page-container" id="pageContent"></div></div>';
        const container = document.getElementById('pageContent');
        try {
          await handler(container);
        } catch (err) {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
              <div class="empty-title">Something went wrong</div>
              <div class="empty-text">${escapeHtml(err.message)}</div>
              <button class="btn btn-primary mt-lg" onclick="location.reload()">
                <i class="bi bi-arrow-clockwise"></i> Reload
              </button>
            </div>
          `;
        }
      } else {
        this.navigate(TokenManager.isLoggedIn() ? '/dashboard' : '/login');
      }
    },

    updateNavActions() {
      const navActions = document.getElementById('navActions');
      const navLinks = document.getElementById('navLinks');

      if (TokenManager.isLoggedIn()) {
        const user = TokenManager.getUser();
        const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';

        navActions.innerHTML = `
          <div class="user-chip" id="userChip">
            <div class="user-avatar-sm">${initials}</div>
            <span class="user-name-sm">${escapeHtml(user?.name || 'User')}</span>
          </div>
          <button class="btn btn-ghost btn-sm" id="logoutBtn" title="Logout">
            <i class="bi bi-box-arrow-right"></i>
          </button>
        `;

        navLinks.style.display = '';

        document.getElementById('logoutBtn').addEventListener('click', async () => {
          const rt = TokenManager.getRefreshToken();
          if (rt) {
            try { await API.post('/api/oauth/token/revoke', { refresh_token: rt }); } catch {}
          }
          TokenManager.clear();
          Router.navigate('/login');
          Toast.show('Logged out successfully', 'success');
        });
      } else {
        navActions.innerHTML = `
          <a href="#/login" class="btn btn-primary btn-sm">
            <i class="bi bi-box-arrow-in-right"></i> Sign In
          </a>
        `;
        navLinks.style.display = 'none';
      }
    },

    init() {
      window.addEventListener('hashchange', () => this.handleRoute());
      this.handleRoute();
    }
  };

  // ===========================================================================
  // Page: Login
  // ===========================================================================

  Router.register('/login', (container) => {
    container.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-header">
            <div class="auth-icon"><i class="bi bi-shield-lock-fill"></i></div>
            <h1 class="auth-title">OAuth Authorization</h1>
            <p class="auth-subtitle">Sign in to obtain your access tokens</p>
          </div>

          <form id="loginForm" novalidate>
            <div class="form-group">
              <label class="form-label" for="loginEmail">Email Address</label>
              <input type="email" class="form-input" id="loginEmail" placeholder="you@example.com" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="loginPassword">Password</label>
              <input type="password" class="form-input" id="loginPassword" placeholder="••••••••" required />
            </div>

            <button type="submit" class="btn btn-primary w-full" id="loginBtn">
              <i class="bi bi-key-fill"></i> Authorize
            </button>
          </form>

          <div id="loginTokenDisplay" style="display:none">
            <div class="token-display">
              <div class="token-display-header">
                <span class="token-label"><i class="bi bi-key"></i> Access Token</span>
                <button class="token-copy-btn" id="copyAccessToken"><i class="bi bi-clipboard"></i> Copy</button>
              </div>
              <div class="token-value" id="accessTokenValue"></div>
            </div>
            <div class="token-display mt-sm">
              <div class="token-display-header">
                <span class="token-label"><i class="bi bi-arrow-repeat"></i> Refresh Token</span>
                <button class="token-copy-btn" id="copyRefreshToken"><i class="bi bi-clipboard"></i> Copy</button>
              </div>
              <div class="token-value" id="refreshTokenValue"></div>
            </div>
          </div>

          <div class="auth-footer">
            Don't have an account? <a href="#/register">Create one</a>
          </div>
        </div>
      </div>
    `;

    const form = document.getElementById('loginForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('loginBtn');
      btn.classList.add('loading');
      btn.disabled = true;

      try {
        const data = await API.post('/api/oauth/authorize', {
          email: document.getElementById('loginEmail').value,
          password: document.getElementById('loginPassword').value
        });

        TokenManager.setTokens(data.tokens, data.user);

        // Show tokens briefly
        document.getElementById('loginTokenDisplay').style.display = 'block';
        document.getElementById('accessTokenValue').textContent = data.tokens.access_token;
        document.getElementById('refreshTokenValue').textContent = data.tokens.refresh_token;

        // Copy handlers
        document.getElementById('copyAccessToken').addEventListener('click', () => {
          navigator.clipboard.writeText(data.tokens.access_token);
          Toast.show('Access token copied!', 'success');
        });
        document.getElementById('copyRefreshToken').addEventListener('click', () => {
          navigator.clipboard.writeText(data.tokens.refresh_token);
          Toast.show('Refresh token copied!', 'success');
        });

        Toast.show(`Welcome back, ${escapeHtml(data.user.name)}!`, 'success', 'Authorization Successful');

        setTimeout(() => Router.navigate('/dashboard'), 1500);
      } catch (err) {
        Toast.show(err.message, 'error');
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    });
  });

  // ===========================================================================
  // Page: Register
  // ===========================================================================

  Router.register('/register', (container) => {
    container.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-header">
            <div class="auth-icon"><i class="bi bi-person-plus-fill"></i></div>
            <h1 class="auth-title">Create Account</h1>
            <p class="auth-subtitle">Register to get your OAuth credentials</p>
          </div>

          <form id="registerForm" novalidate>
            <div class="form-group">
              <label class="form-label" for="regName">Full Name</label>
              <input type="text" class="form-input" id="regName" placeholder="John Doe" required />
              <div class="form-error" id="regNameError"></div>
            </div>

            <div class="form-group">
              <label class="form-label" for="regEmail">Email Address</label>
              <input type="email" class="form-input" id="regEmail" placeholder="you@example.com" required />
              <div class="form-error" id="regEmailError"></div>
            </div>

            <div class="form-group">
              <label class="form-label" for="regPassword">Password</label>
              <input type="password" class="form-input" id="regPassword" placeholder="Min 8 characters" required />
              <div class="password-strength" id="passwordStrength" style="display:none">
                <div class="strength-bar"><div class="strength-fill" id="strengthFill"></div></div>
                <span class="strength-text" id="strengthText"></span>
              </div>
              <div class="form-error" id="regPasswordError"></div>
            </div>

            <div class="form-group">
              <label class="form-label" for="regConfirm">Confirm Password</label>
              <input type="password" class="form-input" id="regConfirm" placeholder="Re-enter password" required />
              <div class="form-error" id="regConfirmError"></div>
            </div>

            <button type="submit" class="btn btn-primary w-full" id="registerBtn">
              <i class="bi bi-person-check-fill"></i> Register & Get Tokens
            </button>
          </form>

          <div class="auth-footer">
            Already have an account? <a href="#/login">Sign in</a>
          </div>
        </div>
      </div>
    `;

    // Password strength meter
    const pwInput = document.getElementById('regPassword');
    const strengthDiv = document.getElementById('passwordStrength');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');

    pwInput.addEventListener('input', () => {
      const pw = pwInput.value;
      if (!pw) {
        strengthDiv.style.display = 'none';
        return;
      }
      strengthDiv.style.display = 'block';
      const s = getPasswordStrength(pw);
      strengthFill.className = `strength-fill ${s.level}`;
      strengthText.textContent = s.text;
      strengthText.style.color = s.color;
    });

    // Real-time validation
    function validateField(id, errorId, validateFn) {
      const input = document.getElementById(id);
      input.addEventListener('blur', () => {
        const errDiv = document.getElementById(errorId);
        const err = validateFn(input.value);
        if (err) {
          input.classList.add('error');
          errDiv.innerHTML = `<i class="bi bi-exclamation-circle"></i> ${err}`;
        } else {
          input.classList.remove('error');
          errDiv.innerHTML = '';
        }
      });
    }

    validateField('regName', 'regNameError', v => {
      if (!v || v.trim().length < 2) return 'Name must be at least 2 characters';
      return '';
    });

    validateField('regEmail', 'regEmailError', v => {
      if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Invalid email address';
      return '';
    });

    validateField('regPassword', 'regPasswordError', v => {
      if (!v || v.length < 8) return 'Minimum 8 characters';
      if (!/[A-Z]/.test(v)) return 'Needs an uppercase letter';
      if (!/[0-9]/.test(v)) return 'Needs a number';
      if (!/[^A-Za-z0-9]/.test(v)) return 'Needs a special character';
      return '';
    });

    validateField('regConfirm', 'regConfirmError', v => {
      if (v !== document.getElementById('regPassword').value) return 'Passwords do not match';
      return '';
    });

    const form = document.getElementById('registerForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('registerBtn');
      btn.classList.add('loading');
      btn.disabled = true;

      try {
        const data = await API.post('/api/oauth/register', {
          name: document.getElementById('regName').value,
          email: document.getElementById('regEmail').value,
          password: document.getElementById('regPassword').value,
          confirmPassword: document.getElementById('regConfirm').value
        });

        TokenManager.setTokens(data.tokens, data.user);
        Toast.show('Account created! OAuth tokens generated.', 'success', 'Registration Complete');
        setTimeout(() => Router.navigate('/dashboard'), 1000);
      } catch (err) {
        // Show field-level errors if available
        if (err.data?.error?.fields) {
          err.data.error.fields.forEach(f => {
            const errDiv = document.getElementById(`reg${f.field.charAt(0).toUpperCase() + f.field.slice(1)}Error`);
            if (errDiv) {
              errDiv.innerHTML = `<i class="bi bi-exclamation-circle"></i> ${escapeHtml(f.message)}`;
              const input = errDiv.previousElementSibling?.classList?.contains('password-strength')
                ? errDiv.previousElementSibling.previousElementSibling
                : errDiv.previousElementSibling;
              if (input) input.classList.add('error');
            }
          });
        }
        Toast.show(err.message, 'error');
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    });
  });

  // ===========================================================================
  // Page: Dashboard
  // ===========================================================================

  Router.register('/dashboard', async (container) => {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title"><i class="bi bi-grid-1x2-fill"></i> API Dashboard</h1>
        <p class="page-subtitle">Monitor your API usage, rate limits, and circuit breaker status in real-time</p>
      </div>

      <div class="grid-4 stagger mb-lg" id="statsGrid">
        <div class="stat-card">
          <div class="stat-icon purple"><i class="bi bi-braces-asterisk"></i></div>
          <div class="stat-info">
            <div class="stat-label">System Status</div>
            <div class="stat-value" id="sysStatus">—</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="bi bi-clock-history"></i></div>
          <div class="stat-info">
            <div class="stat-label">Uptime</div>
            <div class="stat-value" id="sysUptime">—</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon cyan"><i class="bi bi-key-fill"></i></div>
          <div class="stat-info">
            <div class="stat-label">Active Tokens</div>
            <div class="stat-value" id="sysTokens">—</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange"><i class="bi bi-memory"></i></div>
          <div class="stat-info">
            <div class="stat-label">Memory</div>
            <div class="stat-value" id="sysMemory">—</div>
          </div>
        </div>
      </div>

      <div class="grid-2 mb-lg">
        <!-- Rate Limit Gauges -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="bi bi-speedometer2"></i> Rate Limit Usage</div>
            <span class="card-badge badge-blue">LIVE</span>
          </div>
          <div class="grid-3" id="rateLimitGauges">
            <div class="gauge-container" id="gaugeApi">
              <div class="gauge-visual">
                <svg class="gauge-svg" viewBox="0 0 120 120">
                  <circle class="gauge-bg" cx="60" cy="60" r="50"/>
                  <circle class="gauge-fill" id="gaugeFillApi" cx="60" cy="60" r="50"
                    stroke-dasharray="314" stroke-dashoffset="314" stroke="var(--neon-green)"/>
                </svg>
                <div class="gauge-center">
                  <div class="gauge-value" id="gaugeValApi">0</div>
                  <div class="gauge-unit">/ 60</div>
                </div>
              </div>
              <div class="gauge-label">API</div>
              <div class="gauge-sub">60 req/min</div>
            </div>
            <div class="gauge-container" id="gaugeAuth">
              <div class="gauge-visual">
                <svg class="gauge-svg" viewBox="0 0 120 120">
                  <circle class="gauge-bg" cx="60" cy="60" r="50"/>
                  <circle class="gauge-fill" id="gaugeFillAuth" cx="60" cy="60" r="50"
                    stroke-dasharray="314" stroke-dashoffset="314" stroke="var(--neon-green)"/>
                </svg>
                <div class="gauge-center">
                  <div class="gauge-value" id="gaugeValAuth">0</div>
                  <div class="gauge-unit">/ 10</div>
                </div>
              </div>
              <div class="gauge-label">Auth</div>
              <div class="gauge-sub">10 req/min</div>
            </div>
            <div class="gauge-container" id="gaugeExternal">
              <div class="gauge-visual">
                <svg class="gauge-svg" viewBox="0 0 120 120">
                  <circle class="gauge-bg" cx="60" cy="60" r="50"/>
                  <circle class="gauge-fill" id="gaugeFillExternal" cx="60" cy="60" r="50"
                    stroke-dasharray="314" stroke-dashoffset="314" stroke="var(--neon-green)"/>
                </svg>
                <div class="gauge-center">
                  <div class="gauge-value" id="gaugeValExternal">0</div>
                  <div class="gauge-unit">/ 20</div>
                </div>
              </div>
              <div class="gauge-label">External</div>
              <div class="gauge-sub">20 req/min</div>
            </div>
          </div>
        </div>

        <!-- Circuit Breakers -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="bi bi-shield-check"></i> Circuit Breakers</div>
            <span class="card-badge badge-green">MONITORING</span>
          </div>
          <div id="circuitBreakers" style="display:flex; flex-direction:column; gap:var(--space-sm);">
            <div class="circuit-status">
              <div class="circuit-dot closed"></div>
              <span class="circuit-name">Loading...</span>
            </div>
          </div>
          <div style="margin-top:var(--space-lg); padding-top:var(--space-md); border-top:1px solid var(--border-color);">
            <div class="card-title" style="font-size:0.85rem; margin-bottom:var(--space-sm);">
              <i class="bi bi-info-circle"></i> How it works
            </div>
            <div style="font-size:0.78rem; color:var(--text-tertiary); line-height:1.6;">
              <p><strong style="color:var(--neon-green)">CLOSED</strong> — Normal operation, requests pass through</p>
              <p><strong style="color:var(--neon-red)">OPEN</strong> — Service failing, requests rejected instantly</p>
              <p><strong style="color:var(--neon-yellow)">HALF-OPEN</strong> — Testing recovery, allowing one request</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent API Calls -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="bi bi-terminal-fill"></i> Recent API Calls</div>
          <button class="btn btn-sm btn-secondary" id="refreshLogBtn">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
        <div id="apiCallLog">
          <div class="empty-state">
            <div class="empty-icon"><i class="bi bi-terminal"></i></div>
            <div class="empty-title">No API calls yet</div>
            <div class="empty-text">Start making requests to see them logged here</div>
          </div>
        </div>
      </div>
    `;

    // Load dashboard data
    async function loadDashboard() {
      try {
        const [health, rateLimit] = await Promise.all([
          API.get('/api/health'),
          API.get('/api/rate-limit/status')
        ]);

        // System stats
        const statusColors = { healthy: 'var(--neon-green)', degraded: 'var(--neon-red)', recovering: 'var(--neon-yellow)' };
        document.getElementById('sysStatus').textContent = health.status.toUpperCase();
        document.getElementById('sysStatus').style.color = statusColors[health.status] || '';
        document.getElementById('sysUptime').textContent = health.uptime + 's';
        document.getElementById('sysTokens').textContent = health.tokenInfo?.activeRefreshTokens || 0;
        document.getElementById('sysMemory').textContent = health.memory?.used || '—';

        // Rate limit gauges
        updateGauge('Api', rateLimit.rateLimits.limiters.api);
        updateGauge('Auth', rateLimit.rateLimits.limiters.auth);
        updateGauge('External', rateLimit.rateLimits.limiters.external);

        // Circuit breakers
        const cbContainer = document.getElementById('circuitBreakers');
        const breakers = health.circuitBreakers;
        cbContainer.innerHTML = Object.entries(breakers).map(([key, b]) => {
          const stateClass = b.state === 'CLOSED' ? 'closed' : b.state === 'OPEN' ? 'open' : 'half-open';
          return `
            <div class="circuit-status">
              <div class="circuit-dot ${stateClass}"></div>
              <span class="circuit-name">${escapeHtml(b.service)}</span>
              <span class="circuit-state ${stateClass}">${b.state}</span>
              <span style="font-size:0.7rem; color:var(--text-muted); font-family:var(--font-mono);">
                ${b.stats.successRate}% ok
              </span>
            </div>
          `;
        }).join('');

      } catch (err) {
        console.error('Dashboard load error:', err);
      }
    }

    function updateGauge(name, limiter) {
      const circumference = 314; // 2 * PI * 50
      const used = limiter.used;
      const limit = limiter.limit;
      const ratio = used / limit;
      const offset = circumference - (ratio * circumference);

      const fill = document.getElementById(`gaugeFill${name}`);
      const val = document.getElementById(`gaugeVal${name}`);

      fill.style.strokeDashoffset = offset;
      val.textContent = used;

      // Color based on usage
      if (ratio > 0.8) {
        fill.style.stroke = 'var(--neon-red)';
      } else if (ratio > 0.5) {
        fill.style.stroke = 'var(--neon-yellow)';
      } else {
        fill.style.stroke = 'var(--neon-green)';
      }
    }

    async function loadApiLog() {
      try {
        const data = await API.get('/api/external/log');
        const logContainer = document.getElementById('apiCallLog');

        if (!data.calls || data.calls.length === 0) {
          return;
        }

        logContainer.innerHTML = data.calls.slice(0, 15).map(call => `
          <div class="log-entry">
            <span class="log-time">${formatTime(call.timestamp)}</span>
            <span class="log-service">${escapeHtml(call.service)}</span>
            <span class="log-endpoint">${escapeHtml(call.endpoint)}</span>
            <span class="log-status ${call.status < 400 ? 'ok' : 'error'}">${call.status}</span>
            <span class="log-latency">${call.latency}ms</span>
            ${call.cached ? '<span class="log-cached">CACHED</span>' : ''}
          </div>
        `).join('');
      } catch {}
    }

    loadDashboard();
    loadApiLog();

    // Refresh button
    document.getElementById('refreshLogBtn').addEventListener('click', () => {
      loadDashboard();
      loadApiLog();
      Toast.show('Dashboard refreshed', 'info');
    });

    // Auto-refresh every 10s
    const interval = setInterval(() => {
      if (Router.getCurrentRoute() !== '/dashboard') {
        clearInterval(interval);
        return;
      }
      loadDashboard();
    }, 10000);
  });

  // ===========================================================================
  // Page: GitHub Explorer
  // ===========================================================================

  Router.register('/github', async (container) => {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title"><i class="bi bi-github"></i> GitHub Explorer</h1>
        <p class="page-subtitle">Search GitHub users and explore their profiles & repositories via the GitHub REST API</p>
      </div>

      <div class="search-box mb-lg">
        <i class="bi bi-search" style="color:var(--text-muted)"></i>
        <input type="text" id="githubSearch" placeholder="Enter GitHub username (e.g. torvalds, octocat)" />
        <button class="btn btn-primary btn-sm" id="githubSearchBtn">
          <i class="bi bi-search"></i> Search
        </button>
      </div>

      <div id="githubResults">
        <div class="empty-state">
          <div class="empty-icon"><i class="bi bi-github"></i></div>
          <div class="empty-title">Search for a GitHub user</div>
          <div class="empty-text">Enter a username above to view their profile and repositories. Data is fetched through the circuit breaker with caching.</div>
        </div>
      </div>
    `;

    const searchInput = document.getElementById('githubSearch');
    const searchBtn = document.getElementById('githubSearchBtn');
    const resultsDiv = document.getElementById('githubResults');

    async function searchGitHub() {
      const username = searchInput.value.trim();
      if (!username) {
        Toast.show('Please enter a username', 'warning');
        return;
      }

      searchBtn.classList.add('loading');
      searchBtn.disabled = true;

      try {
        const [userData, repoData] = await Promise.all([
          API.get(`/api/external/github/user/${encodeURIComponent(username)}`),
          API.get(`/api/external/github/repos/${encodeURIComponent(username)}`)
        ]);

        const user = userData.data;
        const repos = repoData.data;

        resultsDiv.innerHTML = `
          <div class="card mb-lg page-enter">
            <div class="github-profile">
              <img src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(user.login)}" class="github-avatar" />
              <div class="github-info">
                <div class="github-name">${escapeHtml(user.name || user.login)}</div>
                <div class="github-login">@${escapeHtml(user.login)}</div>
                ${user.bio ? `<div class="github-bio">${escapeHtml(user.bio)}</div>` : ''}
                <div class="github-stats">
                  <div class="github-stat">
                    <div class="github-stat-value">${user.public_repos}</div>
                    <div class="github-stat-label">Repos</div>
                  </div>
                  <div class="github-stat">
                    <div class="github-stat-value">${user.followers}</div>
                    <div class="github-stat-label">Followers</div>
                  </div>
                  <div class="github-stat">
                    <div class="github-stat-value">${user.following}</div>
                    <div class="github-stat-label">Following</div>
                  </div>
                  <div class="github-stat">
                    <div class="github-stat-value">${user.public_gists || 0}</div>
                    <div class="github-stat-label">Gists</div>
                  </div>
                </div>
                <div class="github-meta">
                  ${user.location ? `<span class="github-meta-item"><i class="bi bi-geo-alt"></i> ${escapeHtml(user.location)}</span>` : ''}
                  ${user.company ? `<span class="github-meta-item"><i class="bi bi-building"></i> ${escapeHtml(user.company)}</span>` : ''}
                  ${user.blog ? `<span class="github-meta-item"><i class="bi bi-link-45deg"></i> <a href="${escapeHtml(user.blog)}" target="_blank">${escapeHtml(user.blog)}</a></span>` : ''}
                </div>
              </div>
            </div>
            <div style="padding:0 var(--space-lg) var(--space-sm); font-size:0.75rem; color:var(--text-muted); display:flex; gap:var(--space-md);">
              <span><i class="bi bi-lightning"></i> Source: ${userData.source}</span>
              ${userData.latency ? `<span><i class="bi bi-clock"></i> ${userData.latency}</span>` : ''}
              <span><i class="bi bi-shield"></i> Circuit: ${userData.circuitBreaker || 'N/A'}</span>
            </div>
          </div>

          <h2 style="font-size:1.1rem; font-weight:700; margin-bottom:var(--space-md); display:flex; align-items:center; gap:var(--space-sm);">
            <i class="bi bi-book" style="color:var(--accent-primary-light)"></i>
            Repositories
            <span class="card-badge badge-purple">${repos.length}</span>
          </h2>

          <div class="grid-2 stagger">
            ${repos.map(repo => `
              <div class="repo-card">
                <a href="${escapeHtml(repo.html_url)}" target="_blank" class="repo-name">
                  <i class="bi bi-book"></i> ${escapeHtml(repo.name)}
                </a>
                <div class="repo-desc">${escapeHtml(repo.description || 'No description')}</div>
                <div class="repo-meta">
                  ${repo.language ? `
                    <span class="repo-meta-item">
                      <span class="lang-dot" style="background:${getLangColor(repo.language)}"></span>
                      ${escapeHtml(repo.language)}
                    </span>
                  ` : ''}
                  <span class="repo-meta-item"><i class="bi bi-star"></i> ${repo.stargazers_count}</span>
                  <span class="repo-meta-item"><i class="bi bi-diagram-2"></i> ${repo.forks_count}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `;

      } catch (err) {
        resultsDiv.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
            <div class="empty-title">Error</div>
            <div class="empty-text">${escapeHtml(err.message)}</div>
          </div>
        `;
        Toast.show(err.message, 'error');
      } finally {
        searchBtn.classList.remove('loading');
        searchBtn.disabled = false;
      }
    }

    searchBtn.addEventListener('click', searchGitHub);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchGitHub();
    });
  });

  // ===========================================================================
  // Page: Weather
  // ===========================================================================

  Router.register('/weather', async (container) => {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title"><i class="bi bi-cloud-sun-fill"></i> Weather Station</h1>
        <p class="page-subtitle">Get weather forecasts via the Open-Meteo API — free, no API key required</p>
      </div>

      <div class="search-box mb-lg">
        <i class="bi bi-geo-alt" style="color:var(--text-muted)"></i>
        <input type="text" id="weatherSearch" placeholder="Enter city name (e.g. London, Tokyo, New York)" />
        <button class="btn btn-primary btn-sm" id="weatherSearchBtn">
          <i class="bi bi-search"></i> Search
        </button>
      </div>

      <div id="weatherResults">
        <div class="empty-state">
          <div class="empty-icon">🌍</div>
          <div class="empty-title">Search for a city</div>
          <div class="empty-text">Enter a city name to get the current weather and 5-day forecast</div>
        </div>
      </div>
    `;

    const searchInput = document.getElementById('weatherSearch');
    const searchBtn = document.getElementById('weatherSearchBtn');
    const resultsDiv = document.getElementById('weatherResults');

    async function searchWeather() {
      const city = searchInput.value.trim();
      if (!city) {
        Toast.show('Please enter a city name', 'warning');
        return;
      }

      searchBtn.classList.add('loading');
      searchBtn.disabled = true;

      try {
        const data = await API.get(`/api/external/weather?city=${encodeURIComponent(city)}`);
        const w = data.data;
        const current = w.current;
        const daily = w.daily;

        const weatherCode = current.weather_code;
        const emoji = getWeatherEmoji(weatherCode);
        const desc = getWeatherDescription(weatherCode);

        let forecastHtml = '';
        if (daily && daily.time) {
          forecastHtml = daily.time.map((date, i) => {
            const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
            const dayEmoji = getWeatherEmoji(daily.weather_code[i]);
            return `
              <div class="forecast-card">
                <div class="forecast-day">${dayName}</div>
                <div class="forecast-icon">${dayEmoji}</div>
                <div class="forecast-temps">
                  <span class="forecast-high">${Math.round(daily.temperature_2m_max[i])}°</span>
                  <span class="forecast-low">${Math.round(daily.temperature_2m_min[i])}°</span>
                </div>
              </div>
            `;
          }).join('');
        }

        resultsDiv.innerHTML = `
          <div class="card mb-lg page-enter">
            <div class="card-header">
              <div class="card-title">
                <i class="bi bi-geo-alt-fill"></i>
                ${escapeHtml(w.location.city || 'Unknown')}
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted);">
                ${w.location.latitude.toFixed(2)}°, ${w.location.longitude.toFixed(2)}° · ${escapeHtml(w.location.timezone || '')}
              </div>
            </div>
            <div class="weather-current">
              <div>
                <div class="weather-icon">${emoji}</div>
                <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:var(--space-xs);">${desc}</div>
              </div>
              <div>
                <div class="weather-temp">
                  ${Math.round(current.temperature_2m)}<span class="weather-temp-unit">°C</span>
                </div>
                <div style="font-size:0.85rem; color:var(--text-tertiary); margin-top:4px;">
                  Feels like ${Math.round(current.apparent_temperature)}°C
                </div>
              </div>
              <div class="weather-details">
                <div class="weather-detail"><i class="bi bi-droplet-half"></i> Humidity: ${current.relative_humidity_2m}%</div>
                <div class="weather-detail"><i class="bi bi-wind"></i> Wind: ${current.wind_speed_10m} km/h</div>
              </div>
            </div>
            <div style="padding:0 var(--space-lg) var(--space-sm); font-size:0.75rem; color:var(--text-muted); display:flex; gap:var(--space-md);">
              <span><i class="bi bi-lightning"></i> Source: ${data.source}</span>
              ${data.latency ? `<span><i class="bi bi-clock"></i> ${data.latency}</span>` : ''}
              <span><i class="bi bi-shield"></i> Circuit: ${data.circuitBreaker || 'N/A'}</span>
            </div>
          </div>

          ${forecastHtml ? `
            <h2 style="font-size:1.1rem; font-weight:700; margin-bottom:var(--space-md); display:flex; align-items:center; gap:var(--space-sm);">
              <i class="bi bi-calendar-week" style="color:var(--accent-primary-light)"></i>
              5-Day Forecast
            </h2>
            <div class="forecast-grid stagger">${forecastHtml}</div>
          ` : ''}
        `;

      } catch (err) {
        resultsDiv.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
            <div class="empty-title">Error</div>
            <div class="empty-text">${escapeHtml(err.message)}</div>
          </div>
        `;
        Toast.show(err.message, 'error');
      } finally {
        searchBtn.classList.remove('loading');
        searchBtn.disabled = false;
      }
    }

    searchBtn.addEventListener('click', searchWeather);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchWeather();
    });
  });

  // ===========================================================================
  // Page: Exchange Rates
  // ===========================================================================

  Router.register('/exchange', async (container) => {
    const popularCurrencies = ['USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','INR','BRL','KRW','SGD','MXN','ZAR','SEK'];

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title"><i class="bi bi-currency-exchange"></i> Exchange Rates</h1>
        <p class="page-subtitle">Live currency conversion via the ExchangeRate API — free, no API key required</p>
      </div>

      <div class="grid-2 mb-lg">
        <!-- Converter -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="bi bi-calculator"></i> Currency Converter</div>
          </div>
          <div class="form-group">
            <label class="form-label">Amount</label>
            <input type="number" class="form-input" id="exchangeAmount" value="100" min="0" step="any" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">From</label>
              <select class="form-input" id="exchangeFrom">
                ${popularCurrencies.map(c => `<option value="${c}" ${c === 'USD' ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">To</label>
              <select class="form-input" id="exchangeTo">
                ${popularCurrencies.map(c => `<option value="${c}" ${c === 'EUR' ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <button class="btn btn-primary w-full" id="convertBtn">
            <i class="bi bi-arrow-left-right"></i> Convert
          </button>
          <div id="conversionResult" style="margin-top:var(--space-md); display:none;">
            <div class="converter-result">
              <div class="converter-result-value" id="conversionValue">—</div>
              <div class="converter-result-label" id="conversionLabel">—</div>
            </div>
          </div>
        </div>

        <!-- Rates Table -->
        <div class="card">
          <div class="card-header">
            <div class="card-title"><i class="bi bi-table"></i> Live Rates</div>
            <span class="card-badge badge-green" id="ratesSource">—</span>
          </div>
          <div id="ratesTableContainer" style="max-height:400px; overflow-y:auto;">
            <div class="empty-state">
              <div class="empty-icon"><i class="bi bi-currency-exchange"></i></div>
              <div class="empty-text">Click convert to load rates</div>
            </div>
          </div>
        </div>
      </div>
    `;

    let allRates = null;

    async function convert() {
      const amount = parseFloat(document.getElementById('exchangeAmount').value) || 1;
      const from = document.getElementById('exchangeFrom').value;
      const to = document.getElementById('exchangeTo').value;
      const btn = document.getElementById('convertBtn');

      btn.classList.add('loading');
      btn.disabled = true;

      try {
        const data = await API.get(`/api/external/exchange?base=${from}&target=${to}&amount=${amount}`);
        const result = data.data;
        allRates = result.rates;

        // Show conversion
        if (result.conversion) {
          document.getElementById('conversionResult').style.display = 'block';
          document.getElementById('conversionValue').textContent = `${parseFloat(result.conversion.result).toLocaleString()} ${to}`;
          document.getElementById('conversionLabel').textContent = `${amount} ${from} = ${result.conversion.result} ${to} (Rate: ${result.conversion.rate})`;
        }

        // Source badge
        document.getElementById('ratesSource').textContent = data.source?.toUpperCase() || 'API';

        // Build rates table
        const tableContainer = document.getElementById('ratesTableContainer');
        const currencies = popularCurrencies.filter(c => c !== from && result.rates[c]);

        tableContainer.innerHTML = `
          <table class="rate-table">
            <thead>
              <tr>
                <th>Currency</th>
                <th>Rate</th>
                <th>1 ${from} =</th>
              </tr>
            </thead>
            <tbody>
              ${currencies.map(c => `
                <tr>
                  <td style="font-weight:600; color:var(--text-secondary)">${c}</td>
                  <td>${result.rates[c].toFixed(4)}</td>
                  <td style="color:var(--accent-primary-light)">${result.rates[c].toFixed(2)} ${c}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        Toast.show(`Rates loaded (${data.source})`, 'success');
      } catch (err) {
        Toast.show(err.message, 'error');
      } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    }

    document.getElementById('convertBtn').addEventListener('click', convert);

    // Auto-load on page visit
    convert();
  });

  // ===========================================================================
  // Page: API Docs
  // ===========================================================================

  Router.register('/api-docs', async (container) => {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title"><i class="bi bi-book-fill"></i> API Documentation</h1>
        <p class="page-subtitle">Interactive documentation for all NexusAPI endpoints</p>
      </div>
      <div id="apiDocsContent">
        <div class="page-loader" style="height:200px;">
          <div class="loader-spinner"></div>
        </div>
      </div>
    `;

    try {
      const data = await API.get('/api/explorer/endpoints');
      const docsContainer = document.getElementById('apiDocsContent');

      docsContainer.innerHTML = `
        <div style="margin-bottom:var(--space-lg); padding:var(--space-md); background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-sm);">
          <div>
            <span style="font-weight:700; color:var(--text-primary);">${escapeHtml(data.title)}</span>
            <span style="font-size:0.78rem; color:var(--text-tertiary); margin-left:var(--space-sm);">v${data.version}</span>
          </div>
          <div style="font-size:0.82rem; color:var(--text-secondary);">
            <i class="bi bi-braces"></i> ${data.totalEndpoints} endpoints
          </div>
        </div>

        ${data.groups.map(group => `
          <div class="api-group">
            <div class="api-group-header">
              <div class="api-group-icon"><i class="bi bi-${escapeHtml(group.icon)}"></i></div>
              <div>
                <div class="api-group-title">${escapeHtml(group.group)}</div>
                <div class="api-group-desc">${escapeHtml(group.description)}</div>
              </div>
            </div>

            ${group.endpoints.map((ep, idx) => `
              <div class="endpoint-card" id="ep-${group.group.replace(/\s+/g, '')}-${idx}">
                <div class="endpoint-header" onclick="
                  const body = this.nextElementSibling;
                  body.classList.toggle('expanded');
                ">
                  <span class="method-badge method-${ep.method}">${ep.method}</span>
                  <span class="endpoint-path">${escapeHtml(ep.path)}</span>
                  <div class="endpoint-badges">
                    ${ep.auth
                      ? '<span class="endpoint-auth-badge badge-yellow"><i class="bi bi-lock-fill"></i> AUTH</span>'
                      : '<span class="endpoint-auth-badge badge-green"><i class="bi bi-unlock-fill"></i> PUBLIC</span>'
                    }
                    <span class="endpoint-auth-badge badge-blue">${ep.rateLimit}</span>
                  </div>
                </div>
                <div class="endpoint-body">
                  <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:var(--space-md);">
                    ${escapeHtml(ep.description)}
                  </p>
                  ${ep.body ? `
                    <div class="endpoint-section-title">Request Body</div>
                    <div class="code-block">${JSON.stringify(ep.body, null, 2)}</div>
                  ` : ''}
                  ${ep.params ? `
                    <div class="endpoint-section-title mt-md">Query Parameters</div>
                    <div class="code-block">${JSON.stringify(ep.params, null, 2)}</div>
                  ` : ''}
                  <div class="endpoint-section-title mt-md">Response</div>
                  <div class="code-block">${escapeHtml(ep.response)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      `;

    } catch (err) {
      document.getElementById('apiDocsContent').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="bi bi-exclamation-triangle"></i></div>
          <div class="empty-title">Failed to load documentation</div>
          <div class="empty-text">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
  });

  // ===========================================================================
  // Redirect root
  // ===========================================================================

  Router.register('/', () => {
    Router.navigate(TokenManager.isLoggedIn() ? '/dashboard' : '/login');
  });

  // ===========================================================================
  // Mobile Nav Toggle
  // ===========================================================================

  document.getElementById('navToggle').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
  });

  // Close mobile nav on link click
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      document.getElementById('navLinks').classList.remove('open');
    });
  });

  // ===========================================================================
  // Bootstrap
  // ===========================================================================

  Toast.init();
  Router.init();

})();
