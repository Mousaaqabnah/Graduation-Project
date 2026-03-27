// Messages Management functionality
// Note: allMessages is populated by loadMessagesFromAPI() from the inline script in messages.html

// DOM Elements - will be initialized on DOMContentLoaded
let notificationBtn, notificationPopup, profileBtn, profilePopup;
let messageSearch, statusFilter, messagesList;
let messageModal, closeMessageModal, messageContent;
let spamBlockedBtn;

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

// Render messages as cards (uses allMessages from inline script in messages.html)
function renderMessages(messages) {
    if (messages === undefined) messages = typeof allMessages !== 'undefined' ? allMessages : [];
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
            else if (msg.status === 'read') badges.push({ text: 'Read', class: 'read' });
            if (msg.starred) badges.push({ text: '(marked)', class: 'marked' });
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
                        <button class="message-icon-btn ${msg.blocked ? 'unblock-btn' : ''}" onclick="toggleBlock(${msg.id})" title="${msg.blocked ? 'Unblock (move to normal)' : 'Block/Spam'}">
                            <i class="fi ${msg.blocked ? 'fi-rr-check-circle' : 'fi-rr-circle-xmark'}"></i>
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
async function toggleStar(messageId) {
    const message = allMessages.find(m => m.id === messageId);
    if (!message) return;
    const newStarred = !message.starred;
    try {
        if (API && API.messages && API.messages.setStarred) {
            await API.messages.setStarred(message.conversationId, newStarred);
        }
        message.starred = newStarred;
        filterMessages();
    } catch (e) {
        console.warn('Could not update star:', e);
    }
}

// Toggle Block: block normal message, or unblock to move back to normal
async function toggleBlock(messageId) {
    const message = allMessages.find(m => m.id === messageId);
    if (!message) return;
    
    if (message.blocked) {
        if (!confirm(`Do you want to unblock this message from ${message.fullName}?`)) return;
        try {
            if (API && API.messages && API.messages.setBlocked) {
                await API.messages.setBlocked(message.conversationId, false);
            }
            message.blocked = false;
            filterMessages();
        } catch (e) {
            console.warn('Could not unblock:', e);
            alert('Failed to unblock. Please try again.');
        }
    } else {
        if (!confirm(`Block/Spam message from ${message.fullName}?`)) return;
        try {
            if (API && API.messages && API.messages.setBlocked) {
                await API.messages.setBlocked(message.conversationId, true);
            }
            message.blocked = true;
            filterMessages();
        } catch (e) {
            console.warn('Could not block:', e);
            alert('Failed to block. Please try again.');
        }
    }
}

// Show message detail modal - fetches and displays full conversation history
async function showMessageDetail(messageId) {
    const message = allMessages.find(m => m.id === messageId);
    if (!message || !messageContent || !messageModal) return;
    
    // Mark as read when viewing (persist to backend)
    if (message.status === 'unread') {
        message.status = 'read';
        filterMessages();
        if (message.conversationId && message.latestMessageId && window.API && API.messages && API.messages.markAsRead) {
            try {
                await API.messages.markAsRead(message.conversationId, message.latestMessageId);
            } catch (e) {
                console.warn('Could not mark message as read:', e);
            }
        }
    }
    
    const initials = message.fullName.split(' ').map(n => n[0]).join('').toUpperCase();
    const currentUser = (window.API && API.getCurrentUser) ? API.getCurrentUser() : null;
    
    messageContent.innerHTML = `
        <div class="message-detail-header">
            <div class="message-detail-avatar">${initials}</div>
            <div class="message-detail-info">
                <h3 class="message-detail-name">${escapeHtml(message.fullName)}</h3>
                <p class="message-detail-email">${escapeHtml(message.email)}</p>
                ${message.phone ? `<p class="message-detail-phone">${escapeHtml(message.phone)}</p>` : ''}
            </div>
        </div>
        <div class="message-detail-thread-loading"><i class="fi fi-rr-spinner"></i> Loading full conversation...</div>
        <div class="message-detail-thread" id="messageDetailThread" style="display:none;"></div>
    `;
    messageModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    try {
        const res = await API.messages.getMessages(message.conversationId, { page: 1, limit: 200 });
        const messages = res.messages || [];
        const threadEl = document.getElementById('messageDetailThread');
        const loadingEl = messageContent.querySelector('.message-detail-thread-loading');
        if (loadingEl) loadingEl.remove();
        if (messages.length === 0) {
            threadEl.innerHTML = '<div class="message-detail-empty">No messages in this conversation.</div>';
        } else {
            const threadHtml = messages.map(m => {
                const isFromAdmin = currentUser && m.sender && m.sender.id === currentUser.id;
                const senderName = m.sender ? m.sender.fullName : 'Unknown';
                const timeStr = m.createdAt ? getTimeAgo(m.createdAt) : '';
                return `<div class="message-detail-item ${isFromAdmin ? 'from-admin' : 'from-user'}">
                    <div class="message-detail-item-header">${escapeHtml(senderName)} · ${escapeHtml(timeStr)}</div>
                    <div class="message-detail-item-text">${escapeHtml(m.content)}</div>
                </div>`;
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
            threadEl.innerHTML = '<div class="message-detail-empty">Could not load full conversation.</div><div class="message-detail-item from-user"><div class="message-detail-item-text">' + escapeHtml(message.message) + '</div></div>';
            threadEl.style.display = 'block';
        }
    }
    
    const replyDiv = document.createElement('div');
    replyDiv.innerHTML = `
        <div class="reply-section">
            <h4 class="reply-section-title">Reply to ${escapeHtml(message.fullName)}</h4>
            <form class="reply-form" id="replyForm${message.id}" onsubmit="handleReplySubmit(event, ${message.id})">
                <div class="reply-form-group">
                    <label for="replyMessage${message.id}" class="reply-label">Your Reply</label>
                    <textarea id="replyMessage${message.id}" class="reply-textarea" rows="6" placeholder="Type your reply here..." required></textarea>
                </div>
                <div class="reply-form-actions">
                    <button type="button" class="btn-cancel-reply" onclick="cancelReply(${message.id})">Cancel</button>
                    <button type="submit" class="btn-send-reply"><i class="fi fi-rr-paper-plane"></i> Send Reply</button>
                </div>
            </form>
        </div>
        <div class="message-detail-actions">
            <button class="btn-reply-toggle" onclick="toggleReplySection(${message.id})"><i class="fi fi-rr-envelope"></i> Reply</button>
        </div>
    `;
    while (replyDiv.firstChild) messageContent.appendChild(replyDiv.firstChild);
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
window.toggleBlock = toggleBlock;
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

