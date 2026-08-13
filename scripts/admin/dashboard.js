// Admin Dashboard functionality

// DOM Elements
const profileBtn = document.getElementById('profileBtn');
const profilePopup = document.getElementById('profilePopup');
const inviteAdminBtn = document.getElementById('inviteAdminBtn');
const sendNotificationBtn = document.getElementById('sendNotificationBtn');
const notificationTitle = document.getElementById('notificationTitle');
const notificationMessage = document.getElementById('notificationMessage');
const tagButtons = document.querySelectorAll('.tag-btn');
const recentNotifications = document.getElementById('recentNotifications');
const privateUserSelector = document.getElementById('privateUserSelector');
const userSearchInput = document.getElementById('userSearchInput');
const userDropdown = document.getElementById('userDropdown');
const selectedUserId = document.getElementById('selectedUserId');
const selectedUserDisplay = document.getElementById('selectedUserDisplay');
const removeUserBtn = document.getElementById('removeUserBtn');
const notificationAudienceSelector = document.getElementById('notificationAudienceSelector');
const notificationChannelSelector = document.getElementById('notificationChannelSelector');
const notificationsAudienceChart = document.getElementById('notificationsAudienceChart');
const bookingsRegionsChart = document.getElementById('bookingsRegionsChart');

// Invite Admin Modal elements
const inviteAdminModal = document.getElementById('inviteAdminModal');
const closeInviteAdminModal = document.getElementById('closeInviteAdminModal');
const cancelInviteAdminBtn = document.getElementById('cancelInviteAdminBtn');
const inviteAdminForm = document.getElementById('inviteAdminForm');
const inviteAdminEmail = document.getElementById('inviteAdminEmail');
const inviteAdminName = document.getElementById('inviteAdminName');
const submitInviteAdminBtn = document.getElementById('submitInviteAdminBtn');
const inviteAdminError = document.getElementById('inviteAdminError');
const inviteAdminResult = document.getElementById('inviteAdminResult');
const inviteAdminCreatedEmail = document.getElementById('inviteAdminCreatedEmail');
const inviteAdminTempPassword = document.getElementById('inviteAdminTempPassword');
const toggleInviteAdminPasswordBtn = document.getElementById('toggleInviteAdminPasswordBtn');
const copyInviteAdminPasswordBtn = document.getElementById('copyInviteAdminPasswordBtn');
const doneInviteAdminBtn = document.getElementById('doneInviteAdminBtn');

// Bell + notification list: ../../scripts/player/notifications.js (load after api.js)

// Profile Popup Toggle
if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profilePopup.classList.toggle('active');
        const notificationPopup = document.getElementById('notificationPopup');
        if (notificationPopup) {
            notificationPopup.classList.remove('active');
        }
    });
}

// Close profile popup when clicking outside (bell popup handled in notifications.js)
document.addEventListener('click', (e) => {
    if (profilePopup && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('active');
    }
});

// Load dashboard stats from API
async function loadDashboardStats() {
    const els = {
        totalUsers: document.getElementById('statTotalUsers'),
        usersSubtext: document.getElementById('statUsersSubtext'),
        activeOwners: document.getElementById('statActiveOwners'),
        ownersSubtext: document.getElementById('statOwnersSubtext'),
        bookings: document.getElementById('statBookings'),
        bookingsSubtext: document.getElementById('statBookingsSubtext'),
        revenue: document.getElementById('statRevenue')
    };
    if (!els.totalUsers || !API?.admin?.getStats) return;
    try {
        const res = await API.admin.getStats();
        const s = res.stats || {};
        const fmt = (n) => (n ?? 0).toLocaleString();
        els.totalUsers.textContent = fmt(s.totalUsers);
        els.usersSubtext.textContent = s.usersThisWeek > 0
            ? `+${s.usersThisWeek} this week`
            : 'No new users this week';
        els.activeOwners.textContent = fmt(s.activeOwners);
        els.ownersSubtext.textContent = s.pendingVerifications > 0
            ? `${s.pendingVerifications} pending approval`
            : 'All verified';
        els.bookings.textContent = fmt(s.recentBookings);
        els.bookingsSubtext.textContent = s.bookingsPercent >= 0
            ? `+${s.bookingsPercent}% vs last week`
            : `${s.bookingsPercent}% vs last week`;
        const revAmount = Math.round(s.totalRevenue || 0);
        els.revenue.textContent = (typeof MatchFieldPrefs !== 'undefined' && MatchFieldPrefs.formatMoney)
            ? MatchFieldPrefs.formatMoney(revAmount)
            : ('₪' + revAmount.toLocaleString('en-IL'));
    } catch (err) {
        console.warn('Dashboard stats load failed:', err);
        els.totalUsers.textContent = '-';
        els.usersSubtext.textContent = 'Failed to load';
        els.activeOwners.textContent = '-';
        els.ownersSubtext.textContent = '-';
        els.bookings.textContent = '-';
        els.bookingsSubtext.textContent = '-';
        els.revenue.textContent = '-';
    }
}
loadDashboardStats();

