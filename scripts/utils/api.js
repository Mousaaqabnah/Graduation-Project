// API utility for making requests to the backend.
// When the HTML is opened from Live Server / another port (or file:), the page origin is not the API server (Express on :3000).
// POSTing to /api on a static server returns 405 Method Not Allowed — use the real API origin instead.
function isLikelyLocalDevHost(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

// Returns '' when the page is already served from the API server (port 3000) — use relative /api
// so fetch stays same-origin (fixes localhost vs 127.0.0.1 localStorage + connection quirks).
function resolveApiOrigin() {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  if (window.__API_ORIGIN__) {
    return String(window.__API_ORIGIN__).replace(/\/$/, '');
  }
  const loc = window.location;
  if (loc.origin === 'null' || loc.protocol === 'file:') {
    return 'http://localhost:3000';
  }
  const host = loc.hostname;
  const port = loc.port || (loc.protocol === 'https:' ? '443' : '80');
  if (isLikelyLocalDevHost(host) && String(port) === '3000') {
    return '';
  }
  if (isLikelyLocalDevHost(host) && String(port) !== '3000') {
    return `http://${host}:3000`;
  }
  return loc.origin;
}

const _apiOriginResolved = resolveApiOrigin();
const API_BASE_URL = _apiOriginResolved === '' ? '/api' : `${_apiOriginResolved}/api`;

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
  const url = `${API_BASE_URL}${endpoint}`;
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
      const base = data.error || response.statusText || 'Request failed';
      const extra = data.details ? ` ${data.details}` : '';
      throw new Error(base + extra);
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
      throw new Error(
        `Cannot reach the API (${absForMsg}). Start the backend in the project folder: npm start (or npm run dev). Open http://localhost:3000/pages/auth/login.html and log in as OWNER, or use Live Server (API stays on port 3000). API base: ${API_BASE_URL}`
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
  }
};

// Fields API
const fieldsAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/fields?${queryString}`);
  },

  getById: async (id) => {
    return apiRequest(`/fields/${id}`);
  },

  create: async (fieldData) => {
    return apiRequest('/fields', {
      method: 'POST',
      body: fieldData
    });
  },

  update: async (id, fieldData) => {
    return apiRequest(`/fields/${id}`, {
      method: 'PUT',
      body: fieldData
    });
  },

  delete: async (id) => {
    return apiRequest(`/fields/${id}`, {
      method: 'DELETE'
    });
  },

  getByOwner: async (ownerId) => {
    return apiRequest(`/fields/owner/${ownerId}`);
  },

  getMine: async () => {
    return apiRequest('/fields/me');
  },

  listUnavailableDates: async (fieldId) => {
    return apiRequest(`/fields/${fieldId}/unavailable-dates`);
  },

  addUnavailableDate: async (fieldId, dateYmd) => {
    return apiRequest(`/fields/${fieldId}/unavailable-dates`, {
      method: 'POST',
      body: { date: dateYmd }
    });
  },

  removeUnavailableDate: async (fieldId, dateYmd) => {
    return apiRequest(`/fields/${fieldId}/unavailable-dates?date=${encodeURIComponent(dateYmd)}`, {
      method: 'DELETE'
    });
  },

  getAvailability: async (fieldId, date) => {
    return apiRequest(`/fields/${fieldId}/availability?date=${encodeURIComponent(date)}`);
  }
};

// Bookings API
const bookingsAPI = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/bookings?${queryString}`);
  },

  getById: async (id) => {
    return apiRequest(`/bookings/${id}`);
  },

  create: async (bookingData) => {
    return apiRequest('/bookings', {
      method: 'POST',
      body: bookingData
    });
  },

  updateStatus: async (id, status) => {
    return apiRequest(`/bookings/${id}/status`, {
      method: 'PUT',
      body: { status }
    });
  },

  reschedule: async (id, data) => {
    return apiRequest(`/bookings/${id}/reschedule`, {
      method: 'PUT',
      body: data
    });
  },

  addParticipant: async (id, userId) => {
    return apiRequest(`/bookings/${id}/participants`, {
      method: 'POST',
      body: { userId }
    });
  },

  removeParticipant: async (id) => {
    return apiRequest(`/bookings/${id}/participants/me`, {
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
  }
};

// Export all APIs
window.API = {
  apiBaseUrl: API_BASE_URL,
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

