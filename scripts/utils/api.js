// API utility for making requests to the backend.
// When the HTML is opened from Live Server / another port (or file:), the page origin is not the API server (Express on :3000).
// POSTing to /api on a static server returns 405 Method Not Allowed — use the real API origin instead.

(function initMatchFieldDialogs() {
  if (typeof window === 'undefined' || window.MatchFieldDialog) return;

  function ensureDialogStyles() {
    if (document.getElementById('matchfield-dialog-styles')) return;
    const style = document.createElement('style');
    style.id = 'matchfield-dialog-styles';
    style.textContent = `
      .mf-dialog-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.38);backdrop-filter:blur(5px);padding:20px;}
      .mf-dialog-card{width:min(420px,100%);background:#fff;border:1px solid #E5E7EB;border-radius:22px;box-shadow:0 24px 70px rgba(15,23,42,.22);padding:24px;transform:translateY(10px) scale(.98);opacity:0;transition:all .18s ease;font-family:'Poppins',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
      .mf-dialog-overlay.show .mf-dialog-card{transform:translateY(0) scale(1);opacity:1;}
      .mf-dialog-icon{width:52px;height:52px;border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;}
      .mf-dialog-icon.success{background:#E8F7EF;color:#16A34A;}
      .mf-dialog-icon.warning{background:#FFF7E6;color:#F59E0B;}
      .mf-dialog-icon.danger{background:#FEECEC;color:#DC2626;}
      .mf-dialog-icon.info{background:#EFF6FF;color:#007BFF;}
      .mf-dialog-title{margin:0 0 8px;text-align:center;color:#111827;font-size:20px;font-weight:700;}
      .mf-dialog-message{margin:0;color:#4B5563;text-align:center;font-size:14px;line-height:1.6;white-space:pre-wrap;}
      .mf-dialog-actions{display:flex;gap:12px;justify-content:center;margin-top:22px;}
      .mf-dialog-btn{border:none;border-radius:14px;padding:11px 18px;font-size:14px;font-weight:700;cursor:pointer;min-width:104px;font-family:inherit;transition:transform .15s ease,box-shadow .15s ease,background .15s ease;}
      .mf-dialog-btn:active{transform:translateY(1px);}
      .mf-dialog-btn.primary{background:#007BFF;color:#fff;box-shadow:0 10px 24px rgba(0,123,255,.28);}
      .mf-dialog-btn.primary:hover{background:#006AE0;}
      .mf-dialog-btn.secondary{background:#F3F4F6;color:#374151;border:1px solid #E5E7EB;}
      .mf-dialog-btn.secondary:hover{background:#E5E7EB;}
      .mf-dialog-btn.danger{background:#DC2626;color:#fff;box-shadow:0 10px 24px rgba(220,38,38,.22);}
      .mf-dialog-btn.danger:hover{background:#B91C1C;}
      .mf-dialog-prompt .mf-dialog-input{width:100%;box-sizing:border-box;margin-top:16px;padding:12px 14px;border:1px solid #E5E7EB;border-radius:12px;font-size:15px;font-family:inherit;color:#111827;background:#fff;}
      .mf-dialog-prompt .mf-dialog-input:focus{outline:none;border-color:#007BFF;box-shadow:0 0 0 3px rgba(0,123,255,.15);}
    `;
    document.head.appendChild(style);
  }

  function inferType(message, explicitType) {
    if (explicitType) return explicitType;
    const text = String(message || '').toLowerCase();
    if (text.includes('success') || text.includes('successfully') || text.includes('sent') || text.includes('saved')) return 'success';
    if (text.includes('delete') || text.includes('suspend') || text.includes('block') || text.includes('reject') || text.includes('failed') || text.includes('error')) return 'danger';
    if (text.includes('sure') || text.includes('warning') || text.includes('cannot')) return 'warning';
    return 'info';
  }

  function iconFor(type) {
    if (type === 'success') return '✓';
    if (type === 'warning') return '!';
    if (type === 'danger') return '×';
    return 'i';
  }

  function titleFor(type, customTitle) {
    if (customTitle) return customTitle;
    if (type === 'success') return 'Success';
    if (type === 'warning') return 'Please Confirm';
    if (type === 'danger') return 'Attention Required';
    return 'MatchField';
  }

  function showDialog(options) {
    return new Promise((resolve) => {
      ensureDialogStyles();
      const type = inferType(options.message, options.type);
      const overlay = document.createElement('div');
      overlay.className = 'mf-dialog-overlay';
      overlay.innerHTML = `
        <div class="mf-dialog-card" role="dialog" aria-modal="true">
          <div class="mf-dialog-icon ${type}">${iconFor(type)}</div>
          <h3 class="mf-dialog-title">${titleFor(type, options.title)}</h3>
          <p class="mf-dialog-message"></p>
          <div class="mf-dialog-actions"></div>
        </div>
      `;
      overlay.querySelector('.mf-dialog-message').textContent = String(options.message || '');
      const actions = overlay.querySelector('.mf-dialog-actions');
      const buttons = options.buttons || [{ label: 'OK', value: true, variant: 'primary' }];
      buttons.forEach((button) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mf-dialog-btn ' + (button.variant || 'primary');
        btn.textContent = button.label;
        btn.addEventListener('click', () => close(button.value));
        actions.appendChild(btn);
      });
      function close(value) {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 160);
        resolve(value);
      }
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay && options.dismissible !== false) close(false);
      });
      document.addEventListener('keydown', function onKey(event) {
        if (event.key === 'Escape') {
          document.removeEventListener('keydown', onKey);
          close(false);
        }
      });
      document.body.appendChild(overlay);
      setTimeout(() => overlay.classList.add('show'), 10);
      const primary = overlay.querySelector('.mf-dialog-btn.primary, .mf-dialog-btn.danger, .mf-dialog-btn');
      if (primary) primary.focus();
    });
  }

  function showPromptDialog(options) {
    return new Promise((resolve) => {
      ensureDialogStyles();
      const type = options.type || inferType(options.message, null) || 'info';
      const overlay = document.createElement('div');
      overlay.className = 'mf-dialog-overlay';
      const inputType = options.inputType === 'password' ? 'password' : 'text';
      overlay.innerHTML = `
        <div class="mf-dialog-card mf-dialog-prompt" role="dialog" aria-modal="true">
          <div class="mf-dialog-icon ${type}">${iconFor(type)}</div>
          <h3 class="mf-dialog-title"></h3>
          <p class="mf-dialog-message"></p>
          <input class="mf-dialog-input" />
          <div class="mf-dialog-actions"></div>
        </div>
      `;
      const titleEl = overlay.querySelector('.mf-dialog-title');
      titleEl.textContent = options.title || titleFor(type, null);
      overlay.querySelector('.mf-dialog-message').textContent = String(options.message || '');
      const input = overlay.querySelector('.mf-dialog-input');
      input.type = inputType;
      if (options.placeholder) input.placeholder = options.placeholder;
      if (options.autocomplete != null) {
        input.setAttribute('autocomplete', options.autocomplete);
      } else if (inputType === 'password') {
        input.setAttribute('autocomplete', 'current-password');
      } else {
        input.setAttribute('autocomplete', 'off');
      }

      const actions = overlay.querySelector('.mf-dialog-actions');
      function close(value) {
        overlay.classList.remove('show');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => overlay.remove(), 160);
        resolve(value);
      }

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'mf-dialog-btn secondary';
      cancelBtn.textContent = options.cancelText || 'Cancel';
      cancelBtn.addEventListener('click', () => close(null));

      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'mf-dialog-btn ' + (type === 'danger' ? 'danger' : 'primary');
      okBtn.textContent = options.okText || 'OK';
      okBtn.addEventListener('click', () => close(input.value));

      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);

      function onKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          close(null);
        } else if (event.key === 'Enter' && document.activeElement === input) {
          event.preventDefault();
          close(input.value);
        }
      }
      document.addEventListener('keydown', onKey);

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay && options.dismissible !== false) close(null);
      });

      document.body.appendChild(overlay);
      setTimeout(() => overlay.classList.add('show'), 10);
      setTimeout(() => {
        input.focus();
        if (options.selectAll) input.select();
      }, 50);
    });
  }

  window.MatchFieldDialog = {
    alert(message, options = {}) {
      return showDialog({
        message,
        title: options.title,
        type: inferType(message, options.type),
        buttons: [{ label: options.okText || 'OK', value: true, variant: options.variant || 'primary' }]
      });
    },
    confirm(message, options = {}) {
      const type = inferType(message, options.type || 'warning');
      return showDialog({
        message,
        title: options.title || 'Please Confirm',
        type,
        buttons: [
          { label: options.cancelText || 'Cancel', value: false, variant: 'secondary' },
          { label: options.okText || 'Confirm', value: true, variant: type === 'danger' ? 'danger' : 'primary' }
        ]
      });
    },
    prompt(message, options = {}) {
      const type = options.type || inferType(message, null) || 'info';
      return showPromptDialog({
        message,
        title: options.title || titleFor(type, null),
        type,
        inputType: options.inputType,
        placeholder: options.placeholder,
        okText: options.okText,
        cancelText: options.cancelText,
        dismissible: options.dismissible,
        selectAll: options.selectAll
      });
    }
  };

  const nativeAlert = window.alert ? window.alert.bind(window) : null;
  const nativeConfirm = window.confirm ? window.confirm.bind(window) : null;
  const nativePrompt = window.prompt ? window.prompt.bind(window) : null;

  window.MatchFieldDialog.native = {
    alert(message) {
      if (nativeAlert) nativeAlert(String(message));
    },
    confirm(message) {
      if (nativeConfirm) return nativeConfirm(String(message));
      return typeof Window !== 'undefined' && Window.prototype.confirm
        ? Window.prototype.confirm.call(window, message)
        : false;
    },
    prompt(message, defaultText) {
      if (nativePrompt) return nativePrompt(String(message), defaultText != null ? String(defaultText) : '');
      return typeof Window !== 'undefined' && Window.prototype.prompt
        ? Window.prototype.prompt.call(window, message, defaultText != null ? String(defaultText) : '')
        : null;
    }
  };

  window.alert = function matchFieldAlert(message) {
    if (!document.body || !window.MatchFieldDialog) {
      if (nativeAlert) nativeAlert(message);
      return;
    }
    window.MatchFieldDialog.alert(message);
  };
})();

