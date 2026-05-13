// Admin Profile Page JavaScript (API-backed)

function escapeHtml(text) {
    if (text == null) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function formatDateLong(d) {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null || value === '' ? '—' : String(value);
}

function setImg(id, src) {
    const el = document.getElementById(id);
    if (el && src) el.src = src;
}

function getUiAvatarUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Admin')}&background=007BFF&color=fff&size=256`;
}

let currentUser = null;

function compressImageToJpegDataUrl(file, maxEdge, quality) {
    return new Promise(function (resolve, reject) {
        if (!file || !file.type || !/^image\//i.test(file.type)) {
            reject(new Error('Please choose an image file.'));
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            reject(new Error('Image is too large (max 8 MB).'));
            return;
        }
        const reader = new FileReader();
        reader.onload = function () {
            const img = new Image();
            img.onload = function () {
                const w = img.width;
                const h = img.height;
                const scale = Math.min(1, maxEdge / w, maxEdge / h);
                const tw = Math.max(1, Math.round(w * scale));
                const th = Math.max(1, Math.round(h * scale));
                const canvas = document.createElement('canvas');
                canvas.width = tw;
                canvas.height = th;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, tw, th);
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                // If still too big, reduce quality once more.
                if (dataUrl.length > 3_600_000 && quality > 0.55) {
                    dataUrl = canvas.toDataURL('image/jpeg', 0.55);
                }
                resolve(dataUrl);
            };
            img.onerror = function () {
                reject(new Error('Could not read this image.'));
            };
            img.src = reader.result;
        };
        reader.onerror = function () {
            reject(new Error('Could not read file.'));
        };
        reader.readAsDataURL(file);
    });
}

async function loadMe() {
    if (!window.API?.auth?.getCurrentUser) return null;
    const res = await API.auth.getCurrentUser();
    return res && res.user ? res.user : null;
}

function renderUser(user) {
    const name = user.fullName || 'Admin';
    const email = user.email || '';
    const phone = user.phone || '—';
    const avatar = user.avatar || getUiAvatarUrl(name);

    setImg('profileAvatar', avatar);
    setText('profileNameMain', name);
    setText('profileEmailMain', email);

    setText('fullName', name);
    setText('emailAddress', email);
    setText('phoneNumber', phone);
    setText('adminId', user.id || '—');
    setText('role', user.role === 'ADMIN' ? 'Administrator' : (user.role || '—'));
    setText('memberSince', formatDateLong(user.createdAt));

    // Also update top-right profile picture + popup avatar if present
    const topAvatar = document.querySelector('#profileBtn img');
    if (topAvatar) topAvatar.src = avatar;
    const popupAvatars = document.querySelectorAll('.profile-avatar-large img');
    popupAvatars.forEach((img) => (img.src = avatar));
    const popupName = document.querySelector('.profile-details .profile-name');
    const popupEmail = document.querySelector('.profile-details .profile-email');
    if (popupName) popupName.textContent = name;
    if (popupEmail) popupEmail.textContent = email;
}

