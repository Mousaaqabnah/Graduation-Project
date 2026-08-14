// Admin Support Inbox (shared across admins)

let profileBtn, profilePopup;
let messageSearch, statusFilter, messagesList;
let messageModal, closeMessageModalBtn, messageContent;
let spamBlockedBtn;

let allThreads = [];
let isViewingSpam = false;
let conversationTake = 80;
let submissionTake = 80;
let inboxPollTimer = null;

function escapeHtml(text) {
  if (text == null) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function mfT(key, params) {
  return (window.MatchFieldI18n && typeof MatchFieldI18n.t === 'function')
    ? MatchFieldI18n.t(key, params)
    : String(key);
}

function parseContactFormContent(rawText, fallback) {
  const raw = String(rawText || '');
  const result = {
    topic: (fallback && fallback.topic) || '',
    message: raw,
    phone: (fallback && fallback.phone) || '',
    email: (fallback && fallback.email) || '',
    name: (fallback && fallback.fullName) || ''
  };

  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const messageLines = [];

  lines.forEach((line) => {
    const topicMatch = /^Topic:\s*(.+)$/i.exec(line);
    const phoneMatch = /^Phone:\s*(.+)$/i.exec(line);
    const fromMatch = /^From:\s*(.+?)(?:\s*<([^>]+)>)?\s*(?:\(via Contact form\))?$/i.exec(line);

    if (topicMatch) {
      result.topic = topicMatch[1].trim();
      return;
    }
    if (phoneMatch) {
      result.phone = phoneMatch[1].trim();
      return;
    }
    if (fromMatch) {
      result.name = fromMatch[1].trim();
      if (fromMatch[2]) result.email = fromMatch[2].trim();
      return;
    }
    messageLines.push(line);
  });

  if (messageLines.length) result.message = messageLines.join('\n\n');
  return result;
}

function looksLikeContactFormContent(rawText) {
  const raw = String(rawText || '');
  return /(^|\n)Topic:/i.test(raw) || /(^|\n)Phone:/i.test(raw) || /\(via Contact form\)/i.test(raw);
}

function renderContactMessageCard(rawText, fallback) {
  const data = parseContactFormContent(rawText, fallback || {});

  return `
    <div class="contact-message-card">
      ${data.topic ? `
        <div class="contact-message-topic">
          <span class="contact-message-label">${mfT('admin.topic')}</span>
          <strong>${escapeHtml(data.topic)}</strong>
        </div>
      ` : ''}
      <div class="contact-message-main">
        <span class="contact-message-label">${mfT('admin.message')}</span>
        <p>${escapeHtml(data.message || mfT('admin.noMessage'))}</p>
      </div>
    </div>
  `;
}

function getTimeAgo(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return mfT('common.justNow');
  if (diffMins < 60) return diffMins === 1 ? mfT('common.minuteAgo') : mfT('common.minutesAgo', { count: diffMins });
  if (diffHours < 24) return diffHours === 1 ? mfT('common.hourAgo') : mfT('common.hoursAgo', { count: diffHours });
  if (diffDays < 7) return diffDays === 1 ? mfT('common.dayAgo') : mfT('common.daysAgo', { count: diffDays });
  return d.toLocaleDateString();
}

function mapConversationToThread(conv, currentUser) {
  const latest = (conv.messages && conv.messages[0]) || null;
  const blocked = !!conv.blockedAt;
  const starred = !!conv.starredAt;
  const meId = currentUser && currentUser.id ? String(currentUser.id) : '';
  const otherUser = meId && conv.user1 && String(conv.user1.id) === meId ? conv.user2 : conv.user1;
  const otherName = otherUser ? (otherUser.fullName || otherUser.email || mfT('common.user')) : mfT('common.user');
  const otherEmail = otherUser ? (otherUser.email || '') : '';
  const isFromUser = latest && latest.sender && meId && String(latest.sender.id) !== meId;
  const isUnread = !!(isFromUser && latest && !latest.readAt);
  const latestFromAdmin = !!(latest && meId && latest.sender && String(latest.sender.id) === meId);
  const workflowStatus = latestFromAdmin ? 'replied' : 'pending';
  return {
    id: conv.id, // use conversationId as stable id
    conversationId: conv.id,
    replyElSuffix: `c${conv.id}`,
    isContactSubmission: false,
    latestMessageId: latest ? latest.id : null,
    fullName: otherName,
    email: otherEmail,
    topic: latest ? (String(latest.content).slice(0, 60) + (String(latest.content).length > 60 ? '...' : '')) : mfT('admin.conversation'),
    message: latest ? latest.content : mfT('admin.noMessages'),
    messagePreview: latest
      ? String(latest.content).slice(0, 220) + (String(latest.content).length > 220 ? '…' : '')
      : mfT('admin.noMessages'),
    date: latest ? latest.createdAt : conv.updatedAt,
    status: isUnread ? 'unread' : 'read',
    workflowStatus,
    starred,
    blocked
  };
}

function mapSubmissionToThread(sub) {
  const sid = String(sub.id);
  const date = sub.createdAt || sub.created_at;
  const rawTopic = sub.topic ? String(sub.topic) : mfT('admin.contactForm');
  const topicLine = rawTopic.length > 72 ? `${rawTopic.slice(0, 72)}…` : rawTopic;
  const rawMsg = sub.message || '';
  const seen = !!(sub.adminSeenAt);
  return {
    id: `submission:${sid}`,
    conversationId: `submission:${sid}`,
    replyElSuffix: `s${sid}`,
    isContactSubmission: true,
    submissionMongoId: sid,
    latestMessageId: null,
    fullName: sub.fullName || mfT('common.user'),
    email: sub.email || '',
    topic: topicLine,
    message: rawMsg,
    messagePreview: rawMsg.length > 220 ? `${rawMsg.slice(0, 220)}…` : rawMsg,
    phone: sub.phone || '',
    date,
    status: seen ? 'read' : 'unread',
    workflowStatus: seen ? 'replied' : 'pending',
    starred: false,
    blocked: false
  };
}

function renderThreads(threads) {
  if (!messagesList) return;
  const list = Array.isArray(threads) ? threads : [];
  const shown = list.filter((t) => (isViewingSpam ? t.blocked : !t.blocked));

  if (shown.length === 0) {
    messagesList.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #6B7280;">
        <p style="font-size: 16px; margin: 0;">${mfT('admin.noMessagesFound')}</p>
      </div>
    `;
    return;
  }

  messagesList.innerHTML = shown.map((t) => {
    const isUnread = t.status === 'unread';
    const timeAgo = getTimeAgo(t.date);
    const badges = [];
    if (t.status === 'unread') badges.push({ text: mfT('status.UNREAD'), class: 'unread' });
    else badges.push({ text: mfT('status.READ'), class: 'read' });
    if (!t.isContactSubmission && t.workflowStatus === 'pending' && t.status === 'unread') {
      badges.push({ text: mfT('admin.needsReply'), class: 'marked' });
    }
    if (!t.isContactSubmission && t.workflowStatus === 'replied') {
      badges.push({ text: mfT('admin.youReplied'), class: 'read' });
    }
    if (t.starred) badges.push({ text: mfT('admin.marked'), class: 'marked' });
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
          <h4 class="message-subject">${escapeHtml(t.topic || mfT('admin.noTopic'))}</h4>
          <p class="message-preview">${escapeHtml(t.messagePreview != null ? t.messagePreview : t.message)}</p>
          ${badgesHtml}
        </div>
        <div class="message-actions-right">
          <div class="message-icon-actions">
            ${t.isContactSubmission ? `<span class="status-badge unread" title="${mfT('admin.fromContactForm')}">${mfT('admin.contactForm')}</span>` : `
            <button class="message-icon-btn ${t.starred ? 'starred' : ''}" onclick="toggleStar('${escapeHtml(t.id)}')" title="${t.starred ? mfT('admin.unstar') : mfT('admin.star')}">
              <i class="fi ${t.starred ? 'fi-sr-star' : 'fi-rr-star'}"></i>
            </button>
            <button class="message-icon-btn ${t.blocked ? 'unblock-btn' : ''}" onclick="toggleBlock('${escapeHtml(t.id)}')" title="${t.blocked ? mfT('admin.unblockMove') : mfT('admin.blockSpam')}">
              <i class="fi ${t.blocked ? 'fi-rr-check-circle' : 'fi-rr-circle-xmark'}"></i>
            </button>
            `}
          </div>
          <p class="message-time">${escapeHtml(timeAgo)}</p>
          <button class="btn-view-message" onclick="showMessageDetail('${escapeHtml(t.id)}')">${mfT('admin.viewMessage')}</button>
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
      if (selectedStatus === 'pending' && t.workflowStatus !== 'pending') return false;
      if (selectedStatus === 'replied' && t.workflowStatus !== 'replied') return false;
      if (selectedStatus === 'starred' && !t.starred) return false;
      if (
        (selectedStatus === 'unread' || selectedStatus === 'read') &&
        t.status !== selectedStatus
      ) {
        return false;
      }
    }
    return true;
  });
  renderThreads(filtered);
}

async function loadSupportInbox(opts) {
  if (!messagesList) return;
  const silent = Boolean(opts && opts.silent);
  const loadingIndicator = document.getElementById('loadingIndicator');

  if (!silent) {
    if (loadingIndicator) {
      loadingIndicator.style.display = 'block';
      loadingIndicator.textContent = mfT('admin.loadingMessages');
    }
  }

  try {
    if (!window.API || !API.admin || !API.admin.supportGetConversations) {
      throw new Error(mfT('common.apiUnavailable'));
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

    const res = await API.admin.supportGetConversations({
      conversationTake,
      submissionTake
    });
    const conversations = (res && res.conversations) ? res.conversations : [];
    const backlog = (res && res.submissionBacklog) ? res.submissionBacklog : [];
    const convThreads = conversations.map((c) => mapConversationToThread(c, currentUser));
    const subThreads = backlog.map((s) => mapSubmissionToThread(s));
    allThreads = [...subThreads, ...convThreads];
    allThreads.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    filterThreads();
  } catch (e) {
    console.error('Load support inbox error:', e);
    if (!silent) {
      messagesList.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#DC2626"><p style="margin:0">${escapeHtml((window.MatchFieldI18n && MatchFieldI18n.localizeError(e && e.message)) || mfT('admin.loadMessagesFailed'))}</p></div>`;
    }
  } finally {
    if (!silent) {
      const li = document.getElementById('loadingIndicator');
      if (li) li.remove();
    }
  }
}

