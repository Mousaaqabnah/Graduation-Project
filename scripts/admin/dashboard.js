// Admin Dashboard functionality

// DOM Elements
const notificationBtn = document.getElementById('notificationBtn');
const notificationPopup = document.getElementById('notificationPopup');
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

// Notification Popup Toggle
if (notificationBtn && notificationPopup) {
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationPopup.classList.toggle('active');
        // Close profile popup if open
        if (profilePopup) {
            profilePopup.classList.remove('active');
        }
    });
}

// Profile Popup Toggle
if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profilePopup.classList.toggle('active');
        // Close notification popup if open
        if (notificationPopup) {
            notificationPopup.classList.remove('active');
        }
    });
}

// Close popups when clicking outside
document.addEventListener('click', (e) => {
    if (notificationPopup && !notificationPopup.contains(e.target) && !notificationBtn.contains(e.target)) {
        notificationPopup.classList.remove('active');
    }
    if (profilePopup && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('active');
    }
});

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
            // Handle channel selection (multi-select)
            btn.classList.toggle('active');
        }
    });
});

// User search functionality
let searchTimeout;

// Function to perform user search
function performUserSearch(searchTerm) {
    if (!userDropdown) return;
    
    const term = searchTerm.trim().toLowerCase();
    
    if (term.length === 0) {
        userDropdown.innerHTML = '';
        userDropdown.classList.remove('active');
        return;
    }
    
    const filteredUsers = allUsers.filter(user => 
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
    );
    
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
            const userId = parseInt(item.dataset.userId);
            selectUser(userId);
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

// Select user function
function selectUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    selectedUserId.value = userId;
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

// Send Notification functionality
if (sendNotificationBtn) {
    sendNotificationBtn.addEventListener('click', () => {
        const title = notificationTitle.value.trim();
        const message = notificationMessage.value.trim();
        
        // Get selected audience
        const selectedAudience = document.querySelector('.tag-selector [data-audience].active')?.dataset.audience || 'all';
        const isPrivate = selectedAudience === 'private';
        
        // Get selected channels
        const selectedChannels = Array.from(document.querySelectorAll('.tag-selector [data-channel].active'))
            .map(btn => btn.dataset.channel === 'inapp' ? 'In-app' : 'Email');
        
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
        
        // Get selected user details if private
        let selectedUserData = null;
        if (isPrivate && selectedUser) {
            selectedUserData = allUsers.find(u => u.id === parseInt(selectedUser));
        }
        
        // Create notification object
        const notification = {
            title,
            message,
            audience: selectedAudience,
            channels: selectedChannels,
            isPrivate: isPrivate,
            selectedUser: selectedUserData,
            time: 'Just now'
        };
        
        // Add to recent notifications
        addNotificationToList(notification);
        
        // Reset form
        notificationTitle.value = '';
        notificationMessage.value = '';
        if (privateUserSelector) {
            privateUserSelector.style.display = 'none';
        }
        if (selectedUserId) {
            selectedUserId.value = '';
        }
        if (selectedUserDisplay) {
            selectedUserDisplay.style.display = 'none';
        }
        if (userSearchInput) {
            userSearchInput.value = '';
        }
        if (userDropdown) {
            userDropdown.innerHTML = '';
            userDropdown.classList.remove('active');
        }
        
        // Reset channel selection
        document.querySelectorAll('.tag-selector [data-channel]').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Set default: All users and In-app
        document.querySelectorAll('.tag-selector [data-audience]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('.tag-selector [data-audience]').classList.add('active');
        document.querySelector('.tag-selector [data-channel]').classList.add('active');
        
        // Show success message (you can customize this)
        showNotificationSuccess();
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
            ${notification.channels.map(channel => `<span class="notification-tag">${escapeHtml(channel)}</span>`).join('')}
            ${notification.isPrivate ? '<span class="notification-tag notification-tag-private">Private</span>' : ''}
            ${notification.isPrivate ? userInfo : `<span class="notification-tag">${escapeHtml(audienceDisplayName)}</span>`}
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
    // You can customize this to show a toast notification or similar
    const btn = sendNotificationBtn;
    const originalText = btn.textContent;
    btn.textContent = 'Sent!';
    btn.style.background = '#007A55';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
    }, 2000);
}

// Invite Admin functionality
if (inviteAdminBtn) {
    inviteAdminBtn.addEventListener('click', () => {
        // You can implement invite admin modal or redirect here
        const email = prompt('Enter email address to invite as admin:');
        if (email && email.includes('@')) {
            // Here you would typically send an API request to invite the admin
            alert(`Invitation will be sent to ${email}`);
        } else if (email) {
            alert('Please enter a valid email address.');
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

// Initialize greeting with time-based message
function updateGreeting() {
    const greetingHeader = document.querySelector('.greeting-header h1');
    if (greetingHeader) {
        const hour = new Date().getHours();
        let greeting;
        let emoji = '👋';
        
        if (hour < 12) {
            greeting = 'Good morning';
        } else if (hour < 18) {
            greeting = 'Good afternoon';
        } else {
            greeting = 'Good evening';
        }
        
        // You can get the user's name from your authentication system
        const userName = 'Mousa'; // This should come from your user data
        greetingHeader.textContent = `${greeting}, ${userName} ${emoji}`;
    }
}

// Update greeting on load
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

// Extract notifications from the page and populate allNotifications array
function initializeNotifications() {
    const notificationItems = document.querySelectorAll('#recentNotifications .notification-list-item');
    allNotifications = Array.from(notificationItems).map(item => {
        const titleEl = item.querySelector('.notification-list-title');
        const messageEl = item.querySelector('.notification-list-message');
        const timeEl = item.querySelector('.notification-list-time');
        const tags = Array.from(item.querySelectorAll('.notification-tag')).map(tag => tag.textContent.trim());
        
        // Determine audience and channels from tags
        const channels = tags.filter(tag => tag === 'In-app' || tag === 'Email');
        const audiences = tags.filter(tag => !channels.includes(tag));
        
        const isPrivate = tags.some(tag => tag.toLowerCase() === 'private');
        
        // Extract user info if private notification
        const userTag = tags.find(tag => tag.toLowerCase().startsWith('to:'));
        let selectedUser = null;
        if (userTag && isPrivate) {
            const userName = userTag.replace('To:', '').trim();
            selectedUser = allUsers.find(u => u.name === userName) || { name: userName };
        }
        
        return {
            title: titleEl ? titleEl.textContent.trim() : '',
            message: messageEl ? messageEl.textContent.trim() : '',
            time: timeEl ? timeEl.textContent.trim() : '',
            channels: channels,
            audience: audiences.length > 0 ? audiences[0].toLowerCase().replace(' ', '-') : 'all-users',
            isPrivate: isPrivate,
            selectedUser: selectedUser,
            originalElement: item
        };
    });
    
    // Add some sample notifications for demonstration
    allNotifications.push(
        {
            title: 'System maintenance scheduled',
            message: 'The platform will be under maintenance on Saturday from 2 AM to 4 AM.',
            time: '2 hours ago',
            channels: ['In-app', 'Email'],
            audience: 'all-users',
            isPrivate: false,
            selectedUser: null
        },
        {
            title: 'New payment method available',
            message: 'We now support credit card payments directly on the platform.',
            time: '3 hours ago',
            channels: ['In-app'],
            audience: 'players',
            isPrivate: false,
            selectedUser: null
        },
        {
            title: 'Updated field owner guidelines',
            message: 'Please review the updated guidelines for field owners in your dashboard.',
            time: '1 day ago',
            channels: ['Email'],
            audience: 'field-owners',
            isPrivate: false,
            selectedUser: null
        },
        {
            title: 'Welcome to MatchField!',
            message: 'Thank you for joining MatchField. Start exploring fields near you!',
            time: '2 days ago',
            channels: ['In-app', 'Email'],
            audience: 'players',
            isPrivate: false,
            selectedUser: null
        },
        {
            title: 'Monthly report available',
            message: 'Your monthly earnings report is now available in your dashboard.',
            time: '3 days ago',
            channels: ['Email'],
            audience: 'field-owners',
            isPrivate: false,
            selectedUser: null
        }
    );
}

// Open modal
if (viewAllNotificationsBtn && viewAllNotificationsModal) {
    viewAllNotificationsBtn.addEventListener('click', () => {
        initializeNotifications();
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
                <p>No notifications found matching your criteria.</p>
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
                        ${notification.channels.map(channel => `<span class="notification-tag">${escapeHtml(channel)}</span>`).join('')}
                        ${notification.isPrivate ? '<span class="notification-tag notification-tag-private">Private</span>' : ''}
                        ${notification.isPrivate && notification.selectedUser 
                            ? `<span class="notification-tag notification-tag-user">To: ${escapeHtml(notification.selectedUser.name)}</span>`
                            : `<span class="notification-tag">${escapeHtml(formatAudienceName(notification.audience))}</span>`}
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
            notification.channels.includes(selectedChannel === 'in-app' ? 'In-app' : 'Email');
        
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