(function initApiPortFromPageUrl() {
  if (typeof window === 'undefined') return;
  if (window.__API_PORT__ != null && String(window.__API_PORT__).trim() !== '') return;
  var h = window.location.hostname;
  var local =
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    h === '::1' ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h);
  if (!local) return;
  var p = window.location.port;
  if (!p) return;
  var n = parseInt(p, 10);
  if (!Number.isNaN(n) && n >= 3000 && n <= 3999) {
    window.__API_PORT__ = n;
  }
})();

function isLikelyLocalDevHost(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1') return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

/** Backend port when not using full __API_ORIGIN__ (default 3000). Override: window.__API_PORT__ = 3001 or localStorage matchfield_api_port = 3001 */
function getDevApiPort() {
  if (typeof window === 'undefined') return 3000;
  const fromWin = window.__API_PORT__;
  if (fromWin != null && String(fromWin).trim() !== '') {
    const n = parseInt(String(fromWin), 10);
    if (!Number.isNaN(n) && n > 0 && n <= 65535) return n;
  }
  try {
    const ls = localStorage.getItem('matchfield_api_port');
    if (ls != null && String(ls).trim() !== '') {
      const n = parseInt(ls, 10);
      if (!Number.isNaN(n) && n > 0 && n <= 65535) return n;
    }
  } catch (_) {
    /* private mode */
  }
  return 3000;
}

/** Live Server / Vite / etc. — page is not the Express app; must point at API port. */
function isTypicalSeparateStaticDevPort(portStr) {
  const p = parseInt(String(portStr), 10);
  if (Number.isNaN(p)) return false;
  return [5500, 5501, 5173, 4173, 8080, 8000, 5000, 4000, 1234].indexOf(p) !== -1;
}

/** Same machine, page likely served by Express with API (e.g. PORT=3001 → open :3001/pages/...). */
function isLikelySameNodeServerAsApi(host, pagePortStr) {
  if (!isLikelyLocalDevHost(host)) return false;
  const p = parseInt(String(pagePortStr), 10);
  if (Number.isNaN(p)) return false;
  return p >= 3000 && p <= 3999;
}

// Returns '' when the page is served from the same host:port as the API (e.g. Express on 3000 or 3001).
// Otherwise points at http(s)://<same-host>:<API port> for Live Server / other dev ports.
function resolveApiOrigin() {
  const apiPort = getDevApiPort();
  if (typeof window === 'undefined') return `http://localhost:${apiPort}`;
  if (window.__API_ORIGIN__) {
    return String(window.__API_ORIGIN__).replace(/\/$/, '');
  }
  const loc = window.location;
  if (loc.origin === 'null' || loc.protocol === 'file:') {
    return `http://127.0.0.1:${apiPort}`;
  }
  const host = loc.hostname;
  const port = loc.port || (loc.protocol === 'https:' ? '443' : '80');
  // Express serves /pages/... and /api on the same origin. If we default apiPort to 3000 but the tab is on 3001,
  // use relative /api (same origin) instead of guessing :3000. Skip typical Live Server ports (they are not the API).
  if (
    isLikelyLocalDevHost(host) &&
    typeof loc.pathname === 'string' &&
    loc.pathname.indexOf('/pages/') === 0 &&
    !isTypicalSeparateStaticDevPort(port)
  ) {
    return '';
  }
  if (isLikelyLocalDevHost(host) && String(port) === String(apiPort)) {
    return '';
  }
  if (isLikelyLocalDevHost(host) && isLikelySameNodeServerAsApi(host, port) && !isTypicalSeparateStaticDevPort(port)) {
    return '';
  }
  if (isLikelyLocalDevHost(host) && String(port) !== String(apiPort)) {
    return `http://${host}:${apiPort}`;
  }
  return loc.origin;
}

function getApiBaseUrl() {
  const origin = resolveApiOrigin();
  return origin === '' ? '/api' : `${origin}/api`;
}

// We keep auth session per tab (sessionStorage) so different tabs
// can stay logged in as different users during testing.
function getAuthStorage() {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch (_) {
    /* ignore */
  }
  return localStorage;
}

// Get auth token from storage
function getAuthToken() {
  const s = getAuthStorage();
  return s.getItem('authToken');
}

// Set auth token in storage
function setAuthToken(token) {
  const s = getAuthStorage();
  s.setItem('authToken', token);
}

// Remove auth token from storage
function removeAuthToken() {
  try { sessionStorage.removeItem('authToken'); } catch (_) { /* ignore */ }
  localStorage.removeItem('authToken');
}

function getRefreshToken() {
  const s = getAuthStorage();
  return s.getItem('refreshToken');
}

function setRefreshToken(token) {
  if (!token) return;
  const s = getAuthStorage();
  s.setItem('refreshToken', token);
}

function removeRefreshToken() {
  try { sessionStorage.removeItem('refreshToken'); } catch (_) { /* ignore */ }
  localStorage.removeItem('refreshToken');
}

// Get current user from storage
function getCurrentUser() {
  const s = getAuthStorage();
  const userStr = s.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
}

// Set current user in storage
function setCurrentUser(user) {
  const s = getAuthStorage();
  s.setItem('currentUser', JSON.stringify(user));
}

// Remove current user from storage
function removeCurrentUser() {
  try { sessionStorage.removeItem('currentUser'); } catch (_) { /* ignore */ }
  localStorage.removeItem('currentUser');
}

// Make API request
async function apiRequest(endpoint, options = {}) {
  const url = `${getApiBaseUrl()}${endpoint}`;
  const token = getAuthToken();

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    },
    ...options
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    let response;
    try {
      response = await fetch(url, config);
    } catch (fetchError) {
      // On some Windows setups, localhost can fail while 127.0.0.1 works.
      const canTryLoopbackFallback =
        fetchError &&
        fetchError.name === 'TypeError' &&
        /^https?:\/\/localhost(?::\d+)?\//i.test(url);
      if (!canTryLoopbackFallback) {
        throw fetchError;
      }
      const loopbackUrl = url.replace(/^https?:\/\/localhost(?=[:/])/i, 'http://127.0.0.1');
      response = await fetch(loopbackUrl, config);
    }
    let data;
    const contentType = response.headers.get('content-type');
    try {
      data = contentType && contentType.indexOf('application/json') !== -1
        ? await response.json()
        : {};
    } catch (_) {
      data = {};
    }

    if (!response.ok) {
      let validationMsg = '';
      if (Array.isArray(data.errors) && data.errors.length) {
        validationMsg = data.errors
          .map((e) => (e && (e.msg || e.message)) || '')
          .filter(Boolean)
          .join('; ');
      }
      let base = data.error || validationMsg || response.statusText || 'Request failed';
      if (data.details != null && String(data.details).trim() !== '') {
        base += ': ' + String(data.details);
      }
      throw new Error(String(base));
    }

    return data;
  } catch (error) {
    console.error('API request error:', error, { url });
    const name = error && error.name;
    const msg = (error && error.message) || '';
    if (name === 'TypeError' || /failed to fetch/i.test(msg)) {
      const httpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const httpApi = /^http:\/\//i.test(url);
      if (httpsPage && httpApi) {
        throw new Error(
          'Blocked mixed content: this page is HTTPS but the API is HTTP. Open the site over http:// (not https), or set window.__API_ORIGIN__ to your API URL.'
        );
      }
      const absForMsg =
        typeof window !== 'undefined' && url.startsWith('/')
          ? `${window.location.origin}${url}`
          : url;
      const base = getApiBaseUrl();
      const absBase = base.startsWith('/') ? `${typeof window !== 'undefined' ? window.location.origin : ''}${base}` : base;
      throw new Error(
        `Cannot reach the API (${absForMsg}). Start the backend: cd project folder, then npm start (optional: $env:PORT=3001; npm start on Windows). If the API is not on port 3000, set before loading scripts: window.__API_PORT__=3001 or localStorage.setItem('matchfield_api_port','3001'). Open app from the same port as the server (e.g. http://127.0.0.1:3001/pages/auth/login.html). API base: ${absBase}`
      );
    }
    throw error;
  }
}