async function autoMarkSubmissionSeenWhenViewed(t) {
  if (!t.isContactSubmission || t.status !== 'unread') return;
  if (!window.API || !API.admin || !API.admin.supportMarkSubmissionSeen) return;
  try {
    await API.admin.supportMarkSubmissionSeen(t.submissionMongoId);
    t.status = 'read';
    t.workflowStatus = 'replied';
    filterThreads();
  } catch (_) {
    /* leave unread if the request fails */
  }
}

async function toggleStar(threadId) {
  const t = allThreads.find((x) => String(x.id) === String(threadId));
  if (!t || t.isContactSubmission) return;
  const next = !t.starred;
  try {
    await API.admin.supportSetStarred(t.conversationId, next);
    t.starred = next;
    filterThreads();
  } catch (e) {
    alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(e && e.message)) || mfT('admin.starFailed'));
  }
}

async function toggleBlock(threadId) {
  const t = allThreads.find((x) => String(x.id) === String(threadId));
  if (!t || t.isContactSubmission) return;
  const next = !t.blocked;
  const ok = await MatchFieldDialog.confirm(
    next ? mfT('admin.blockConfirm', { name: t.fullName }) : mfT('admin.unblockConfirm', { name: t.fullName }),
    { type: next ? 'danger' : 'warning', okText: next ? mfT('admin.block') : mfT('admin.unblock') }
  );
  if (!ok) return;
  try {
    await API.admin.supportSetBlocked(t.conversationId, next);
    t.blocked = next;
    filterThreads();
  } catch (e) {
    alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(e && e.message)) || mfT('admin.blockFailed'));
  }
}

