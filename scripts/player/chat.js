/**
 * MatchField Chat - Real-time messaging between players and field owners.
 * Uses API for conversations and messages. Auth required.
 */

// Chat state
const chatState = {
  conversations: [],
  currentConversationId: null,
  currentConversation: null,
  messages: [],
  currentFieldInfo: null,
  isLoading: false,
  isSending: false
};

const CHAT_REFRESH_MS = 4000;
let chatRefreshTimer = null;

// Helper: Get current user from API
function getCurrentUserId() {
  const user = typeof API !== 'undefined' && API.getCurrentUser ? API.getCurrentUser() : null;
  return user ? user.id : null;
}

// Helper: Format role for display
function formatRole(role) {
  if (!role) return 'User';
  const map = { PLAYER: 'Player', OWNER: 'Field Owner', ADMIN: 'Admin' };
  return map[role] || role;
}

// Helper: Get avatar URL
function getAvatarUrl(user, size = 128) {
  if (user && user.avatar) return user.avatar;
  const name = (user && user.fullName) ? user.fullName : 'User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=007BFF&color=fff&size=${size}`;
}

// Helper: Format time ago
function formatTimeAgo(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString();
}

// Helper: Format message time (e.g. 4:20 PM)
function formatMessageTime(date) {
  if (!date) return '';
  const d = new Date(date);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mm = m < 10 ? '0' + m : m;
  return `${h}:${mm} ${ampm}`;
}

// Map API conversation to UI format
function mapConversation(conv, currentUserId) {
  const other = conv.user1Id === currentUserId ? conv.user2 : conv.user1;
  const lastMsg = conv.messages && conv.messages[0];
  return {
    id: conv.id,
    conversationId: conv.id,
    userId: other.id,
    name: other.fullName,
    role: formatRole(other.role),
    avatar: getAvatarUrl(other),
    status: 'offline', // TODO: real-time presence
    lastMessage: lastMsg ? lastMsg.content : 'No messages yet',
    lastMessageTime: lastMsg ? lastMsg.createdAt : conv.updatedAt,
    timeAgo: formatTimeAgo(lastMsg ? lastMsg.createdAt : conv.updatedAt),
    otherUser: other
  };
}

function didConversationsChange(prev, next) {
  if (!Array.isArray(prev) || !Array.isArray(next)) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (!a || !b) return true;
    if (a.id !== b.id) return true;
    if (String(a.lastMessage || '') !== String(b.lastMessage || '')) return true;
    if (String(a.lastMessageTime || '') !== String(b.lastMessageTime || '')) return true;
    if (String(a.timeAgo || '') !== String(b.timeAgo || '')) return true;
  }
  return false;
}

function didMessagesChange(prev, next) {
  if (!Array.isArray(prev) || !Array.isArray(next)) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (!a || !b) return true;
    if (String(a.id || '') !== String(b.id || '')) return true;
    if (String(a.content || '') !== String(b.content || '')) return true;
    if (String(a.createdAt || '') !== String(b.createdAt || '')) return true;
    const aSender = a.sender ? String(a.sender.id || '') : '';
    const bSender = b.sender ? String(b.sender.id || '') : '';
    if (aSender !== bSender) return true;
  }
  return false;
}

