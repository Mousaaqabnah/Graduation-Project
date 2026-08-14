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
    if (window.MatchFieldI18n && MatchFieldI18n.statusLabel) {
        return MatchFieldI18n.statusLabel(status) || (status ? String(status) : '—');
    }
    const s = String(status || '').toUpperCase();
    if (s === 'ACTIVE') return t('status.ACTIVE');
    if (s === 'SUSPENDED') return t('status.SUSPENDED');
    return status ? String(status) : '—';
}

function formatVerificationStatus(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') return t('status.PENDING');
    if (s === 'APPROVED') return t('status.VERIFIED');
    if (s === 'REJECTED') return t('status.REJECTED');
    if (s === 'NOT_SUBMITTED' || !s) return t('status.NOT_SUBMITTED');
    return (window.MatchFieldI18n && MatchFieldI18n.statusLabel) ? MatchFieldI18n.statusLabel(s) : String(status);
}

function formatDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString((document.documentElement && document.documentElement.lang === 'ar') ? 'ar' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function mapVerificationUser(u) {
    const name = u.fullName || u.email || t('common.user');
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
            throw new Error(t('admin.apiFromServer'));
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
                        ${escapeHtml((window.MatchFieldI18n && MatchFieldI18n.localizeError(e && e.message)) || t('admin.failedLoadVerifications'))}
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
                    ${isLoading ? t('admin.loadingVerification') : t('admin.noVerification')}
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
                        <button class="action-icon-btn verify" onclick="showVerificationModal('${escapeHtml(user.id)}')" title="${t('admin.reviewVerification')}">
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
                        <label class="verification-image-label">${t('profile.idFront')}</label>
                        <div class="verification-image-container">
                            <img data-doc-src="${escapeHtml(user.idFrontUrl)}" alt="${t('profile.idFront')}" class="verification-image js-kyc-image">
                        </div>
                    </div>
                    <div class="verification-image-section">
                        <label class="verification-image-label">${t('profile.idBack')}</label>
                        <div class="verification-image-container">
                            <img data-doc-src="${escapeHtml(user.idBackUrl)}" alt="${t('profile.idBack')}" class="verification-image js-kyc-image">
                        </div>
                    </div>
                </div>
            ` : `
                <div class="verification-no-images">
                    <i class="fi fi-rr-document"></i>
                    <p>${t('admin.noIdImages')}</p>
                </div>
            `}
            
            <div class="verification-actions">
                <button class="btn btn-verify" onclick="approveVerification('${escapeHtml(user.id)}')" ${!hasIdImages ? 'disabled' : ''}>
                    <i class="fi fi-rr-check"></i> ${t('admin.approveOwner')}
                </button>
                <button class="btn btn-reject" onclick="rejectVerification('${escapeHtml(user.id)}')" ${!hasIdImages ? 'disabled' : ''}>
                    <i class="fi fi-rr-cross"></i> ${t('admin.rejectOwner')}
                </button>
            </div>
        `;
        if (hasIdImages && window.API && typeof API.authFetchBlobUrl === 'function') {
            verificationContent.querySelectorAll('.js-kyc-image').forEach(function (img) {
                var apiPath = img.getAttribute('data-doc-src');
                if (!apiPath) return;
                API.authFetchBlobUrl(apiPath).then(function (blobUrl) {
                    img.src = blobUrl;
                    img.onclick = function () { openImageModal(blobUrl); };
                }).catch(function () {
                    img.alt = t('admin.unableLoadDoc');
                });
            });
        }
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
    
    if (await MatchFieldDialog.confirm(t('admin.verifyConfirm', { name: user.name }), {
        okText: t('admin.verify')
    })) {
        try {
            await API.admin.verifyOwner(String(userId), 'APPROVED', '');
            allVerificationRequests = allVerificationRequests.filter(u => String(u.id) !== String(userId));
            filterVerificationRequests();
            if (verificationModal) {
                verificationModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        } catch (e) {
            alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(e && e.message)) || t('admin.approveFailed'));
        }
    }
}

// Reject verification
async function rejectVerification(userId) {
    const user = allVerificationRequests.find(u => String(u.id) === String(userId));
    if (!user) return;
    
    const reason =
        typeof MatchFieldDialog !== 'undefined' && MatchFieldDialog.prompt
            ? await MatchFieldDialog.prompt(t('admin.rejectReason'), {
                  title: t('admin.reasonTitle'),
                  type: 'warning',
                  okText: t('common.ok'),
                  cancelText: t('common.cancel'),
                  placeholder: t('admin.optionalNote')
              }) ?? ''
            : prompt(t('admin.rejectReason')) || '';
    if (await MatchFieldDialog.confirm(t('admin.rejectVerify', { name: user.name }), {
        type: 'danger',
        okText: t('admin.rejectOwner')
    })) {
        try {
            await API.admin.verifyOwner(String(userId), 'REJECTED', reason || '');
            allVerificationRequests = allVerificationRequests.filter(u => String(u.id) !== String(userId));
            filterVerificationRequests();
            if (verificationModal) {
                verificationModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        } catch (e) {
            alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(e && e.message)) || t('admin.rejectFailed'));
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
            <img src="${imageSrc}" alt="${t('admin.idDocument')}" class="image-modal-img">
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



