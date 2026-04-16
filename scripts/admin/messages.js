// Admin Support Inbox (shared across admins)

let notificationBtn, notificationPopup, profileBtn, profilePopup;
let messageSearch, statusFilter, messagesList;
let messageModal, closeMessageModalBtn, messageContent;
let spamBlockedBtn;

let allThreads = [];
let isViewingSpam = false;

function escapeHtml(text) {
  if (text == null) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function getTimeAgo(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'Minute' : 'Minutes'} Ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'Hour' : 'Hours'} Ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'} Ago`;
  return d.toLocaleDateString();
}

function mapConversationToThread(conv, currentUser) {
  const latest = (conv.messages && conv.messages[0]) || null;
  const blocked = !!conv.blockedAt;
  const starred = !!conv.starredAt;
  const meId = currentUser && currentUser.id ? String(currentUser.id) : '';
  const otherUser = meId && conv.user1 && String(conv.user1.id) === meId ? conv.user2 : conv.user1;
  const otherName = otherUser ? (otherUser.fullName || otherUser.email || 'User') : 'User';
  const otherEmail = otherUser ? (otherUser.email || '') : '';
  const isFromUser = latest && latest.sender && meId && String(latest.sender.id) !== meId;
  const isUnread = !!(isFromUser && latest && !latest.readAt);
  return {
    id: conv.id, // use conversationId as stable id
    conversationId: conv.id,
    latestMessageId: latest ? latest.id : null,
    fullName: otherName,
    email: otherEmail,
    topic: latest ? (String(latest.content).slice(0, 60) + (String(latest.content).length > 60 ? '...' : '')) : 'Conversation',
    message: latest ? latest.content : 'No messages yet.',
    date: latest ? latest.createdAt : conv.updatedAt,
    status: isUnread ? 'unread' : 'read',
    starred,
    blocked
  };
}

