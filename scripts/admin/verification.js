// Verification Requests functionality

// DOM Elements
const notificationBtn = document.getElementById('notificationBtn');
const notificationPopup = document.getElementById('notificationPopup');
const profileBtn = document.getElementById('profileBtn');
const profilePopup = document.getElementById('profilePopup');
const verificationSearch = document.getElementById('verificationSearch');
const statusFilter = document.getElementById('statusFilter');
const dateFilter = document.getElementById('dateFilter');
const verificationTableBody = document.getElementById('verificationTableBody');
const verificationCountBadge = document.getElementById('verificationCountBadge');
const verificationModal = document.getElementById('verificationModal');
const closeVerificationModal = document.getElementById('closeVerificationModal');
const verificationContent = document.getElementById('verificationContent');

// Sample users data - only field owners with pending/not-submitted verification
let allVerificationRequests = [
    {
        id: 2,
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
        id: 9,
        name: 'John Smith',
        email: 'john.smith@example.com',
        role: 'field-owner',
        location: 'Istanbul, Turkey',
        joined: 'Nov 25, 2025',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=John+Smith&background=7C3AED&color=fff',
        verificationStatus: 'pending',
        idFront: 'https://via.placeholder.com/400x250?text=ID+Front',
        idBack: 'https://via.placeholder.com/400x250?text=ID+Back'
    },
    {
        id: 10,
        name: 'Emma Wilson',
        email: 'emma.wilson@example.com',
        role: 'field-owner',
        location: 'Beirut, Lebanon',
        joined: 'Nov 26, 2025',
        status: 'active',
        avatar: 'https://ui-avatars.com/api/?name=Emma+Wilson&background=7C3AED&color=fff',
        verificationStatus: 'not-submitted'
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

// Render verification requests table
function renderVerificationRequests(requests = allVerificationRequests) {
    if (!verificationTableBody) return;
    
    // Update count badge
    if (verificationCountBadge) {
        verificationCountBadge.textContent = requests.length;
    }
    
    if (requests.length === 0) {
        verificationTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #6B7280;">
                    No verification requests found.
                </td>
            </tr>
        `;
        return;
    }
    
    verificationTableBody.innerHTML = requests.map(user => `
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
            <td>${escapeHtml(user.location)}</td>
            <td>${escapeHtml(user.joined)}</td>
            <td>
                <span class="status-badge ${user.status}">${formatStatus(user.status)}</span>
            </td>
            <td>
                <span class="verification-badge ${user.verificationStatus || 'not-submitted'}">${formatVerificationStatus(user.verificationStatus)}</span>
            </td>
            <td>
                <div class="actions-cell">
                    <div class="action-buttons">
                        <button class="action-icon-btn verify" onclick="showVerificationModal(${user.id})" title="Verify field owner">
                            <i class="fi fi-rr-badge-check"></i>
                        </button>
                    </div>
                </div>
            </td>
        </tr>
    `).join('');
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

// Filter verification requests
function filterVerificationRequests() {
    const searchTerm = verificationSearch ? verificationSearch.value.toLowerCase().trim() : '';
    const selectedStatus = statusFilter ? statusFilter.value : 'all';
    const selectedDate = dateFilter ? dateFilter.value : 'all';
    
    let filtered = allVerificationRequests.filter(user => {
        // Search filter
        const matchesSearch = !searchTerm || 
            user.name.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            user.location.toLowerCase().includes(searchTerm);
        
        // Status filter
        const matchesStatus = selectedStatus === 'all' || 
            (selectedStatus === 'pending' && (user.verificationStatus === 'pending' || !user.verificationStatus)) ||
            (selectedStatus === 'not-submitted' && (user.verificationStatus === 'not-submitted' || (!user.verificationStatus && !user.idFront)));
        
        // Date filter (simplified - in real app, you'd parse dates)
        const matchesDate = selectedDate === 'all'; // For now, always true
        
        return matchesSearch && matchesStatus && matchesDate;
    });
    
    renderVerificationRequests(filtered);
}

// Search functionality
if (verificationSearch) {
    verificationSearch.addEventListener('input', filterVerificationRequests);
}

// Filter functionality
if (statusFilter) {
    statusFilter.addEventListener('change', filterVerificationRequests);
}

if (dateFilter) {
    dateFilter.addEventListener('change', filterVerificationRequests);
}

// Show verification modal
function showVerificationModal(userId) {
    const user = allVerificationRequests.find(u => u.id === userId);
    if (!user || user.role !== 'field-owner') return;
    
    if (verificationContent) {
        const hasIdImages = user.idFront && user.idBack;
        
        verificationContent.innerHTML = `
            <div class="verification-user-info">
                <img src="${user.avatar}" alt="${escapeHtml(user.name)}" class="verification-avatar" onerror="this.style.display='none'">
                <div>
                    <h3 class="verification-user-name">${escapeHtml(user.name)}</h3>
                    <p class="verification-user-email">${escapeHtml(user.email)}</p>
                    <p class="verification-user-location">${escapeHtml(user.location)}</p>
                </div>
            </div>
            
            ${hasIdImages ? `
                <div class="verification-images">
                    <div class="verification-image-section">
                        <label class="verification-image-label">ID Front</label>
                        <div class="verification-image-container">
                            <img src="${user.idFront}" alt="ID Front" class="verification-image" onclick="openImageModal('${user.idFront}')">
                        </div>
                    </div>
                    <div class="verification-image-section">
                        <label class="verification-image-label">ID Back</label>
                        <div class="verification-image-container">
                            <img src="${user.idBack}" alt="ID Back" class="verification-image" onclick="openImageModal('${user.idBack}')">
                        </div>
                    </div>
                </div>
            ` : `
                <div class="verification-no-images">
                    <i class="fi fi-rr-document"></i>
                    <p>No ID images submitted yet</p>
                </div>
            `}
            
            <div class="verification-actions">
                <button class="btn btn-verify" onclick="approveVerification(${user.id})" ${!hasIdImages ? 'disabled' : ''}>
                    <i class="fi fi-rr-check"></i> Approve Field
                </button>
                <button class="btn btn-reject" onclick="rejectVerification(${user.id})" ${!hasIdImages ? 'disabled' : ''}>
                    <i class="fi fi-rr-cross"></i> Reject Field
                </button>
            </div>
        `;
    }
    
    if (verificationModal) {
        verificationModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Approve verification
function approveVerification(userId) {
    const user = allVerificationRequests.find(u => u.id === userId);
    if (!user) return;
    
    if (confirm(`Verify ${user.name} as a field owner?`)) {
        user.verificationStatus = 'verified';
        // Remove from verification requests list
        allVerificationRequests = allVerificationRequests.filter(u => u.id !== userId);
        filterVerificationRequests(); // Re-render table
        if (verificationModal) {
            verificationModal.classList.remove('active');
            document.body.style.overflow = '';
        }
        console.log(`Field owner ${user.name} has been verified`);
    }
}

// Reject verification
function rejectVerification(userId) {
    const user = allVerificationRequests.find(u => u.id === userId);
    if (!user) return;
    
    const reason = prompt('Please provide a reason for rejection (optional):');
    if (confirm(`Reject verification for ${user.name}?`)) {
        user.verificationStatus = 'rejected';
        // Remove from verification requests list
        allVerificationRequests = allVerificationRequests.filter(u => u.id !== userId);
        filterVerificationRequests(); // Re-render table
        if (verificationModal) {
            verificationModal.classList.remove('active');
            document.body.style.overflow = '';
        }
        console.log(`Field owner ${user.name} verification has been rejected${reason ? ': ' + reason : ''}`);
    }
}

// Open image in full screen modal
function openImageModal(imageSrc) {
    const imageModal = document.createElement('div');
    imageModal.className = 'image-modal-overlay';
    imageModal.innerHTML = `
        <div class="image-modal-content">
            <button class="image-modal-close" onclick="this.closest('.image-modal-overlay').remove()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <img src="${imageSrc}" alt="ID Document" class="image-modal-img">
        </div>
    `;
    document.body.appendChild(imageModal);
    
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            imageModal.remove();
        }
    });
}

// Close verification modal
if (closeVerificationModal && verificationModal) {
    closeVerificationModal.addEventListener('click', () => {
        verificationModal.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    // Close on overlay click
    verificationModal.addEventListener('click', (e) => {
        if (e.target === verificationModal) {
            verificationModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && verificationModal.classList.contains('active')) {
            verificationModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// Make functions globally available for onclick handlers
window.showVerificationModal = showVerificationModal;
window.approveVerification = approveVerification;
window.rejectVerification = rejectVerification;
window.openImageModal = openImageModal;

// Initialize: Render verification requests on page load
document.addEventListener('DOMContentLoaded', () => {
    renderVerificationRequests();
});