function appendReplyFormToMessageModal(t) {
  const suf = escapeHtml(t.replyElSuffix);
  const tid = escapeHtml(t.id);
  const replyDiv = document.createElement('div');
  replyDiv.innerHTML = `
    <div class="reply-section">
      <h4 class="reply-section-title">${mfT('admin.replyTo', { name: escapeHtml(t.fullName) })}</h4>
      <form class="reply-form" id="replyForm-${suf}" onsubmit="handleReplySubmit(event, '${tid}')">
        <div class="reply-form-group">
          <label for="replyMessage-${suf}" class="reply-label">${mfT('admin.yourReply')}</label>
          <textarea id="replyMessage-${suf}" class="reply-textarea" rows="6" placeholder="${mfT('admin.typeReply')}" required></textarea>
        </div>
        <div class="reply-form-actions">
          <button type="button" class="btn-cancel-reply" onclick="cancelReply('${tid}')">${mfT('common.cancel')}</button>
          <button type="submit" class="btn-send-reply"><i class="fi fi-rr-paper-plane"></i> ${mfT('admin.sendReply')}</button>
        </div>
      </form>
    </div>
    <div class="message-detail-actions">
      <button class="btn-reply-toggle" onclick="toggleReplySection('${tid}')"><i class="fi fi-rr-envelope"></i> ${mfT('admin.reply')}</button>
    </div>
  `;
  while (replyDiv.firstChild) messageContent.appendChild(replyDiv.firstChild);
}