function renderThreads(threads) {
  if (!messagesList) return;
  const list = Array.isArray(threads) ? threads : [];
  const shown = list.filter((t) => (isViewingSpam ? t.blocked : !t.blocked));

  if (shown.length === 0) {
    messagesList.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #6B7280;">
        <p style="font-size: 16px; margin: 0;">No messages found.</p>
      </div>
    `;
    return;
  }

  messagesList.innerHTML = shown.map((t) => {
    const isUnread = t.status === 'unread';
    const timeAgo = getTimeAgo(t.date);
    const badges = [];
    if (t.status === 'unread') badges.push({ text: 'Unread', class: 'unread' });
    else badges.push({ text: 'Read', class: 'read' });
    if (t.starred) badges.push({ text: '(marked)', class: 'marked' });
    const badgesHtml = badges.length > 0 ? `
      <div class="message-badges">
        ${badges.map(b => `<span class="status-badge ${b.class}">${b.text}</span>`).join('')}
      </div>` : '';

    return `
      <div class="message-card ${isUnread ? 'unread' : ''}">
        <div class="message-card-content">
          <div class="message-sender-info">
            <h3 class="message-sender-name">${escapeHtml(t.fullName)}</h3>
            <p class="message-sender-email">${escapeHtml(t.email)}</p>
          </div>
          <h4 class="message-subject">${escapeHtml(t.topic || 'No topic')}</h4>
          <p class="message-preview">${escapeHtml(t.message)}</p>
          ${badgesHtml}
        </div>
        <div class="message-actions-right">
          <div class="message-icon-actions">
            <button class="message-icon-btn ${t.starred ? 'starred' : ''}" onclick="toggleStar('${escapeHtml(t.id)}')" title="${t.starred ? 'Unstar' : 'Star'}">
              <i class="fi ${t.starred ? 'fi-sr-star' : 'fi-rr-star'}"></i>
            </button>
            <button class="message-icon-btn ${t.blocked ? 'unblock-btn' : ''}" onclick="toggleBlock('${escapeHtml(t.id)}')" title="${t.blocked ? 'Unblock (move to normal)' : 'Block/Spam'}">
              <i class="fi ${t.blocked ? 'fi-rr-check-circle' : 'fi-rr-circle-xmark'}"></i>
            </button>
          </div>
          <p class="message-time">${escapeHtml(timeAgo)}</p>
          <button class="btn-view-message" onclick="showMessageDetail('${escapeHtml(t.id)}')">View Message</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterThreads() {
  const term = messageSearch ? String(messageSearch.value || '').toLowerCase().trim() : '';
  const selectedStatus = statusFilter ? String(statusFilter.value || 'all') : 'all';
  const filtered = allThreads.filter((t) => {
    if (term) {
      const hay = `${t.fullName} ${t.email} ${t.topic} ${t.message}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    if (selectedStatus !== 'all') {
      if (t.status !== selectedStatus) return false;
    }
    return true;
  });
  renderThreads(filtered);
}

async function loadSupportInbox() {
  if (!messagesList) return;
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) loadingIndicator.textContent = 'Loading messages from server...';

  try {
    if (!window.API || !API.admin || !API.admin.supportGetConversations) {
      throw new Error('API not available.');
    }

    let currentUser = API.getCurrentUser && API.getCurrentUser();
    if (!currentUser && API.auth && API.auth.getCurrentUser) {
      try {
        const me = await API.auth.getCurrentUser();
        if (me && me.user) {
          currentUser = me.user;
          if (API.setCurrentUser) API.setCurrentUser(currentUser);
        }
      } catch (_) {}
    }

    const res = await API.admin.supportGetConversations({ limit: 200 });
    const conversations = (res && res.conversations) ? res.conversations : [];
    allThreads = conversations.map((c) => mapConversationToThread(c, currentUser));
    allThreads.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    filterThreads();
  } catch (e) {
    console.error('Load support inbox error:', e);
    messagesList.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#DC2626"><p style="margin:0">${escapeHtml(e && e.message ? e.message : 'Failed to load messages')}</p></div>`;
  } finally {
    const li = document.getElementById('loadingIndicator');
    if (li) li.remove();
  }
}

async function toggleStar(threadId) {
  const t = allThreads.find((x) => String(x.id) === String(threadId));
  if (!t) return;
  const next = !t.starred;
  try {
    await API.admin.supportSetStarred(t.conversationId, next);
    t.starred = next;
    filterThreads();
  } catch (e) {
    alert(e && e.message ? e.message : 'Failed to update star.');
  }
}

async function toggleBlock(threadId) {
  const t = allThreads.find((x) => String(x.id) === String(threadId));
  if (!t) return;
  const next = !t.blocked;
  const ok = confirm(next ? `Block/Spam message from ${t.fullName}?` : `Unblock this message from ${t.fullName}?`);
  if (!ok) return;
  try {
    await API.admin.supportSetBlocked(t.conversationId, next);
    t.blocked = next;
    filterThreads();
  } catch (e) {
    alert(e && e.message ? e.message : 'Failed to update block status.');
  }
}

async function showMessageDetail(threadId) {
  const t = allThreads.find((x) => String(x.id) === String(threadId));
  if (!t || !messageContent || !messageModal) return;

  // mark latest as read (best effort)
  if (t.status === 'unread' && t.latestMessageId) {
    t.status = 'read';
    filterThreads();
    try {
      await API.admin.supportMarkAsRead(t.conversationId, t.latestMessageId);
    } catch (_) {}
  }

  const initials = String(t.fullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  messageContent.innerHTML = `
    <div class="message-detail-header">
      <div class="message-detail-avatar">${escapeHtml(initials)}</div>
      <div class="message-detail-info">
        <h3 class="message-detail-name">${escapeHtml(t.fullName)}</h3>
        <p class="message-detail-email">${escapeHtml(t.email)}</p>
      </div>
    </div>
    <div class="message-detail-thread-loading"><i class="fi fi-rr-spinner"></i> Loading full conversation...</div>
    <div class="message-detail-thread" id="messageDetailThread" style="display:none;"></div>
  `;
  messageModal.classList.add('active');
  document.body.style.overflow = 'hidden';

  try {
    const res = await API.admin.supportGetMessages(t.conversationId, { page: 1, limit: 200 });
    const msgs = (res && res.messages) ? res.messages : [];
    const threadEl = document.getElementById('messageDetailThread');
    const loadingEl = messageContent.querySelector('.message-detail-thread-loading');
    if (loadingEl) loadingEl.remove();
    if (!threadEl) return;
    if (msgs.length === 0) {
      threadEl.innerHTML = '<div class="message-detail-empty">No messages in this conversation.</div>';
    } else {
      const me = API.getCurrentUser ? API.getCurrentUser() : null;
      const meId = me && me.id ? String(me.id) : '';
      const threadHtml = msgs.map((m) => {
        const isFromAdmin = meId && m.sender && String(m.sender.id) === meId;
        const senderName = m.sender ? (m.sender.fullName || 'Unknown') : 'Unknown';
        const timeStr = m.createdAt ? getTimeAgo(m.createdAt) : '';
        return `
          <div class="message-detail-item ${isFromAdmin ? 'from-admin' : 'from-user'}">
            <div class="message-detail-item-header">${escapeHtml(senderName)} · ${escapeHtml(timeStr)}</div>
            <div class="message-detail-item-text">${escapeHtml(m.content)}</div>
          </div>
        `;
      }).join('');
      threadEl.innerHTML = '<div class="message-detail-thread-label">Full conversation history</div>' + threadHtml;
    }
    threadEl.style.display = 'block';
  } catch (e) {
    console.warn('Could not load full conversation:', e);
    const threadEl = document.getElementById('messageDetailThread');
    const loadingEl = messageContent.querySelector('.message-detail-thread-loading');
    if (loadingEl) loadingEl.remove();
    if (threadEl) {
      threadEl.innerHTML = '<div class="message-detail-empty">Could not load full conversation.</div>';
      threadEl.style.display = 'block';
    }
  }

  // Reply UI
  const replyDiv = document.createElement('div');
  replyDiv.innerHTML = `
    <div class="reply-section">
      <h4 class="reply-section-title">Reply to ${escapeHtml(t.fullName)}</h4>
      <form class="reply-form" id="replyForm${escapeHtml(t.id)}" onsubmit="handleReplySubmit(event, '${escapeHtml(t.id)}')">
        <div class="reply-form-group">
          <label for="replyMessage${escapeHtml(t.id)}" class="reply-label">Your Reply</label>
          <textarea id="replyMessage${escapeHtml(t.id)}" class="reply-textarea" rows="6" placeholder="Type your reply here..." required></textarea>
        </div>
        <div class="reply-form-actions">
          <button type="button" class="btn-cancel-reply" onclick="cancelReply('${escapeHtml(t.id)}')">Cancel</button>
          <button type="submit" class="btn-send-reply"><i class="fi fi-rr-paper-plane"></i> Send Reply</button>
        </div>
      </form>
    </div>
    <div class="message-detail-actions">
      <button class="btn-reply-toggle" onclick="toggleReplySection('${escapeHtml(t.id)}')"><i class="fi fi-rr-envelope"></i> Reply</button>
    </div>
  `;
  while (replyDiv.firstChild) messageContent.appendChild(replyDiv.firstChild);
}

function toggleReplySection(threadId) {
  const form = document.getElementById(`replyForm${threadId}`);
  if (!form) return;
  const replySection = form.closest('.reply-section');
  if (!replySection) return;
  replySection.classList.toggle('active');
  if (replySection.classList.contains('active')) {
    const ta = document.getElementById(`replyMessage${threadId}`);
    if (ta) ta.focus();
  }
}

function cancelReply(threadId) {
  const form = document.getElementById(`replyForm${threadId}`);
  if (!form) return;
  const replySection = form.closest('.reply-section');
  if (replySection) replySection.classList.remove('active');
  const ta = document.getElementById(`replyMessage${threadId}`);
  if (ta) ta.value = '';
}

async function handleReplySubmit(event, threadId) {
  event.preventDefault();
  const t = allThreads.find((x) => String(x.id) === String(threadId));
  if (!t) return;
  const ta = document.getElementById(`replyMessage${threadId}`);
  const text = ta ? String(ta.value || '').trim() : '';
  if (!text) return alert('Please enter a reply message.');

  const submitBtn = document.querySelector(`#replyForm${CSS.escape(threadId)} .btn-send-reply`);
  const originalHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Sending...';
  }
  try {
    await API.admin.supportSendMessage(t.conversationId, text);
    closeMessageModal();
    await loadSupportInbox();
    alert('Reply sent. The user will see it in their notifications.');
  } catch (e) {
    alert(e && e.message ? e.message : 'Failed to send reply.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml || '<i class="fi fi-rr-paper-plane"></i> Send Reply';
    }
  }
}

function closeMessageModal() {
  if (messageModal) {
    messageModal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function setupNotificationAndProfile() {
  if (notificationBtn && notificationPopup) {
    notificationBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationPopup.classList.toggle('active');
      if (profilePopup) profilePopup.classList.remove('active');
    });
  }
  if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profilePopup.classList.toggle('active');
      if (notificationPopup) notificationPopup.classList.remove('active');
    });
  }
  document.addEventListener('click', (e) => {
    if (notificationPopup && !notificationPopup.contains(e.target) && notificationBtn && !notificationBtn.contains(e.target)) {
      notificationPopup.classList.remove('active');
    }
    if (profilePopup && !profilePopup.contains(e.target) && profileBtn && !profileBtn.contains(e.target)) {
      profilePopup.classList.remove('active');
    }
  });
}

function setupModalHandlers() {
  if (closeMessageModalBtn && messageModal) {
    closeMessageModalBtn.addEventListener('click', closeMessageModal);
    messageModal.addEventListener('click', (e) => {
      if (e.target === messageModal) closeMessageModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && messageModal.classList.contains('active')) closeMessageModal();
    });
  }
}

