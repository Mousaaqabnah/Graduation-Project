// WebSocket connection (will be initialized when page loads)
let ws = null;
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Friend requests storage
let friendRequests = {
    sent: [], // Array of user IDs to whom requests have been sent
    received: [], // Array of user IDs from whom requests have been received
    friends: [] // Array of user IDs who are friends
};

// Load friend requests from localStorage
function loadFriendRequests() {
    try {
        const saved = localStorage.getItem('matchfieldFriendRequests');
        if (saved) {
            friendRequests = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading friend requests:', error);
    }
}

// Save friend requests to localStorage
function saveFriendRequests() {
    try {
        localStorage.setItem('matchfieldFriendRequests', JSON.stringify(friendRequests));
    } catch (error) {
        console.error('Error saving friend requests:', error);
    }
}

// Check if friend request was sent to a user
function hasFriendRequestSent(userId) {
    return friendRequests.sent.includes(userId);
}

// Check if user is already a friend
function isFriend(userId) {
    return friendRequests.friends.includes(userId);
}

// Send friend request
function sendFriendRequest(userId, userName) {
    if (isFriend(userId)) {
        showNotification('Already friends with ' + userName, 'info');
        return;
    }
    
    if (hasFriendRequestSent(userId)) {
        showNotification('Friend request already sent to ' + userName, 'info');
        return;
    }
    
    // Add to sent requests
    friendRequests.sent.push(userId);
    saveFriendRequests();
    
    // Update button states
    updateFriendButtonStates(userId);
    
    // Show success notification
    showNotification('Friend request sent to ' + userName + '!', 'success');
}

// Show notification toast
function showNotification(message, type = 'success') {
    // Remove existing notification if any
    const existingNotification = document.querySelector('.friend-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `friend-notification friend-notification-${type}`;
    notification.innerHTML = `
        <div class="friend-notification-content">
            <i class="fi ${type === 'success' ? 'fi-rr-check' : type === 'info' ? 'fi-rr-info' : 'fi-rr-exclamation'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Hide and remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Update friend button states
function updateFriendButtonStates(userId) {
    // Update "Add To Friend" button in field owner section
    const addToFriendBtn = document.getElementById('addToFriendBtn');
    if (addToFriendBtn && chatData.currentChatId === userId) {
        if (isFriend(userId)) {
            addToFriendBtn.innerHTML = '<i class="fi fi-rr-check"></i><span>Friends</span>';
            addToFriendBtn.disabled = true;
            addToFriendBtn.style.opacity = '0.6';
            addToFriendBtn.style.cursor = 'not-allowed';
        } else if (hasFriendRequestSent(userId)) {
            addToFriendBtn.innerHTML = '<i class="fi fi-rr-clock"></i><span>Request Sent</span>';
            addToFriendBtn.disabled = true;
            addToFriendBtn.style.opacity = '0.6';
            addToFriendBtn.style.cursor = 'not-allowed';
        }
    }
}

// Sample chat data
const chatData = {
    conversations: [
        {
            id: 1,
            name: "Mousa Aqabnah",
            role: "CEO and the founder",
            avatar: "https://ui-avatars.com/api/?name=Mousa+Aqabnah&background=007BFF&color=fff&size=128",
            status: "online",
            lastMessage: "The field is available this Saturday at 3 PM",
            lastMessageTime: "10:28 AM",
            timeAgo: "2 hours ago",
            messages: [
                {
                    id: 1,
                    sender: "user",
                    text: "Hi! I'm interested in booking your field for Saturday",
                    time: "10:23 AM"
                },
                {
                    id: 2,
                    sender: "Mousa Aqabnah",
                    text: "Hello! Yes, we have availability on Saturday",
                    time: "10:23 AM"
                },
                {
                    id: 3,
                    sender: "user",
                    text: "What time slots are available?",
                    time: "10:25 AM"
                },
                {
                    id: 4,
                    sender: "Mousa Aqabnah",
                    text: "The field is available this Saturday at 3 PM",
                    time: "10:28 AM"
                },
                {
                    id: 5,
                    sender: "user",
                    text: "Perfect! I'd like to book it for 2 hours",
                    time: "10:40 AM"
                }
            ],
            fieldInfo: {
                type: "Football Field",
                rate: "₺1500/h",
                size: "Standard (45x22m)",
                surface: "Artificial Turf",
                image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&h=300&fit=crop&auto=format"
            }
        },
        {
            id: 2,
            name: "Ahmed Hassan",
            role: "Field Owner",
            avatar: "https://ui-avatars.com/api/?name=Ahmed+Hassan&background=10B981&color=fff&size=128",
            status: "offline",
            lastMessage: "Sure, I can help you with that",
            lastMessageTime: "Yesterday",
            timeAgo: "1 day ago",
            messages: [
                {
                    id: 1,
                    sender: "user",
                    text: "Hello, is the basketball court available?",
                    time: "2:30 PM"
                },
                {
                    id: 2,
                    sender: "Ahmed Hassan",
                    text: "Sure, I can help you with that",
                    time: "3:15 PM"
                }
            ],
            fieldInfo: {
                type: "Basketball Court",
                rate: "₺1200/h",
                size: "Standard (28x15m)",
                surface: "Indoor Hardwood",
                image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&h=300&fit=crop&auto=format"
            }
        },
        {
            id: 3,
            name: "Sarah Johnson",
            role: "Player",
            avatar: "https://ui-avatars.com/api/?name=Sarah+Johnson&background=EF4444&color=fff&size=128",
            status: "online",
            lastMessage: "Great! See you there",
            lastMessageTime: "3 days ago",
            timeAgo: "3 days ago",
            messages: [
                {
                    id: 1,
                    sender: "Sarah Johnson",
                    text: "Hey! Are you still up for the match tomorrow?",
                    time: "4:20 PM"
                },
                {
                    id: 2,
                    sender: "user",
                    text: "Yes, absolutely!",
                    time: "4:25 PM"
                },
                {
                    id: 3,
                    sender: "Sarah Johnson",
                    text: "Great! See you there",
                    time: "4:30 PM"
                }
            ],
            fieldInfo: null
        },
        {
            id: 4,
            name: "Omar Al-Mansouri",
            role: "Field Owner",
            avatar: "https://ui-avatars.com/api/?name=Omar+Al-Mansouri&background=8B5CF6&color=fff&size=128",
            status: "online",
            lastMessage: "Welcome! How can I help you today?",
            lastMessageTime: "Just now",
            timeAgo: "Just now",
            messages: [
                {
                    id: 1,
                    sender: "Omar Al-Mansouri",
                    text: "Welcome! How can I help you today?",
                    time: "11:00 AM"
                }
            ],
            fieldInfo: {
                type: "Tennis Court",
                rate: "₺1800/h",
                size: "Standard (23.77x10.97m)",
                surface: "Hard Court",
                image: "https://images.unsplash.com/photo-1622163642999-800a229a24a4?w=400&h=300&fit=crop&auto=format"
            }
        }
    ],
    currentChatId: null
};

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Load friend requests
    loadFriendRequests();
    
    renderMessageList();
    setupEventListeners();
    
    // Load chat from localStorage if available
    loadChatFromStorage();
    
    // Initialize WebSocket connection for real-time messaging
    // Uncomment and configure when you have a WebSocket server
    // initializeWebSocket();
    
    // Hide field info sidebar initially
    const fieldInfoSidebar = document.getElementById('fieldInfoSidebar');
    if (fieldInfoSidebar) {
        fieldInfoSidebar.style.display = 'none';
    }
    
    // Auto-select first conversation if available
    if (chatData.conversations.length > 0 && !chatData.currentChatId) {
        selectConversation(chatData.conversations[0].id);
    }
});

// Render message list
function renderMessageList() {
    const messageList = document.getElementById('messageList');
    if (!messageList) return;
    
    messageList.innerHTML = '';
    
    chatData.conversations.forEach(conversation => {
        const messageItem = createMessageItem(conversation);
        messageList.appendChild(messageItem);
    });
}

// Create message item element
function createMessageItem(conversation) {
    const item = document.createElement('div');
    item.className = 'message-item';
    item.dataset.chatId = conversation.id;
    
    if (chatData.currentChatId === conversation.id) {
        item.classList.add('active');
    }
    
    const statusClass = conversation.status === 'online' ? 'online-indicator' : '';
    const statusIndicator = conversation.status === 'online' 
        ? '<span class="online-indicator"></span>' 
        : '';
    
    item.innerHTML = `
        <div class="message-item-avatar">
            <img src="${conversation.avatar}" alt="${conversation.name}">
            ${statusIndicator}
        </div>
        <div class="message-item-content">
            <div class="message-item-header">
                <span class="message-item-name">${conversation.name}</span>
                <span class="message-item-time">${conversation.timeAgo}</span>
            </div>
            <div class="message-item-preview">${conversation.lastMessage}</div>
            <div class="message-item-role">${conversation.role}</div>
        </div>
    `;
    
    item.addEventListener('click', () => {
        selectConversation(conversation.id);
    });
    
    return item;
}

// Select conversation
function selectConversation(chatId) {
    chatData.currentChatId = chatId;
    const conversation = chatData.conversations.find(c => c.id === chatId);
    
    if (!conversation) return;
    
    // Update active state in message list
    document.querySelectorAll('.message-item').forEach(item => {
        item.classList.remove('active');
        if (parseInt(item.dataset.chatId) === chatId) {
            item.classList.add('active');
        }
    });
    
    // Update chat header
    updateChatHeader(conversation);
    
    // Render messages
    renderMessages(conversation.messages, conversation);
    
    // Update field info sidebar (but don't show it yet - user clicks profile to show)
    updateFieldInfo(conversation);
    // Hide sidebar initially - will show when user clicks on profile
    const fieldInfoSidebar = document.getElementById('fieldInfoSidebar');
    if (fieldInfoSidebar && conversation.fieldInfo) {
        fieldInfoSidebar.style.display = 'none';
    }
    
    // Update friend button states
    updateFriendButtonStates(chatId);
    
    // Show chat input
    const chatInputContainer = document.getElementById('chatInputContainer');
    if (chatInputContainer) {
        chatInputContainer.style.display = 'flex';
    }
    
    // Scroll to bottom of messages
    setTimeout(() => {
        scrollToBottom();
    }, 100);
}

// Update chat header
function updateChatHeader(conversation) {
    const chatUserName = document.getElementById('chatUserName');
    const chatUserStatus = document.getElementById('chatUserStatus');
    const chatAvatar = document.querySelector('.chat-avatar img');
    
    if (chatUserName) {
        chatUserName.textContent = conversation.name;
    }
    
    if (chatUserStatus) {
        const statusText = conversation.status === 'online' ? 'Online' : 'Offline';
        chatUserStatus.textContent = statusText;
    }
    
    if (chatAvatar) {
        chatAvatar.src = conversation.avatar;
    }
}

// Render messages
function renderMessages(messages, conversation) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    chatMessages.innerHTML = '';
    
    messages.forEach(message => {
        const messageElement = createMessageElement(message, conversation);
        chatMessages.appendChild(messageElement);
    });
}

// Create message element
function createMessageElement(message, conversation) {
    const messageDiv = document.createElement('div');
    const isSent = message.sender === 'user';
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    if (!isSent) {
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${conversation.avatar}" alt="${message.sender}">
            </div>
            <div class="message-content">
                <div class="message-bubble">${escapeHtml(message.text)}</div>
                <div class="message-time">${message.time}</div>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-bubble">${escapeHtml(message.text)}</div>
                <div class="message-time">${message.time}</div>
            </div>
        `;
    }
    
    return messageDiv;
}

// Update field info sidebar (updates data but doesn't show it - user clicks profile to show)
function updateFieldInfo(conversation) {
    if (!conversation.fieldInfo) {
        // Hide field info if it's a player conversation
        const fieldInfoSidebar = document.getElementById('fieldInfoSidebar');
        if (fieldInfoSidebar) {
            fieldInfoSidebar.style.display = 'none';
        }
        return;
    }
    
    // Don't show sidebar automatically - user clicks profile to show it
    // Just update the data
    
    const fieldInfo = conversation.fieldInfo;
    
    // Update field owner info
    const fieldOwnerName = document.getElementById('fieldOwnerName');
    const fieldOwnerAvatar = document.getElementById('fieldOwnerAvatar');
    const fieldOwnerStatus = document.getElementById('fieldOwnerStatus');
    
    if (fieldOwnerName) {
        fieldOwnerName.textContent = conversation.name;
    }
    
    if (fieldOwnerAvatar) {
        fieldOwnerAvatar.src = conversation.avatar;
    }
    
    if (fieldOwnerStatus) {
        fieldOwnerStatus.textContent = conversation.status === 'online' ? 'Online' : 'Offline';
        fieldOwnerStatus.style.color = conversation.status === 'online' ? '#10B981' : '#6B7280';
    }
    
    // Update field information
    const fieldType = document.getElementById('fieldType');
    const fieldRate = document.getElementById('fieldRate');
    const fieldSize = document.getElementById('fieldSize');
    const fieldSurface = document.getElementById('fieldSurface');
    const fieldImage = document.getElementById('fieldImage');
    
    if (fieldType) fieldType.textContent = fieldInfo.type;
    if (fieldRate) fieldRate.textContent = fieldInfo.rate;
    if (fieldSize) fieldSize.textContent = fieldInfo.size;
    if (fieldSurface) fieldSurface.textContent = fieldInfo.surface;
    if (fieldImage) fieldImage.src = fieldInfo.image;
    
    // Reset and update "Add To Friend" button state
    const addToFriendBtn = document.getElementById('addToFriendBtn');
    if (addToFriendBtn) {
        if (isFriend(conversation.id)) {
            addToFriendBtn.innerHTML = '<i class="fi fi-rr-check"></i><span>Friends</span>';
            addToFriendBtn.disabled = true;
            addToFriendBtn.style.opacity = '0.6';
            addToFriendBtn.style.cursor = 'not-allowed';
        } else if (hasFriendRequestSent(conversation.id)) {
            addToFriendBtn.innerHTML = '<i class="fi fi-rr-clock"></i><span>Request Sent</span>';
            addToFriendBtn.disabled = true;
            addToFriendBtn.style.opacity = '0.6';
            addToFriendBtn.style.cursor = 'not-allowed';
        } else {
            addToFriendBtn.innerHTML = '<i class="fi fi-rr-user-add"></i><span>+ Add To Friend</span>';
            addToFriendBtn.disabled = false;
            addToFriendBtn.style.opacity = '1';
            addToFriendBtn.style.cursor = 'pointer';
        }
    }
}

// Send message
function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !chatData.currentChatId) return;
    
    const messageText = chatInput.value.trim();
    if (!messageText) return;
    
    const conversation = chatData.conversations.find(c => c.id === chatData.currentChatId);
    if (!conversation) return;
    
    // Create new message
    const newMessage = {
        id: conversation.messages.length + 1,
        sender: 'user',
        text: messageText,
        time: getCurrentTime()
    };
    
    // Add message to conversation
    conversation.messages.push(newMessage);
    conversation.lastMessage = messageText;
    conversation.lastMessageTime = newMessage.time;
    conversation.timeAgo = 'Just now';
    
    // Render the new message
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const messageElement = createMessageElement(newMessage, conversation);
        chatMessages.appendChild(messageElement);
        scrollToBottom();
    }
    
    // Update message list
    renderMessageList();
    
    // Clear input
    chatInput.value = '';
    
    // Save to localStorage
    saveChatToStorage();
    
    // Send message via WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
        sendMessageViaWebSocket(chatData.currentChatId, messageText);
    } else {
        // Fallback: Simulate response if WebSocket is not connected
        // Remove this in production when WebSocket is properly configured
        setTimeout(() => {
            simulateResponse(conversation);
        }, 1000);
    }
}

