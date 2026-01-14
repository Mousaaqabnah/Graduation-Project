// Users Management functionality

// DOM Elements
const notificationBtn = document.getElementById('notificationBtn');
const notificationPopup = document.getElementById('notificationPopup');
const profileBtn = document.getElementById('profileBtn');
const profilePopup = document.getElementById('profilePopup');
const userSearch = document.getElementById('userSearch');
const roleFilter = document.getElementById('roleFilter');
const statusFilter = document.getElementById('statusFilter');
const dateFilter = document.getElementById('dateFilter');
const usersTableBody = document.getElementById('usersTableBody');
const userInfoModal = document.getElementById('userInfoModal');
const closeUserInfoModal = document.getElementById('closeUserInfoModal');
const userInfoContent = document.getElementById('userInfoContent');

// Sample users data
let allUsers = [
    {
        id: 1,
        playerId: '12345678901',
        name: 'Michael Johnson',
        email: 'michael.johnson@example.com',
        role: 'player',
        location: 'Istanbul, Turkey',
        joined: 'Nov 24, 2025',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Michael+Johnson&background=007BFF&color=fff'
    },
    {
        id: 2,
        playerId: '23456789012',
        name: 'Michael Johnson',
        email: 'michael.johnson@example.com',
        role: 'field-owner',
        location: 'Beirut, Lebanon',
        joined: 'Nov 24, 2025',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Michael+Johnson&background=7C3AED&color=fff',
        verificationStatus: 'pending',
        idFront: 'https://via.placeholder.com/400x250?text=ID+Front',
        idBack: 'https://via.placeholder.com/400x250?text=ID+Back'
    },
    {
        id: 3,
        playerId: '34567890123',
        name: 'Michael Johnson',
        email: 'michael.johnson@example.com',
        role: 'admin',
        location: 'Istanbul, Turkey',
        joined: 'Nov 24, 2025',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Michael+Johnson&background=1F2937&color=fff'
    },
    {
        id: 4,
        playerId: '45678901234',
        name: 'Michael Johnson',
        email: 'michael.johnson@example.com',
        role: 'player',
        location: 'Istanbul, Turkey',
        joined: 'Nov 24, 2025',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Michael+Johnson&background=007BFF&color=fff'
    },
    {
        id: 5,
        playerId: '56789012345',
        name: 'Michael Johnson',
        email: 'michael.johnson@example.com',
        role: 'player',
        location: 'Beirut, Lebanon',
        joined: 'Nov 24, 2025',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Michael+Johnson&background=007BFF&color=fff'
    },
    {
        id: 6,
        playerId: '67890123456',
        name: 'Michael Johnson',
        email: 'michael.johnson@example.com',
        role: 'player',
        location: 'Istanbul, Turkey',
        joined: 'Nov 24, 2025',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Michael+Johnson&background=007BFF&color=fff'
    },
    {
        id: 7,
        playerId: '78901234567',
        name: 'Sarah Williams',
        email: 'sarah.williams@example.com',
        role: 'field-owner',
        location: 'Istanbul, Turkey',
        joined: 'Nov 20, 2025',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Sarah+Williams&background=7C3AED&color=fff',
        verificationStatus: 'verified',
        idFront: 'https://via.placeholder.com/400x250?text=ID+Front',
        idBack: 'https://via.placeholder.com/400x250?text=ID+Back'
    },
    {
        id: 8,
        playerId: '89012345678',
        name: 'Ahmed Hassan',
        email: 'ahmed.hassan@example.com',
        role: 'field-owner',
        location: 'Beirut, Lebanon',
        joined: 'Nov 22, 2025',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Ahmed+Hassan&background=7C3AED&color=fff',
        verificationStatus: 'rejected',
        idFront: 'https://via.placeholder.com/400x250?text=ID+Front',
        idBack: 'https://via.placeholder.com/400x250?text=ID+Back'
    }
];

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
    if (notificationPopup && !notificationPopup.contains(e.target) && !notificationBtn.contains(e.target)) {
        notificationPopup.classList.remove('active');
    }
    if (profilePopup && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('active');
    }
});

// Render users table
function renderUsers(users = allUsers) {
    if (!usersTableBody) return;
    
    if (users.length === 0) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #6B7280;">
                    No users found matching your criteria.
                </td>
            </tr>
        `;
        return;
    }
    
    usersTableBody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-name-cell">
                    <div class="user-avatar">
                        <img src="${user.avatar}" alt="${escapeHtml(user.name)}" onerror="this.style.display='none'; this.parentElement.innerHTML='${user.name.charAt(0).toUpperCase()}'">
                    </div>
                    <span class="user-name">${escapeHtml(user.name)}</span>
                </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>
                <span class="role-badge ${user.role}">${formatRole(user.role)}</span>
            </td>
            <td>${escapeHtml(user.location)}</td>
            <td>${escapeHtml(user.joined)}</td>
            <td>
                <span class="status-badge ${user.status}">${formatStatus(user.status)}</span>
            </td>
            <td>
                ${user.role === 'field-owner' 
                    ? `<span class="verification-badge ${user.verificationStatus || 'not-submitted'}">${formatVerificationStatus(user.verificationStatus)}</span>`
                    : '<span class="verification-badge not-applicable">N/A</span>'
                }
            </td>
            <td>
                <div class="actions-cell">
                    <div class="action-buttons">
                        <button class="info-btn" onclick="showUserInfo(${user.id})" title="View user info">
                            <i class="fi fi-rr-info"></i>
                        </button>
                        ${user.status === 'active' 
                            ? `<button class="action-btn suspend" onclick="toggleUserStatus(${user.id})">Suspend</button>`
                            : `<button class="action-btn activate" onclick="toggleUserStatus(${user.id})">Activate</button>`
                        }
                    </div>
                </div>
            </td>
        </tr>
    `).join('');
}