// Auth API
const authAPI = {
  register: async (userData) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: userData
    });
    if (data.token && data.user) {
      setAuthToken(data.token);
      setCurrentUser(data.user);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
    }
    return data;
  },

  login: async (email, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password }
    });

    if (data.token && data.user) {
      setAuthToken(data.token);
      setCurrentUser(data.user);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
    }

    return data;
  },

  refresh: async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');
    const data = await apiRequest('/auth/refresh', {
      method: 'POST',
      body: { refreshToken }
    });
    if (data.token) setAuthToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    return data;
  },

  forgotPassword: async (email) => {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email }
    });
  },

  resetPassword: async (token, newPassword) => {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword }
    });
  },

  logout: async () => {
    const refreshToken = getRefreshToken();
    try {
      if (getAuthToken()) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: refreshToken ? { refreshToken } : {}
        });
      }
    } catch (_) {
      /* ignore network errors on logout */
    }
    removeAuthToken();
    removeRefreshToken();
    removeCurrentUser();
    window.location.replace('/pages/auth/login.html');
  },

  getCurrentUser: async () => {
    return apiRequest('/auth/me');
  },

  updatePassword: async (currentPassword, newPassword) => {
    return apiRequest('/auth/password', {
      method: 'PUT',
      body: { currentPassword, newPassword }
    });
  },

  deleteAccount: async (currentPassword) => {
    return apiRequest('/auth/me', {
      method: 'DELETE',
      body: { currentPassword }
    });
  }
};