// Send message via WebSocket
function sendMessageViaWebSocket(chatId, messageText) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket is not connected');
        return;
    }
    
    const message = {
        type: 'send_message',
        chatId: chatId,
        text: messageText,
        timestamp: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(message));
}

// Simulate response from other user
function simulateResponse(conversation) {
    if (!conversation || conversation.id === 3) return; // Don't simulate for player conversations
    
    const responses = [
        "Thanks for your message!",
        "I'll get back to you shortly.",
        "That sounds great!",
        "Let me check the availability for you."
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    const responseMessage = {
        id: conversation.messages.length + 1,
        sender: conversation.name,
        text: randomResponse,
        time: getCurrentTime()
    };
    
    conversation.messages.push(responseMessage);
    conversation.lastMessage = randomResponse;
    conversation.lastMessageTime = responseMessage.time;
    conversation.timeAgo = 'Just now';
    
    // Render the response
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages && chatData.currentChatId === conversation.id) {
        const messageElement = createMessageElement(responseMessage, conversation);
        chatMessages.appendChild(messageElement);
        scrollToBottom();
    }
    
    // Update message list
    renderMessageList();
    
    // Save to localStorage
    saveChatToStorage();
}

// Get current time in 12-hour format
function getCurrentTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
}

// Scroll to bottom of messages
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // Enter key to send
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // Message search
    const messageSearch = document.getElementById('messageSearch');
    if (messageSearch) {
        messageSearch.addEventListener('input', (e) => {
            filterMessages(e.target.value);
        });
    }
    
    // Add friend button (in message list header)
    const addFriendBtn = document.getElementById('addFriendBtn');
    if (addFriendBtn) {
        addFriendBtn.addEventListener('click', () => {
            showAddFriendModal();
        });
    }
    
    // Add to friend button (in field owner section)
    const addToFriendBtn = document.getElementById('addToFriendBtn');
    if (addToFriendBtn) {
        addToFriendBtn.addEventListener('click', () => {
            if (chatData.currentChatId) {
                const conversation = chatData.conversations.find(c => c.id === chatData.currentChatId);
                if (conversation) {
                    sendFriendRequest(conversation.id, conversation.name);
                } else {
                    showNotification('Please select a conversation first', 'info');
                }
            } else {
                showNotification('Please select a conversation first', 'info');
            }
        });
    }
    
    // Notification popup
    const notificationBtn = document.querySelector('.notification-btn');
    const notificationPopup = document.getElementById('notificationPopup');
    const closeNotificationBtn = document.getElementById('closeNotificationBtn');
    
    if (notificationBtn && notificationPopup) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationPopup.classList.toggle('active');
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup && profilePopup.classList.contains('active')) {
                profilePopup.classList.remove('active');
            }
        });
        
        // Close notification button
        if (closeNotificationBtn) {
            closeNotificationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                notificationPopup.classList.remove('active');
            });
        }
        
        document.addEventListener('click', (e) => {
            if (notificationPopup && notificationPopup.classList.contains('active')) {
                if (!notificationPopup.contains(e.target) && !notificationBtn.contains(e.target)) {
                    notificationPopup.classList.remove('active');
                }
            }
        });
    }
    
    // Profile popup
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    
    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            if (notificationPopup && notificationPopup.classList.contains('active')) {
                notificationPopup.classList.remove('active');
            }
        });
        
        document.addEventListener('click', (e) => {
            if (profilePopup && profilePopup.classList.contains('active')) {
                if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
                    profilePopup.classList.remove('active');
                }
            }
        });
    }
    
    // View Field Page button
    const viewFieldPageBtn = document.getElementById('viewFieldPageBtn');
    if (viewFieldPageBtn) {
        viewFieldPageBtn.addEventListener('click', () => {
            if (chatData.currentChatId) {
                const conversation = chatData.conversations.find(c => c.id === chatData.currentChatId);
                if (conversation && conversation.fieldInfo) {
                    // Map field type to venue ID
                    const venueId = mapFieldTypeToVenueId(conversation.fieldInfo.type, conversation.id);
                    // Navigate to field info page with venue ID
                    window.location.href = `field-info.html?id=${venueId}`;
                } else {
                    showNotification('No field information available for this user', 'info');
                }
            } else {
                showNotification('Please select a conversation first', 'info');
            }
        });
    }
    
    // Book Now button
    const bookNowBtn = document.querySelector('.field-action-btn.primary');
    if (bookNowBtn) {
        bookNowBtn.addEventListener('click', () => {
            if (chatData.currentChatId) {
                const conversation = chatData.conversations.find(c => c.id === chatData.currentChatId);
                if (conversation && conversation.fieldInfo) {
                    // Map field type to venue ID
                    const venueId = mapFieldTypeToVenueId(conversation.fieldInfo.type, conversation.id);
                    // Navigate to field info page with venue ID (where they can book)
                    window.location.href = `field-info.html?id=${venueId}`;
                } else {
                    showNotification('No field information available for this user', 'info');
                }
            } else {
                showNotification('Please select a conversation first', 'info');
            }
        });
    }
    
    // Chat header click to toggle field info sidebar
    const chatHeader = document.getElementById('chatHeader');
    if (chatHeader) {
        chatHeader.addEventListener('click', () => {
            toggleFieldInfoSidebar();
        });
        // Make it look clickable
        chatHeader.style.cursor = 'pointer';
    }
}

