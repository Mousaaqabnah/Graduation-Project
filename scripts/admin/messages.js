// Messages Management functionality

// DOM Elements - will be initialized on DOMContentLoaded
let notificationBtn, notificationPopup, profileBtn, profilePopup;
let messageSearch, statusFilter, messagesList;
let messageModal, closeMessageModal, messageContent;
let spamBlockedBtn;

// Sample messages data
let allMessages = [
    {
        id: 1,
        fullName: 'Mousa Aqabnah',
        email: 'mousa.aqabnah@example.com',
        phone: '+90 555 123 4567',
        topic: 'Question about field availability',
        message: 'Hi, I would like to know if Field A is available for booking next weekend. We are planning a tournament and need to confirm the availability.',
        date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        status: 'unread',
        starred: false,
        important: false,
        blocked: false
    },
    {
        id: 2,
        fullName: 'Baraa Qasem',
        email: 'Baraa.Qasem@example.com',
        phone: '+90 555 234 5678',
        topic: 'Reservation confirmation issue',
        message: 'I made a reservation yesterday but haven\'t received a confirmation email yet. My booking reference is #12345. Can you please check?',
        date: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        status: 'pending',
        starred: true,
        important: true,
        blocked: false
    },
    {
        id: 3,
        fullName: 'Alex Morgan',
        email: 'alex.morgan@example.com',
        phone: '+90 555 345 6789',
        topic: 'Booking problem',
        message: 'I booked a field for tomorrow but I need to cancel it. How can I do that?',
        date: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        status: 'read',
        starred: false,
        important: false,
        blocked: false
    },
    {
        id: 4,
        fullName: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        phone: '+90 555 456 7890',
        topic: 'Payment issue',
        message: 'I tried to pay for my booking but the payment failed. Can you help me resolve this?',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        status: 'read',
        starred: false,
        important: false,
        blocked: false
    },
    {
        id: 5,
        fullName: 'Michael Brown',
        email: 'michael.brown@example.com',
        phone: '+90 555 567 8901',
        topic: 'Field availability',
        message: 'I want to know if the football field is available this weekend for a tournament.',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        status: 'replied',
        starred: false,
        important: false,
        blocked: false
    }
];


// Calculate time ago
function getTimeAgo(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'Minute' : 'Minutes'} Ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'Hour' : 'Hours'} Ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'} Ago`;
    return date.toLocaleDateString();
}

