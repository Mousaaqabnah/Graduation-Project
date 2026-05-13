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

  (function injectNotificationPopupLayoutStyles() {
    if (document.getElementById('matchfield-notification-popup-layout')) return;
    const style = document.createElement('style');
    style.id = 'matchfield-notification-popup-layout';
    style.textContent = `
      #notificationPopup.notification-popup{
        max-height:min(72vh,420px);
        overflow:hidden;
        flex-direction:column;
      }
      #notificationPopup.notification-popup.active{
        display:flex;
      }
      #notificationPopup .notification-popup-header{
        flex-shrink:0;
        display:flex;
        flex-direction:row;
        align-items:center;
        justify-content:space-between;
        gap:12px;
      }
      #notificationPopup .notification-popup-header h3{
        flex:1 1 auto;
        min-width:0;
        margin:0;
      }
      #notificationPopup .clear-all-notifications-btn{
        flex-shrink:0;
      }
      #notificationPopup .notification-popup-content{
        flex:1 1 auto;
        min-height:0;
        max-height:none;
        overflow-y:auto;
        -webkit-overflow-scrolling:touch;
      }
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
        <div class="notification-detail-actions"></div>
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
      .notification-detail-actions{display:flex;flex-direction:column;gap:10px;margin:16px 0 12px;}
      .notification-action-btn{border:none;border-radius:10px;padding:10px 12px;font-size:14px;font-weight:600;cursor:pointer;}
      .notification-action-btn.primary{background:#007BFF;color:#fff;}
      .notification-action-btn.secondary{background:#EFF6FF;color:#007BFF;}
      .notification-action-btn:disabled{opacity:.65;cursor:not-allowed;}
      .notification-add-player-box{display:none;margin-top:6px;padding:12px;border:1px solid #E5E7EB;border-radius:10px;background:#F9FAFB;}
      .notification-add-player-box.active{display:block;}
      .notification-add-player-input{width:100%;box-sizing:border-box;border:1px solid #D1D5DB;border-radius:8px;padding:9px 10px;font-size:14px;}
      .notification-player-results{display:flex;flex-direction:column;gap:6px;margin-top:8px;max-height:180px;overflow:auto;}
      .notification-player-result{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;}
      .notification-player-result span{font-size:13px;color:#374151;}
      .notification-player-result button{border:none;border-radius:8px;background:#007BFF;color:#fff;padding:7px 9px;font-size:12px;font-weight:600;cursor:pointer;}
      .notification-action-note{margin:8px 0 0;color:#6B7280;font-size:12px;line-height:1.4;}
      .notification-detail-time{margin:0;font-size:12px;color:#9CA3AF;}
      .notification-item{cursor:pointer;}
      .notification-item:hover{background:#F3F4F6;}
    `;
    document.head.appendChild(style);
  }
  detailModal.querySelector('.notification-detail-backdrop').onclick = () => detailModal.classList.remove('active');
  detailModal.querySelector('.notification-detail-close').onclick = () => detailModal.classList.remove('active');

  function getNotificationBookingId(notification) {
    return String((notification && notification.bookingId) || '');
  }

  function getBookingIdValue(booking) {
    return String((booking && (booking.id != null ? booking.id : booking._id)) || '');
  }

  async function loadBookingForNotification(notification) {
    const bookingId = getNotificationBookingId(notification);
    if (!bookingId) return null;
    if (window.API && API.bookings && API.bookings.getById && API.getAuthToken && API.getAuthToken()) {
      try {
        const res = await API.bookings.getById(bookingId);
        if (res && res.booking) return res.booking;
      } catch (e) {
        console.warn('notification booking load failed', e);
      }
    }
    try {
      const bookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
      return bookings.find((b) => getBookingIdValue(b) === bookingId) || null;
    } catch (_) {
      return null;
    }
  }

  function getLeftPlayerShare(notification, booking) {
    const explicit = Number(notification && notification.paymentAmount);
    if (explicit > 0) return explicit;
    const total = Number(booking && booking.totalCost) || 0;
    const teamSize = Number(booking && booking.teamSize) || 0;
    if (total > 0 && teamSize > 0) return Math.round(total / teamSize);
    const participants = (booking && (booking.participants || booking.players)) || [];
    const totalPlayers = participants.length + 2; // organizer + remaining players + the one who left
    return total > 0 ? Math.round(total / totalPlayers) : 0;
  }

  function markLeftShareCovered(notification, amount) {
    const bookingId = getNotificationBookingId(notification);
    if (!bookingId) return;
    const coverKey = bookingId + '_covered_' + String(notification.id || Date.now());
    const paidMap = JSON.parse(localStorage.getItem('playerPaidBookings') || '{}');
    paidMap[coverKey] = true;
    localStorage.setItem('playerPaidBookings', JSON.stringify(paidMap));

    const covered = JSON.parse(localStorage.getItem('organizerCoveredLeftPlayerShares') || '{}');
    covered[String(notification.id || coverKey)] = {
      bookingId: bookingId,
      amount: amount,
      leftPlayerName: notification.leftPlayerName || 'Player',
      coveredAt: new Date().toISOString()
    };
    localStorage.setItem('organizerCoveredLeftPlayerShares', JSON.stringify(covered));
  }

  function removeLocalNotificationById(notificationId) {
    if (!notificationId) return;
    try {
      const notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
      const next = notifications.filter((n) => String(n.id || '') !== String(notificationId));
      localStorage.setItem('playerNotifications', JSON.stringify(next));
    } catch (_) {}
  }

  function createReplacementPaymentNotification(booking, notification, player, amount) {
    const currentUser = getCurrentUser() || {};
    const bookingId = getBookingIdValue(booking) || getNotificationBookingId(notification);
    const fieldName = (booking && booking.field && booking.field.name) || notification.fieldName || 'the field';
    const fieldImage =
      (booking && booking.field && Array.isArray(booking.field.images) && booking.field.images[0]) ||
      notification.fieldImage ||
      '';
    const dateValue = (booking && booking.date) || notification.date;
    const timeValue = (booking && booking.timeSlotStart && booking.timeSlotEnd)
      ? (booking.timeSlotStart + ' - ' + booking.timeSlotEnd)
      : (notification.time || '');
    const notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
    notifications.push({
      id: 'notif_' + Date.now() + '_' + player.id,
      type: 'booking_payment_request',
      playerId: player.id,
      playerName: player.fullName || player.name || '',
      bookingId: bookingId,
      fieldName: fieldName,
      fieldImage: fieldImage,
      title: 'Payment Required',
      message: (currentUser.fullName || currentUser.name || 'The organizer') +
        ' invited you to replace a player at ' + fieldName + '. Your share is ₺' + amount + '.',
      date: dateValue,
      time: timeValue,
      paymentAmount: amount,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('playerNotifications', JSON.stringify(notifications));
  }

  async function addReplacementPlayer(notification, user, button) {
    const booking = await loadBookingForNotification(notification);
    if (!booking) {
      alert('Booking not found. Please refresh and try again.');
      return;
    }
    const bookingId = getBookingIdValue(booking) || getNotificationBookingId(notification);
    const amount = getLeftPlayerShare(notification, booking);
    if (button) {
      button.disabled = true;
      button.textContent = 'Adding...';
    }
    try {
      if (window.API && API.bookings && API.bookings.addParticipant && API.getAuthToken && API.getAuthToken()) {
        await API.bookings.addParticipant(bookingId, user.id);
      }
      createReplacementPaymentNotification(booking, notification, user, amount);
      removeLocalNotificationById(notification.id);
      alert((user.fullName || user.name || 'Player') + ' was added and sent a payment request.');
      detailModal.classList.remove('active');
      await loadNotifications();
      if (typeof window.matchfieldRefreshNotificationBadge === 'function') window.matchfieldRefreshNotificationBadge();
    } catch (e) {
      alert((e && e.message) || 'Could not add this player.');
      if (button) {
        button.disabled = false;
        button.textContent = 'Add';
      }
    }
  }

  function renderPlayerSearchResults(container, notification, users) {
    if (!container) return;
    if (!users || !users.length) {
      container.innerHTML = '<p class="notification-action-note">No players found.</p>';
      return;
    }
    container.innerHTML = users.map((u, index) => {
      return '<div class="notification-player-result" data-index="' + index + '">' +
        '<span>' + escapeHtml(u.fullName || u.email || 'Player') + '</span>' +
        '<button type="button">Add</button>' +
        '</div>';
    }).join('');
    container.querySelectorAll('.notification-player-result button').forEach((btn) => {
      btn.addEventListener('click', function () {
        const row = btn.closest('.notification-player-result');
        const idx = parseInt(row && row.getAttribute('data-index'), 10);
        const user = users[idx];
        if (user) addReplacementPlayer(notification, user, btn);
      });
    });
  }

  function renderPlayerLeftActions(notification) {
    const bookingId = getNotificationBookingId(notification);
    if (!bookingId) return '';
    const amountText = Number(notification.paymentAmount) > 0 ? ' (₺' + Number(notification.paymentAmount) + ')' : '';
    return `
      <button type="button" class="notification-action-btn primary" data-notification-action="add-player">
        Add Another Player
      </button>
      <button type="button" class="notification-action-btn secondary" data-notification-action="cover-share">
        Pay Missing Player Share${amountText}
      </button>
      <div class="notification-add-player-box">
        <input type="text" class="notification-add-player-input" placeholder="Search player by name or email">
        <div class="notification-player-results"></div>
        <p class="notification-action-note">The selected player will be added to this booking and receive a payment request.</p>
      </div>
    `;
  }

  function wirePlayerLeftActions(notification) {
    const actions = detailModal.querySelector('.notification-detail-actions');
    if (!actions || notification.type !== 'player_left_booking') return;
    const addBtn = actions.querySelector('[data-notification-action="add-player"]');
    const coverBtn = actions.querySelector('[data-notification-action="cover-share"]');
    const addBox = actions.querySelector('.notification-add-player-box');
    const input = actions.querySelector('.notification-add-player-input');
    const results = actions.querySelector('.notification-player-results');

    if (addBtn && addBox && input) {
      addBtn.addEventListener('click', function () {
        addBox.classList.toggle('active');
        if (addBox.classList.contains('active')) input.focus();
      });
      input.addEventListener('input', async function () {
        const q = input.value.trim();
        if (q.length < 2) {
          if (results) results.innerHTML = '<p class="notification-action-note">Type at least 2 characters.</p>';
          return;
        }
        if (!(window.API && API.users && API.users.search)) return;
        try {
          const res = await API.users.search(q);
          const users = (res.users || []).filter((u) => String(u.role || '').toUpperCase() === 'PLAYER');
          renderPlayerSearchResults(results, notification, users);
        } catch (e) {
          if (results) results.innerHTML = '<p class="notification-action-note">Could not search players.</p>';
        }
      });
    }

    if (coverBtn) {
      coverBtn.addEventListener('click', async function () {
        const booking = await loadBookingForNotification(notification);
        const amount = getLeftPlayerShare(notification, booking);
        const bookingId = (booking && getBookingIdValue(booking)) || getNotificationBookingId(notification);
        if (!booking || !bookingId) {
          alert('Booking not found. Please refresh and try again.');
          return;
        }
        if (typeof window.openPaymentModal !== 'function') {
          alert('Payment form is not available on this page. Please open My Bookings and try again.');
          return;
        }
        window.openPaymentModal({
          amount: amount,
          bookingId: bookingId,
          isOrganizer: true,
          booking: booking,
          coverLeftShare: {
            notificationId: notification.id,
            leftPlayerName: notification.leftPlayerName || notification.playerName || 'Player',
            amount: amount
          }
        });
        detailModal.classList.remove('active');
      });
    }
  }

  function openDetail(notification) {
    const title = notification && notification.title;
    const message = notification && notification.message;
    const time = formatTime(notification && notification.createdAt);
    detailModal.querySelector('.notification-detail-title').textContent = title || 'Notification';
    detailModal.querySelector('.notification-detail-message').textContent = message || '';
    detailModal.querySelector('.notification-detail-time').textContent = time || '';
    const actions = detailModal.querySelector('.notification-detail-actions');
    if (actions) {
      actions.innerHTML = notification && notification.type === 'player_left_booking'
        ? renderPlayerLeftActions(notification)
        : '';
    }
    wirePlayerLeftActions(notification || {});
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
      ...n,
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
        if (n) openDetail(n);
      });
    });
  }

  async function clearAllNotifications() {
    const currentUser = getCurrentUser();
    const userRole = (currentUser && currentUser.role) ? String(currentUser.role).toUpperCase() : '';
    let storageKey = 'playerNotifications';
    if (userRole === 'OWNER') storageKey = 'ownerNotifications';
    else if (userRole === 'ADMIN') storageKey = 'adminNotifications';
    const currentUserId = currentUser && currentUser.id;
    const token = window.API && API.getAuthToken && API.getAuthToken();

    if (token && window.API && API.notifications && API.notifications.clearAll) {
      try {
        await API.notifications.clearAll();
      } catch (e) {
        console.warn('clear API notifications', e);
        const msg = (e && e.message) ? String(e.message) : '';
        alert(
          msg
            ? 'Could not clear notifications: ' + msg
            : 'Could not clear notifications on the server. Please try again.'
        );
        return;
      }
    }

    let local = [];
    try {
      local = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (e) {}
    if (currentUserId && storageKey === 'playerNotifications') {
      local = local.filter((n) => n.playerId !== currentUserId);
    } else {
      local = [];
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(local));
    } catch (_) {}

    if (currentUserId) setNotificationsLastViewedNow(currentUserId);
    await loadNotifications();
    await refreshUnreadDot();
  }

  const clearBtn = notificationPopup.querySelector('.clear-all-notifications-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async function (e) {
      e.stopPropagation();
      if (clearBtn.disabled) return;
      clearBtn.disabled = true;
      clearBtn.style.cursor = 'wait';
      clearBtn.style.opacity = '0.65';
      try {
        await clearAllNotifications();
      } finally {
        clearBtn.disabled = false;
        clearBtn.style.cursor = '';
        clearBtn.style.opacity = '';
      }
    });
  }

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