async function showMessageDetail(threadId) {
  const t = allThreads.find((x) => String(x.id) === String(threadId));
  if (!t || !messageContent || !messageModal) return;

  if (!t.isContactSubmission && t.status === 'unread' && t.latestMessageId) {
    const prevStatus = t.status;
    t.status = 'read';
    filterThreads();
    try {
      await API.admin.supportMarkAsRead(t.conversationId, t.latestMessageId);
    } catch (err) {
      t.status = prevStatus;
      filterThreads();
      console.warn('Admin inbox: mark as read failed', err);
      alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || mfT('admin.markReadFailed'));
    }
  }

  const initials = String(t.fullName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  messageModal.classList.add('active');
  document.body.style.overflow = 'hidden';

  if (t.isContactSubmission) {
    await autoMarkSubmissionSeenWhenViewed(t);
    const timeStr = t.date ? getTimeAgo(t.date) : '';
    messageContent.innerHTML = `
      <div class="message-detail-header">
        <div class="message-detail-avatar">${escapeHtml(initials)}</div>
        <div class="message-detail-info">
          <h3 class="message-detail-name">${escapeHtml(t.fullName)}</h3>
          <p class="message-detail-email">${escapeHtml(t.email)}</p>
        </div>
      </div>
      <div class="message-detail-thread" id="messageDetailThread">
        <div class="message-detail-thread-label">${mfT('admin.contactFormMessage')}</div>
        <div class="message-detail-item from-user">
          <div class="message-detail-item-header">${escapeHtml(t.fullName)} · ${escapeHtml(timeStr)}</div>
          ${renderContactMessageCard(t.message, t)}
        </div>
      </div>
    `;
    appendReplyFormToMessageModal(t);
    return;
  }

  messageContent.innerHTML = `
    <div class="message-detail-header">
      <div class="message-detail-avatar">${escapeHtml(initials)}</div>
      <div class="message-detail-info">
        <h3 class="message-detail-name">${escapeHtml(t.fullName)}</h3>
        <p class="message-detail-email">${escapeHtml(t.email)}</p>
      </div>
    </div>
    <div class="message-detail-thread-loading"><i class="fi fi-rr-spinner"></i> ${mfT('admin.loadingConversation')}</div>
    <div class="message-detail-thread" id="messageDetailThread" style="display:none;"></div>
  `;

  try {
    const res = await API.admin.supportGetMessages(t.conversationId, { page: 1, limit: 200 });
    const msgs = (res && res.messages) ? res.messages : [];
    const threadEl = document.getElementById('messageDetailThread');
    const loadingEl = messageContent.querySelector('.message-detail-thread-loading');
    if (loadingEl) loadingEl.remove();
    if (!threadEl) return;
    if (msgs.length === 0) {
      threadEl.innerHTML = '<div class="message-detail-empty">' + mfT('admin.noMessagesInConv') + '</div>';
    } else {
      const me = API.getCurrentUser ? API.getCurrentUser() : null;
      const meId = me && me.id ? String(me.id) : '';
      const threadHtml = msgs.map((m) => {
        const isFromAdmin = meId && m.sender && String(m.sender.id) === meId;
        const senderName = m.sender ? (m.sender.fullName || mfT('common.unknown')) : mfT('common.unknown');
        const timeStr = m.createdAt ? getTimeAgo(m.createdAt) : '';
        const contentHtml = !isFromAdmin && looksLikeContactFormContent(m.content)
          ? renderContactMessageCard(m.content, { fullName: senderName })
          : `<div class="message-detail-item-text">${escapeHtml(m.content)}</div>`;
        return `
          <div class="message-detail-item ${isFromAdmin ? 'from-admin' : 'from-user'}">
            <div class="message-detail-item-header">${escapeHtml(senderName)} · ${escapeHtml(timeStr)}</div>
            ${contentHtml}
          </div>
        `;
      }).join('');
      threadEl.innerHTML = '<div class="message-detail-thread-label">' + mfT('admin.fullConversation') + '</div>' + threadHtml;
    }
    threadEl.style.display = 'block';
  } catch (e) {
    console.warn('Could not load full conversation:', e);
    const threadEl = document.getElementById('messageDetailThread');
    const loadingEl = messageContent.querySelector('.message-detail-thread-loading');
    if (loadingEl) loadingEl.remove();
    if (threadEl) {
      threadEl.innerHTML = '<div class="message-detail-empty">' + mfT('admin.couldNotLoadConversation') + '</div>';
      threadEl.style.display = 'block';
    }
  }

  appendReplyFormToMessageModal(t);
}