// Render messages as cards
function renderMessages(messages = allMessages) {
    if (!messagesList) {
        console.error('messagesList element not found!');
        return;
    }
    
    // Filter out blocked messages unless viewing spam/blocked
    const filteredMessages = messages.filter(msg => !msg.blocked);
    
    console.log('Rendering messages:', filteredMessages.length);
    
    if (filteredMessages.length === 0) {
        messagesList.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #6B7280;">
                <p style="font-size: 16px; margin: 0;">No messages found matching your criteria.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    filteredMessages.forEach(msg => {
        try {
            const isUnread = msg.status === 'unread';
            const timeAgo = getTimeAgo(msg.date);
            const badges = [];
            
            if (msg.status === 'unread') badges.push({ text: 'Unread', class: 'unread' });
            if (msg.status === 'pending') badges.push({ text: 'Pending', class: 'pending' });
            if (msg.important) badges.push({ text: 'Important', class: 'important' });
            
            const badgesHtml = badges.length > 0 ? `
                <div class="message-badges">
                    ${badges.map(badge => `
                        <span class="status-badge ${badge.class}">${badge.text}</span>
                    `).join('')}
                </div>
            ` : '';
            
            html += `
            <div class="message-card ${isUnread ? 'unread' : ''}">
                <div class="message-card-content">
                    <div class="message-sender-info">
                        <h3 class="message-sender-name">${escapeHtml(msg.fullName)}</h3>
                        <p class="message-sender-email">${escapeHtml(msg.email)}</p>
                    </div>
                    <h4 class="message-subject">${escapeHtml(msg.topic || 'No topic')}</h4>
                    <p class="message-preview">${escapeHtml(msg.message)}</p>
                    ${badgesHtml}
                </div>
                <div class="message-actions-right">
                    <div class="message-icon-actions">
                        <button class="message-icon-btn ${msg.starred ? 'starred' : ''}" onclick="toggleStar(${msg.id})" title="${msg.starred ? 'Unstar' : 'Star'}">
                            <i class="fi ${msg.starred ? 'fi-sr-star' : 'fi-rr-star'}"></i>
                        </button>
                        <button class="message-icon-btn" onclick="blockMessage(${msg.id})" title="Block/Spam">
                            <i class="fi fi-rr-circle-xmark"></i>
                        </button>
                    </div>
                    <p class="message-time">${timeAgo}</p>
                    <button class="btn-view-message" onclick="showMessageDetail(${msg.id})">
                        View Message
                    </button>
                </div>
            </div>
            `;
        } catch (error) {
            console.error('Error rendering message:', msg, error);
        }
    });
    
    messagesList.innerHTML = html;
}

// Format status for display
function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Filter messages
function filterMessages() {
    const searchTerm = messageSearch ? messageSearch.value.toLowerCase().trim() : '';
    const selectedStatus = statusFilter ? statusFilter.value : 'all';
    
    let filtered = allMessages.filter(msg => {
        // Search filter
        const matchesSearch = !searchTerm || 
            msg.fullName.toLowerCase().includes(searchTerm) ||
            msg.email.toLowerCase().includes(searchTerm) ||
            (msg.topic && msg.topic.toLowerCase().includes(searchTerm)) ||
            msg.message.toLowerCase().includes(searchTerm);
        
        // Status filter
        const matchesStatus = selectedStatus === 'all' || msg.status === selectedStatus;
        
        return matchesSearch && matchesStatus;
    });
    
    renderMessages(filtered);
}


// Toggle star
function toggleStar(messageId) {
    const message = allMessages.find(m => m.id === messageId);
    if (!message) return;
    
    message.starred = !message.starred;
    filterMessages(); // Re-render to show updated star state
}

// Block/Spam message
function blockMessage(messageId) {
    const message = allMessages.find(m => m.id === messageId);
    if (!message) return;
    
    if (confirm(`Block/Spam message from ${message.fullName}?`)) {
        message.blocked = true;
        filterMessages(); // Re-render to remove blocked message
        console.log(`Message from ${message.fullName} blocked`);
    }
}

// Show message detail modal
function showMessageDetail(messageId) {
    const message = allMessages.find(m => m.id === messageId);
    if (!message) return;
    
    // Mark as read when viewing
    if (message.status === 'unread') {
        message.status = 'read';
        filterMessages(); // Re-render to update status
    }
    
    if (messageContent) {
        const initials = message.fullName.split(' ').map(n => n[0]).join('').toUpperCase();
        const timeAgo = getTimeAgo(message.date);
        
        messageContent.innerHTML = `
            <div class="message-detail-header">
                <div class="message-detail-avatar">
                    ${initials}
                </div>
                <div class="message-detail-info">
                    <h3 class="message-detail-name">${escapeHtml(message.fullName)}</h3>
                    <p class="message-detail-email">${escapeHtml(message.email)}</p>
                    ${message.phone ? `<p class="message-detail-phone">${escapeHtml(message.phone)}</p>` : ''}
                </div>
            </div>
            
            <div class="message-detail-content">
                <div class="message-detail-topic">
                    ${escapeHtml(message.topic || 'No topic')}
                </div>
                <div class="message-detail-text">
                    ${escapeHtml(message.message)}
                </div>
                <div class="message-detail-meta">
                    <span>Received: ${timeAgo}</span>
                    <span class="status-badge ${message.status}">${formatStatus(message.status)}</span>
                </div>
            </div>
            
            <div class="message-detail-actions">
                <button class="btn-mark-read" onclick="markAsRead(${message.id}); closeMessageModal();" ${message.status === 'read' || message.status === 'replied' ? 'style="display:none"' : ''}>
                    <i class="fi fi-rr-check"></i> Mark as Read
                </button>
                <button class="btn-reply" onclick="replyToMessage(${message.id})">
                    <i class="fi fi-rr-envelope"></i> Reply
                </button>
                <button class="btn-delete" onclick="deleteMessage(${message.id}); closeMessageModal();">
                    <i class="fi fi-rr-trash"></i> Delete
                </button>
            </div>
        `;
    }
    
    if (messageModal) {
        messageModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Mark message as read
function markAsRead(messageId) {
    const message = allMessages.find(m => m.id === messageId);
    if (!message) return;
    
    message.status = 'read';
    filterMessages(); // Re-render to show updated status
    console.log(`Message from ${message.fullName} marked as read`);
}

// Reply to message
function replyToMessage(messageId) {
    const message = allMessages.find(m => m.id === messageId);
    if (!message) return;
    
    // Open email client or show reply form
    const subject = encodeURIComponent(`Re: ${message.topic || 'Your message'}`);
    const body = encodeURIComponent(`\n\n--- Original Message ---\nFrom: ${message.fullName} (${message.email})\nDate: ${message.date} ${message.time}\n\n${message.message}`);
    window.location.href = `mailto:${message.email}?subject=${subject}&body=${body}`;
    
    // Mark as replied
    message.status = 'replied';
    filterMessages();
}

// Delete message
function deleteMessage(messageId) {
    const message = allMessages.find(m => m.id === messageId);
    if (!message) return;
    
    if (confirm(`Delete message from ${message.fullName}?`)) {
        allMessages = allMessages.filter(m => m.id !== messageId);
        filterMessages(); // Re-render table
        console.log(`Message from ${message.fullName} deleted`);
    }
}

// Close message modal
function closeMessageModal() {
    if (messageModal) {
        messageModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}


// Make functions globally available for onclick handlers
window.showMessageDetail = showMessageDetail;
window.markAsRead = markAsRead;
window.replyToMessage = replyToMessage;
window.deleteMessage = deleteMessage;
window.closeMessageModal = closeMessageModal;
window.toggleStar = toggleStar;
window.blockMessage = blockMessage;
window.initializeMessages = initializeMessages;
window.renderMessages = renderMessages;

// Initialize function
function initializeMessages() {
    console.log('Messages page loaded, initializing...');
    
    // Initialize DOM elements
    notificationBtn = document.getElementById('notificationBtn');
    notificationPopup = document.getElementById('notificationPopup');
    profileBtn = document.getElementById('profileBtn');
    profilePopup = document.getElementById('profilePopup');
    messageSearch = document.getElementById('messageSearch');
    statusFilter = document.getElementById('statusFilter');
    messagesList = document.getElementById('messagesList');
    messageModal = document.getElementById('messageModal');
    closeMessageModal = document.getElementById('closeMessageModal');
    messageContent = document.getElementById('messageContent');
    spamBlockedBtn = document.getElementById('spamBlockedBtn');
    
    console.log('DOM elements initialized. messagesList:', messagesList);
    console.log('Total messages:', allMessages.length);
    
    if (!messagesList) {
        console.error('messagesList element not found! Check HTML structure.');
        return;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Remove loading indicator
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
    
    // Render messages
    renderMessages();
    
    console.log('Initialization complete');
}

// Initialize: Render messages on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMessages);
} else {
    // DOM is already loaded
    initializeMessages();
}

// Setup event listeners
function setupEventListeners() {
    // Notification Popup Toggle
    if (notificationBtn && notificationPopup) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationPopup.classList.toggle('active');
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
            if (notificationPopup) {
                notificationPopup.classList.remove('active');
            }
        });
    }

    // Close popups when clicking outside
    document.addEventListener('click', (e) => {
        if (notificationPopup && !notificationPopup.contains(e.target) && notificationBtn && !notificationBtn.contains(e.target)) {
            notificationPopup.classList.remove('active');
        }
        if (profilePopup && !profilePopup.contains(e.target) && profileBtn && !profileBtn.contains(e.target)) {
            profilePopup.classList.remove('active');
        }
    });
    
    // Search functionality
    if (messageSearch) {
        messageSearch.addEventListener('input', filterMessages);
    }

    // Filter functionality
    if (statusFilter) {
        statusFilter.addEventListener('change', filterMessages);
    }

    // Spam/Blocked Messages button
    if (spamBlockedBtn) {
        spamBlockedBtn.addEventListener('click', () => {
            const blockedMessages = allMessages.filter(msg => msg.blocked);
            renderMessages(blockedMessages);
        });
    }
    
    // Close message modal
    if (closeMessageModal && messageModal) {
        closeMessageModal.addEventListener('click', () => {
            closeMessageModal();
        });
        
        // Close on overlay click
        messageModal.addEventListener('click', (e) => {
            if (e.target === messageModal) {
                closeMessageModal();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && messageModal.classList.contains('active')) {
                closeMessageModal();
            }
        });
    }
}