function setupSearchAndFilter() {
  if (messageSearch) messageSearch.addEventListener('input', filterThreads);
  if (statusFilter) statusFilter.addEventListener('change', filterThreads);
  if (spamBlockedBtn) {
    spamBlockedBtn.addEventListener('click', () => {
      isViewingSpam = !isViewingSpam;
      spamBlockedBtn.classList.toggle('active', isViewingSpam);
      filterThreads();
    });
  }
}

function initialize() {
  notificationBtn = document.getElementById('notificationBtn');
  notificationPopup = document.getElementById('notificationPopup');
  profileBtn = document.getElementById('profileBtn');
  profilePopup = document.getElementById('profilePopup');
  messageSearch = document.getElementById('messageSearch');
  statusFilter = document.getElementById('statusFilter');
  messagesList = document.getElementById('messagesList');
  messageModal = document.getElementById('messageModal');
  closeMessageModalBtn = document.getElementById('closeMessageModal');
  messageContent = document.getElementById('messageContent');
  spamBlockedBtn = document.getElementById('spamBlockedBtn');

  setupNotificationAndProfile();
  setupModalHandlers();
  setupSearchAndFilter();
  loadSupportInbox();
}

// Expose for onclick handlers
window.toggleStar = toggleStar;
window.toggleBlock = toggleBlock;
window.showMessageDetail = showMessageDetail;
window.closeMessageModal = closeMessageModal;
window.handleReplySubmit = handleReplySubmit;
window.cancelReply = cancelReply;
window.toggleReplySection = toggleReplySection;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

