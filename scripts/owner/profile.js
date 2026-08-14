// Owner profile — loads /users/:id + /owner/stats; saves via PUT /users/:id; photo as compressed data URL.

(function () {
    var cachedUser = null;

    function formatOwnerTry(amount) {
        var n = Number(amount) || 0;
        if (typeof MatchFieldPrefs !== 'undefined' && MatchFieldPrefs.formatMoney) {
            return MatchFieldPrefs.formatMoney(n);
        }
        return '₪' + n.toLocaleString('en-IL');
    }

    function defaultAvatarUrl(name, size) {
        var n = (name || t('owner.fieldOwner')).trim() || t('owner.fieldOwner');
        return (
            'https://ui-avatars.com/api/?name=' +
            encodeURIComponent(n) +
            '&background=007BFF&color=fff&size=' +
            (size || 256)
        );
    }

    function applyAvatarsAndHeader(user) {
        var fullName = user.fullName || user.name || t('owner.fieldOwner');
        var email = user.email || '';
        var avatarSrc = user.avatar || defaultAvatarUrl(fullName, 128);

        var profileAvatar = document.getElementById('profileAvatar');
        if (profileAvatar) {
            profileAvatar.src = avatarSrc;
            profileAvatar.alt = fullName;
        }

        var headerImg = document.querySelector('#profileBtn img');
        if (headerImg) {
            headerImg.src = avatarSrc;
            headerImg.alt = fullName;
        }

        var popupName = document.querySelector('#profilePopup .profile-name');
        var popupEmail = document.querySelector('#profilePopup .profile-email');
        var popupAvatar = document.querySelector('#profilePopup .profile-avatar-large img');
        if (popupName) popupName.textContent = fullName;
        if (popupEmail) popupEmail.textContent = email;
        if (popupAvatar) {
            popupAvatar.src = avatarSrc;
            popupAvatar.alt = fullName;
        }
    }

    function toDateInputValue(iso) {
        if (!iso) return '';
        var dt = new Date(iso);
        if (isNaN(dt.getTime())) return '';
        var y = dt.getUTCFullYear();
        var m = String(dt.getUTCMonth() + 1).padStart(2, '0');
        var d = String(dt.getUTCDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    function formatMemberSince(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString((document.documentElement && document.documentElement.lang === 'ar') ? 'ar' : 'en-US', { month: 'long', year: 'numeric' });
        } catch (e) {
            return '—';
        }
    }

    function formatDobDisplay(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString((document.documentElement && document.documentElement.lang === 'ar') ? 'ar' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return '—';
        }
    }

    function verificationLabel(status) {
        if (status === 'APPROVED') return { text: t('owner.verifiedOwner'), ok: true };
        if (status === 'PENDING') return { text: t('owner.verificationPending'), ok: false };
        if (status === 'REJECTED') return { text: t('owner.verificationRejected'), ok: false };
        return { text: t('owner.notVerified'), ok: false };
    }

    function updateVerificationSubmissionUI(user) {
        var card = document.getElementById('verificationUploadCard');
        var statusText = document.getElementById('verificationUploadStatus');
        var submitBtn = document.getElementById('submitVerificationBtn');
        var frontInput = document.getElementById('idFrontFile');
        var backInput = document.getElementById('idBackFile');
        if (!card || !statusText || !submitBtn || !frontInput || !backInput) return;

        var status = String((user && user.verificationStatus) || '').toUpperCase();
        var isApproved = status === 'APPROVED';
        var isPending = status === 'PENDING';
        var isRejected = status === 'REJECTED';

        if (isApproved) {
            statusText.textContent = t('owner.accountVerified');
        } else if (isPending) {
            statusText.textContent = t('owner.verificationPendingReview');
        } else if (isRejected) {
            statusText.textContent = t('owner.verificationRejectedRetry');
        } else {
            statusText.textContent = t('owner.verifyUploadId');
        }

        var disabled = isApproved || isPending;
        frontInput.disabled = disabled;
        backInput.disabled = disabled;
        submitBtn.disabled = disabled;
        submitBtn.style.opacity = disabled ? '0.6' : '';
        submitBtn.style.cursor = disabled ? 'not-allowed' : '';
    }

    function renderProfile(user, stats) {
        cachedUser = user;
        if (typeof API !== 'undefined' && API.setCurrentUser && API.getCurrentUser) {
            var prev = API.getCurrentUser() || {};
            API.setCurrentUser(Object.assign({}, prev, user));
        }

        var fullName = user.fullName || '—';
        var email = user.email || '—';

        applyAvatarsAndHeader(user);

        var profileNameMain = document.getElementById('profileNameMain');
        var profileEmailMain = document.getElementById('profileEmailMain');
        if (profileNameMain) profileNameMain.textContent = fullName;
        if (profileEmailMain) profileEmailMain.textContent = email;

        var businessName = document.getElementById('businessName');
        if (businessName) businessName.textContent = fullName;

        var genderEl = document.getElementById('profileGenderDisplay');
        if (genderEl) genderEl.textContent = user.gender || '—';

        var dobEl = document.getElementById('profileDobDisplay');
        if (dobEl) dobEl.textContent = formatDobDisplay(user.dateOfBirth);

        var memberSince = document.getElementById('memberSince');
        if (memberSince) memberSince.textContent = formatMemberSince(user.createdAt);

        var emailAddress = document.getElementById('emailAddress');
        var phoneNumber = document.getElementById('phoneNumber');
        if (emailAddress) emailAddress.textContent = email;
        if (phoneNumber) phoneNumber.textContent = user.phone || '—';

        var streetAddress = document.getElementById('streetAddress');
        if (streetAddress) streetAddress.textContent = user.location || '—';

        var v = verificationLabel(user.verificationStatus);
        var badgeText = document.getElementById('verificationBadgeText');
        var badge = document.getElementById('verificationBadge');
        if (badgeText) badgeText.textContent = v.text;
        if (badge) {
            badge.style.opacity = v.ok ? '1' : '0.85';
        }
        updateVerificationSubmissionUI(user);

        if (stats != null) {
            var s = stats || {};
            function setStat(id, val) {
                var el = document.getElementById(id);
                if (el) el.textContent = val != null ? String(val) : '—';
            }

            setStat('totalFields', s.totalFields);
            setStat('totalBookings', s.totalBookings);
            setStat('todayBookings', s.todayBookings);
            setStat(
                'averageRating',
                s.averageFieldRating != null ? String(s.averageFieldRating) : '—'
            );
            var monthlyRev = document.getElementById('monthlyRevenue');
            if (monthlyRev) monthlyRev.textContent = formatOwnerTry(s.revenueThisMonth);
            setStat('memberMonths', s.monthsActive);
        }
    }

    function populateEditForm() {
        if (!cachedUser) return;
        var u = cachedUser;
        var nameInput = document.getElementById('editBusinessName');
        var emailInput = document.getElementById('editEmail');
        var phoneInput = document.getElementById('editPhone');
        var locInput = document.getElementById('editLocation');
        var genderInput = document.getElementById('editGender');
        var dobInput = document.getElementById('editDob');

        if (nameInput) nameInput.value = u.fullName || '';
        if (emailInput) emailInput.value = u.email || '';
        if (phoneInput) phoneInput.value = u.phone || '';
        if (locInput) locInput.value = u.location || '';
        if (genderInput) genderInput.value = u.gender || '';
        if (dobInput) dobInput.value = toDateInputValue(u.dateOfBirth);
    }

    function compressImageToJpegDataUrl(file, maxEdge, quality) {
        return new Promise(function (resolve, reject) {
            if (!file || !file.type || !/^image\//i.test(file.type)) {
                reject(new Error(t('owner.chooseImage')));
                return;
            }
            if (file.size > 8 * 1024 * 1024) {
                reject(new Error(t('owner.imageTooLarge8')));
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                var img = new Image();
                img.onload = function () {
                    var w = img.width;
                    var h = img.height;
                    var scale = Math.min(1, maxEdge / w, maxEdge / h);
                    var tw = Math.max(1, Math.round(w * scale));
                    var th = Math.max(1, Math.round(h * scale));
                    var canvas = document.createElement('canvas');
                    canvas.width = tw;
                    canvas.height = th;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, tw, th);
                    var dataUrl = canvas.toDataURL('image/jpeg', quality);
                    if (dataUrl.length > 1800000 && quality > 0.5) {
                        dataUrl = canvas.toDataURL('image/jpeg', 0.55);
                    }
                    resolve(dataUrl);
                };
                img.onerror = function () {
                    reject(new Error(t('owner.couldNotReadImage')));
                };
                img.src = reader.result;
            };
            reader.onerror = function () {
                reject(new Error(t('owner.couldNotReadFile')));
            };
            reader.readAsDataURL(file);
        });
    }

    async function loadProfileFromApi() {
        if (typeof API === 'undefined' || !API.users || !API.users.getById) {
            return;
        }
        var local = API.getCurrentUser && API.getCurrentUser();
        if (!local || !local.id) return;

        try {
            var userRes = await API.users.getById(local.id);
            var user = userRes && userRes.user;
            if (!user) return;

            var stats = {};
            try {
                if (API.owner && API.owner.getStats) {
                    var statsRes = await API.owner.getStats();
                    stats = (statsRes && statsRes.stats) || {};
                }
            } catch (statsErr) {
                console.warn('Owner stats failed', statsErr);
            }

            renderProfile(user, stats);
        } catch (e) {
            console.error('loadProfileFromApi', e);
            var msg = (window.MatchFieldI18n && MatchFieldI18n.localizeError(e && e.message)) || t('owner.couldNotLoadProfile');
            alert(msg);
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var profileBtn = document.getElementById('profileBtn');
        var profilePopup = document.getElementById('profilePopup');
        var notificationPopup = document.getElementById('notificationPopup');

        if (profileBtn && profilePopup) {
            profileBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                profilePopup.classList.toggle('active');
                if (notificationPopup) notificationPopup.classList.remove('active');
            });
        }

        document.addEventListener('click', function (e) {
            if (
                profilePopup &&
                profileBtn &&
                !profilePopup.contains(e.target) &&
                !profileBtn.contains(e.target)
            ) {
                profilePopup.classList.remove('active');
            }
        });

        var editProfileBtn = document.getElementById('editProfileBtn');
        var editProfileModal = document.getElementById('editProfileModal');
        var closeEditModalBtn = document.getElementById('closeEditModalBtn');
        var cancelEditBtn = document.getElementById('cancelEditBtn');
        var saveProfileBtn = document.getElementById('saveProfileBtn');

        function closeEditModal() {
            if (editProfileModal) editProfileModal.classList.remove('active');
        }

        if (editProfileBtn && editProfileModal) {
            editProfileBtn.addEventListener('click', function () {
                populateEditForm();
                editProfileModal.classList.add('active');
            });
        }

        if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditModal);
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);

        if (editProfileModal) {
            editProfileModal.addEventListener('click', function (e) {
                if (e.target === editProfileModal) closeEditModal();
            });
        }

        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', async function () {
                var form = document.getElementById('editProfileForm');
                if (!form || !cachedUser || !API || !API.users || !API.users.update) return;
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }

                var fullName = document.getElementById('editBusinessName').value.trim();
                var phone = document.getElementById('editPhone').value.trim();
                var location = document.getElementById('editLocation').value.trim();
                var gender = document.getElementById('editGender').value;
                var dobVal = document.getElementById('editDob').value;

                try {
                    var res = await API.users.update(cachedUser.id, {
                        fullName: fullName,
                        phone: phone || null,
                        location: location || null,
                        gender: gender || null,
                        dateOfBirth: dobVal ? dobVal : null
                    });
                    var updated = res && res.user;
                    if (updated) {
                        var stats = {};
                        try {
                            if (API.owner && API.owner.getStats) {
                                var statsRes = await API.owner.getStats();
                                stats = (statsRes && statsRes.stats) || {};
                            }
                        } catch (e2) {
                            console.warn('stats refresh', e2);
                        }
                        renderProfile(updated, stats);
                    }
                    closeEditModal();
                    alert(t('profile.updated'));
                } catch (err) {
                    alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('profile.couldNotSave'));
                }
            });
        }

        var avatarEditBtn = document.getElementById('avatarEditBtn');
        var avatarFileInput = document.getElementById('avatarFileInput');
        if (avatarEditBtn && avatarFileInput) {
            avatarEditBtn.addEventListener('click', function () {
                avatarFileInput.click();
            });
        }

        if (avatarFileInput) {
            avatarFileInput.addEventListener('change', async function () {
                var file = avatarFileInput.files && avatarFileInput.files[0];
                avatarFileInput.value = '';
                if (!file || !cachedUser || !API || !API.users || !API.users.updateAvatar) return;

                try {
                    var dataUrl = await compressImageToJpegDataUrl(file, 384, 0.72);
                    var res = await API.users.updateAvatar(cachedUser.id, dataUrl);
                    var updated = res && res.user;
                    if (updated) {
                        renderProfile(updated);
                        alert(t('profile.photoUpdated'));
                    }
                } catch (err) {
                    alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('owner.couldNotUploadPhoto'));
                }
            });
        }

        var idFrontInput = document.getElementById('idFrontFile');
        var idBackInput = document.getElementById('idBackFile');
        var idFrontFileName = document.getElementById('idFrontFileName');
        var idBackFileName = document.getElementById('idBackFileName');
        var submitVerificationBtn = document.getElementById('submitVerificationBtn');

        function bindFileName(inputEl, nameEl) {
            if (!inputEl || !nameEl) return;
            inputEl.addEventListener('change', function () {
                var f = inputEl.files && inputEl.files[0];
                nameEl.textContent = f ? f.name : t('profile.noFile');
            });
        }
        bindFileName(idFrontInput, idFrontFileName);
        bindFileName(idBackInput, idBackFileName);

        if (submitVerificationBtn) {
            submitVerificationBtn.addEventListener('click', async function () {
                if (!cachedUser || !API || !API.users || !API.users.submitOwnerVerification) return;
                var status = String(cachedUser.verificationStatus || '').toUpperCase();
                if (status === 'APPROVED') {
                    alert(t('profile.alreadyVerified'));
                    return;
                }
                if (status === 'PENDING') {
                    alert(t('profile.alreadyPending'));
                    return;
                }
                var frontFile = idFrontInput && idFrontInput.files && idFrontInput.files[0];
                var backFile = idBackInput && idBackInput.files && idBackInput.files[0];
                if (!frontFile || !backFile) {
                    alert(t('profile.uploadBothIds'));
                    return;
                }

                submitVerificationBtn.disabled = true;
                submitVerificationBtn.style.opacity = '0.7';
                submitVerificationBtn.textContent = t('owner.submitting');
                try {
                    var idFrontUrl = await compressImageToJpegDataUrl(frontFile, 1600, 0.8);
                    var idBackUrl = await compressImageToJpegDataUrl(backFile, 1600, 0.8);
                    await API.users.submitOwnerVerification(idFrontUrl, idBackUrl);
                    await loadProfileFromApi();
                    if (idFrontInput) idFrontInput.value = '';
                    if (idBackInput) idBackInput.value = '';
                    if (idFrontFileName) idFrontFileName.textContent = t('profile.noFile');
                    if (idBackFileName) idBackFileName.textContent = t('profile.noFile');
                    alert(t('owner.verificationSubmittedWait'));
                } catch (err) {
                    alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('owner.couldNotSubmitVerification'));
                } finally {
                    submitVerificationBtn.textContent = t('owner.submitVerificationBtn');
                    submitVerificationBtn.style.opacity = '';
                    submitVerificationBtn.disabled = false;
                    updateVerificationSubmissionUI(cachedUser || {});
                }
            });
        }

        loadProfileFromApi();
    });
})();