function renderSimpleBarChart(container, rows) {
    if (!container) return;
    if (!Array.isArray(rows) || rows.length === 0) {
        container.innerHTML = '<div class="bar-chart-item"><div class="bar-chart-label">No data</div><div class="bar-chart-bar-wrapper"><div class="bar-chart-bar" style="width: 0%"></div></div><span class="bar-chart-value">0%</span></div>';
        return;
    }
    container.innerHTML = rows.map((row) => {
        const label = escapeHtml(String(row.label || 'Other'));
        const value = Math.max(0, Math.min(100, Number(row.percent) || 0));
        return `
            <div class="bar-chart-item">
                <div class="bar-chart-label">${label}</div>
                <div class="bar-chart-bar-wrapper">
                    <div class="bar-chart-bar" style="width: ${value}%"></div>
                </div>
                <span class="bar-chart-value">${value}%</span>
            </div>
        `;
    }).join('');
}

async function loadNotificationsAudienceChart() {
    if (!notificationsAudienceChart || !API?.admin?.getNotifications) return;
    try {
        const res = await API.admin.getNotifications({ limit: 200 });
        const list = res.notifications || [];
        const counts = { players: 0, owners: 0, admins: 0 };
        list.forEach((n) => {
            const a = String(n.audience || '').toLowerCase();
            if (a === 'players') counts.players += 1;
            else if (a === 'owners' || a === 'field-owners') counts.owners += 1;
            else if (a === 'admins') counts.admins += 1;
            else if (a === 'all') {
                counts.players += 1;
                counts.owners += 1;
                counts.admins += 1;
            }
        });
        const total = counts.players + counts.owners + counts.admins;
        const rows = total > 0 ? [
            { label: 'Players', percent: Math.round((counts.players / total) * 100) },
            { label: 'Field owners', percent: Math.round((counts.owners / total) * 100) },
            { label: 'Admins', percent: Math.round((counts.admins / total) * 100) }
        ] : [
            { label: 'Players', percent: 0 },
            { label: 'Field owners', percent: 0 },
            { label: 'Admins', percent: 0 }
        ];
        renderSimpleBarChart(notificationsAudienceChart, rows);
    } catch (err) {
        console.warn('Notifications audience chart failed:', err);
        renderSimpleBarChart(notificationsAudienceChart, []);
    }
}

function bookingRegionRowsFromBookingsList(bookings) {
    const S = typeof window !== 'undefined' ? window.MatchFieldBookingRegionStats : null;
    if (!S || typeof S.buildBookingRegionStats !== 'function') return [];
    const fieldById = new Map();
    (bookings || []).forEach((b) => {
        if (b.field && b.field.id) fieldById.set(b.field.id, b.field);
    });
    const slim = (bookings || []).map((b) => ({ fieldId: b.fieldId }));
    const { rows } = S.buildBookingRegionStats(slim, fieldById);
    return (rows || []).map((r) => ({
        label: r.label,
        percent: Math.max(0, Math.min(100, Number(r.percent) || 0))
    }));
}

async function loadBookingsRegionsChart() {
    if (!bookingsRegionsChart) return;
    try {
        if (API?.admin?.getBookingsRegionStats) {
            const res = await API.admin.getBookingsRegionStats();
            const rows = (res.rows || []).map((r) => ({
                label: r.label,
                percent: Math.max(0, Math.min(100, Number(r.percent) || 0))
            }));
            renderSimpleBarChart(bookingsRegionsChart, rows);
            return;
        }
    } catch (err) {
        console.warn('Bookings region stats (admin) failed:', err);
    }
    if (!API?.bookings?.getAll) {
        renderSimpleBarChart(bookingsRegionsChart, []);
        return;
    }
    try {
        const res = await API.bookings.getAll({ limit: 500 });
        const bookings = res.bookings || [];
        const rows = bookingRegionRowsFromBookingsList(bookings);
        renderSimpleBarChart(bookingsRegionsChart, rows);
    } catch (err) {
        console.warn('Bookings regions chart failed:', err);
        renderSimpleBarChart(bookingsRegionsChart, []);
    }
}

loadNotificationsAudienceChart();
loadBookingsRegionsChart();

