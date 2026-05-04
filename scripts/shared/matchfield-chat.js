/**
 * MatchField Chat — Socket.IO realtime, attachments, read state, moderation.
 * Set window.MATCHFIELD_CHAT_VARIANT to 'player' or 'owner' before loading.
 */
(function () {
  const VARIANT = window.MATCHFIELD_CHAT_VARIANT === 'owner' ? 'owner' : 'player';

  const chatState = {
    conversations: [],
    currentConversationId: null,
    currentConversation: null,
    messages: [],
    currentFieldInfo: null,
    currentPlayerSummary: null,
    isLoading: false,
    isSending: false,
    hasMoreOlder: false,
    oldestMessageId: null,
    loadingOlder: false,
    pendingFiles: [],
    failedPayload: null
  };

  let chatSocket = null;
  let typingTimer = null;
  const onlineUsers = new Set();
  let emojiPickerEl = null;

  const EMOJI_LIST = [
    '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎',
    '🤔', '😢', '😭', '😡', '👍', '👏', '🙏', '💪',
    '🎉', '🔥', '❤️', '💯', '⚽', '🏟️', '📅', '📍'
  ];

  function getFieldInfoUrl(fieldId) {
    if (!fieldId) return '';
    const q = encodeURIComponent(fieldId);
    return VARIANT === 'owner' ? `../player/field-info.html?id=${q}` : `field-info.html?id=${q}`;
  }

  function hideChatSidebars() {
    ['playerInfoSidebar', 'fieldInfoSidebar'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('visible');
    });
  }

  function getCurrentUserId() {
    const user = typeof API !== 'undefined' && API.getCurrentUser ? API.getCurrentUser() : null;
    return user ? user.id : null;
  }

  function formatRole(role) {
    if (!role) return 'User';
    const map = { PLAYER: 'Player', OWNER: 'Field Owner', ADMIN: 'Admin' };
    return map[role] || role;
  }

  function getAvatarUrl(user, size = 128) {
    if (user && user.avatar) return user.avatar;
    const name = user && user.fullName ? user.fullName : 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=007BFF&color=fff&size=${size}`;
  }

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

  function formatMemberSince(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }

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

  function previewFromConv(conv) {
    const lastMsg = conv.messages && conv.messages[0];
    if (!lastMsg) return 'No messages yet';
    const att = lastMsg.attachments;
    if (att && att.length) return lastMsg.content ? lastMsg.content : '📎 Attachment';
    return lastMsg.content || '';
  }

  function mapConversation(conv, currentUserId) {
    const other = conv.user1Id === currentUserId ? conv.user2 : conv.user1;
    const lastMsg = conv.messages && conv.messages[0];
    const uid = other.id;
    const online = onlineUsers.has(uid);
    return {
      id: conv.id,
      conversationId: conv.id,
      userId: uid,
      name: other.fullName,
      role: formatRole(other.role),
      avatar: getAvatarUrl(other),
      status: online ? 'online' : 'offline',
      lastMessage: previewFromConv(conv),
      lastMessageTime: lastMsg ? lastMsg.createdAt : conv.updatedAt,
      timeAgo: formatTimeAgo(lastMsg ? lastMsg.createdAt : conv.updatedAt),
      otherUser: other,
      unreadCount: typeof conv.unreadCount === 'number' ? conv.unreadCount : 0,
      blockedAt: conv.blockedAt || null,
      starredAt: conv.starredAt || null,
      raw: conv
    };
  }

  function sortConversations(list) {
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) => {
      const aStarred = a && a.starredAt ? 1 : 0;
      const bStarred = b && b.starredAt ? 1 : 0;
      if (aStarred !== bStarred) return bStarred - aStarred;

      const aTime = new Date((a && (a.lastMessageTime || (a.raw && a.raw.updatedAt))) || 0).getTime();
      const bTime = new Date((b && (b.lastMessageTime || (b.raw && b.raw.updatedAt))) || 0).getTime();
      return bTime - aTime;
    });
  }

  function showToast(message, type = 'success') {
    const existing = document.querySelector('.chat-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `chat-toast chat-toast-${type}`;
    toast.innerHTML = `
      <div class="chat-toast-content">
        <i class="fi ${type === 'success' ? 'fi-rr-check' : type === 'info' ? 'fi-rr-info' : 'fi-rr-exclamation'}"></i>
        <span>${escapeHtml(message)}</span>
      </div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function closeEmojiPicker() {
    if (emojiPickerEl && emojiPickerEl.parentNode) {
      emojiPickerEl.parentNode.removeChild(emojiPickerEl);
    }
    emojiPickerEl = null;
  }

  function insertEmojiIntoInput(input, emoji) {
    if (!input) return;
    const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    input.value = `${before}${emoji}${after}`;
    const nextPos = start + emoji.length;
    input.setSelectionRange(nextPos, nextPos);
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function toggleEmojiPicker() {
    const btn = document.getElementById('emojiBtn');
    const input = document.getElementById('chatInput');
    if (!btn || !input) return;
    if (emojiPickerEl) {
      closeEmojiPicker();
      return;
    }

    const picker = document.createElement('div');
    picker.className = 'chat-emoji-picker';
    picker.style.position = 'absolute';
    picker.style.bottom = '56px';
    picker.style.left = '0';
    picker.style.zIndex = '10020';
    picker.style.display = 'grid';
    picker.style.gridTemplateColumns = 'repeat(8, 1fr)';
    picker.style.gap = '6px';
    picker.style.padding = '10px';
    picker.style.background = '#fff';
    picker.style.border = '1px solid #E5E7EB';
    picker.style.borderRadius = '12px';
    picker.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.12)';

    EMOJI_LIST.forEach((emoji) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = emoji;
      b.style.width = '30px';
      b.style.height = '30px';
      b.style.border = 'none';
      b.style.background = 'transparent';
      b.style.borderRadius = '8px';
      b.style.cursor = 'pointer';
      b.style.fontSize = '18px';
      b.addEventListener('mouseenter', () => {
        b.style.background = '#F3F4F6';
      });
      b.addEventListener('mouseleave', () => {
        b.style.background = 'transparent';
      });
      b.addEventListener('click', () => {
        insertEmojiIntoInput(input, emoji);
        closeEmojiPicker();
      });
      picker.appendChild(b);
    });

    const actions = document.querySelector('.chat-input-actions');
    if (!actions) return;
    actions.style.position = 'relative';
    actions.appendChild(picker);
    emojiPickerEl = picker;

    setTimeout(() => {
      document.addEventListener(
        'click',
        function onDocClick(e) {
          if (!emojiPickerEl) {
            document.removeEventListener('click', onDocClick, true);
            return;
          }
          if (emojiPickerEl.contains(e.target) || btn.contains(e.target)) return;
          closeEmojiPicker();
          document.removeEventListener('click', onDocClick, true);
        },
        true
      );
    }, 0);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderAttachmentHtml(msg) {
    const list = msg.attachments;
    if (!list || !list.length) return '';
    return list
      .map((a) => {
        const url = escapeHtml(a.url || '');
        const name = escapeHtml(a.originalName || 'file');
        const isImg = String(a.mimeType || '').indexOf('image/') === 0;
        if (isImg && url) {
          return `<div class="chat-attachment chat-attachment-image"><a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${name}" loading="lazy"/></a></div>`;
        }
        return `<div class="chat-attachment chat-attachment-file"><a href="${url}" target="_blank" rel="noopener"><i class="fi fi-rr-file"></i> ${name}</a></div>`;
      })
      .join('');
  }

  function updateTypingIndicator(text) {
    let el = document.getElementById('chatTypingIndicator');
    if (!el) {
      const wrap = document.querySelector('.chat-conversation-container');
      if (!wrap) return;
      el = document.createElement('div');
      el.id = 'chatTypingIndicator';
      el.className = 'chat-typing-indicator';
      const msgs = document.getElementById('chatMessages');
      if (msgs && msgs.parentNode) msgs.parentNode.insertBefore(el, msgs);
      else wrap.appendChild(el);
    }
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
  }

  function ensureModerationToolbar() {
    const header = document.querySelector('.chat-header');
    if (!header || document.getElementById('chatModerationBar')) return;
    const bar = document.createElement('div');
    bar.id = 'chatModerationBar';
    bar.className = 'chat-moderation-bar';
    bar.innerHTML = `
      <button type="button" class="chat-mod-btn" id="chatStarBtn" title="Star conversation"><i class="fi fi-rr-star"></i></button>
      <button type="button" class="chat-mod-btn" id="chatBlockBtn" title="Block conversation"><i class="fi fi-rr-ban"></i></button>
    `;
    header.appendChild(bar);
    document.getElementById('chatStarBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStar();
    });
    document.getElementById('chatBlockBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBlock();
    });
  }

  function refreshModerationButtons() {
    const conv = chatState.currentConversation;
    const starBtn = document.getElementById('chatStarBtn');
    const blockBtn = document.getElementById('chatBlockBtn');
    if (!starBtn || !blockBtn) return;
    const starred = !!(conv && conv.starredAt);
    const blocked = !!(conv && conv.blockedAt);
    starBtn.classList.toggle('active', starred);
    blockBtn.classList.toggle('active', blocked);
    starBtn.title = starred ? 'Unstar conversation' : 'Star conversation';
    blockBtn.title = blocked ? 'Unblock conversation' : 'Block conversation';
  }

  async function toggleStar() {
    if (!chatState.currentConversationId || !API.messages.setStarred) return;
    const conv = chatState.currentConversation;
    const next = !conv.starredAt;
    try {
      await API.messages.setStarred(chatState.currentConversationId, next);
      conv.starredAt = next ? new Date().toISOString() : null;
      sortConversations(chatState.conversations);
      renderMessageList();
      document.querySelectorAll('.message-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.chatId === chatState.currentConversationId);
      });
      refreshModerationButtons();
      showToast(next ? 'Conversation starred' : 'Star removed', 'success');
    } catch (e) {
      showToast(e.message || 'Failed', 'error');
    }
  }

  async function toggleBlock() {
    if (!chatState.currentConversationId) return;
    const conv = chatState.currentConversation;
    const next = !conv.blockedAt;
    if (!confirm(next ? 'Block this conversation? Sending will be disabled.' : 'Unblock this conversation?')) return;
    try {
      await API.messages.setBlocked(chatState.currentConversationId, next);
      conv.blockedAt = next ? new Date().toISOString() : null;
      applyBlockedUi();
      refreshModerationButtons();
      showToast(next ? 'Conversation blocked' : 'Conversation unblocked', 'success');
    } catch (e) {
      showToast(e.message || 'Failed', 'error');
    }
  }

  function applyBlockedUi() {
    const blocked = !!(chatState.currentConversation && chatState.currentConversation.blockedAt);
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachBtn = document.getElementById('attachBtn');
    if (input) {
      input.disabled = blocked;
      input.placeholder = blocked ? 'This conversation is blocked' : 'Type a message...';
    }
    if (sendBtn) sendBtn.disabled = blocked;
    if (attachBtn) attachBtn.disabled = blocked;
  }

  function getFieldBookNowButton() {
    return (
      document.getElementById('bookNowBtn') ||
      document.querySelector('#fieldInfoSidebar .field-action-btn.primary')
    );
  }

  function applyPlayerSidebarPresence(conv) {
    const statusEl = document.getElementById('playerStatus');
    const dot = document.querySelector('#playerInfoSidebar .player-avatar-large .online-indicator');
    if (!conv) {
      if (statusEl) {
        statusEl.textContent = '—';
        statusEl.classList.remove('player-status--online', 'player-status--offline');
      }
      if (dot) dot.style.display = 'none';
      return;
    }
    const online = conv.status === 'online';
    if (statusEl) {
      statusEl.textContent = online ? 'Online' : 'Offline';
      statusEl.classList.remove('player-status--online', 'player-status--offline');
      statusEl.classList.add(online ? 'player-status--online' : 'player-status--offline');
    }
    if (dot) dot.style.display = online ? '' : 'none';
  }

  function updatePlayerInfoSidebar(conv) {
    if (!conv || !conv.otherUser) return;
    const u = conv.otherUser;
    const nameEl = document.getElementById('playerName');
    const avatarEl = document.getElementById('playerAvatar');
    if (nameEl) nameEl.textContent = u.fullName || conv.name || 'Player';
    if (avatarEl) avatarEl.src = getAvatarUrl(u);
    applyPlayerSidebarPresence(conv);
  }

  /** Owner chat: load booking count, member since, location (requires GET /users/:id for owners). */
  async function enrichPlayerSidebar(conv) {
    if (!conv || VARIANT !== 'owner' || !document.getElementById('playerInfoSidebar')) return;
    const tb = document.getElementById('totalBookings');
    const ms = document.getElementById('memberSince');
    const locEl = document.getElementById('playerLocation');
    if (!API || !API.users || !API.users.getById) {
      if (tb) tb.textContent = '—';
      if (ms) ms.textContent = '—';
      if (locEl) locEl.textContent = '—';
      return;
    }
    try {
      const res = await API.users.getById(conv.userId);
      const u = res.user;
      const sum = res.playerChatSummary || {};
      if (tb) tb.textContent = typeof sum.totalBookings === 'number' ? String(sum.totalBookings) : '—';
      if (ms) ms.textContent = u && u.createdAt ? formatMemberSince(u.createdAt) : '—';
      if (locEl) {
        const loc = u && u.location != null ? String(u.location).trim() : '';
        locEl.textContent = loc || '—';
      }
      if (u) {
        const nameEl = document.getElementById('playerName');
        const avatarEl = document.getElementById('playerAvatar');
        if (nameEl && u.fullName) nameEl.textContent = u.fullName;
        if (avatarEl) avatarEl.src = getAvatarUrl(u);
        applyPlayerSidebarPresence(conv);
      }
    } catch (_) {
      if (tb) tb.textContent = '—';
      if (ms) ms.textContent = '—';
      if (locEl) locEl.textContent = '—';
    }
  }

  function resetPlayerSidebarStats() {
    ['totalBookings', 'memberSince', 'playerLocation'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
    applyPlayerSidebarPresence(null);
  }

  function applyFieldOwnerSidebarPresence(ownerConv) {
    const ownerStatusEl = document.getElementById('fieldOwnerStatus');
    const dot = document.querySelector('#fieldInfoSidebar .field-owner-avatar .online-indicator');
    if (!ownerConv) {
      if (ownerStatusEl) {
        ownerStatusEl.textContent = '—';
        ownerStatusEl.classList.remove('field-owner-status--online', 'field-owner-status--offline');
      }
      if (dot) dot.style.display = 'none';
      return;
    }
    const online = ownerConv.status === 'online';
    if (ownerStatusEl) {
      ownerStatusEl.textContent = online ? 'Online' : 'Offline';
      ownerStatusEl.classList.remove('field-owner-status--online', 'field-owner-status--offline');
      ownerStatusEl.classList.add(online ? 'field-owner-status--online' : 'field-owner-status--offline');
    }
    if (dot) dot.style.display = online ? '' : 'none';
  }

  function updateFieldInfoSidebar(info) {
    if (!info || !info.owner) return;
    const field = info.field;
    const owner = info.owner;
    const ownerNameEl = document.getElementById('fieldOwnerName');
    const ownerAvatarEl = document.getElementById('fieldOwnerAvatar');
    const typeEl = document.getElementById('fieldType');
    const rateEl = document.getElementById('fieldRate');
    const sizeEl = document.getElementById('fieldSize');
    const surfaceEl = document.getElementById('fieldSurface');
    const imgEl = document.getElementById('fieldImage');
    if (ownerNameEl) ownerNameEl.textContent = owner.name;
    if (ownerAvatarEl) ownerAvatarEl.src = owner.avatar;
    applyFieldOwnerSidebarPresence(owner);
    const bookBtn = getFieldBookNowButton();
    if (field) {
      if (imgEl) imgEl.src = (field.images && field.images[0]) || 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&h=300&fit=crop&auto=format';
      if (typeEl) typeEl.textContent = field.sport || field.name || 'Field';
      if (rateEl) rateEl.textContent = field.pricePerHour != null ? `₺${field.pricePerHour}/h` : 'N/A';
      if (sizeEl) {
        const bits = [];
        if (field.type === 'INDOOR') bits.push('Indoor');
        else if (field.type === 'OUTDOOR') bits.push('Outdoor');
        if (field.capacity != null && String(field.capacity).trim() !== '') {
          bits.push(`${field.capacity} players max`);
        }
        sizeEl.textContent = bits.length ? bits.join(' · ') : '—';
      }
      if (surfaceEl) {
        const feats = Array.isArray(field.features) ? field.features.filter(Boolean) : [];
        surfaceEl.textContent = feats.length ? feats.slice(0, 4).join(', ') : '—';
      }
      const viewBtn = document.getElementById('viewFieldPageBtn');
      if (viewBtn) {
        viewBtn.disabled = false;
        viewBtn.style.opacity = '1';
      }
      if (bookBtn) {
        bookBtn.disabled = false;
        bookBtn.style.opacity = '1';
      }
    } else {
      if (imgEl) imgEl.src = 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&h=300&fit=crop&auto=format';
      if (typeEl) typeEl.textContent = '—';
      if (rateEl) rateEl.textContent = '—';
      if (sizeEl) sizeEl.textContent = '—';
      if (surfaceEl) surfaceEl.textContent = '—';
      const viewBtn = document.getElementById('viewFieldPageBtn');
      if (viewBtn) {
        viewBtn.disabled = true;
        viewBtn.style.opacity = '0.6';
      }
      if (bookBtn) {
        bookBtn.disabled = true;
        bookBtn.style.opacity = '0.6';
      }
    }
  }

  async function loadConversations(options = {}) {
    const silent = Boolean(options.silent);
    const skipAutoSelect = Boolean(options.skipAutoSelect);
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
      let mapped = (res.conversations || []).map((c) => mapConversation(c, currentUserId));
      mapped = mapped.filter((c) => String(c.otherUser.role || '').toUpperCase() !== 'ADMIN');
      sortConversations(mapped);
      chatState.conversations = mapped;
      renderMessageList();
      if (chatState.currentConversationId) {
        const still = mapped.some((c) => c.id === chatState.currentConversationId);
        if (!still) {
          chatState.currentConversationId = null;
          chatState.currentConversation = null;
          chatState.messages = [];
          hideChatSidebars();
          showEmptyChatState();
          hideChatInput();
        }
      } else if (mapped.length > 0 && !skipAutoSelect) {
        selectConversation(mapped[0].id);
      } else if (mapped.length === 0) {
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

  async function loadMessagesInitial(conversationId) {
    if (!API || !API.messages) return;
    chatState.isLoading = true;
    renderMessagesLoading(true);
    try {
      const res = await API.messages.getMessages(conversationId, { limit: 50, page: 1 });
      chatState.messages = res.messages || [];
      chatState.hasMoreOlder = !!(res.pagination && res.pagination.hasMoreBefore);
      chatState.oldestMessageId = chatState.messages.length ? chatState.messages[0].id : null;
      renderMessages(chatState.messages, chatState.currentConversation);
      scrollToBottom();
      setupLoadMoreVisibility();
    } catch (err) {
      console.error('Load messages error:', err);
      showToast(err.message || 'Failed to load messages', 'error');
      chatState.messages = [];
      renderMessages([], chatState.currentConversation);
    } finally {
      chatState.isLoading = false;
      renderMessagesLoading(false);
    }
  }

  async function loadOlderMessages() {
    if (!chatState.currentConversationId || !chatState.oldestMessageId || !chatState.hasMoreOlder) return;
    if (chatState.loadingOlder) return;
    chatState.loadingOlder = true;
    const btn = document.getElementById('loadOlderBtn');
    if (btn) btn.disabled = true;
    try {
      const res = await API.messages.getMessages(chatState.currentConversationId, {
        limit: 50,
        before: chatState.oldestMessageId
      });
      const older = res.messages || [];
      chatState.hasMoreOlder = !!(res.pagination && res.pagination.hasMoreBefore);
      const container = document.getElementById('chatMessages');
      const prevHeight = container ? container.scrollHeight : 0;
      chatState.messages = older.concat(chatState.messages);
      if (older.length) chatState.oldestMessageId = chatState.messages[0].id;
      renderMessages(chatState.messages, chatState.currentConversation);
      if (container) {
        container.scrollTop = container.scrollHeight - prevHeight;
      }
    } catch (e) {
      showToast(e.message || 'Failed to load older messages', 'error');
    } finally {
      chatState.loadingOlder = false;
      if (btn) btn.disabled = false;
      setupLoadMoreVisibility();
    }
  }

  function setupLoadMoreVisibility() {
    const btn = document.getElementById('loadOlderBtn');
    if (!btn) return;
    btn.style.display = chatState.hasMoreOlder && chatState.messages.length ? 'inline-flex' : 'none';
  }

  async function selectConversation(conversationId) {
    const conv = chatState.conversations.find((c) => c.id === conversationId);
    if (!conv) return;
    chatState.currentConversationId = conversationId;
    chatState.currentConversation = conv;
    chatState.currentFieldInfo = null;
    chatState.currentPlayerSummary = null;
    resetPlayerSidebarStats();

    const headerInfoClear = document.querySelector('#chatHeader .chat-header-info');
    if (headerInfoClear) headerInfoClear.title = '';
    const headerElClear = document.getElementById('chatHeader');
    if (headerElClear) headerElClear.title = '';
    applyFieldOwnerSidebarPresence(null);

    document.querySelectorAll('.message-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.chatId === conversationId);
    });
    updateChatHeader(conv);
    hideChatSidebars();
    ensureModerationToolbar();
    applyBlockedUi();
    refreshModerationButtons();

    if (chatSocket && chatSocket.connected) {
      chatSocket.emit('conversation:join', { conversationId });
    }
    try {
      await API.messages.markAllRead(conversationId);
      conv.unreadCount = 0;
      renderMessageList();
    } catch (_) {}

    await loadMessagesInitial(conversationId);

    const role = conv.otherUser ? String(conv.otherUser.role || '').toUpperCase() : '';
    const chatHeaderInfo = document.querySelector('#chatHeader .chat-header-info');
    const chatHeader = document.getElementById('chatHeader');
    if (chatHeader) chatHeader.title = '';

    if (VARIANT === 'owner') {
      if (role === 'PLAYER') {
        chatState.currentPlayerSummary = conv;
        updatePlayerInfoSidebar(conv);
        if (chatHeaderInfo) chatHeaderInfo.title = 'Click name or avatar to show player info';
        await enrichPlayerSidebar(conv);
      } else if (role === 'OWNER' && API && API.fields) {
        try {
          const res = await API.fields.getByOwner(conv.userId);
          const fields = res.fields || [];
          const field = fields.length > 0 ? fields[0] : null;
          chatState.currentFieldInfo = { field, owner: conv };
          updateFieldInfoSidebar(chatState.currentFieldInfo);
        } catch (err) {
          chatState.currentFieldInfo = { field: null, owner: conv };
          updateFieldInfoSidebar(chatState.currentFieldInfo);
        }
        if (chatHeaderInfo) chatHeaderInfo.title = 'Click name or avatar to show field info';
      } else if (chatHeaderInfo) {
        chatHeaderInfo.title = '';
      }
    } else {
      if (role === 'OWNER' && API && API.fields) {
        try {
          const res = await API.fields.getByOwner(conv.userId);
          const fields = res.fields || [];
          const field = fields.length > 0 ? fields[0] : null;
          chatState.currentFieldInfo = { field, owner: conv };
          updateFieldInfoSidebar(chatState.currentFieldInfo);
        } catch (err) {
          chatState.currentFieldInfo = { field: null, owner: conv };
          updateFieldInfoSidebar(chatState.currentFieldInfo);
        }
      }
      if (chatHeaderInfo) {
        chatHeaderInfo.title = chatState.currentFieldInfo ? 'Click name or avatar to show field info' : '';
      }
    }

    const inputContainer = document.getElementById('chatInputContainer');
    if (inputContainer) inputContainer.style.display = 'flex';
  }

  function updateChatHeader(conv) {
    const nameEl = document.getElementById('chatUserName');
    const statusEl = document.getElementById('chatUserStatus');
    const avatarImg = document.querySelector('.chat-header .chat-avatar img');
    const dot = document.querySelector('.chat-header .online-indicator');
    if (nameEl) nameEl.textContent = conv.name;
    if (statusEl) statusEl.textContent = conv.status === 'online' ? 'Online' : 'Offline';
    if (avatarImg) avatarImg.src = conv.avatar;
    if (dot) dot.style.display = conv.status === 'online' ? '' : 'none';
  }

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
        </div>`;
      return;
    }
    chatState.conversations.forEach((conv) => {
      const item = document.createElement('div');
      item.className = 'message-item' + (chatState.currentConversationId === conv.id ? ' active' : '');
      item.dataset.chatId = conv.id;
      const unread =
        conv.unreadCount > 0
          ? `<span class="message-unread-badge">${conv.unreadCount > 9 ? '9+' : conv.unreadCount}</span>`
          : '';
      const statusIndicator = conv.status === 'online' ? '<span class="online-indicator"></span>' : '';
      item.innerHTML = `
        <div class="message-item-avatar">
          <img src="${escapeHtml(conv.avatar)}" alt="${escapeHtml(conv.name)}">
          ${statusIndicator}
        </div>
        <div class="message-item-content">
          <div class="message-item-header">
            <span class="message-item-name">${escapeHtml(conv.name)}${unread}</span>
            <span class="message-item-time">${escapeHtml(conv.timeAgo)}</span>
          </div>
          <div class="message-item-preview">${escapeHtml(conv.lastMessage)}</div>
          <div class="message-item-role">${escapeHtml(conv.role)}</div>
        </div>`;
      item.addEventListener('click', () => selectConversation(conv.id));
      list.appendChild(item);
    });
  }

  function renderMessages(messages, conversation) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const currentUserId = getCurrentUserId();
    const wrap = document.createElement('div');
    wrap.className = 'chat-messages-inner';
    messages.forEach((msg) => {
      const isSent = msg.sender && msg.sender.id === currentUserId;
      const senderName = msg.sender ? msg.sender.fullName : 'Unknown';
      const senderAvatar = msg.sender ? getAvatarUrl(msg.sender, 36) : getAvatarUrl({ fullName: 'User' }, 36);
      const div = document.createElement('div');
      div.className = `message ${isSent ? 'sent' : 'received'}`;
      div.dataset.messageId = msg.id || '';
      const bubbleContent =
        (msg.content ? `<div class="message-text">${escapeHtml(msg.content)}</div>` : '') +
        renderAttachmentHtml(msg);
      const readLabel =
        isSent && msg.readAt
          ? `<span class="message-read-receipt"><i class="fi fi-rr-check"></i> Read</span>`
          : '';
      if (isSent) {
        div.innerHTML = `
          <div class="message-content">
            <div class="message-bubble">${bubbleContent}</div>
            <div class="message-meta-row">
              <span class="message-time">${formatMessageTime(msg.createdAt)}</span>
              ${readLabel}
            </div>
          </div>`;
      } else {
        div.innerHTML = `
          <div class="message-avatar">
            <img src="${escapeHtml(senderAvatar)}" alt="${escapeHtml(senderName)}">
          </div>
          <div class="message-content">
            <div class="message-bubble">${bubbleContent}</div>
            <div class="message-time">${formatMessageTime(msg.createdAt)}</div>
          </div>`;
      }
      wrap.appendChild(div);
    });
    container.innerHTML = '';
    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.id = 'loadOlderBtn';
    loadBtn.className = 'load-older-btn';
    loadBtn.textContent = 'Load older messages';
    loadBtn.addEventListener('click', loadOlderMessages);
    container.appendChild(loadBtn);
    container.appendChild(wrap);
    setupLoadMoreVisibility();
    container.onscroll = function () {
      if (container.scrollTop < 40 && chatState.hasMoreOlder) loadOlderMessages();
    };
  }

  function showEmptyChatState() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = `
      <div class="empty-chat-state">
        <i class="fi fi-rr-messages"></i>
        <p>Select a conversation to start chatting</p>
        <p class="empty-chat-hint">Or use "+ Add Friend" to start a new conversation</p>
      </div>`;
  }

  function hideChatInput() {
    const input = document.getElementById('chatInputContainer');
    if (input) input.style.display = 'none';
  }

  function renderLoadingState(loading) {
    const list = document.getElementById('messageList');
    if (!list) return;
    if (loading && chatState.conversations.length === 0) {
      list.innerHTML =
        '<div class="message-list-loading"><i class="fi fi-rr-spinner"></i><p>Loading conversations...</p></div>';
    }
  }

  function renderMessagesLoading(loading) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    if (loading && chatState.messages.length === 0 && chatState.currentConversationId) {
      container.innerHTML =
        '<div class="messages-loading"><i class="fi fi-rr-spinner"></i><p>Loading messages...</p></div>';
    }
  }

  function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    if (container) container.scrollTop = container.scrollHeight;
  }

  function mergeIncomingMessage(msg) {
    if (!msg || !msg.id) return;
    if (chatState.currentConversationId === msg.conversationId) {
      if (!chatState.messages.some((m) => m.id === msg.id)) {
        chatState.messages.push(msg);
        renderMessages(chatState.messages, chatState.currentConversation);
        scrollToBottom();
      }
    }
  }

  function patchConversationAfterMessage(convId, msg) {
    const idx = chatState.conversations.findIndex((c) => c.id === convId);
    if (idx < 0) return;
    const c = chatState.conversations[idx];
    const preview = msg.content || (msg.attachments && msg.attachments.length ? '📎 Attachment' : '');
    c.lastMessage = preview;
    c.lastMessageTime = msg.createdAt;
    c.timeAgo = 'Just now';
    if (msg.sender && msg.sender.id !== getCurrentUserId()) {
      if (chatState.currentConversationId !== convId) {
        c.unreadCount = (c.unreadCount || 0) + 1;
      }
    }
    chatState.conversations.splice(idx, 1);
    chatState.conversations.unshift(c);
    sortConversations(chatState.conversations);
    renderMessageList();
    document.querySelectorAll('.message-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.chatId === chatState.currentConversationId);
    });
  }

  function connectChatSocket() {
    if (typeof io === 'undefined') {
      console.warn('Socket.IO client not loaded');
      return;
    }
    const token = API.getAuthToken();
    if (!token) return;
    const origin = API.getSocketOrigin ? API.getSocketOrigin() : window.location.origin;
    chatSocket = io(origin, { auth: { token }, transports: ['websocket', 'polling'] });

    chatSocket.on('connect', () => {
      if (chatState.currentConversationId) {
        chatSocket.emit('conversation:join', { conversationId: chatState.currentConversationId });
      }
    });

    chatSocket.on('presence:self', (data) => {
      (data.onlineUsers || []).forEach((id) => onlineUsers.add(id));
      refreshPresenceUi();
    });

    chatSocket.on('presence:update', (data) => {
      if (!data || !data.userId) return;
      if (data.online) onlineUsers.add(data.userId);
      else onlineUsers.delete(data.userId);
      refreshPresenceUi();
    });

    chatSocket.on('message:new', (payload) => {
      const msg = payload && payload.message;
      const cid = payload && payload.conversationId;
      if (!msg || !cid) return;
      mergeIncomingMessage({ ...msg, conversationId: cid });
      patchConversationAfterMessage(cid, msg);
      if (typeof window.matchfieldRefreshNotificationBadge === 'function') {
        try {
          window.matchfieldRefreshNotificationBadge();
        } catch (_) {}
      }
    });

    chatSocket.on('conversation:update', () => {
      loadConversations({ silent: true, skipAutoSelect: true });
    });

    chatSocket.on('message:read', (payload) => {
      if (!payload) return;
      const myId = getCurrentUserId();
      const cid = chatState.currentConversationId;
      if (payload.all && payload.readerId && payload.readerId !== myId) {
        if (payload.conversationId === cid) {
          const ra = payload.readAt || new Date().toISOString();
          chatState.messages.forEach((m) => {
            if (m.sender && m.sender.id === myId) m.readAt = ra;
          });
          renderMessages(chatState.messages, chatState.currentConversation);
        }
        return;
      }
      if (
        payload.messageId &&
        payload.readerId &&
        payload.readerId !== myId &&
        payload.conversationId === cid
      ) {
        const msg = chatState.messages.find((m) => m.id === payload.messageId);
        if (msg && msg.sender && msg.sender.id === myId) {
          msg.readAt = payload.readAt || new Date().toISOString();
          renderMessages(chatState.messages, chatState.currentConversation);
        }
      }
    });

    chatSocket.on('typing:start', (data) => {
      if (!data || data.conversationId !== chatState.currentConversationId) return;
      if (data.userId === getCurrentUserId()) return;
      updateTypingIndicator(`${data.fullName || 'Someone'} is typing…`);
    });

    chatSocket.on('typing:stop', (data) => {
      if (!data || data.conversationId !== chatState.currentConversationId) return;
      updateTypingIndicator('');
    });
  }

  function refreshPresenceUi() {
    chatState.conversations.forEach((c) => {
      const uid = c.userId;
      c.status = onlineUsers.has(uid) ? 'online' : 'offline';
    });
    if (chatState.currentConversation) {
      const uid = chatState.currentConversation.userId;
      chatState.currentConversation.status = onlineUsers.has(uid) ? 'online' : 'offline';
      updateChatHeader(chatState.currentConversation);
      if (VARIANT === 'owner' && chatState.currentPlayerSummary) {
        applyPlayerSidebarPresence(chatState.currentConversation);
      }
      if (chatState.currentFieldInfo && chatState.currentFieldInfo.owner && chatState.currentConversation) {
        chatState.currentFieldInfo.owner.status = chatState.currentConversation.status;
        applyFieldOwnerSidebarPresence(chatState.currentFieldInfo.owner);
      }
    }
    renderMessageList();
    document.querySelectorAll('.message-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.chatId === chatState.currentConversationId);
    });
  }

  async function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input || !chatState.currentConversationId || !chatState.currentConversation) return;
    if (chatState.currentConversation.blockedAt) {
      showToast('This conversation is blocked', 'error');
      return;
    }

    const text = input.value.trim();
    const files = chatState.pendingFiles.slice();
    if (!text && !files.length) return;

    if (!API || !API.messages) {
      showToast('API not available', 'error');
      return;
    }

    chatState.isSending = true;
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.disabled = true;

    let attachments = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const up = await API.messages.uploadChatAttachment(files[i]);
        attachments.push({
          url: up.url,
          mimeType: up.mimeType,
          originalName: up.originalName,
          size: up.size
        });
      }
    } catch (upErr) {
      console.error(upErr);
      showToast(upErr.message || 'Upload failed', 'error');
      chatState.isSending = false;
      if (sendBtn) sendBtn.disabled = false;
      return;
    }

    const tempMsg = {
      id: 'temp-' + Date.now(),
      content: text,
      attachments: attachments.length ? attachments : undefined,
      createdAt: new Date().toISOString(),
      sender: API.getCurrentUser ? API.getCurrentUser() : { id: getCurrentUserId(), fullName: 'You', avatar: null }
    };
    chatState.messages.push(tempMsg);
    renderMessages(chatState.messages, chatState.currentConversation);
    scrollToBottom();
    input.value = '';
    chatState.pendingFiles = [];
    renderPendingFiles();

    const conv = chatState.currentConversation;
    conv.lastMessage = text || (attachments.length ? '📎 Attachment' : '');
    conv.timeAgo = 'Just now';
    renderMessageList();

    chatState.failedPayload = { conversationId: chatState.currentConversationId, content: text, attachments };

    try {
      const res = await API.messages.sendMessage(chatState.currentConversationId, {
        content: text,
        attachments: attachments.length ? attachments : undefined
      });
      const saved = res.message;
      if (saved) {
        const idx = chatState.messages.findIndex((m) => m.id === tempMsg.id);
        const existingSavedIdx = chatState.messages.findIndex((m) => m.id === saved.id);
        if (existingSavedIdx >= 0) {
          // Socket echo already inserted the persisted message; remove temp copy.
          if (idx >= 0) {
            chatState.messages.splice(idx, 1);
          }
        } else if (idx >= 0) {
          chatState.messages[idx] = saved;
        } else {
          chatState.messages.push(saved);
        }
        renderMessages(chatState.messages, chatState.currentConversation);
        chatState.failedPayload = null;
      }
    } catch (err) {
      console.error('Send message error:', err);
      showToast(err.message || 'Failed to send message', 'error');
      const idx = chatState.messages.findIndex((m) => m.id === tempMsg.id);
      if (idx >= 0) {
        chatState.messages[idx]._failed = true;
        renderMessages(chatState.messages, chatState.currentConversation);
      }
      input.value = text;
    } finally {
      chatState.isSending = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  function renderPendingFiles() {
    let el = document.getElementById('pendingAttachments');
    if (!el) {
      const container = document.getElementById('chatInputContainer');
      if (!container) return;
      el = document.createElement('div');
      el.id = 'pendingAttachments';
      el.className = 'pending-attachments';
      container.insertBefore(el, container.firstChild);
    }
    if (!chatState.pendingFiles.length) {
      el.innerHTML = '';
      el.style.display = 'none';
      return;
    }
    el.style.display = 'flex';
    el.innerHTML = chatState.pendingFiles
      .map((f, i) => `<span class="pending-file">${escapeHtml(f.name)} <button type="button" data-i="${i}">×</button></span>`)
      .join('');
    el.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i, 10);
        chatState.pendingFiles.splice(i, 1);
        renderPendingFiles();
      });
    });
  }

  function filterConversations(query) {
    const items = document.querySelectorAll('.message-item');
    const q = (query || '').toLowerCase().trim();
    items.forEach((item) => {
      if (item.classList.contains('message-list-empty') || item.classList.contains('message-list-loading')) return;
      const name = (item.querySelector('.message-item-name') || {}).textContent || '';
      const preview = (item.querySelector('.message-item-preview') || {}).textContent || '';
      const role = (item.querySelector('.message-item-role') || {}).textContent || '';
      const match =
        !q ||
        name.toLowerCase().includes(q) ||
        preview.toLowerCase().includes(q) ||
        role.toLowerCase().includes(q);
      item.style.display = match ? 'flex' : 'none';
    });
  }

  function openStartChatModal() {
    const overlay = document.createElement('div');
    overlay.className = 'friend-modal-overlay';
    overlay.innerHTML = `
      <div class="friend-modal">
        <div class="friend-modal-header">
          <h3>Start a Chat</h3>
          <button class="friend-modal-close" type="button"><i class="fi fi-rr-cross"></i></button>
        </div>
        <div class="friend-modal-content">
          <p>Search for a player or field owner to start chatting:</p>
          <div class="friend-modal-search">
            <i class="fi fi-rr-search friend-modal-search-icon"></i>
            <input type="text" class="friend-modal-search-input" placeholder="Search by name or email..." autocomplete="off">
          </div>
          <div class="friend-modal-list" id="startChatUserList">
            <div class="friend-modal-empty" id="startChatEmpty">
              <i class="fi fi-rr-search-alt"></i><p>Type at least 2 characters to search</p>
            </div>
          </div>
        </div>
      </div>`;
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
        .filter((u) => u.id !== getCurrentUserId() && String(u.role || '').toUpperCase() !== 'ADMIN')
        .map((user) => {
          const isExisting = chatState.conversations.some((c) => c.userId === user.id);
          return `
            <div class="friend-modal-item">
              <div class="friend-modal-item-avatar"><img src="${escapeHtml(getAvatarUrl(user))}" alt=""></div>
              <div class="friend-modal-item-info">
                <h4>${escapeHtml(user.fullName || user.email)}</h4>
                <p>${escapeHtml(formatRole(user.role))}</p>
              </div>
              <button class="friend-modal-item-btn start-chat-btn" type="button" data-user-id="${user.id}">
                <i class="fi fi-rr-messages"></i> ${isExisting ? 'Open Chat' : 'Start Chat'}
              </button>
            </div>`;
        })
        .join('');
      listEl.querySelectorAll('.start-chat-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            const res = await API.messages.getConversation(btn.dataset.userId);
            const conv = res.conversation;
            const mapped = mapConversation(
              { ...conv, unreadCount: conv.unreadCount },
              getCurrentUserId()
            );
            if (!chatState.conversations.find((c) => c.id === conv.id)) {
              chatState.conversations.unshift(mapped);
            }
            close();
            renderMessageList();
            selectConversation(conv.id);
          } catch (err) {
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
          renderUserResults(res.users || []);
        } catch (err) {
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
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    searchInput.focus();
  }

  function setupEventListeners() {
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendMessage();
        }
      });
      chatInput.addEventListener('input', () => {
        if (chatSocket && chatState.currentConversationId) {
          chatSocket.emit('typing:start', { conversationId: chatState.currentConversationId });
          clearTimeout(typingTimer);
          typingTimer = setTimeout(() => {
            if (chatSocket && chatState.currentConversationId) {
              chatSocket.emit('typing:stop', { conversationId: chatState.currentConversationId });
            }
          }, 1200);
        }
      });
    }
    const searchInput = document.getElementById('messageSearch');
    if (searchInput) searchInput.addEventListener('input', (e) => filterConversations(e.target.value));
    const addFriendBtn = document.getElementById('addFriendBtn');
    if (addFriendBtn) addFriendBtn.addEventListener('click', openStartChatModal);

    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('chatFileInput');
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files || []);
        fileInput.value = '';
        files.forEach((f) => {
          if (chatState.pendingFiles.length < 5) chatState.pendingFiles.push(f);
        });
        renderPendingFiles();
      });
    }
    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiBtn) {
      emojiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleEmojiPicker();
      });
    }

    const chatHeader = document.getElementById('chatHeader');
    const chatHeaderInfo = document.querySelector('#chatHeader .chat-header-info');
    if (chatHeader && chatHeaderInfo) {
      chatHeader.style.cursor = '';
      chatHeaderInfo.style.cursor = 'pointer';
      chatHeader.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-header-info')) return;
        if (VARIANT === 'owner') {
          const playerSb = document.getElementById('playerInfoSidebar');
          const fieldSb = document.getElementById('fieldInfoSidebar');
          if (chatState.currentPlayerSummary && playerSb) {
            playerSb.classList.toggle('visible');
            return;
          }
          if (chatState.currentFieldInfo && fieldSb) {
            fieldSb.classList.toggle('visible');
            return;
          }
          showToast('Select a conversation to see details', 'info');
        } else {
          const sidebar = document.getElementById('fieldInfoSidebar');
          if (chatState.currentFieldInfo && sidebar) sidebar.classList.toggle('visible');
          else showToast('Field info appears when chatting with a field owner', 'info');
        }
      });
    }

    const viewFieldPageBtn = document.getElementById('viewFieldPageBtn');
    if (viewFieldPageBtn) {
      viewFieldPageBtn.addEventListener('click', () => {
        if (chatState.currentFieldInfo && chatState.currentFieldInfo.field) {
          window.location.href = getFieldInfoUrl(chatState.currentFieldInfo.field.id);
        } else showToast('No field information available', 'info');
      });
    }
    const bookNowBtn = getFieldBookNowButton();
    if (bookNowBtn) {
      bookNowBtn.addEventListener('click', () => {
        if (chatState.currentFieldInfo && chatState.currentFieldInfo.field) {
          window.location.href = getFieldInfoUrl(chatState.currentFieldInfo.field.id);
        } else showToast('No field information available', 'info');
      });
    }

    const fieldAddFriendBtn = document.getElementById('fieldAddFriendBtn');
    if (fieldAddFriendBtn) {
      fieldAddFriendBtn.addEventListener('click', () => {
        showToast('Friend list is not connected yet.', 'info');
      });
    }

    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    if (profileBtn && profilePopup) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profilePopup.classList.toggle('active');
        const np = document.getElementById('notificationPopup');
        if (np) np.classList.remove('active');
      });
      document.addEventListener('click', (e) => {
        if (
          profilePopup.classList.contains('active') &&
          !profilePopup.contains(e.target) &&
          !profileBtn.contains(e.target)
        ) {
          profilePopup.classList.remove('active');
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof API === 'undefined') {
      console.warn('Chat: API not loaded');
      return;
    }
    const fileInputHtml = document.getElementById('chatFileInput');
    if (!fileInputHtml) {
      const container = document.getElementById('chatInputContainer');
      if (container) {
        const fi = document.createElement('input');
        fi.type = 'file';
        fi.id = 'chatFileInput';
        fi.accept = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';
        fi.style.display = 'none';
        fi.multiple = true;
        container.appendChild(fi);
      }
    }
    setupEventListeners();
    showEmptyChatState();
    hideChatInput();
    connectChatSocket();
    loadConversations({ skipAutoSelect: false });
  });
})();