// Show toast notification
function showToast(message, type = 'success') {
  const existing = document.querySelector('.chat-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `chat-toast chat-toast-${type}`;
  toast.innerHTML = `
    <div class="chat-toast-content">
      <i class="fi ${type === 'success' ? 'fi-rr-check' : type === 'info' ? 'fi-rr-info' : 'fi-rr-exclamation'}"></i>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load conversations from API
async function loadConversations(options = {}) {
  const silent = Boolean(options.silent);
  if (!API || !API.messages) {
    showToast('API not available', 'error');
    return;
  }

  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    showToast('Please log in to view messages', 'error');
    return;
  }

  if (!silent) {
    chatState.isLoading = true;
    renderLoadingState(true);
  }

  try {
    const res = await API.messages.getConversations();
    const mapped = (res.conversations || []).map(c => mapConversation(c, currentUserId));
    // Exclude Admin conversations - Contact Us is one-way; Chat is for players & field owners only
    const convs = mapped.filter(c => {
      const role = (c.otherUser && c.otherUser.role) ? String(c.otherUser.role).toUpperCase() : '';
      return role !== 'ADMIN';
    });
    const hasListChanged = didConversationsChange(chatState.conversations, convs);
    chatState.conversations = convs;
    if (!silent || hasListChanged) {
      renderMessageList();
    }

    // If we had a selected conversation, keep it
    if (chatState.currentConversationId) {
      const stillExists = convs.some(c => c.id === chatState.currentConversationId);
      if (!stillExists) {
        chatState.currentConversationId = null;
        chatState.currentConversation = null;
        chatState.messages = [];
        showEmptyChatState();
        hideChatInput();
      }
    } else if (convs.length > 0) {
      selectConversation(convs[0].id);
    } else {
      showEmptyChatState();
      hideChatInput();
    }
  } catch (err) {
    console.error('Load conversations error:', err);
    showToast(err.message || 'Failed to load conversations', 'error');
    chatState.conversations = [];
    renderMessageList();
    showEmptyChatState();
    hideChatInput();
  } finally {
    if (!silent) {
      chatState.isLoading = false;
      renderLoadingState(false);
    }
  }
}

// Load messages for a conversation
async function loadMessages(conversationId, options = {}) {
  const silent = Boolean(options.silent);
  if (!API || !API.messages) return;

  if (!silent) {
    chatState.isLoading = true;
    renderMessagesLoading(true);
  }

  try {
    const res = await API.messages.getMessages(conversationId);
    const incoming = res.messages || [];
    const hasChanged = didMessagesChange(chatState.messages, incoming);
    if (!hasChanged) return;

    const container = document.getElementById('chatMessages');
    const wasNearBottom = container
      ? (container.scrollHeight - container.scrollTop - container.clientHeight) < 80
      : false;
    const prevScrollTop = container ? container.scrollTop : 0;

    chatState.messages = incoming;
    renderMessages(chatState.messages, chatState.currentConversation);
    if (container) {
      if (wasNearBottom) {
        scrollToBottom();
      } else {
        container.scrollTop = prevScrollTop;
      }
    }
  } catch (err) {
    console.error('Load messages error:', err);
    showToast(err.message || 'Failed to load messages', 'error');
    chatState.messages = [];
    renderMessages([], chatState.currentConversation);
  } finally {
    if (!silent) {
      chatState.isLoading = false;
      renderMessagesLoading(false);
    }
  }
}

// Select conversation
async function selectConversation(conversationId) {
  const conv = chatState.conversations.find(c => c.id === conversationId);
  if (!conv) return;

  chatState.currentConversationId = conversationId;
  chatState.currentConversation = conv;

  // Update active state in list
  document.querySelectorAll('.message-item').forEach(item => {
    item.classList.toggle('active', item.dataset.chatId === conversationId);
  });

  // Update header
  updateChatHeader(conv);

  // Load messages
  await loadMessages(conversationId);

  // Load field info when chatting with a Field Owner
  const sidebar = document.getElementById('fieldInfoSidebar');
  chatState.currentFieldInfo = null;
  if (sidebar) sidebar.classList.remove('visible');
  const isOwner = conv.otherUser && String(conv.otherUser.role || '').toUpperCase() === 'OWNER';
  if (isOwner && API && API.fields) {
    try {
      const res = await API.fields.getByOwner(conv.userId);
      const fields = res.fields || [];
      const field = fields.length > 0 ? fields[0] : null;
      chatState.currentFieldInfo = { field, owner: conv };
      updateFieldInfoSidebar(chatState.currentFieldInfo);
      if (sidebar) sidebar.classList.add('visible');
    } catch (err) {
      console.error('Load owner fields error:', err);
      chatState.currentFieldInfo = { field: null, owner: conv };
      updateFieldInfoSidebar(chatState.currentFieldInfo);
      if (sidebar) sidebar.classList.add('visible');
    }
  }

  // Show input
  const inputContainer = document.getElementById('chatInputContainer');
  if (inputContainer) inputContainer.style.display = 'flex';
}

// Update chat header
function updateChatHeader(conv) {
  const nameEl = document.getElementById('chatUserName');
  const statusEl = document.getElementById('chatUserStatus');
  const avatarImg = document.querySelector('.chat-header .chat-avatar img');

  if (nameEl) nameEl.textContent = conv.name;
  if (statusEl) statusEl.textContent = conv.status === 'online' ? 'Online' : 'Offline';
  if (avatarImg) avatarImg.src = conv.avatar;
}

// Update field info sidebar (Field Owner + field details)
function updateFieldInfoSidebar(info) {
  if (!info || !info.owner) return;

  const field = info.field;
  const owner = info.owner;
  const ownerNameEl = document.getElementById('fieldOwnerName');
  const ownerAvatarEl = document.getElementById('fieldOwnerAvatar');
  const ownerStatusEl = document.getElementById('fieldOwnerStatus');
  const typeEl = document.getElementById('fieldType');
  const rateEl = document.getElementById('fieldRate');
  const sizeEl = document.getElementById('fieldSize');
  const surfaceEl = document.getElementById('fieldSurface');
  const imgEl = document.getElementById('fieldImage');

  if (ownerNameEl) ownerNameEl.textContent = owner.name;
  if (ownerAvatarEl) ownerAvatarEl.src = owner.avatar;
  if (ownerStatusEl) {
    ownerStatusEl.textContent = owner.status === 'online' ? 'Online' : 'Offline';
    ownerStatusEl.style.color = owner.status === 'online' ? '#10B981' : '#6B7280';
  }

  if (field) {
    if (imgEl) imgEl.src = (field.images && field.images[0]) || 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&h=300&fit=crop&auto=format';
    if (typeEl) typeEl.textContent = field.sport || 'Field';
    if (rateEl) rateEl.textContent = field.pricePerHour != null ? `₺${field.pricePerHour}/h` : 'N/A';
    if (sizeEl) sizeEl.textContent = field.type === 'INDOOR' ? 'Indoor' : 'Outdoor';
    if (surfaceEl) surfaceEl.textContent = (field.features && field.features[0]) || field.type || 'Standard';
    const viewBtn = document.getElementById('viewFieldPageBtn');
    const bookBtn = document.getElementById('bookNowBtn');
    if (viewBtn) { viewBtn.disabled = false; viewBtn.style.opacity = '1'; }
    if (bookBtn) { bookBtn.disabled = false; bookBtn.style.opacity = '1'; }
  } else {
    if (imgEl) imgEl.src = 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&h=300&fit=crop&auto=format';
    if (typeEl) typeEl.textContent = '—';
    if (rateEl) rateEl.textContent = '—';
    if (sizeEl) sizeEl.textContent = '—';
    if (surfaceEl) surfaceEl.textContent = '—';
    const viewBtn = document.getElementById('viewFieldPageBtn');
    const bookBtn = document.getElementById('bookNowBtn');
    if (viewBtn) { viewBtn.disabled = true; viewBtn.style.opacity = '0.6'; }
    if (bookBtn) { bookBtn.disabled = true; bookBtn.style.opacity = '0.6'; }
  }
}

// Render message list
function renderMessageList() {
  const list = document.getElementById('messageList');
  if (!list) return;

  list.innerHTML = '';

  if (chatState.conversations.length === 0) {
    list.innerHTML = `
      <div class="message-list-empty">
        <i class="fi fi-rr-messages"></i>
        <p>No conversations yet</p>
        <p class="message-list-empty-hint">Click "+ Add Friend" to start chatting with players or field owners</p>
      </div>
    `;
    return;
  }

  chatState.conversations.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'message-item' + (chatState.currentConversationId === conv.id ? ' active' : '');
    item.dataset.chatId = conv.id;

    const statusIndicator = conv.status === 'online' ? '<span class="online-indicator"></span>' : '';
    item.innerHTML = `
      <div class="message-item-avatar">
        <img src="${escapeHtml(conv.avatar)}" alt="${escapeHtml(conv.name)}">
        ${statusIndicator}
      </div>
      <div class="message-item-content">
        <div class="message-item-header">
          <span class="message-item-name">${escapeHtml(conv.name)}</span>
          <span class="message-item-time">${escapeHtml(conv.timeAgo)}</span>
        </div>
        <div class="message-item-preview">${escapeHtml(conv.lastMessage)}</div>
        <div class="message-item-role">${escapeHtml(conv.role)}</div>
      </div>
    `;

    item.addEventListener('click', () => selectConversation(conv.id));
    list.appendChild(item);
  });
}

// Render messages
function renderMessages(messages, conversation) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const currentUserId = getCurrentUserId();

  container.innerHTML = '';

  messages.forEach(msg => {
    const isSent = msg.sender && msg.sender.id === currentUserId;
    const senderName = msg.sender ? msg.sender.fullName : 'Unknown';
    const senderAvatar = msg.sender ? getAvatarUrl(msg.sender, 36) : getAvatarUrl({ fullName: 'User' }, 36);

    const div = document.createElement('div');
    div.className = `message ${isSent ? 'sent' : 'received'}`;

    if (isSent) {
      div.innerHTML = `
        <div class="message-content">
          <div class="message-bubble">${escapeHtml(msg.content)}</div>
          <div class="message-time">${formatMessageTime(msg.createdAt)}</div>
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="message-avatar">
          <img src="${escapeHtml(senderAvatar)}" alt="${escapeHtml(senderName)}">
        </div>
        <div class="message-content">
          <div class="message-bubble">${escapeHtml(msg.content)}</div>
          <div class="message-time">${formatMessageTime(msg.createdAt)}</div>
        </div>
      `;
    }

    container.appendChild(div);
  });
}

// Show empty chat state
function showEmptyChatState() {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-chat-state">
      <i class="fi fi-rr-messages"></i>
      <p>Select a conversation to start chatting</p>
      <p class="empty-chat-hint">Or use "+ Add Friend" to start a new conversation</p>
    </div>
  `;
}

// Hide chat input
function hideChatInput() {
  const input = document.getElementById('chatInputContainer');
  if (input) input.style.display = 'none';
}

// Loading states
function renderLoadingState(loading) {
  const list = document.getElementById('messageList');
  if (!list) return;
  if (loading && chatState.conversations.length === 0) {
    list.innerHTML = '<div class="message-list-loading"><i class="fi fi-rr-spinner"></i><p>Loading conversations...</p></div>';
  }
}

function renderMessagesLoading(loading) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  if (loading && chatState.messages.length === 0 && chatState.currentConversationId) {
    container.innerHTML = '<div class="messages-loading"><i class="fi fi-rr-spinner"></i><p>Loading messages...</p></div>';
  }
}

