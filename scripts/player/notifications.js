// Shared notifications - loads from API (admin replies, etc.) + localStorage (booking updates)

document.addEventListener('DOMContentLoaded', function () {
  // Prefer #notificationBtn when present (owner pages); else first .notification-btn (player pages)
  const notificationBtn =
    document.getElementById('notificationBtn') ||
    document.querySelector('.notification-btn');
  const notificationPopup = document.getElementById('notificationPopup');

  if (!notificationBtn || !notificationPopup) return;

  (function injectNotificationBadgeStyles() {
    if (document.getElementById('matchfield-notification-badge-styles')) return;
    const style = document.createElement('style');
    style.id = 'matchfield-notification-badge-styles';
    style.textContent = `
      .notification-wrapper{position:relative;}
      button.icon-btn.notification-btn{position:relative;}
      /*
        Anchor to the button's top-right corner, then nudge outward (translate).
        The bell glyph sits inside a small box; without translate the dot sits over the bell body.
      */
      button.icon-btn.notification-btn > .notification-unread-badge{
        position:absolute;
        top:0;
        right:0;
        left:auto;
        bottom:auto;
        transform:translate(15%,-42%);
        width:8px;
        height:8px;
        border-radius:50%;
        background:#ef4444;
        border:2px solid #fff;
        box-sizing:content-box;
        display:none;
        pointer-events:none;
        z-index:3;
        margin:0;
        padding:0;
      }
      button.icon-btn.notification-btn > .notification-unread-badge.notification-unread-badge--on{display:block;}
    `;
    document.head.appendChild(style);
  })();

  const notificationWrap = notificationBtn.closest('.notification-wrapper');
  let badgeEl = notificationBtn.querySelector('.notification-unread-badge');
  if (!badgeEl && notificationWrap) {
    badgeEl = notificationWrap.querySelector('.notification-unread-badge');
  }
  if (!badgeEl) {
    badgeEl = document.createElement('span');
    badgeEl.className = 'notification-unread-badge';
    badgeEl.setAttribute('aria-hidden', 'true');
  }
  if (badgeEl.parentElement !== notificationBtn) {
    notificationBtn.appendChild(badgeEl);
  }
  if (getComputedStyle(notificationBtn).position === 'static') {
    notificationBtn.style.position = 'relative';
  }

  function setNotificationDotVisible(show) {
    badgeEl.classList.toggle('notification-unread-badge--on', !!show);
    const base = 'Notifications';
    if (show) notificationBtn.setAttribute('aria-label', base + ', unread');
    else notificationBtn.setAttribute('aria-label', base);
  }

  function notificationsLastViewedKey(userId) {
    return 'matchfield_notif_last_viewed_' + String(userId || '');
  }

  function getNotificationsLastViewedMs(userId) {
    if (!userId) return 0;
    try {
      const raw = localStorage.getItem(notificationsLastViewedKey(userId));
      if (!raw) return 0;
      const t = new Date(raw).getTime();
      return Number.isNaN(t) ? 0 : t;
    } catch (_) {
      return 0;
    }
  }

  function setNotificationsLastViewedNow(userId) {
    if (!userId) return;
    try {
      localStorage.setItem(notificationsLastViewedKey(userId), new Date().toISOString());
    } catch (_) {}
  }

  function markLocalPlayerNotificationsRead(userId) {
    if (!userId) return;
    try {
      const raw = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
      const next = raw.map((n) => (n.playerId === userId ? Object.assign({}, n, { read: true }) : n));
      localStorage.setItem('playerNotifications', JSON.stringify(next));
    } catch (_) {}
  }

  function getLocalUnreadCount(currentUser) {
    if (!currentUser || !currentUser.id) return 0;
    const role = String(currentUser.role || '').toUpperCase();
    if (role !== 'PLAYER') return 0;
    const uid = currentUser.id;
    try {
      const arr = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
      return arr.filter((n) => String(n.playerId) === String(uid) && !n.read).length;
    } catch (_) {
      return 0;
    }
  }

  async function refreshUnreadDot() {
    const u = getCurrentUser();
    if (!u || !(window.API && API.getAuthToken && API.getAuthToken())) {
      setNotificationDotVisible(false);
      return;
    }
    const uid = u.id;
    const lastViewedMs = getNotificationsLastViewedMs(uid);
    let apiUnread = 0;
    if (API.notifications && API.notifications.getMine) {
      try {
        const res = await API.notifications.getMine();
        const list = res.notifications || [];
        apiUnread = list.filter((n) => {
          if (n.readAt) return false;
          const created = new Date(n.createdAt).getTime();
          return created > lastViewedMs;
        }).length;
      } catch (_) {}
    }
    const localUnread = getLocalUnreadCount(u);
    setNotificationDotVisible(apiUnread + localUnread > 0);
  }

  const header = notificationPopup.querySelector('.notification-popup-header');
  if (header && !header.querySelector('.clear-all-notifications-btn')) {
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'clear-all-notifications-btn';
    clearBtn.textContent = 'Clear All';
    clearBtn.title = 'Clear all notifications';
    clearBtn.style.cssText = 'padding: 6px 12px; font-size: 13px; color: #007BFF; background: transparent; border: 1px solid #007BFF; border-radius: 8px; cursor: pointer; font-weight: 500;';
    clearBtn.onmouseover = function () { this.style.background = '#EFF6FF'; };
    clearBtn.onmouseout = function () { this.style.background = 'transparent'; };
    header.appendChild(clearBtn);
  }

  function getCurrentUser() {
    try {
      if (window.API && typeof window.API.getCurrentUser === 'function') {
        return window.API.getCurrentUser();
      }
    } catch (e) { console.warn('notifications: getCurrentUser', e); }
    return null;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatTime(isoOrStr) {
    if (!isoOrStr) return '';
    const d = new Date(isoOrStr);
    if (isNaN(d.getTime())) return String(isoOrStr);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return days === 1 ? 'Yesterday' : days + ' days ago';
    if (hours > 0) return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
    if (mins > 0) return mins + ' min ago';
    return 'Just now';
  }

  let detailModal = document.getElementById('notificationDetailModal');
  if (!detailModal) {
    detailModal = document.createElement('div');
    detailModal.id = 'notificationDetailModal';
    detailModal.className = 'notification-detail-modal';
    detailModal.innerHTML = `
      <div class="notification-detail-backdrop"></div>
      <div class="notification-detail-content">
        <button type="button" class="notification-detail-close" aria-label="Close">&times;</button>
        <h3 class="notification-detail-title"></h3>
        <p class="notification-detail-message"></p>
        <p class="notification-detail-time"></p>
      </div>
    `;
    document.body.appendChild(detailModal);
    const style = document.createElement('style');
    style.textContent = `
      .notification-detail-modal{display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;}
      .notification-detail-modal.active{display:flex;}
      .notification-detail-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.4);}
      .notification-detail-content{position:relative;background:#fff;border-radius:12px;padding:24px;max-width:400px;width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.15);}
      .notification-detail-close{position:absolute;top:12px;right:12px;background:none;border:none;font-size:24px;cursor:pointer;color:#6B7280;}
      .notification-detail-title{margin:0 0 12px;font-size:18px;font-weight:600;}
      .notification-detail-message{margin:0 0 12px;font-size:14px;line-height:1.5;white-space:pre-wrap;}
      .notification-detail-time{margin:0;font-size:12px;color:#9CA3AF;}
      .notification-item{cursor:pointer;}
      .notification-item:hover{background:#F3F4F6;}
    `;
    document.head.appendChild(style);
  }
  detailModal.querySelector('.notification-detail-backdrop').onclick = () => detailModal.classList.remove('active');
  detailModal.querySelector('.notification-detail-close').onclick = () => detailModal.classList.remove('active');

  function openDetail(title, message, time) {
    detailModal.querySelector('.notification-detail-title').textContent = title || 'Notification';
    detailModal.querySelector('.notification-detail-message').textContent = message || '';
    detailModal.querySelector('.notification-detail-time').textContent = time || '';
    detailModal.classList.add('active');
  }

  async function loadNotifications() {
    const content = notificationPopup.querySelector('.notification-popup-content');
    if (!content) return;

    const currentUser = getCurrentUser();
    const currentUserId = currentUser && currentUser.id;
    const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : '';
    let storageKey = 'playerNotifications';
    if (userRole === 'OWNER') storageKey = 'ownerNotifications';
    else if (userRole === 'ADMIN') storageKey = 'adminNotifications';

    let apiNotifications = [];
    if (window.API && API.notifications && API.notifications.getMine && API.getAuthToken && API.getAuthToken()) {
      try {
        const res = await API.notifications.getMine();
        apiNotifications = (res.notifications || []).map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          createdAt: n.createdAt,
          readAt: n.readAt,
          source: 'api'
        }));
      } catch (e) {
        console.warn('notifications: API fetch failed', e);
      }
    }

    let local = [];
    try {
      local = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (e) {}
    if (currentUserId && storageKey === 'playerNotifications') {
      local = local.filter((n) => n.playerId === currentUserId);
    } else {
      // Owner/admin: no dev-only local queue in this app; API is the source of truth
      local = [];
    }
    const localNotifications = local.map((n) => ({
      id: n.id || 'local-' + (n.date || ''),
      title: n.title || 'Booking update',
      message: n.message || '',
      createdAt: n.createdAt || n.date,
      source: 'local'
    }));

    const combined = [...apiNotifications, ...localNotifications].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    if (combined.length === 0) {
      content.innerHTML = '<div style="padding:16px;text-align:center;color:#6B7280;font-size:14px;">No notifications yet.</div>';
      return;
    }

    content.innerHTML = combined.map((n, i) => {
      const title = n.title || 'Notification';
      const time = formatTime(n.createdAt);
      return `
        <div class="notification-item" data-index="${i}">
          <div class="notification-icon"><i class="fi fi-rs-bell"></i></div>
          <div class="notification-text">
            <p class="notification-title">${escapeHtml(title)}</p>
            <p class="notification-time">${escapeHtml(time)}</p>
          </div>
        </div>
      `;
    }).join('');

    const items = content.querySelectorAll('.notification-item');
    items.forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index, 10);
        const n = combined[idx];
        if (n) openDetail(n.title, n.message, formatTime(n.createdAt));
      });
    });
  }

  async function clearAllNotifications() {
    const currentUser = getCurrentUser();
    const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : '';
    let storageKey = 'playerNotifications';
    if (userRole === 'OWNER') storageKey = 'ownerNotifications';
    else if (userRole === 'ADMIN') storageKey = 'adminNotifications';
    let local = [];
    try {
      local = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (e) {}
    const currentUserId = currentUser && currentUser.id;
    if (currentUserId && storageKey === 'playerNotifications') {
      local = local.filter((n) => n.playerId !== currentUserId);
    } else {
      local = [];
    }
    localStorage.setItem(storageKey, JSON.stringify(local));
    if (window.API && API.notifications && API.notifications.clearAll && API.getAuthToken && API.getAuthToken()) {
      try { await API.notifications.clearAll(); } catch (e) { console.warn('clear API notifications', e); }
    }
    if (currentUserId) setNotificationsLastViewedNow(currentUserId);
    await loadNotifications();
    await refreshUnreadDot();
  }

  const clearBtn = notificationPopup.querySelector('.clear-all-notifications-btn');
  if (clearBtn) clearBtn.addEventListener('click', (e) => { e.stopPropagation(); clearAllNotifications(); });

  notificationBtn.addEventListener('click', async function (e) {
    e.stopPropagation();
    const profilePopup = document.getElementById('profilePopup');
    if (profilePopup && profilePopup.classList.contains('active')) profilePopup.classList.remove('active');
    const isActive = notificationPopup.classList.contains('active');
    if (!isActive) {
      const u = getCurrentUser();
      const uid = u && u.id;
      setNotificationDotVisible(false);
      if (window.API && API.notifications && API.notifications.markAllRead && API.getAuthToken && API.getAuthToken()) {
        try {
          await API.notifications.markAllRead();
        } catch (err) {
          console.warn('notifications: markAllRead', err);
        }
      }
      if (uid) markLocalPlayerNotificationsRead(uid);
      if (uid) setNotificationsLastViewedNow(uid);
      await loadNotifications();
      await refreshUnreadDot();
      notificationPopup.classList.add('active');
    } else {
      notificationPopup.classList.remove('active');
    }
  });

  document.addEventListener('click', (e) => {
    if (notificationPopup.classList.contains('active') &&
        !notificationPopup.contains(e.target) &&
        !notificationBtn.contains(e.target)) {
      notificationPopup.classList.remove('active');
    }
  });

  refreshUnreadDot();
  setInterval(refreshUnreadDot, 45000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refreshUnreadDot();
  });
  window.matchfieldRefreshNotificationBadge = refreshUnreadDot;
});
