// Users Management - loads real users from API

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

let allUsers = [];
let searchTimeout = null;

// Profile popup (bell: ../../scripts/player/notifications.js)
if (profileBtn && profilePopup) {
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profilePopup.classList.toggle('active');
    const notificationPopup = document.getElementById('notificationPopup');
    if (notificationPopup) notificationPopup.classList.remove('active');
  });
}
document.addEventListener('click', (e) => {
  if (profilePopup && !profilePopup.contains(e.target) && !profileBtn?.contains(e.target)) {
    profilePopup.classList.remove('active');
  }
});

function escapeHtml(text) {
  if (text == null || text === '') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function formatRole(role) {
  const m = { PLAYER: t('admin.playerRole'), OWNER: t('admin.fieldOwners'), ADMIN: t('admin.adminRole') };
  return m[role] || role;
}

function formatStatus(status) {
  if (window.MatchFieldI18n && MatchFieldI18n.statusLabel) {
    return MatchFieldI18n.statusLabel(status) || status || '';
  }
  return status === 'ACTIVE' ? t('status.ACTIVE') : status === 'SUSPENDED' ? t('status.SUSPENDED') : (status || '');
}

function formatVerificationStatus(s) {
  if (!s || s === 'NOT_SUBMITTED') return t('status.NOT_SUBMITTED');
  if (window.MatchFieldI18n && MatchFieldI18n.statusLabel) {
    if (s === 'APPROVED') return MatchFieldI18n.statusLabel('VERIFIED');
    return MatchFieldI18n.statusLabel(s) || s;
  }
  const m = { PENDING: t('status.PENDING'), APPROVED: t('status.VERIFIED'), REJECTED: t('status.REJECTED') };
  return m[s] || s;
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString((document.documentElement && document.documentElement.lang === 'ar') ? 'ar' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Map API user to display format
function mapUser(u) {
  const role = (u.role || 'PLAYER').toUpperCase();
  const status = (u.status || 'ACTIVE').toUpperCase();
  return {
    id: u.id,
    name: u.fullName || u.email || t('common.unknown'),
    email: u.email || '',
    role,
    status,
    location: u.location || '—',
    joined: formatDate(u.createdAt),
    avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName || u.email || 'U')}&background=007BFF&color=fff`,
    verificationStatus: u.verificationStatus || (role === 'OWNER' ? 'NOT_SUBMITTED' : null)
  };
}

async function loadUsers() {
  if (!usersTableBody) return;
  if (typeof API === 'undefined' || !API.users || !API.users.getAll) {
    usersTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#6B7280">' + t('common.apiUnavailable') + '</td></tr>';
    return;
  }

  usersTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#6B7280">' + t('admin.loadingUsers') + '</td></tr>';

  const params = { limit: 100 };
  const role = roleFilter?.value;
  const status = statusFilter?.value;
  const search = userSearch?.value?.trim();
  if (role) params.role = role;
  if (status) params.status = status;
  if (search) params.search = search;

  try {
    const res = await API.users.getAll(params);
    allUsers = (res.users || []).map(mapUser);
    renderUsers();
  } catch (err) {
    console.error('Load users error:', err);
    usersTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#DC2626">${escapeHtml((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('admin.failedLoadUsers'))}</td></tr>`;
  }
}

function renderUsers() {
  if (!usersTableBody) return;

  if (allUsers.length === 0) {
    usersTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:#6B7280">' + t('admin.noUsersFound') + '</td></tr>';
    return;
  }

  usersTableBody.innerHTML = allUsers.map((user) => {
    let verifClass = (user.verificationStatus || 'NOT_SUBMITTED').toLowerCase().replace(/_/g, '-');
    if (verifClass === 'approved') verifClass = 'verified';
    const verifDisplay = user.role === 'OWNER'
      ? `<span class="verification-badge ${verifClass}">${formatVerificationStatus(user.verificationStatus)}</span>`
      : '<span class="verification-badge not-applicable">' + t('common.na') + '</span>';

    const statusBtn = user.status === 'ACTIVE'
      ? `<button class="action-btn suspend" data-id="${escapeHtml(user.id)}" data-action="suspend">${t('admin.suspend')}</button>`
      : `<button class="action-btn activate" data-id="${escapeHtml(user.id)}" data-action="activate">${t('admin.activate')}</button>`;

    const roleClass = user.role === 'OWNER' ? 'field-owner' : user.role.toLowerCase();
    return `
      <tr>
        <td>
          <div class="user-name-cell">
            <div class="user-avatar">
              <img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=U&background=007BFF&color=fff'">
            </div>
            <span class="user-name">${escapeHtml(user.name)}</span>
          </div>
        </td>
        <td>${escapeHtml(user.email)}</td>
        <td><span class="role-badge ${roleClass}">${formatRole(user.role)}</span></td>
        <td>${escapeHtml(user.location)}</td>
        <td>${escapeHtml(user.joined)}</td>
        <td><span class="status-badge ${user.status.toLowerCase()}">${formatStatus(user.status)}</span></td>
        <td>${verifDisplay}</td>
        <td>
          <div class="actions-cell">
            <div class="action-buttons">
              <button class="info-btn" data-id="${escapeHtml(user.id)}" title="${t('admin.viewUserInfo')}">
                <i class="fi fi-rr-info"></i>
              </button>
              ${statusBtn}
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach event listeners
  usersTableBody.querySelectorAll('.info-btn').forEach((btn) => {
    btn.addEventListener('click', () => showUserInfo(btn.dataset.id));
  });
  usersTableBody.querySelectorAll('.action-btn[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => toggleUserStatus(btn.dataset.id, btn.dataset.action));
  });
}

async function toggleUserStatus(userId, action) {
  const newStatus = action === 'suspend' ? 'SUSPENDED' : 'ACTIVE';
  const ok = await MatchFieldDialog.confirm(
    action === 'suspend' ? t('admin.suspendConfirm') : t('admin.activateConfirm'),
    { type: action === 'suspend' ? 'danger' : 'warning', okText: action === 'suspend' ? t('admin.suspend') : t('admin.activate') }
  );
  if (!ok) return;

  try {
    await API.users.updateStatus(userId, newStatus);
    const u = allUsers.find((x) => x.id === userId);
    if (u) u.status = newStatus;
    renderUsers();
    if (action === 'suspend' && window.MatchFieldDialog && typeof MatchFieldDialog.alert === 'function') {
      await MatchFieldDialog.alert(
        t('admin.userSuspendedLong'),
        { type: 'info', title: t('admin.userSuspendedTitle') }
      );
    }
  } catch (err) {
    alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('admin.statusFailed'));
  }
}

function showUserInfo(userId) {
  const user = allUsers.find((u) => u.id === userId);
  if (!user) return;

  if (userInfoContent) {
    userInfoContent.innerHTML = `
      <img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}" class="user-info-avatar" onerror="this.style.display='none'">
      <div class="user-info-item"><div class="user-info-label">${t('admin.userId')}</div><div class="user-info-value">${escapeHtml(user.id)}</div></div>
      <div class="user-info-item"><div class="user-info-label">${t('common.name')}</div><div class="user-info-value">${escapeHtml(user.name)}</div></div>
      <div class="user-info-item"><div class="user-info-label">${t('common.email')}</div><div class="user-info-value">${escapeHtml(user.email)}</div></div>
      <div class="user-info-item"><div class="user-info-label">${t('common.role')}</div><div class="user-info-value"><span class="role-badge ${user.role === 'OWNER' ? 'field-owner' : user.role.toLowerCase()}">${formatRole(user.role)}</span></div></div>
      <div class="user-info-item"><div class="user-info-label">${t('common.location')}</div><div class="user-info-value">${escapeHtml(user.location)}</div></div>
      <div class="user-info-item"><div class="user-info-label">${t('common.joined')}</div><div class="user-info-value">${escapeHtml(user.joined)}</div></div>
      <div class="user-info-item"><div class="user-info-label">${t('common.status')}</div><div class="user-info-value"><span class="status-badge ${(user.status || 'ACTIVE').toLowerCase()}">${formatStatus(user.status)}</span></div></div>
      ${user.role === 'OWNER' ? `<div class="user-info-item"><div class="user-info-label">${t('admin.verification')}</div><div class="user-info-value">${formatVerificationStatus(user.verificationStatus)}</div></div>` : ''}
    `;
  }
  if (userInfoModal) {
    userInfoModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

if (closeUserInfoModal && userInfoModal) {
  closeUserInfoModal.addEventListener('click', () => {
    userInfoModal.classList.remove('active');
    document.body.style.overflow = '';
  });
  userInfoModal.addEventListener('click', (e) => {
    if (e.target === userInfoModal) {
      userInfoModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && userInfoModal.classList.contains('active')) {
      userInfoModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
}

// Search with debounce
if (userSearch) {
  userSearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadUsers, 300);
  });
}

if (roleFilter) roleFilter.addEventListener('change', loadUsers);
if (statusFilter) statusFilter.addEventListener('change', loadUsers);
if (dateFilter) dateFilter.addEventListener('change', loadUsers);

document.addEventListener('DOMContentLoaded', () => {
  loadUsers();
});
