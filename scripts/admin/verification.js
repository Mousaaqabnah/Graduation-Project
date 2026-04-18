// Verification Requests functionality

// DOM Elements (bell: ../../scripts/player/notifications.js)
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

let allVerificationRequests = [];
let isLoading = false;

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

document.addEventListener('click', (e) => {
    if (profilePopup && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('active');
    }
});

function escapeHtml(text) {
    if (text == null) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatStatus(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'ACTIVE') return 'Active';
    if (s === 'SUSPENDED') return 'Suspended';
    return status ? String(status) : '—';
}

function formatVerificationStatus(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') return 'Pending';
    if (s === 'APPROVED') return 'Verified';
    if (s === 'REJECTED') return 'Rejected';
    if (s === 'NOT_SUBMITTED' || !s) return 'Not Submitted';
    return String(status);
}

function formatDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function mapVerificationUser(u) {
    const name = u.fullName || u.email || 'User';
    return {
        id: u.id,
        name,
        email: u.email || '',
        role: 'OWNER',
        location: u.location || '—',
        joined: formatDate(u.createdAt),
        status: u.status || 'ACTIVE',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7C3AED&color=fff`,
        verificationStatus: u.verificationStatus || 'PENDING',
        idFrontUrl: u.idFrontUrl || '',
        idBackUrl: u.idBackUrl || ''
    };
}

async function loadVerificationRequestsFromAPI() {
    if (isLoading) return;
    isLoading = true;
    try {
        if (!window.API || !API.admin || !API.admin.getVerifications) {
            throw new Error('API not available. Make sure the backend is running and you opened this page from the server.');
        }
        const res = await API.admin.getVerifications({ limit: 200, page: 1 });
        const users = (res && res.users) ? res.users : [];
        allVerificationRequests = users.map(mapVerificationUser);
    } catch (e) {
        console.warn('Failed to load verifications:', e);
        allVerificationRequests = [];
        if (verificationTableBody) {
            verificationTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #DC2626;">
                        ${escapeHtml(e && e.message ? e.message : 'Failed to load verification requests')}
                    </td>
                </tr>
            `;
        }
        if (verificationCountBadge) verificationCountBadge.textContent = '0';
        return;
    } finally {
        isLoading = false;
    }
    filterVerificationRequests();
}

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
                    ${isLoading ? 'Loading verification requests...' : 'No verification requests found.'}
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
                <span class="status-badge ${(String(user.status || '').toLowerCase())}">${formatStatus(user.status)}</span>
            </td>
            <td>
                <span class="verification-badge ${(String(user.verificationStatus || '').toLowerCase())}">${formatVerificationStatus(user.verificationStatus)}</span>
            </td>
            <td>
                <div class="actions-cell">
                    <div class="action-buttons">
                        <button class="action-icon-btn verify" onclick="showVerificationModal('${escapeHtml(user.id)}')" title="Review verification">
                            <i class="fi fi-rr-badge-check"></i>
                        </button>
                    </div>
                </div>
            </td>
        </tr>
    `).join('');
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
        const vs = String(user.verificationStatus || '').toUpperCase();
        const matchesStatus =
            selectedStatus === 'all' ||
            (selectedStatus === 'pending' && vs === 'PENDING') ||
            (selectedStatus === 'not-submitted' && vs === 'NOT_SUBMITTED');
        
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
    const user = allVerificationRequests.find(u => String(u.id) === String(userId));
    if (!user) return;
    
    if (verificationContent) {
        const hasIdImages = !!(user.idFrontUrl && user.idBackUrl);
        
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
                            <img src="${user.idFrontUrl}" alt="ID Front" class="verification-image" onclick="openImageModal('${escapeHtml(user.idFrontUrl)}')">
                        </div>
                    </div>
                    <div class="verification-image-section">
                        <label class="verification-image-label">ID Back</label>
                        <div class="verification-image-container">
                            <img src="${user.idBackUrl}" alt="ID Back" class="verification-image" onclick="openImageModal('${escapeHtml(user.idBackUrl)}')">
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
                <button class="btn btn-verify" onclick="approveVerification('${escapeHtml(user.id)}')" ${!hasIdImages ? 'disabled' : ''}>
                    <i class="fi fi-rr-check"></i> Approve Owner
                </button>
                <button class="btn btn-reject" onclick="rejectVerification('${escapeHtml(user.id)}')" ${!hasIdImages ? 'disabled' : ''}>
                    <i class="fi fi-rr-cross"></i> Reject Owner
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
async function approveVerification(userId) {
    const user = allVerificationRequests.find(u => String(u.id) === String(userId));
    if (!user) return;
    
    if (confirm(`Verify ${user.name} as a field owner?`)) {
        try {
            await API.admin.verifyOwner(String(userId), 'APPROVED', '');
            allVerificationRequests = allVerificationRequests.filter(u => String(u.id) !== String(userId));
            filterVerificationRequests();
            if (verificationModal) {
                verificationModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        } catch (e) {
            alert((e && e.message) ? e.message : 'Failed to approve verification.');
        }
    }
}

// Reject verification
async function rejectVerification(userId) {
    const user = allVerificationRequests.find(u => String(u.id) === String(userId));
    if (!user) return;
    
    const reason = prompt('Please provide a reason for rejection (optional):');
    if (confirm(`Reject verification for ${user.name}?`)) {
        try {
            await API.admin.verifyOwner(String(userId), 'REJECTED', reason || '');
            allVerificationRequests = allVerificationRequests.filter(u => String(u.id) !== String(userId));
            filterVerificationRequests();
            if (verificationModal) {
                verificationModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        } catch (e) {
            alert((e && e.message) ? e.message : 'Failed to reject verification.');
        }
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
    renderVerificationRequests([]);
    loadVerificationRequestsFromAPI();
});