// Send message
async function sendMessage() {
  const input = document.getElementById('chatInput');
  if (!input || !chatState.currentConversationId || !chatState.currentConversation) return;

  const text = input.value.trim();
  if (!text) return;

  if (!API || !API.messages) {
    showToast('API not available', 'error');
    return;
  }

  chatState.isSending = true;
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.disabled = true;

  // Optimistic UI: add message immediately
  const tempMsg = {
    id: 'temp-' + Date.now(),
    content: text,
    createdAt: new Date().toISOString(),
    sender: API.getCurrentUser ? API.getCurrentUser() : { id: getCurrentUserId(), fullName: 'You', avatar: null }
  };
  chatState.messages.push(tempMsg);
  renderMessages(chatState.messages, chatState.currentConversation);
  scrollToBottom();
  input.value = '';

  // Update conversation last message
  const conv = chatState.currentConversation;
  conv.lastMessage = text;
  conv.timeAgo = 'Just now';
  conv.lastMessageTime = new Date();
  renderMessageList();

  try {
    const res = await API.messages.sendMessage(chatState.currentConversationId, text);
    const saved = res.message;
    if (saved) {
      const idx = chatState.messages.findIndex(m => m.id === tempMsg.id);
      if (idx >= 0) {
        chatState.messages[idx] = saved;
        renderMessages(chatState.messages, chatState.currentConversation);
      }
    }
  } catch (err) {
    console.error('Send message error:', err);
    showToast(err.message || 'Failed to send message', 'error');
    chatState.messages = chatState.messages.filter(m => m.id !== tempMsg.id);
    renderMessages(chatState.messages, chatState.currentConversation);
    input.value = text;
  } finally {
    chatState.isSending = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

// Scroll to bottom
function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  if (container) container.scrollTop = container.scrollHeight;
}

async function refreshChatData() {
  if (chatState.isLoading || chatState.isSending) return;
  try {
    await loadConversations({ silent: true });
    if (chatState.currentConversationId) {
      const stillExists = chatState.conversations.some(c => c.id === chatState.currentConversationId);
      if (stillExists) {
        await loadMessages(chatState.currentConversationId, { silent: true });
      }
    }
  } catch (err) {
    console.error('Background chat refresh error:', err);
  }
}

function startChatAutoRefresh() {
  if (chatRefreshTimer) return;
  chatRefreshTimer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    refreshChatData();
  }, CHAT_REFRESH_MS);
}