// Toggle field info sidebar visibility
function toggleFieldInfoSidebar() {
    const fieldInfoSidebar = document.getElementById('fieldInfoSidebar');
    if (!fieldInfoSidebar) return;
    
    const conversation = chatData.conversations.find(c => c.id === chatData.currentChatId);
    if (!conversation || !conversation.fieldInfo) {
        // Don't show sidebar for player conversations
        fieldInfoSidebar.style.display = 'none';
        return;
    }
    
    // Toggle visibility
    const isVisible = fieldInfoSidebar.style.display === 'flex';
    fieldInfoSidebar.style.display = isVisible ? 'none' : 'flex';
}

// Filter messages
function filterMessages(query) {
    const messageItems = document.querySelectorAll('.message-item');
    const searchTerm = query.toLowerCase().trim();
    
    if (!searchTerm) {
        messageItems.forEach(item => {
            item.style.display = 'flex';
        });
        return;
    }
    
    messageItems.forEach(item => {
        const name = item.querySelector('.message-item-name').textContent.toLowerCase();
        const preview = item.querySelector('.message-item-preview').textContent.toLowerCase();
        const role = item.querySelector('.message-item-role').textContent.toLowerCase();
        
        if (name.includes(searchTerm) || preview.includes(searchTerm) || role.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Save chat to localStorage
function saveChatToStorage() {
    try {
        localStorage.setItem('matchfieldChatData', JSON.stringify(chatData));
    } catch (error) {
        console.error('Error saving chat data:', error);
    }
}

// Load chat from localStorage
function loadChatFromStorage() {
    try {
        const saved = localStorage.getItem('matchfieldChatData');
        if (saved) {
            const savedData = JSON.parse(saved);
            // Merge saved conversations with default ones
            if (savedData.conversations && savedData.conversations.length > 0) {
                // Start with saved conversations
                const mergedConversations = [...savedData.conversations];
                
                // Add any new users from default data that don't exist in saved data
                chatData.conversations.forEach(defaultConv => {
                    const existsInSaved = savedData.conversations.some(c => c.id === defaultConv.id);
                    if (!existsInSaved) {
                        // This is a new user, add it to merged conversations
                        mergedConversations.push(defaultConv);
                    } else {
                        // Update existing conversation with saved messages but keep default structure
                        const savedConv = savedData.conversations.find(c => c.id === defaultConv.id);
                        const index = mergedConversations.findIndex(c => c.id === defaultConv.id);
                        if (index >= 0 && savedConv) {
                            mergedConversations[index] = {
                                ...defaultConv,
                                ...savedConv,
                                messages: savedConv.messages || defaultConv.messages,
                                lastMessage: savedConv.lastMessage || defaultConv.lastMessage,
                                lastMessageTime: savedConv.lastMessageTime || defaultConv.lastMessageTime,
                                timeAgo: savedConv.timeAgo || defaultConv.timeAgo
                            };
                        }
                    }
                });
                
                // Update chatData with merged conversations
                chatData.conversations = mergedConversations;
                
                if (savedData.currentChatId) {
                    chatData.currentChatId = savedData.currentChatId;
                }
                renderMessageList();
                if (chatData.currentChatId) {
                    selectConversation(chatData.currentChatId);
                }
            }
        }
    } catch (error) {
        console.error('Error loading chat data:', error);
    }
}

// WebSocket connection (for real-time messaging)
// Uses native WebSocket API - NO LIBRARIES NEEDED!
function initializeWebSocket() {
    // Replace with your WebSocket server URL
    // For development: 'ws://localhost:3000' or 'ws://localhost:8080'
    // For production: 'wss://your-domain.com/chat' (secure WebSocket)
    const wsUrl = 'ws://localhost:3000/chat'; // Change this to your server URL
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
            wsReconnectAttempts = 0;
            
            // Send authentication/user info if needed
            // ws.send(JSON.stringify({ type: 'auth', userId: getCurrentUserId() }));
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        ws.onclose = () => {
            console.log('WebSocket disconnected');
            // Attempt to reconnect
            attemptReconnect();
        };
        
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        // Fall back to simulated responses
    }
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'new_message':
            handleIncomingMessage(data);
            break;
        case 'user_online':
            updateUserStatus(data.userId, 'online');
            break;
        case 'user_offline':
            updateUserStatus(data.userId, 'offline');
            break;
        case 'typing':
            // Handle typing indicators if needed
            showTypingIndicator(data.chatId, data.userId);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

// Attempt to reconnect WebSocket
function attemptReconnect() {
    if (wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        wsReconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 30000); // Exponential backoff, max 30s
        
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        
        setTimeout(() => {
            initializeWebSocket();
        }, delay);
    } else {
        console.error('Max reconnection attempts reached. Please refresh the page.');
    }
}

// Update user online/offline status
function updateUserStatus(userId, status) {
    const conversation = chatData.conversations.find(c => c.id === userId || c.userId === userId);
    if (conversation) {
        conversation.status = status;
        renderMessageList();
        
        // Update chat header if this is the current conversation
        if (chatData.currentChatId === conversation.id) {
            updateChatHeader(conversation);
        }
    }
}

// Show typing indicator
function showTypingIndicator(chatId, userId) {
    // Implementation for typing indicator
    // You can add a "User is typing..." message in the chat
    console.log(`User ${userId} is typing in chat ${chatId}`);
}

// Handle incoming message from WebSocket
function handleIncomingMessage(message) {
    const conversation = chatData.conversations.find(c => c.id === message.chatId);
    if (!conversation) return;
    
    const newMessage = {
        id: conversation.messages.length + 1,
        sender: message.sender,
        text: message.text,
        time: getCurrentTime()
    };
    
    conversation.messages.push(newMessage);
    conversation.lastMessage = message.text;
    conversation.lastMessageTime = newMessage.time;
    conversation.timeAgo = 'Just now';
    
    // Update UI if this is the current chat
    if (chatData.currentChatId === message.chatId) {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const messageElement = createMessageElement(newMessage, conversation);
            chatMessages.appendChild(messageElement);
            scrollToBottom();
        }
    }
    
    // Update message list
    renderMessageList();
    
    // Save to localStorage
    saveChatToStorage();
}

// Default users list (always available for friend requests)
const defaultUsersList = [
    { id: 1, name: "Mousa Aqabnah", role: "CEO and the founder", avatar: "https://ui-avatars.com/api/?name=Mousa+Aqabnah&background=007BFF&color=fff&size=128", status: "online" },
    { id: 2, name: "Ahmed Hassan", role: "Field Owner", avatar: "https://ui-avatars.com/api/?name=Ahmed+Hassan&background=10B981&color=fff&size=128", status: "offline" },
    { id: 3, name: "Sarah Johnson", role: "Player", avatar: "https://ui-avatars.com/api/?name=Sarah+Johnson&background=EF4444&color=fff&size=128", status: "online" },
    { id: 4, name: "Omar Al-Mansouri", role: "Field Owner", avatar: "https://ui-avatars.com/api/?name=Omar+Al-Mansouri&background=8B5CF6&color=fff&size=128", status: "online" }
];

// Get all available users (from conversations and default users list)
function getAllAvailableUsers() {
    // Start with default users list (always includes all users)
    const userMap = new Map();
    
    // Add all default users first
    defaultUsersList.forEach(user => {
        userMap.set(user.id, user);
    });
    
    // Then add/update with users from current conversations (in case they have updated status or info)
    chatData.conversations.forEach(conv => {
        userMap.set(conv.id, {
            id: conv.id,
            name: conv.name,
            role: conv.role,
            avatar: conv.avatar,
            status: conv.status || 'offline'
        });
    });
    
    // Return as array, sorted by ID
    return Array.from(userMap.values()).sort((a, b) => a.id - b.id);
}

// Render friend modal items
function renderFriendModalItems(users) {
    return users.map(user => {
        const requestSent = hasFriendRequestSent(user.id);
        const isAlreadyFriend = isFriend(user.id);
        return `
            <div class="friend-modal-item" 
                 data-user-id="${user.id}" 
                 data-user-name="${user.name.toLowerCase()}" 
                 data-user-role="${user.role.toLowerCase()}">
                <div class="friend-modal-item-avatar">
                    <img src="${user.avatar}" alt="${user.name}">
                </div>
                <div class="friend-modal-item-info">
                    <h4>${user.name}</h4>
                    <p>${user.role}</p>
                </div>
                <button class="friend-modal-item-btn ${requestSent || isAlreadyFriend ? 'disabled' : ''}" 
                        data-user-id="${user.id}" 
                        data-user-name="${user.name}"
                        ${requestSent || isAlreadyFriend ? 'disabled' : ''}>
                    ${isAlreadyFriend ? '<i class="fi fi-rr-check"></i> Friends' : 
                      requestSent ? '<i class="fi fi-rr-clock"></i> Request Sent' : 
                      '<i class="fi fi-rr-user-add"></i> Send Request'}
                </button>
            </div>
        `;
    }).join('');
}

// Filter friend modal items based on search query
function filterFriendModalItems(searchQuery, modalOverlay) {
    const searchTerm = searchQuery.toLowerCase().trim();
    const items = modalOverlay.querySelectorAll('.friend-modal-item');
    const emptyState = modalOverlay.querySelector('#friendModalEmpty');
    const modalList = modalOverlay.querySelector('#friendModalList');
    let visibleCount = 0;
    
    if (!searchTerm) {
        // Show all items if search is empty
        items.forEach(item => {
            item.style.display = 'flex';
            visibleCount++;
        });
        if (emptyState) emptyState.style.display = 'none';
    } else {
        // Filter items based on name, role, or ID
        items.forEach(item => {
            const userName = item.dataset.userName || '';
            const userRole = item.dataset.userRole || '';
            const userId = item.dataset.userId ? item.dataset.userId.toString() : '';
            
            // Check if search matches name, role, or ID
            const matchesName = userName.includes(searchTerm);
            const matchesRole = userRole.includes(searchTerm);
            const matchesId = userId.includes(searchTerm) || userId === searchTerm;
            
            if (matchesName || matchesRole || matchesId) {
                item.style.display = 'flex';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });
        
        // Show empty state if no items match
        if (emptyState) {
            emptyState.style.display = visibleCount === 0 ? 'flex' : 'none';
        }
        
        // If no matches found, try to find user by ID in all available users
        if (visibleCount === 0 && !isNaN(searchTerm)) {
            const allUsers = getAllAvailableUsers();
            const foundUser = allUsers.find(u => 
                u.id.toString() === searchTerm || 
                u.name.toLowerCase().includes(searchTerm) ||
                u.role.toLowerCase().includes(searchTerm)
            );
            
            if (foundUser) {
                // User found but not in list, add them dynamically
                const requestSent = hasFriendRequestSent(foundUser.id);
                const isAlreadyFriend = isFriend(foundUser.id);
                const newItem = document.createElement('div');
                newItem.className = 'friend-modal-item';
                newItem.dataset.userId = foundUser.id;
                newItem.dataset.userName = foundUser.name.toLowerCase();
                newItem.dataset.userRole = foundUser.role.toLowerCase();
                newItem.innerHTML = `
                    <div class="friend-modal-item-avatar">
                        <img src="${foundUser.avatar}" alt="${foundUser.name}">
                    </div>
                    <div class="friend-modal-item-info">
                        <h4>${foundUser.name}</h4>
                        <p>${foundUser.role}</p>
                    </div>
                    <button class="friend-modal-item-btn ${requestSent || isAlreadyFriend ? 'disabled' : ''}" 
                            data-user-id="${foundUser.id}" 
                            data-user-name="${foundUser.name}"
                            ${requestSent || isAlreadyFriend ? 'disabled' : ''}>
                        ${isAlreadyFriend ? '<i class="fi fi-rr-check"></i> Friends' : 
                          requestSent ? '<i class="fi fi-rr-clock"></i> Request Sent' : 
                          '<i class="fi fi-rr-user-add"></i> Send Request'}
                    </button>
                `;
                if (modalList) {
                    modalList.appendChild(newItem);
                    visibleCount++;
                    if (emptyState) emptyState.style.display = 'none';
                }
            }
        }
    }
}

// Show add friend modal (for the "+ Add Friend" button in message list)
function showAddFriendModal() {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'friend-modal-overlay';
    modalOverlay.innerHTML = `
        <div class="friend-modal">
            <div class="friend-modal-header">
                <h3>Add Friend</h3>
                <button class="friend-modal-close" id="closeFriendModal">
                    <i class="fi fi-rr-cross"></i>
                </button>
            </div>
            <div class="friend-modal-content">
                <p>Search for a user by name or ID to send a friend request:</p>
                <div class="friend-modal-search">
                    <i class="fi fi-rr-search friend-modal-search-icon"></i>
                    <input type="text" 
                           id="friendModalSearch" 
                           placeholder="Search by name or ID..." 
                           class="friend-modal-search-input">
                </div>
                <div class="friend-modal-list" id="friendModalList">
                    ${renderFriendModalItems(getAllAvailableUsers())}
                </div>
                <div class="friend-modal-empty" id="friendModalEmpty" style="display: none;">
                    <i class="fi fi-rr-search-alt"></i>
                    <p>No users found matching your search</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    // Show modal
    setTimeout(() => {
        modalOverlay.classList.add('show');
    }, 10);
    
    // Close button
    const closeBtn = modalOverlay.querySelector('#closeFriendModal');
    closeBtn.addEventListener('click', () => {
        closeFriendModal(modalOverlay);
    });
    
    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeFriendModal(modalOverlay);
        }
    });
    
    // Handle search input
    const searchInput = modalOverlay.querySelector('#friendModalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterFriendModalItems(e.target.value, modalOverlay);
        });
        
        // Focus on search input when modal opens
        setTimeout(() => {
            searchInput.focus();
        }, 100);
    }
    
    // Handle friend request buttons (using event delegation for dynamic items)
    const modalList = modalOverlay.querySelector('#friendModalList');
    if (modalList) {
        modalList.addEventListener('click', (e) => {
            const btn = e.target.closest('.friend-modal-item-btn:not(.disabled)');
            if (btn) {
                const userId = parseInt(btn.dataset.userId);
                const userName = btn.dataset.userName;
                sendFriendRequest(userId, userName);
                
                // Update button in modal
                btn.disabled = true;
                btn.classList.add('disabled');
                btn.innerHTML = '<i class="fi fi-rr-clock"></i> Request Sent';
                
                // Close modal after a short delay
                setTimeout(() => {
                    closeFriendModal(modalOverlay);
                }, 1500);
            }
        });
    }
}

// Close friend modal
function closeFriendModal(modalOverlay) {
    modalOverlay.classList.remove('show');
    setTimeout(() => {
        modalOverlay.remove();
    }, 300);
}

// Map field type to venue ID for navigation
function mapFieldTypeToVenueId(fieldType, conversationId) {
    // Map field types to venue IDs based on the field-info.js venue data
    // Venue IDs: 1=Football, 2=Tennis, 3=Basketball, 4=Padel, 5=Volleyball, 6=Ice Hockey
    const fieldTypeMap = {
        'Football Field': 1,
        'Tennis Court': 2,
        'Basketball Court': 3,
        'Padel Court': 4,
        'Volleyball Court': 5,
        'Ice Hockey Rink': 6
    };
    
    // Try to find exact match
    if (fieldTypeMap[fieldType]) {
        return fieldTypeMap[fieldType];
    }
    
    // Fallback: try partial match
    const lowerFieldType = fieldType.toLowerCase();
    if (lowerFieldType.includes('football') || lowerFieldType.includes('soccer')) {
        return 1;
    } else if (lowerFieldType.includes('tennis')) {
        return 2;
    } else if (lowerFieldType.includes('basketball')) {
        return 3;
    } else if (lowerFieldType.includes('padel')) {
        return 4;
    } else if (lowerFieldType.includes('volleyball')) {
        return 5;
    } else if (lowerFieldType.includes('hockey') || lowerFieldType.includes('ice')) {
        return 6;
    }
    
    // Final fallback: use conversation ID (if it matches a venue ID)
    return conversationId <= 6 ? conversationId : 1;
}