// Users API
const usersAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/users?${queryString}`);
  },

  getById: async (id) => {
    return apiRequest(`/users/${id}`);
  },

  update: async (id, userData) => {
    return apiRequest(`/users/${id}`, {
      method: 'PUT',
      body: userData
    });
  },

  updateAvatar: async (id, avatarDataUrl) => {
    return apiRequest(`/users/${id}/avatar`, {
      method: 'PUT',
      body: { avatar: avatarDataUrl }
    });
  },

  submitOwnerVerification: async (idFrontUrl, idBackUrl) => {
    return apiRequest('/users/me/verification', {
      method: 'POST',
      body: { idFrontUrl, idBackUrl }
    });
  },

  updateStatus: async (id, status) => {
    return apiRequest(`/users/${id}/status`, {
      method: 'PUT',
      body: { status }
    });
  },

  search: async (query, options = {}) => {
    const params = new URLSearchParams({ q: String(query || '') });
    if (options && options.playersOnly) {
      params.set('playersOnly', '1');
    }
    return apiRequest(`/users/search/users?${params.toString()}`);
  },

  getMyPreferences: async () => {
    return apiRequest('/users/me/preferences');
  },

  patchMyPreferences: async (prefsSlice) => {
    return apiRequest('/users/me/preferences', {
      method: 'PATCH',
      body: prefsSlice
    });
  }
};

// Fields API
const fieldsAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/fields?${queryString}`);
  },

  getById: async (id) => {
    return apiRequest(`/fields/${encodeURIComponent(id)}`);
  },

  create: async (fieldData) => {
    return apiRequest('/fields', {
      method: 'POST',
      body: fieldData
    });
  },

  update: async (id, fieldData) => {
    return apiRequest(`/fields/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: fieldData
    });
  },

  delete: async (id) => {
    return apiRequest(`/fields/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  getByOwner: async (ownerId) => {
    return apiRequest(`/fields/owner/${encodeURIComponent(ownerId)}`);
  },

  getMine: async () => {
    return apiRequest('/fields/me');
  },

  listUnavailableDates: async (fieldId) => {
    return apiRequest(`/fields/${encodeURIComponent(fieldId)}/unavailable-dates`);
  },

  addUnavailableDate: async (fieldId, dateYmd, startTime, endTime) => {
    const body = { date: dateYmd };
    if (startTime && endTime) {
      body.startTime = startTime;
      body.endTime = endTime;
    }
    return apiRequest(`/fields/${encodeURIComponent(fieldId)}/unavailable-dates`, {
      method: 'POST',
      body
    });
  },

  removeUnavailableDate: async (fieldId, dateYmd, startTime, endTime) => {
    const params = new URLSearchParams({ date: dateYmd });
    if (startTime && endTime) {
      params.set('startTime', startTime);
      params.set('endTime', endTime);
    }
    return apiRequest(
      `/fields/${encodeURIComponent(fieldId)}/unavailable-dates?${params.toString()}`,
      {
        method: 'DELETE'
      }
    );
  },

  getAvailability: async (fieldId, date) => {
    return apiRequest(
      `/fields/${encodeURIComponent(fieldId)}/availability?date=${encodeURIComponent(date)}`
    );
  },

  getNearby: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/fields/nearby?${queryString}`);
  },

  getPopularNow: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/fields/popular-now?${queryString}`);
  },

  getRecommendations: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/fields/recommendations?${queryString}`);
  }
};

// Bookings API
const bookingsAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/bookings?${queryString}`);
  },

  getById: async (id) => {
    return apiRequest(`/bookings/${encodeURIComponent(id)}`);
  },

  create: async (bookingData) => {
    return apiRequest('/bookings', {
      method: 'POST',
      body: bookingData
    });
  },

  updateStatus: async (id, status) => {
    return apiRequest(`/bookings/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: { status }
    });
  },

  /** Server-side MANUAL settlement — never send card fields. */
  manualSettle: async (id, options = {}) => {
    const body = {};
    if (options && options.userId) body.userId = options.userId;
    return apiRequest(`/bookings/${encodeURIComponent(id)}/payments/manual-settle`, {
      method: 'POST',
      body
    });
  },

  reschedule: async (id, data) => {
    return apiRequest(`/bookings/${encodeURIComponent(id)}/reschedule`, {
      method: 'PUT',
      body: data
    });
  },

  addParticipant: async (id, userId) => {
    return apiRequest(`/bookings/${encodeURIComponent(id)}/participants`, {
      method: 'POST',
      body: { userId }
    });
  },

  removeParticipant: async (id) => {
    return apiRequest(`/bookings/${encodeURIComponent(id)}/participants/me`, {
      method: 'DELETE'
    });
  }
};

// Reviews API
const reviewsAPI = {
  getMyReviews: async () => {
    return apiRequest('/reviews/user/me');
  },

  getByField: async (fieldId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/reviews/field/${fieldId}?${queryString}`);
  },

  create: async (reviewData) => {
    return apiRequest('/reviews', {
      method: 'POST',
      body: reviewData
    });
  },

  delete: async (id) => {
    return apiRequest(`/reviews/${id}`, {
      method: 'DELETE'
    });
  }
};