// Format role for display
function formatRole(role) {
    const roleMap = {
        'player': 'Player',
        'field-owner': 'Field owner',
        'admin': 'Admin'
    };
    return roleMap[role] || role;
}

// Format status for display
function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

// Format verification status for display
function formatVerificationStatus(status) {
    if (!status || status === 'not-submitted') return 'Not Submitted';
    const statusMap = {
        'pending': 'Pending',
        'verified': 'Verified',
        'rejected': 'Rejected'
    };
    return statusMap[status] || status;
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

// Filter users
function filterUsers() {
    const searchTerm = userSearch ? userSearch.value.toLowerCase().trim() : '';
    const selectedRole = roleFilter ? roleFilter.value : 'all';
    const selectedStatus = statusFilter ? statusFilter.value : 'all';
    const selectedDate = dateFilter ? dateFilter.value : 'all';
    
    let filtered = allUsers.filter(user => {
        // Search filter
        const matchesSearch = !searchTerm || 
            user.name.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            user.location.toLowerCase().includes(searchTerm);
        
        // Role filter
        const matchesRole = selectedRole === 'all' || user.role === selectedRole;
        
        // Status filter
        const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
        
        // Date filter (simplified - in real app, you'd parse dates)
        const matchesDate = selectedDate === 'all'; // For now, always true
        
        return matchesSearch && matchesRole && matchesStatus && matchesDate;
    });
    
    renderUsers(filtered);
}

// Search functionality
if (userSearch) {
    userSearch.addEventListener('input', filterUsers);
}

// Filter functionality
if (roleFilter) {
    roleFilter.addEventListener('change', filterUsers);
}

if (statusFilter) {
    statusFilter.addEventListener('change', filterUsers);
}

if (dateFilter) {
    dateFilter.addEventListener('change', filterUsers);
}

// Toggle user status
function toggleUserStatus(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    user.status = user.status === 'active' ? 'suspended' : 'active';
    filterUsers(); // Re-render to show updated status
    
    // Show confirmation (you can customize this)
    const action = user.status === 'active' ? 'activated' : 'suspended';
    console.log(`User ${user.name} has been ${action}`);
}

// Show user info modal
function showUserInfo(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    if (userInfoContent) {
        userInfoContent.innerHTML = `
            <img src="${user.avatar}" alt="${escapeHtml(user.name)}" class="user-info-avatar" onerror="this.style.display='none'">
            <div class="user-info-item">
                <div class="user-info-label">Player ID</div>
                <div class="user-info-value">${user.playerId || 'N/A'}</div>
            </div>
            <div class="user-info-item">
                <div class="user-info-label">Name</div>
                <div class="user-info-value">${escapeHtml(user.name)}</div>
            </div>
            <div class="user-info-item">
                <div class="user-info-label">Email</div>
                <div class="user-info-value">${escapeHtml(user.email)}</div>
            </div>
            <div class="user-info-item">
                <div class="user-info-label">Role</div>
                <div class="user-info-value">
                    <span class="role-badge ${user.role}">${formatRole(user.role)}</span>
                </div>
            </div>
            <div class="user-info-item">
                <div class="user-info-label">Location</div>
                <div class="user-info-value">${escapeHtml(user.location)}</div>
            </div>
            <div class="user-info-item">
                <div class="user-info-label">Joined</div>
                <div class="user-info-value">${escapeHtml(user.joined)}</div>
            </div>
            <div class="user-info-item">
                <div class="user-info-label">Status</div>
                <div class="user-info-value">
                    <span class="status-badge ${user.status}">${formatStatus(user.status)}</span>
                </div>
            </div>
        `;
    }
    
    if (userInfoModal) {
        userInfoModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Close user info modal
if (closeUserInfoModal && userInfoModal) {
    closeUserInfoModal.addEventListener('click', () => {
        userInfoModal.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    // Close on overlay click
    userInfoModal.addEventListener('click', (e) => {
        if (e.target === userInfoModal) {
            userInfoModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && userInfoModal.classList.contains('active')) {
            userInfoModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}


// Make functions globally available for onclick handlers
window.toggleUserStatus = toggleUserStatus;
window.showUserInfo = showUserInfo;

// Initialize: Render users on page load
document.addEventListener('DOMContentLoaded', () => {
    renderUsers();
});