function stopChatAutoRefresh() {
  if (!chatRefreshTimer) return;
  clearInterval(chatRefreshTimer);
  chatRefreshTimer = null;
}

// Filter conversations (search)
function filterConversations(query) {
  const items = document.querySelectorAll('.message-item');
  const q = (query || '').toLowerCase().trim();

  items.forEach(item => {
    if (item.classList.contains('message-list-empty') || item.classList.contains('message-list-loading')) return;
    const name = (item.querySelector('.message-item-name') || {}).textContent || '';
    const preview = (item.querySelector('.message-item-preview') || {}).textContent || '';
    const role = (item.querySelector('.message-item-role') || {}).textContent || '';
    const match = !q || name.toLowerCase().includes(q) || preview.toLowerCase().includes(q) || role.toLowerCase().includes(q);
    item.style.display = match ? 'flex' : 'none';
  });
}

// Open "Start Chat" modal - search users and start conversation
function openStartChatModal() {
  const overlay = document.createElement('div');
  overlay.className = 'friend-modal-overlay';
  overlay.innerHTML = `
    <div class="friend-modal">
      <div class="friend-modal-header">
        <h3>Start a Chat</h3>
        <button class="friend-modal-close" type="button">
          <i class="fi fi-rr-cross"></i>
        </button>
      </div>
      <div class="friend-modal-content">
        <p>Search for a player or field owner to start chatting:</p>
        <div class="friend-modal-search">
          <i class="fi fi-rr-search friend-modal-search-icon"></i>
          <input type="text" class="friend-modal-search-input" placeholder="Search by name or email..." autocomplete="off">
        </div>
        <div class="friend-modal-list" id="startChatUserList">
          <div class="friend-modal-empty" id="startChatEmpty">
            <i class="fi fi-rr-search-alt"></i>
            <p>Type at least 2 characters to search</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('show'), 10);

  const closeBtn = overlay.querySelector('.friend-modal-close');
  const searchInput = overlay.querySelector('.friend-modal-search-input');
  const listEl = overlay.querySelector('#startChatUserList');
  const emptyEl = overlay.querySelector('#startChatEmpty');

  let searchTimeout;

  function close() {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 300);
  }

  function renderUserResults(users) {
    const currentUserId = getCurrentUserId();
    const excludeIds = [currentUserId, ...chatState.conversations.map(c => c.userId)];

    if (!users || users.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) {
        listEl.appendChild(emptyEl);
        emptyEl.style.display = 'flex';
        emptyEl.querySelector('p').textContent = 'No users found';
      }
      return;
    }

    emptyEl.style.display = 'none';
    listEl.innerHTML = users
      .filter(u => u.id !== currentUserId && String(u.role || '').toUpperCase() !== 'ADMIN')
      .map(user => {
        const isExisting = chatState.conversations.some(c => c.userId === user.id);
        return `
          <div class="friend-modal-item" data-user-id="${escapeHtml(user.id)}">
            <div class="friend-modal-item-avatar">
              <img src="${escapeHtml(getAvatarUrl(user))}" alt="${escapeHtml(user.fullName)}">
            </div>
            <div class="friend-modal-item-info">
              <h4>${escapeHtml(user.fullName || user.email)}</h4>
              <p>${escapeHtml(formatRole(user.role))}</p>
            </div>
            <button class="friend-modal-item-btn start-chat-btn" type="button" data-user-id="${user.id}" data-user-name="${escapeHtml(user.fullName || user.email)}">
              <i class="fi fi-rr-messages"></i>
              ${isExisting ? 'Open Chat' : 'Start Chat'}
            </button>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('.start-chat-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userId;
        const userName = btn.dataset.userName;

        try {
          const res = await API.messages.getConversation(userId);
          const conv = res.conversation;
          const mapped = mapConversation(conv, getCurrentUserId());

          const exists = chatState.conversations.find(c => c.id === conv.id);
          if (!exists) {
            chatState.conversations.unshift(mapped);
          }
          close();
          renderMessageList();
          selectConversation(conv.id);
        } catch (err) {
          console.error('Start chat error:', err);
          showToast(err.message || 'Failed to start chat', 'error');
        }
      });
    });
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    clearTimeout(searchTimeout);

    if (q.length < 2) {
      listEl.innerHTML = '';
      if (emptyEl) {
        listEl.appendChild(emptyEl);
        emptyEl.style.display = 'flex';
        emptyEl.querySelector('p').textContent = 'Type at least 2 characters to search';
      }
      return;
    }

    listEl.innerHTML = '<div class="friend-modal-loading"><i class="fi fi-rr-spinner"></i> Searching...</div>';

    searchTimeout = setTimeout(async () => {
      try {
        const res = await API.users.search(q);
        const users = res.users || [];
        renderUserResults(users);
      } catch (err) {
        console.error('Search users error:', err);
        listEl.innerHTML = '';
        if (emptyEl) {
          listEl.appendChild(emptyEl);
          emptyEl.style.display = 'flex';
          emptyEl.querySelector('p').textContent = 'Search failed. Try again.';
        }
      }
    }, 300);
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });

  searchInput.focus();
}