// Load recent notifications sent by admin (runs after DOM ready)
async function loadRecentNotifications() {
    if (!recentNotifications || !API?.admin?.getNotifications) return;
    try {
        const res = await API.admin.getNotifications({ limit: 4 });
        const list = res.notifications || [];
        recentNotifications.innerHTML = '';
        if (list.length === 0) {
            recentNotifications.innerHTML = '<div class="no-results"><p>No notifications sent yet.</p></div>';
            return;
        }
        const audienceDisplay = { all: 'All users', players: 'Players', owners: 'Field owners', admins: 'Admins', private: 'Private' };
        list.forEach((n) => {
            const channels = Array.isArray(n.channels) ? n.channels : ['in-app'];
            const audName = audienceDisplay[n.audience] || n.audience;
            const timeStr = formatTimeAgo(new Date(n.createdAt));
            const item = document.createElement('div');
            item.className = 'notification-list-item';
            item.innerHTML = `
                <div class="notification-list-content">
                    <h3 class="notification-list-title">${escapeHtml(n.title)}</h3>
                    <p class="notification-list-message">${escapeHtml(n.message)}</p>
                    <p class="notification-list-time">${escapeHtml(timeStr)}</p>
                </div>
                <div class="notification-list-tags">
                    ${channels.map(c => `<span class="notification-tag">${escapeHtml(formatChannelLabel(c))}</span>`).join('')}
                    ${n.audience === 'private' ? '<span class="notification-tag notification-tag-private">Private</span>' : `<span class="notification-tag">${escapeHtml(audName)}</span>`}
                </div>
            `;
            recentNotifications.appendChild(item);
        });
    } catch (err) {
        console.warn('Load recent notifications failed:', err);
        recentNotifications.innerHTML = '<div class="no-results"><p>Failed to load notifications.</p></div>';
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadRecentNotifications());
} else {
    loadRecentNotifications();
}

// Tag Selector functionality
tagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const selector = btn.closest('.tag-selector');
        const isAudience = selector.querySelector('[data-audience]');
        const isChannel = selector.querySelector('[data-channel]');
        
        if (isAudience) {
            // Handle audience selection (single select)
            selector.querySelectorAll('[data-audience]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show/hide user selector for private notifications
            const selectedAudience = btn.dataset.audience;
            if (privateUserSelector) {
                if (selectedAudience === 'private') {
                    privateUserSelector.style.display = 'block';
                } else {
                    privateUserSelector.style.display = 'none';
                    // Clear selected user when switching away from private
                    if (selectedUserId) selectedUserId.value = '';
                    if (selectedUserDisplay) selectedUserDisplay.style.display = 'none';
                    if (userSearchInput) userSearchInput.value = '';
                    if (userDropdown) {
                        userDropdown.innerHTML = '';
                        userDropdown.classList.remove('active');
                    }
                }
            }
        } else if (isChannel) {
            // Backend requires in-app for every notification.
            const isInApp = btn.dataset.channel === 'inapp';
            if (isInApp) {
                btn.classList.add('active');
                return;
            }
            btn.classList.toggle('active');
            const inAppBtn = selector.querySelector('[data-channel="inapp"]');
            if (inAppBtn && !inAppBtn.classList.contains('active')) {
                inAppBtn.classList.add('active');
            }
        }
    });
});

// User search functionality
let searchTimeout;

