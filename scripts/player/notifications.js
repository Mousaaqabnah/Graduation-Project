// Shared notifications logic for player pages
// Handles notification bell button and popup, and loads notifications from localStorage

document.addEventListener('DOMContentLoaded', function () {
  const notificationBtn = document.querySelector('.notification-btn');
  const notificationPopup = document.getElementById('notificationPopup');

  if (!notificationBtn || !notificationPopup) {
    return;
  }

  // Add Clear All button to header if not already present
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

  // Helper: get current user (set by auth-guard via API.setCurrentUser)
  function getCurrentUser() {
    try {
      if (window.API && typeof window.API.getCurrentUser === 'function') {
        return window.API.getCurrentUser();
      }
    } catch (e) {
      console.warn('notifications: failed to get current user', e);
    }
    return null;
  }

  // Load notifications from localStorage and render into popup
  function loadNotifications() {
    const content = notificationPopup.querySelector('.notification-popup-content');
    if (!content) return;

    let notifications = [];
    try {
      notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
    } catch (e) {
      console.warn('notifications: could not parse playerNotifications from localStorage', e);
    }

    const currentUser = getCurrentUser();
    const currentUserId = currentUser && currentUser.id;

    // Filter notifications for current player if we have an ID
    if (currentUserId) {
      notifications = notifications.filter(n => n.playerId === currentUserId);
    }

    if (!notifications.length) {
      content.innerHTML = `
        <div style="padding: 16px; text-align: center; color: #6B7280; font-size: 14px;">
          No notifications yet.
        </div>
      `;
      return;
    }

    content.innerHTML = notifications
      .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
      .map(n => {
        const title = n.title || 'Booking update';
        const time = n.date || '';
        const message = n.message || '';
        return `
          <div class="notification-item">
            <div class="notification-icon">
              <i class="fi fi-rs-bell"></i>
            </div>
            <div class="notification-text">
              <p class="notification-title">${escapeHtml(title)}</p>
              <p class="notification-time">${escapeHtml(time)}</p>
              ${message ? `<p class="notification-message">${escapeHtml(message)}</p>` : ''}
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Simple HTML escaper
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Clear all notifications for current user
  function clearAllNotifications() {
    let notifications = [];
    try {
      notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
    } catch (e) {
      return;
    }
    const currentUser = getCurrentUser();
    const currentUserId = currentUser && currentUser.id;
    if (currentUserId) {
      notifications = notifications.filter(n => n.playerId !== currentUserId);
    } else {
      notifications = [];
    }
    localStorage.setItem('playerNotifications', JSON.stringify(notifications));
    loadNotifications();
  }

  // Clear All button click
  const clearBtn = notificationPopup.querySelector('.clear-all-notifications-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      clearAllNotifications();
    });
  }

  // Toggle popup on bell click
  notificationBtn.addEventListener('click', function (e) {
    e.stopPropagation();

    // Close profile popup if open
    const profilePopup = document.getElementById('profilePopup');
    if (profilePopup && profilePopup.classList.contains('active')) {
      profilePopup.classList.remove('active');
    }

    const isActive = notificationPopup.classList.contains('active');
    if (!isActive) {
      loadNotifications();
      notificationPopup.classList.add('active');
    } else {
      notificationPopup.classList.remove('active');
    }
  });

  // Close popup when clicking outside
  document.addEventListener('click', function (e) {
    if (
      notificationPopup.classList.contains('active') &&
      !notificationPopup.contains(e.target) &&
      !notificationBtn.contains(e.target)
    ) {
      notificationPopup.classList.remove('active');
    }
  });
});