// Setup event listeners
function setupEventListeners() {
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);

  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  const searchInput = document.getElementById('messageSearch');
  if (searchInput) {
    searchInput.addEventListener('input', e => filterConversations(e.target.value));
  }

  const addFriendBtn = document.getElementById('addFriendBtn');
  if (addFriendBtn) {
    addFriendBtn.addEventListener('click', openStartChatModal);
  }

  // Chat header click - toggle field info sidebar (profile area)
  const chatHeader = document.getElementById('chatHeader');
  if (chatHeader) {
    chatHeader.style.cursor = 'pointer';
    chatHeader.title = 'Click to show field info';
    chatHeader.addEventListener('click', () => {
      const sidebar = document.getElementById('fieldInfoSidebar');
      if (!sidebar) return;
      if (!chatState.currentFieldInfo) {
        showToast('Field info is only available when chatting with a Field Owner', 'info');
        return;
      }
      sidebar.classList.toggle('visible');
    });
  }

  // View Field Page and Book Now buttons
  const viewFieldPageBtn = document.getElementById('viewFieldPageBtn');
  if (viewFieldPageBtn) {
    viewFieldPageBtn.addEventListener('click', () => {
      if (chatState.currentFieldInfo && chatState.currentFieldInfo.field) {
        window.location.href = `field-info.html?id=${chatState.currentFieldInfo.field.id}`;
      } else {
        showToast('No field information available', 'info');
      }
    });
  }
  const bookNowBtn = document.getElementById('bookNowBtn') || document.querySelector('.field-action-btn.primary');
  if (bookNowBtn) {
    bookNowBtn.addEventListener('click', () => {
      if (chatState.currentFieldInfo && chatState.currentFieldInfo.field) {
        window.location.href = `field-info.html?id=${chatState.currentFieldInfo.field.id}`;
      } else {
        showToast('No field information available', 'info');
      }
    });
  }

  // Profile/notification popups (if not in header-user/notifications)
  const profileBtn = document.getElementById('profileBtn');
  const profilePopup = document.getElementById('profilePopup');
  if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', e => {
      e.stopPropagation();
      profilePopup.classList.toggle('active');
      const np = document.getElementById('notificationPopup');
      if (np) np.classList.remove('active');
    });
    document.addEventListener('click', e => {
      if (profilePopup.classList.contains('active') && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('active');
      }
    });
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', function () {
  if (typeof API === 'undefined') {
    console.warn('Chat: API not loaded. Include api.js before chat.js');
    return;
  }

  setupEventListeners();

  // Show placeholder until we have data
  showEmptyChatState();
  hideChatInput();

  loadConversations();
  startChatAutoRefresh();
});

window.addEventListener('beforeunload', stopChatAutoRefresh);