function toggleReplySection(threadId) {
  const t = allThreads.find((x) => String(x.id) === String(threadId));
  if (!t || !t.replyElSuffix) return;
  const form = document.getElementById(`replyForm-${t.replyElSuffix}`);
  if (!form) return;
  const replySection = form.closest('.reply-section');
  if (!replySection) return;
  replySection.classList.toggle('active');
  if (replySection.classList.contains('active')) {
    const ta = document.getElementById(`replyMessage-${t.replyElSuffix}`);
    if (ta) ta.focus();
  }
}

function cancelReply(threadId) {
  const t = allThreads.find((x) => String(x.id) === String(threadId));
  if (!t || !t.replyElSuffix) return;
  const form = document.getElementById(`replyForm-${t.replyElSuffix}`);
  if (!form) return;
  const replySection = form.closest('.reply-section');
  if (replySection) replySection.classList.remove('active');
  const ta = document.getElementById(`replyMessage-${t.replyElSuffix}`);
  if (ta) ta.value = '';
}

async function handleReplySubmit(event, threadId) {
  event.preventDefault();
  const t = allThreads.find((x) => String(x.id) === String(threadId));
  if (!t || !t.replyElSuffix) return;
  const ta = document.getElementById(`replyMessage-${t.replyElSuffix}`);
  const text = ta ? String(ta.value || '').trim() : '';
  if (!text) return alert(mfT('admin.enterReply'));

  const submitBtn = document.querySelector(`#replyForm-${CSS.escape(t.replyElSuffix)} .btn-send-reply`);
  const originalHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> ' + mfT('common.sending');
  }
  try {
    if (t.isContactSubmission) {
      await API.admin.supportReplyFromSubmission(t.submissionMongoId, text);
    } else {
      await API.admin.supportSendMessage(t.conversationId, text);
    }
    closeMessageModal();
    await loadSupportInbox({ silent: true });
    alert(mfT('admin.replySentNotify'));
  } catch (e) {
    alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(e && e.message)) || mfT('admin.replyFailed'));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml || '<i class="fi fi-rr-paper-plane"></i> ' + mfT('admin.sendReply');
    }
  }
}

function closeMessageModal() {
  if (messageModal) {
    messageModal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function setupProfilePopup() {
  // Bell: ../../scripts/player/notifications.js
  if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profilePopup.classList.toggle('active');
      const notificationPopup = document.getElementById('notificationPopup');
      if (notificationPopup) notificationPopup.classList.remove('active');
    });
  }
  document.addEventListener('click', (e) => {
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
  profileBtn = document.getElementById('profileBtn');
  profilePopup = document.getElementById('profilePopup');
  messageSearch = document.getElementById('messageSearch');
  statusFilter = document.getElementById('statusFilter');
  messagesList = document.getElementById('messagesList');
  messageModal = document.getElementById('messageModal');
  closeMessageModalBtn = document.getElementById('closeMessageModal');
  messageContent = document.getElementById('messageContent');
  spamBlockedBtn = document.getElementById('spamBlockedBtn');

  const loadMoreBtn = document.getElementById('loadMoreInboxBtn');
  const refreshBtn = document.getElementById('refreshInboxBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      conversationTake = Math.min(300, conversationTake + 60);
      submissionTake = Math.min(200, submissionTake + 40);
      if (conversationTake >= 300 && submissionTake >= 200) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = mfT('admin.maxLoaded');
      }
      loadSupportInbox();
    });
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      try {
        await loadSupportInbox({ silent: true });
      } finally {
        refreshBtn.disabled = false;
      }
    });
  }

  setupProfilePopup();
  setupModalHandlers();
  setupSearchAndFilter();
  loadSupportInbox();

  if (inboxPollTimer) clearInterval(inboxPollTimer);
  inboxPollTimer = setInterval(() => {
    loadSupportInbox({ silent: true });
  }, 45000);
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

