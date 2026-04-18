// API utility for making requests to the backend.
// When the HTML is opened from Live Server / another port (or file:), the page origin is not the API server (Express on :3000).
// POSTing to /api on a static server returns 405 Method Not Allowed — use the real API origin instead.

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

// Get auth token from localStorage
function getAuthToken() {
  return localStorage.getItem('authToken');
}

// Set auth token in localStorage
function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

// Remove auth token from localStorage
function removeAuthToken() {
  localStorage.removeItem('authToken');
}

// Get current user from localStorage
function getCurrentUser() {
  const userStr = localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
}

// Set current user in localStorage
function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

// Remove current user from localStorage
function removeCurrentUser() {
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
    const response = await fetch(url, config);
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
      const firstValErr =
        Array.isArray(data.errors) && data.errors[0] && (data.errors[0].msg || data.errors[0].message);
      let base = data.error || firstValErr || response.statusText || 'Request failed';
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
    return apiRequest('/auth/register', {
      method: 'POST',
      body: userData
    });
  },

  login: async (email, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    
    if (data.token && data.user) {
      setAuthToken(data.token);
      setCurrentUser(data.user);
    }
    
    return data;
  },

  logout: () => {
    removeAuthToken();
    removeCurrentUser();
    // Use replace so Back button doesn't return to the page we just left
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

  search: async (query) => {
    return apiRequest(`/users/search/users?q=${encodeURIComponent(query)}`);
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

  addUnavailableDate: async (fieldId, dateYmd) => {
    return apiRequest(`/fields/${encodeURIComponent(fieldId)}/unavailable-dates`, {
      method: 'POST',
      body: { date: dateYmd }
    });
  },

  removeUnavailableDate: async (fieldId, dateYmd) => {
    return apiRequest(
      `/fields/${encodeURIComponent(fieldId)}/unavailable-dates?date=${encodeURIComponent(dateYmd)}`,
      {
        method: 'DELETE'
      }
    );
  },

  getAvailability: async (fieldId, date) => {
    return apiRequest(
      `/fields/${encodeURIComponent(fieldId)}/availability?date=${encodeURIComponent(date)}`
    );
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

// Messages API
const messagesAPI = {
  getConversations: async () => {
    return apiRequest('/messages/conversations');
  },

  getConversation: async (userId) => {
    return apiRequest(`/messages/conversation/${userId}`);
  },

  getMessages: async (conversationId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/messages/conversation/${conversationId}/messages?${queryString}`);
  },

  sendMessage: async (conversationId, content) => {
    return apiRequest(`/messages/conversation/${conversationId}/messages`, {
      method: 'POST',
      body: { content }
    });
  },

  markAsRead: async (conversationId, messageId) => {
    return apiRequest(`/messages/conversation/${conversationId}/messages/${messageId}/read`, {
      method: 'PUT'
    });
  },

  setBlocked: async (conversationId, blocked) => {
    return apiRequest(`/messages/conversation/${conversationId}/block`, {
      method: 'PATCH',
      body: { blocked }
    });
  },

  setStarred: async (conversationId, starred) => {
    return apiRequest(`/messages/conversation/${conversationId}/star`, {
      method: 'PATCH',
      body: { starred }
    });
  }
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
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/admin/support/conversations${queryString ? '?' + queryString : ''}`);
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
  messages: messagesAPI,
  notifications: notificationsAPI,
  support: supportAPI,
  owner: ownerAPI,
  admin: adminAPI,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getCurrentUser,
  setCurrentUser,
  removeCurrentUser
};