async function loadProfileStats() {
    // best effort: reuse admin stats
    if (!window.API?.admin?.getStats) return;
    try {
        const res = await API.admin.getStats();
        const s = res && res.stats ? res.stats : {};
        if (document.getElementById('totalUsers')) setText('totalUsers', (s.totalUsers ?? 0).toLocaleString());
        // verifiedFields / totalMessages / months etc. are not tracked precisely yet; leave as-is
    } catch (_) {
        // ignore
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Get popup elements
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    // Bell list: ../../scripts/player/notifications.js

    // Profile popup toggle
    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            const notificationPopup = document.getElementById('notificationPopup');
            if (notificationPopup) notificationPopup.classList.remove('active');
        });
    }

    document.addEventListener('click', function(e) {
        if (profilePopup && !profilePopup.contains(e.target) && profileBtn && !profileBtn.contains(e.target)) {
            profilePopup.classList.remove('active');
        }
    });

    // Load user: paint from session cache first, then refresh from API
    try {
        const cached = window.API?.getCurrentUser?.();
        if (cached) {
            currentUser = cached;
            renderUser(cached);
        }
        const fresh = await loadMe();
        if (fresh) {
            currentUser = fresh;
            if (window.API?.setCurrentUser) API.setCurrentUser(currentUser);
            renderUser(currentUser);
        }
    } catch (e) {
        console.warn('Failed to load profile:', e);
    }
    loadProfileStats();

    // Edit profile modal
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    const editFullName = document.getElementById('editFullName');
    const editEmail = document.getElementById('editEmail');
    const editPhone = document.getElementById('editPhone');

    function populateEditForm() {
        const u = currentUser || API.getCurrentUser?.() || {};
        if (editFullName) editFullName.value = u.fullName || '';
        if (editEmail) editEmail.value = u.email || '';
        if (editPhone) editPhone.value = u.phone || '';
    }

    function closeEditModal() {
        if (editProfileModal) editProfileModal.classList.remove('active');
    }

    if (editProfileBtn && editProfileModal) {
        editProfileBtn.addEventListener('click', function() {
            populateEditForm();
            editProfileModal.classList.add('active');
        });
    }
    if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
    if (editProfileModal) {
        editProfileModal.addEventListener('click', function(e) {
            if (e.target === editProfileModal) closeEditModal();
        });
    }

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async function() {
            if (!currentUser || !currentUser.id) return;
            const fullName = editFullName ? String(editFullName.value || '').trim() : '';
            const phone = editPhone ? String(editPhone.value || '').trim() : '';
            if (!fullName) {
                alert('Full name is required.');
                return;
            }

            const oldText = saveProfileBtn.textContent;
            saveProfileBtn.disabled = true;
            saveProfileBtn.textContent = 'Saving...';
            try {
                if (!window.API?.users?.update) throw new Error('API not available');
                const res = await API.users.update(currentUser.id, {
                    fullName,
                    phone: phone || null
                });
                const updated = res && res.user ? res.user : null;
                if (updated) {
                    currentUser = { ...currentUser, ...updated };
                    if (window.API?.setCurrentUser) API.setCurrentUser(currentUser);
                    renderUser(currentUser);
                } else {
                    // fallback: update local view
                    currentUser.fullName = fullName;
                    currentUser.phone = phone || null;
                    renderUser(currentUser);
                }
                closeEditModal();
            } catch (e) {
                alert((e && e.message) ? e.message : 'Failed to save profile.');
            } finally {
                saveProfileBtn.disabled = false;
                saveProfileBtn.textContent = oldText;
            }
        });
    }

    // Avatar upload
    const avatarEditBtn = document.getElementById('avatarEditBtn');
    const avatarFileInput = document.getElementById('avatarFileInput');

    if (avatarEditBtn && avatarFileInput) {
        avatarEditBtn.addEventListener('click', () => avatarFileInput.click());
        avatarFileInput.addEventListener('change', async () => {
            if (!currentUser || !currentUser.id) return;
            const file = avatarFileInput.files && avatarFileInput.files[0];
            if (!file) return;
            if (!file.type || file.type.indexOf('image/') !== 0) {
                alert('Please select an image file.');
                avatarFileInput.value = '';
                return;
            }
            const oldIcon = avatarEditBtn.innerHTML;
            avatarEditBtn.disabled = true;
            avatarEditBtn.innerHTML = '<i class="fi fi-rr-hourglass"></i>';
            try {
                const dataUrl = await compressImageToJpegDataUrl(file, 384, 0.72);
                if (!dataUrl.startsWith('data:image/')) throw new Error('Invalid image.');
                const res = await API.users.updateAvatar(currentUser.id, dataUrl);
                const updated = res && res.user ? res.user : null;
                if (updated && updated.avatar) {
                    currentUser = { ...currentUser, ...updated };
                    if (window.API?.setCurrentUser) API.setCurrentUser(currentUser);
                    try {
                        localStorage.setItem('userAvatar_' + currentUser.id, String(currentUser.avatar || ''));
                    } catch (_) {}
                    renderUser(currentUser);
                } else {
                    currentUser.avatar = dataUrl;
                    try {
                        localStorage.setItem('userAvatar_' + currentUser.id, String(dataUrl || ''));
                    } catch (_) {}
                    renderUser(currentUser);
                }
            } catch (e) {
                alert((e && e.message) ? e.message : 'Failed to upload avatar.');
            } finally {
                avatarEditBtn.disabled = false;
                avatarEditBtn.innerHTML = oldIcon;
                avatarFileInput.value = '';
            }
        });
    }
});







