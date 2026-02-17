// API utility for making requests to the backend (uses same host/port as the page)
const API_BASE_URL = (typeof window !== 'undefined' && window.location?.origin
  ? window.location.origin
  : 'http://localhost:3000') + '/api';

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
      throw new Error(data.error || response.statusText || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API request error:', error);
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
    window.location.href = '/pages/auth/login.html';
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

  addParticipant: async (id, userId) => {
    return apiRequest(`/bookings/${id}/participants`, {
      method: 'POST',
      body: { userId }
    });
  }
};

// Reviews API
const reviewsAPI = {
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
  }
};

// Admin API
const adminAPI = {
  getStats: async () => {
    return apiRequest('/admin/stats');
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
  auth: authAPI,
  users: usersAPI,
  fields: fieldsAPI,
  bookings: bookingsAPI,
  reviews: reviewsAPI,
  favorites: favoritesAPI,
  messages: messagesAPI,
  admin: adminAPI,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getCurrentUser,
  setCurrentUser,
  removeCurrentUser
};