// Function to perform user search (uses API for real users when available)
async function performUserSearch(searchTerm) {
    if (!userDropdown) return;
    
    const raw = typeof searchTerm === 'string' ? searchTerm.trim() : '';
    const termLc = raw.toLowerCase();
    
    if (raw.length < 2) {
        userDropdown.innerHTML = '';
        userDropdown.classList.remove('active');
        return;
    }
    
    userDropdown.innerHTML = '<div class="user-dropdown-loading">Searching...</div>';
    userDropdown.classList.add('active');
    
    let filteredUsers = [];
    if (typeof API !== 'undefined' && API.users && API.users.search) {
        try {
            const res = await API.users.search(raw);
            const users = res.users || [];
            filteredUsers = users.map((u) => ({
                id: u.id,
                name: u.fullName || u.email || 'User',
                email: u.email || '',
                role: (u.role || '').toLowerCase(),
                avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName || 'U')}&background=007BFF&color=fff`
            }));
        } catch (e) {
            console.warn('User search failed, using local:', e);
            filteredUsers = allUsers.filter((user) =>
                (user.name || '').toLowerCase().includes(termLc) ||
                (user.email || '').toLowerCase().includes(termLc)
            );
        }
    } else {
        filteredUsers = allUsers.filter((user) =>
            (user.name || '').toLowerCase().includes(termLc) ||
            (user.email || '').toLowerCase().includes(termLc)
        );
    }
    
    if (filteredUsers.length === 0) {
        userDropdown.innerHTML = '<div class="user-dropdown-empty">No users found</div>';
        userDropdown.classList.add('active');
        return;
    }
    
    userDropdown.innerHTML = filteredUsers.map(user => `
        <div class="user-dropdown-item" data-user-id="${user.id}">
            <img src="${user.avatar}" alt="${escapeHtml(user.name)}" class="user-dropdown-avatar">
            <div class="user-dropdown-info">
                <span class="user-dropdown-name">${escapeHtml(user.name)}</span>
                <span class="user-dropdown-email">${escapeHtml(user.email)}</span>
            </div>
            <span class="user-dropdown-role">${formatUserRole(user.role)}</span>
        </div>
    `).join('');
    
    userDropdown.classList.add('active');
    
    // Add click handlers to dropdown items
    userDropdown.querySelectorAll('.user-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const userId = item.dataset.userId;
            const user = filteredUsers.find((u) => u.id === userId || String(u.id) === userId);
            if (user) selectUser(user);
        });
    });
}

if (userSearchInput && userDropdown) {
    // Search on input with debounce
    userSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        
        clearTimeout(searchTimeout);
        
        searchTimeout = setTimeout(() => {
            performUserSearch(searchTerm);
        }, 300);
    });
    
    // Search on icon click
    const userSearchIcon = document.querySelector('.user-search-icon');
    if (userSearchIcon) {
        userSearchIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            if (userSearchInput) {
                performUserSearch(userSearchInput.value);
            }
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userSearchInput.contains(e.target) && 
            !userDropdown.contains(e.target) && 
            !userSearchIcon?.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
    });
}

// Select user function (user can be object or id)
function selectUser(userOrId) {
    const user = typeof userOrId === 'object' ? userOrId : allUsers.find((u) => u.id === userOrId || String(u.id) === String(userOrId));
    if (!user) return;
    
    selectedUserId.value = user.id;
    userSearchInput.value = '';
    userDropdown.innerHTML = '';
    userDropdown.classList.remove('active');
    
    // Display selected user
    const avatar = selectedUserDisplay.querySelector('.selected-user-avatar');
    const name = selectedUserDisplay.querySelector('.selected-user-name');
    const email = selectedUserDisplay.querySelector('.selected-user-email');
    const roleBadge = selectedUserDisplay.querySelector('.selected-user-role-badge');
    
    avatar.src = user.avatar;
    avatar.alt = user.name;
    name.textContent = user.name;
    email.textContent = user.email;
    roleBadge.textContent = formatUserRole(user.role);
    roleBadge.className = 'selected-user-role-badge role-' + user.role;
    
    selectedUserDisplay.style.display = 'flex';
}

// Remove selected user
if (removeUserBtn) {
    removeUserBtn.addEventListener('click', () => {
        selectedUserId.value = '';
        selectedUserDisplay.style.display = 'none';
        userSearchInput.value = '';
    });
}

// Format user role for display
function formatUserRole(role) {
    const roleMap = {
        'player': 'Player',
        'field-owner': 'Field Owner',
        'admin': 'Admin'
    };
    return roleMap[role] || role;
}

function normalizeChannelForApi(channel) {
    const value = String(channel || '').toLowerCase();
    if (value === 'inapp' || value === 'in-app') return 'in-app';
    if (value === 'email') return 'email';
    return value;
}

function formatChannelLabel(channel) {
    const normalized = normalizeChannelForApi(channel);
    if (normalized === 'in-app') return 'In-app';
    if (normalized === 'email') return 'Email';
    return String(channel || '');
}

// Send Notification functionality
if (sendNotificationBtn) {
    sendNotificationBtn.addEventListener('click', async () => {
        const title = notificationTitle.value.trim();
        const message = notificationMessage.value.trim();
        
        const selectedAudience =
            notificationAudienceSelector?.querySelector('[data-audience].active')?.dataset.audience || 'all';
        const isPrivate = selectedAudience === 'private';

        const selectedChannels = Array.from(
            notificationChannelSelector?.querySelectorAll('[data-channel].active') ?? []
        ).map((btn) => normalizeChannelForApi(btn.dataset.channel));
        
        const selectedUser = selectedUserId ? selectedUserId.value : '';
        
        if (!title || !message) {
            alert('Please fill in both title and message fields.');
            return;
        }
        
        if (selectedChannels.length === 0) {
            alert('Please select at least one channel.');
            return;
        }
        
        if (isPrivate && !selectedUser) {
            alert('Please select a user for private notification.');
            return;
        }
        
        let selectedUserData = null;
        if (isPrivate && selectedUser) {
            const id = typeof selectedUser === 'string' ? selectedUser : String(selectedUser);
            selectedUserData = (typeof allUsers !== 'undefined' && allUsers) ? allUsers.find(u => u.id === id || u.id === selectedUser) : null;
        }
        
        const btn = sendNotificationBtn;
        btn.disabled = true;
        btn.textContent = 'Sending...';
        
        try {
            const payload = {
                title,
                message,
                audience: selectedAudience,
                channels: selectedChannels
            };
            if (isPrivate && selectedUser) {
                payload.targetUserId = typeof selectedUser === 'string' ? selectedUser : String(selectedUser);
            }
            
            await API.admin.sendNotification(payload);
            
            const notification = {
                title,
                message,
                audience: selectedAudience,
                channels: selectedChannels,
                isPrivate,
                selectedUser: selectedUserData,
                time: 'Just now'
            };
                addNotificationToList(notification);
            
            // Reset form
            notificationTitle.value = '';
            notificationMessage.value = '';
            if (privateUserSelector) privateUserSelector.style.display = 'none';
            if (selectedUserId) selectedUserId.value = '';
            if (selectedUserDisplay) selectedUserDisplay.style.display = 'none';
            if (userSearchInput) userSearchInput.value = '';
            if (userDropdown) {
                userDropdown.innerHTML = '';
                userDropdown.classList.remove('active');
            }
            
            notificationChannelSelector?.querySelectorAll('[data-channel]').forEach((b) => {
                if (b.dataset.channel === 'inapp') {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            notificationAudienceSelector?.querySelectorAll('[data-audience]').forEach((b) => b.classList.remove('active'));
            const audBtn = notificationAudienceSelector?.querySelector('[data-audience="all"]');
            const chBtn = notificationChannelSelector?.querySelector('[data-channel="inapp"]');
            if (audBtn) audBtn.classList.add('active');
            if (chBtn) chBtn.classList.add('active');
            
            showNotificationSuccess();
        } catch (err) {
            console.error('Send notification error:', err);
            alert(err.message || 'Failed to send notification. Please try again.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send now';
        }
    });
}

// Add notification to the list
function addNotificationToList(notification) {
    const notificationItem = document.createElement('div');
    notificationItem.className = 'notification-list-item';
    
    // Map audience to display name
    const audienceMap = {
        'all': 'all-users',
        'players': 'players',
        'owners': 'field-owners',
        'admins': 'admins',
        'private': 'private'
    };
    
    const audienceDisplay = audienceMap[notification.audience] || notification.audience;
    
    // Create notification object for allNotifications array
    const notificationObj = {
        title: notification.title,
        message: notification.message,
        time: notification.time,
        channels: notification.channels,
        audience: audienceDisplay,
        isPrivate: notification.isPrivate || false,
        selectedUser: notification.selectedUser || null
    };
    
    // Add to allNotifications array (at the beginning)
    if (typeof allNotifications !== 'undefined') {
        allNotifications.unshift(notificationObj);
    }
    
    const audienceDisplayName = {
        'all-users': 'All users',
        'players': 'Players',
        'field-owners': 'Field owners',
        'admins': 'Admins',
        'private': 'Private'
    }[audienceDisplay] || audienceDisplay;
    
    const userInfo = notification.isPrivate && notification.selectedUser 
        ? `<span class="notification-tag notification-tag-user">To: ${escapeHtml(notification.selectedUser.name)}</span>`
        : '';
    
    notificationItem.innerHTML = `
        <div class="notification-list-content">
            <h3 class="notification-list-title">${escapeHtml(notification.title)}</h3>
            <p class="notification-list-message">${escapeHtml(notification.message)}</p>
            <p class="notification-list-time">${notification.time}</p>
        </div>
        <div class="notification-list-tags">
${notification.channels.map(channel => `<span class="notification-tag">${escapeHtml(formatChannelLabel(channel))}</span>`).join('')}
                        ${notification.isPrivate ? '<span class="notification-tag notification-tag-private">Private</span>' : `<span class="notification-tag">${escapeHtml(audienceDisplayName)}</span>`}
                        ${notification.isPrivate && notification.selectedUser ? userInfo : ''}
        </div>
    `;
    
    if (recentNotifications) {
        recentNotifications.insertBefore(notificationItem, recentNotifications.firstChild);
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Show success notification
function showNotificationSuccess() {
    const btn = sendNotificationBtn;
    const originalText = btn.textContent;
    btn.textContent = 'Sent!';
    btn.style.background = '#007A55';

    // Show success toast
    const existing = document.getElementById('successToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'successToast';
    toast.className = 'success-toast';
    toast.innerHTML = '<i class="fi fi-rr-badge-check"></i><span>Notification sent successfully!</span>';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'opacity 0.3s, transform 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);

    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
    }, 2000);
}

// Invite Admin functionality
if (inviteAdminBtn) {
    inviteAdminBtn.addEventListener('click', () => {
        if (!inviteAdminModal) return;
        if (inviteAdminForm) inviteAdminForm.style.display = 'block';
        if (inviteAdminResult) inviteAdminResult.style.display = 'none';
        if (inviteAdminError) {
            inviteAdminError.style.display = 'none';
            inviteAdminError.textContent = '';
        }
        if (inviteAdminEmail) inviteAdminEmail.value = '';
        if (inviteAdminName) inviteAdminName.value = '';
        if (inviteAdminTempPassword) inviteAdminTempPassword.value = '';
        if (inviteAdminCreatedEmail) inviteAdminCreatedEmail.textContent = '—';
        if (inviteAdminTempPassword) inviteAdminTempPassword.type = 'password';
        if (toggleInviteAdminPasswordBtn) toggleInviteAdminPasswordBtn.textContent = 'Show';
        inviteAdminModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            if (inviteAdminEmail) inviteAdminEmail.focus();
        }, 50);
    });
}

function closeInviteModal() {
    if (!inviteAdminModal) return;
    inviteAdminModal.classList.remove('active');
    document.body.style.overflow = '';
}

if (closeInviteAdminModal) closeInviteAdminModal.addEventListener('click', closeInviteModal);
if (cancelInviteAdminBtn) cancelInviteAdminBtn.addEventListener('click', closeInviteModal);
if (doneInviteAdminBtn) doneInviteAdminBtn.addEventListener('click', closeInviteModal);

if (inviteAdminModal) {
    inviteAdminModal.addEventListener('click', (e) => {
        if (e.target === inviteAdminModal) closeInviteModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && inviteAdminModal.classList.contains('active')) closeInviteModal();
    });
}

if (copyInviteAdminPasswordBtn) {
    copyInviteAdminPasswordBtn.addEventListener('click', async () => {
        const pwd = inviteAdminTempPassword ? String(inviteAdminTempPassword.value || '') : '';
        if (!pwd) return;
        try {
            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(pwd);
                copyInviteAdminPasswordBtn.textContent = 'Copied';
                setTimeout(() => (copyInviteAdminPasswordBtn.textContent = 'Copy'), 1200);
            }
        } catch (_) {
            // fallback: select text for manual copy
            try {
                inviteAdminTempPassword.focus();
                inviteAdminTempPassword.select();
            } catch (_) {}
        }
    });
}

if (toggleInviteAdminPasswordBtn && inviteAdminTempPassword) {
    toggleInviteAdminPasswordBtn.addEventListener('click', () => {
        const isHidden = inviteAdminTempPassword.type === 'password';
        inviteAdminTempPassword.type = isHidden ? 'text' : 'password';
        toggleInviteAdminPasswordBtn.textContent = isHidden ? 'Hide' : 'Show';
        toggleInviteAdminPasswordBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
}

if (inviteAdminForm) {
    inviteAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (inviteAdminError) {
            inviteAdminError.style.display = 'none';
            inviteAdminError.textContent = '';
        }
        const email = inviteAdminEmail ? String(inviteAdminEmail.value || '').trim() : '';
        const fullName = inviteAdminName ? String(inviteAdminName.value || '').trim() : '';

        if (!email || !email.includes('@')) {
            if (inviteAdminError) {
                inviteAdminError.textContent = 'Please enter a valid email address.';
                inviteAdminError.style.display = 'block';
            }
            return;
        }
        if (!API?.admin?.inviteAdmin) {
            if (inviteAdminError) {
                inviteAdminError.textContent = 'API not available. Make sure you opened this page from the backend server.';
                inviteAdminError.style.display = 'block';
            }
            return;
        }

        if (submitInviteAdminBtn) {
            submitInviteAdminBtn.disabled = true;
            submitInviteAdminBtn.textContent = 'Creating...';
        }

        try {
            const res = await API.admin.inviteAdmin(email, fullName);
            const createdEmail = res && res.user && res.user.email ? String(res.user.email) : email;
            const pwd = res && res.tempPassword ? String(res.tempPassword) : '';

            if (inviteAdminCreatedEmail) inviteAdminCreatedEmail.textContent = createdEmail;
            if (inviteAdminTempPassword) inviteAdminTempPassword.value = pwd;
            if (inviteAdminTempPassword) inviteAdminTempPassword.type = 'password';
            if (toggleInviteAdminPasswordBtn) toggleInviteAdminPasswordBtn.textContent = 'Show';

            if (inviteAdminForm) inviteAdminForm.style.display = 'none';
            if (inviteAdminResult) inviteAdminResult.style.display = 'block';

            // auto-copy best effort
            if (pwd && navigator && navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(pwd);
                    if (copyInviteAdminPasswordBtn) {
                        copyInviteAdminPasswordBtn.textContent = 'Copied';
                        setTimeout(() => (copyInviteAdminPasswordBtn.textContent = 'Copy'), 1200);
                    }
                } catch (_) {}
            }
        } catch (err) {
            if (inviteAdminError) {
                inviteAdminError.textContent = (err && err.message) ? err.message : 'Failed to create admin.';
                inviteAdminError.style.display = 'block';
            }
        } finally {
            if (submitInviteAdminBtn) {
                submitInviteAdminBtn.disabled = false;
                submitInviteAdminBtn.textContent = 'Create admin';
            }
        }
    });
}

// Time formatting for notifications
function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return days === 1 ? 'Yesterday' : `${days} days ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
        return `${minutes} min ago`;
    } else {
        return 'Just now';
    }
}

function getGreetingForHour(hour) {
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

function getDisplayNameFromUser(user) {
    const full = (user && (user.fullName || user.name)) ? String(user.fullName || user.name).trim() : '';
    if (!full) return 'Admin';
    // Use first name for compact header greeting
    return full.split(/\s+/)[0] || full;
}

// Initialize greeting with time-based message + logged-in user's name (no hardcoded name)
async function updateGreeting() {
    const greetingHeader = document.querySelector('.greeting-header h1');
    if (!greetingHeader) return;

    const hour = new Date().getHours();
    const greeting = getGreetingForHour(hour);
    const emoji = '👋';

    try {
        const localUser = API && API.getCurrentUser ? API.getCurrentUser() : null;
        if (localUser) {
            greetingHeader.textContent = `${greeting}, ${getDisplayNameFromUser(localUser)} ${emoji}`;
            return;
        }

        if (API && API.auth && API.auth.getCurrentUser) {
            const res = await API.auth.getCurrentUser();
            const u = res && res.user ? res.user : null;
            if (u && API.setCurrentUser) API.setCurrentUser(u);
            greetingHeader.textContent = `${greeting}, ${getDisplayNameFromUser(u)} ${emoji}`;
            return;
        }
    } catch (_) {
        // ignore, fall back
    }

    greetingHeader.textContent = `${greeting} ${emoji}`;
}

updateGreeting();

// Store all notifications (will be populated from existing notifications)
let allNotifications = [];

// Sample users data for private notifications
let allUsers = [
    {
        id: 1,
        name: 'Michael Johnson',
        email: 'michael.johnson@example.com',
        role: 'player',
        avatar: 'https://ui-avatars.com/api/?name=Michael+Johnson&background=007BFF&color=fff'
    },
    {
        id: 2,
        name: 'Sarah Williams',
        email: 'sarah.williams@example.com',
        role: 'field-owner',
        avatar: 'https://ui-avatars.com/api/?name=Sarah+Williams&background=7C3AED&color=fff'
    },
    {
        id: 3,
        name: 'Ahmed Hassan',
        email: 'ahmed.hassan@example.com',
        role: 'field-owner',
        avatar: 'https://ui-avatars.com/api/?name=Ahmed+Hassan&background=7C3AED&color=fff'
    },
    {
        id: 4,
        name: 'Emma Davis',
        email: 'emma.davis@example.com',
        role: 'player',
        avatar: 'https://ui-avatars.com/api/?name=Emma+Davis&background=007BFF&color=fff'
    },
    {
        id: 5,
        name: 'John Smith',
        email: 'john.smith@example.com',
        role: 'admin',
        avatar: 'https://ui-avatars.com/api/?name=John+Smith&background=1F2937&color=fff'
    },
    {
        id: 6,
        name: 'Maria Garcia',
        email: 'maria.garcia@example.com',
        role: 'player',
        avatar: 'https://ui-avatars.com/api/?name=Maria+Garcia&background=007BFF&color=fff'
    },
    {
        id: 7,
        name: 'David Brown',
        email: 'david.brown@example.com',
        role: 'field-owner',
        avatar: 'https://ui-avatars.com/api/?name=David+Brown&background=7C3AED&color=fff'
    },
    {
        id: 8,
        name: 'Lisa Anderson',
        email: 'lisa.anderson@example.com',
        role: 'admin',
        avatar: 'https://ui-avatars.com/api/?name=Lisa+Anderson&background=1F2937&color=fff'
    }
];

// View All Notifications Modal
const viewAllNotificationsBtn = document.getElementById('viewAllNotificationsBtn');
const viewAllNotificationsModal = document.getElementById('viewAllNotificationsModal');
const closeNotificationsModal = document.getElementById('closeNotificationsModal');
const allNotificationsList = document.getElementById('allNotificationsList');
const notificationSearch = document.getElementById('notificationSearch');
const filterAudience = document.getElementById('filterAudience');
const filterChannel = document.getElementById('filterChannel');

// Load all notifications for View all modal (admin-sent only, excludes Contact Us replies)
async function initializeNotifications() {
    if (!API?.admin?.getNotifications) {
        allNotifications = [];
        return;
    }
    try {
        const res = await API.admin.getNotifications({ limit: 100 });
        const list = res.notifications || [];
        const audienceDisplay = { all: 'all-users', players: 'players', owners: 'field-owners', admins: 'admins', private: 'private' };
        allNotifications = list.map((n) => {
            const channels = Array.isArray(n.channels) ? n.channels : ['in-app'];
            return {
                title: n.title,
                message: n.message,
                time: formatTimeAgo(new Date(n.createdAt)),
                channels,
                audience: audienceDisplay[n.audience] || n.audience || 'all-users',
                isPrivate: n.audience === 'private',
                selectedUser: null
            };
        });
    } catch (err) {
        console.warn('Load notifications for View all failed:', err);
        allNotifications = [];
    }
}

// Open modal
if (viewAllNotificationsBtn && viewAllNotificationsModal) {
    viewAllNotificationsBtn.addEventListener('click', async () => {
        await initializeNotifications();
        renderAllNotifications();
        viewAllNotificationsModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
}

// Close modal
if (closeNotificationsModal && viewAllNotificationsModal) {
    closeNotificationsModal.addEventListener('click', () => {
        viewAllNotificationsModal.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    // Close on overlay click
    viewAllNotificationsModal.addEventListener('click', (e) => {
        if (e.target === viewAllNotificationsModal) {
            viewAllNotificationsModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && viewAllNotificationsModal.classList.contains('active')) {
            viewAllNotificationsModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// Render all notifications
function renderAllNotifications(filteredNotifications = null) {
    const notificationsToRender = filteredNotifications || allNotifications;
    
    if (!allNotificationsList) return;
    
    if (notificationsToRender.length === 0) {
        allNotificationsList.innerHTML = `
            <div class="no-results">
                <i class="fi fi-rr-search-alt"></i>
                <p>No notifications sent yet.</p>
            </div>
        `;
        return;
    }
    
    allNotificationsList.innerHTML = `
        <div class="notifications-list">
            ${notificationsToRender.map(notification => `
                <div class="notification-list-item">
                    <div class="notification-list-content">
                        <h3 class="notification-list-title">${escapeHtml(notification.title)}</h3>
                        <p class="notification-list-message">${escapeHtml(notification.message)}</p>
                        <p class="notification-list-time">${escapeHtml(notification.time)}</p>
                    </div>
                    <div class="notification-list-tags">
                        ${notification.channels.map(channel => `<span class="notification-tag">${escapeHtml(formatChannelLabel(channel))}</span>`).join('')}
                        ${notification.isPrivate ? '<span class="notification-tag notification-tag-private">Private</span>' : `<span class="notification-tag">${escapeHtml(formatAudienceName(notification.audience))}</span>`}
                        ${notification.isPrivate && notification.selectedUser 
                            ? `<span class="notification-tag notification-tag-user">To: ${escapeHtml(notification.selectedUser.name)}</span>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Format audience name for display
function formatAudienceName(audience) {
    const audienceMap = {
        'all-users': 'All users',
        'players': 'Players',
        'field-owners': 'Field owners',
        'admins': 'Admins',
        'all': 'All users',
        'private': 'Private'
    };
    return audienceMap[audience] || audience;
}

// Filter and search notifications
function filterNotifications() {
    const searchTerm = notificationSearch ? notificationSearch.value.toLowerCase().trim() : '';
    const selectedAudience = filterAudience ? filterAudience.value : 'all';
    const selectedChannel = filterChannel ? filterChannel.value : 'all';
    
    let filtered = allNotifications.filter(notification => {
        // Search filter
        const matchesSearch = !searchTerm || 
            notification.title.toLowerCase().includes(searchTerm) ||
            notification.message.toLowerCase().includes(searchTerm);
        
        // Audience filter
        const matchesAudience = selectedAudience === 'all' || 
            notification.audience === selectedAudience;
        
        // Channel filter
        const matchesChannel = selectedChannel === 'all' ||
            notification.channels.some((channel) => normalizeChannelForApi(channel) === normalizeChannelForApi(selectedChannel));
        
        return matchesSearch && matchesAudience && matchesChannel;
    });
    
    renderAllNotifications(filtered);
}

// Search functionality
if (notificationSearch) {
    notificationSearch.addEventListener('input', filterNotifications);
}

// Filter functionality
if (filterAudience) {
    filterAudience.addEventListener('change', filterNotifications);
}

if (filterChannel) {
    filterChannel.addEventListener('change', filterNotifications);
}