// Favorites API
const favoritesAPI = {
  getAll: async () => {
    return apiRequest('/favorites');
  },

  add: async (fieldId) => {
    return apiRequest('/favorites', {
      method: 'POST',
      body: { fieldId }
    });
  },

  remove: async (fieldId) => {
    return apiRequest(`/favorites/${fieldId}`, {
      method: 'DELETE'
    });
  },

  check: async (fieldId) => {
    return apiRequest(`/favorites/check/${fieldId}`);
  }
};

// Support / Contact API
const supportAPI = {
  getContactInfo: async () => apiRequest('/support/contact-info'),

  contact: async (data) => {
    return apiRequest('/support/contact', {
      method: 'POST',
      body: data
    });
  }
};

// User Notifications API (admin replies, etc.)
const notificationsAPI = {
  getMine: async () => apiRequest('/notifications/me'),
  markAllRead: async () => apiRequest('/notifications/me/mark-read', { method: 'POST' }),
  clearAll: async () => apiRequest('/notifications/me', { method: 'DELETE' })
};

// Field owner API
const ownerAPI = {
  getStats: async () => {
    return apiRequest('/owner/stats');
  }
};

// Admin API
const adminAPI = {
  getStats: async () => {
    return apiRequest('/admin/stats');
  },

  getBookingsRegionStats: async () => {
    return apiRequest('/admin/bookings/region-stats');
  },

  getNotifications: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/notifications${queryString ? '?' + queryString : ''}`);
  },

  sendNotification: async (data) => {
    return apiRequest('/admin/notifications/send', {
      method: 'POST',
      body: data
    });
  },

  getVerifications: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/verifications?${queryString}`);
  },

  verifyOwner: async (userId, verificationStatus, reason) => {
    return apiRequest(`/admin/verify-owner/${userId}`, {
      method: 'PUT',
      body: { verificationStatus, reason }
    });
  },

  inviteAdmin: async (email, fullName) => {
    return apiRequest('/admin/invite-admin', {
      method: 'POST',
      body: { email, fullName }
    });
  },

  // Fields moderation
  getFields: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/fields${queryString ? '?' + queryString : ''}`);
  },

  moderateField: async (fieldId, status, reason) => {
    return apiRequest(`/admin/fields/${encodeURIComponent(fieldId)}/moderation`, {
      method: 'PUT',
      body: { status, reason }
    });
  },

  // Shared Support Inbox
  supportGetConversations: async (params = {}) => {
    const q = new URLSearchParams();
    if (params.conversationTake != null && String(params.conversationTake).trim() !== '') {
      q.set('conversationTake', String(params.conversationTake));
    }
    if (params.submissionTake != null && String(params.submissionTake).trim() !== '') {
      q.set('submissionTake', String(params.submissionTake));
    }
    if (params.limit != null && String(params.limit).trim() !== '') {
      q.set('limit', String(params.limit));
    }
    const qs = q.toString();
    return apiRequest(`/admin/support/conversations${qs ? '?' + qs : ''}`);
  },

  supportGetMessages: async (conversationId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/support/conversation/${encodeURIComponent(conversationId)}/messages?${queryString}`);
  },

  supportSendMessage: async (conversationId, content) => {
    return apiRequest(`/admin/support/conversation/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: { content }
    });
  },

  supportMarkAsRead: async (conversationId, messageId) => {
    return apiRequest(`/admin/support/conversation/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/read`, {
      method: 'PUT'
    });
  },

  supportSetBlocked: async (conversationId, blocked) => {
    return apiRequest(`/admin/support/conversation/${encodeURIComponent(conversationId)}/block`, {
      method: 'PATCH',
      body: { blocked }
    });
  },

  supportSetStarred: async (conversationId, starred) => {
    return apiRequest(`/admin/support/conversation/${encodeURIComponent(conversationId)}/star`, {
      method: 'PATCH',
      body: { starred }
    });
  },

  supportReplyFromSubmission: async (submissionMongoId, content) => {
    return apiRequest(`/admin/support/submission/${encodeURIComponent(submissionMongoId)}/reply`, {
      method: 'POST',
      body: { content }
    });
  },

  supportMarkSubmissionSeen: async (submissionMongoId) => {
    return apiRequest(`/admin/support/submission/${encodeURIComponent(submissionMongoId)}/seen`, {
      method: 'PATCH'
    });
  }
};

// Export all APIs
window.API = {
  get apiBaseUrl() {
    return getApiBaseUrl();
  },
  getApiBaseUrl,
  getDevApiPort,
  auth: authAPI,
  users: usersAPI,
  fields: fieldsAPI,
  bookings: bookingsAPI,
  reviews: reviewsAPI,
  favorites: favoritesAPI,
  notifications: notificationsAPI,
  support: supportAPI,
  owner: ownerAPI,
  admin: adminAPI,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getCurrentUser,
  setCurrentUser,
  removeCurrentUser,
  escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  /** Fetch private resource with Authorization header; returns blob object URL (revoke when done). */
  async authFetchBlobUrl(apiPath) {
    const token = getAuthToken();
    if (!token) throw new Error('Not authenticated');
    const base = getApiBaseUrl();
    const url = String(apiPath || '').startsWith('http')
      ? apiPath
      : `${base}${String(apiPath).startsWith('/') ? '' : '/'}${apiPath}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'same-origin'
    });
    if (!res.ok) {
      const err = new Error('Failed to load protected resource');
      err.status = res.status;
      throw err;
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
};

