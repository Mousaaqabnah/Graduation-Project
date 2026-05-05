// Settings Page JavaScript

var savePrefsTimer = null;
var FIXED_PLAYER_PREFS = {
    language: 'en',
    currency: 'TRY',
    timezone: 'Europe/Istanbul'
};
var PRIVACY_VISIBILITY_ALLOWED = ['public', 'private'];
var privacySecurityState = {
    profileVisibility: 'public',
    dataSharing: true,
    isSaving: false
};
var ACCOUNT_PREF_KEYS = ['emailNotifications', 'twoFactorAuth'];
var accountSettingsState = {
    emailNotifications: true,
    twoFactorAuth: false,
    isSaving: false
};
var NOTIFICATION_PREF_KEYS = [
    'bookingConfirmations',
    'reminders',
    'venueUpdates',
    'marketingEmails'
];
var notificationPrefsState = {
    bookingConfirmations: true,
    reminders: true,
    venueUpdates: true,
    marketingEmails: false,
    isSaving: false
};

document.addEventListener('DOMContentLoaded', async function() {
    // Get popup elements (notification handled by notifications.js)
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    
    // Profile popup toggle
    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            var notificationPopup = document.getElementById('notificationPopup');
            if (notificationPopup) notificationPopup.classList.remove('active');
        });
    }
    
    // Close profile popup when clicking outside
    document.addEventListener('click', function(e) {
        if (profilePopup && !profilePopup.contains(e.target) && profileBtn && !profileBtn.contains(e.target)) {
            profilePopup.classList.remove('active');
        }
    });
    
    await loadSettings();
    
    // Toggle switches event listeners (except privacy toggle, handled separately)
    const toggles = document.querySelectorAll('.toggle-switch input:not(#dataSharing):not(#emailNotifications):not(#twoFactorAuth):not(#bookingConfirmations):not(#reminders):not(#venueUpdates):not(#marketingEmails)');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', function() {
            saveSettings();
        });
    });
    
    // Select dropdowns event listeners (except privacy select, handled separately)
    const selects = document.querySelectorAll('.settings-select:not(#profileVisibility)');
    selects.forEach(select => {
        select.addEventListener('change', function() {
            saveSettings();
        });
    });

    initializePrivacySecurityHandlers();
    initializeAccountSettingsHandlers();
    initializeNotificationPreferenceHandlers();
    
    // Change Password Button & Modal
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const changePasswordModal = document.getElementById('changePasswordModal');
    const changePasswordModalClose = document.getElementById('changePasswordModalClose');
    const changePasswordCancel = document.getElementById('changePasswordCancel');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const changePasswordError = document.getElementById('changePasswordError');

    function openChangePasswordModal() {
        if (typeof API === 'undefined' || !API.getAuthToken || !API.getAuthToken()) {
            alert('Please log in to change your password.');
            return;
        }
        if (changePasswordModal) {
            changePasswordModal.classList.add('active');
            if (changePasswordForm) changePasswordForm.reset();
            if (changePasswordError) changePasswordError.textContent = '';
            var cur = document.getElementById('currentPassword');
            if (cur) cur.focus();
        }
    }

    function closeChangePasswordModal() {
        if (changePasswordModal) changePasswordModal.classList.remove('active');
    }

    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', openChangePasswordModal);
    }
    if (changePasswordModalClose) {
        changePasswordModalClose.addEventListener('click', closeChangePasswordModal);
    }
    if (changePasswordCancel) {
        changePasswordCancel.addEventListener('click', closeChangePasswordModal);
    }
    if (changePasswordModal) {
        changePasswordModal.addEventListener('click', function(e) {
            if (e.target === changePasswordModal) closeChangePasswordModal();
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var currentPwd = document.getElementById('currentPassword').value;
            var newPwd = document.getElementById('newPassword').value;
            var confirmPwd = document.getElementById('confirmPassword').value;

            if (changePasswordError) changePasswordError.textContent = '';

            if (newPwd.length < 8) {
                if (changePasswordError) changePasswordError.textContent = 'New password must be at least 8 characters.';
                return;
            }
            if (newPwd !== confirmPwd) {
                if (changePasswordError) changePasswordError.textContent = 'New passwords do not match.';
                return;
            }
            if (newPwd === currentPwd) {
                if (changePasswordError) changePasswordError.textContent = 'New password must be different from current password.';
                return;
            }

            var submitBtn = document.getElementById('changePasswordSubmit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';
            }

            if (typeof API === 'undefined' || !API.auth || !API.auth.updatePassword) {
                if (changePasswordError) {
                    changePasswordError.textContent = 'Password service is unavailable. Please refresh the page.';
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Update Password';
                }
                return;
            }

            API.auth.updatePassword(currentPwd, newPwd)
                .then(function() {
                    closeChangePasswordModal();
                    alert('Your password has been updated successfully.');
                })
                .catch(function(err) {
                    if (changePasswordError) {
                        changePasswordError.textContent = err.message || 'Failed to update password. Please check your current password.';
                    }
                })
                .finally(function() {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Update Password';
                    }
                });
        });
    }
    // Delete Account Button
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', function() {
            if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
            if (!confirm('This will permanently delete all your data. Are you absolutely sure?')) return;

            if (typeof API === 'undefined' || !API.auth || !API.auth.deleteAccount) {
                alert('Account deletion service is unavailable. Please refresh the page.');
                return;
            }

            var currentPwd = prompt('Please enter your current password to confirm account deletion:');
            if (currentPwd == null) return;
            currentPwd = String(currentPwd).trim();
            if (!currentPwd) {
                alert('Current password is required to delete your account.');
                return;
            }

            deleteAccountBtn.disabled = true;
            deleteAccountBtn.textContent = 'Deleting...';
            API.auth.deleteAccount(currentPwd)
                .then(function() {
                    alert('Your account has been deleted successfully.');
                    API.auth.logout();
                })
                .catch(function(err) {
                    alert((err && err.message) ? err.message : 'Failed to delete account.');
                })
                .finally(function() {
                    deleteAccountBtn.disabled = false;
                    deleteAccountBtn.textContent = 'Delete Account';
                });
        });
    }
});

async function loadSettings() {
    const local = JSON.parse(localStorage.getItem('playerSettings') || '{}');
    var remote = {};
    try {
        if (typeof API !== 'undefined' && API.users && API.users.getMyPreferences) {
            var data = await API.users.getMyPreferences();
            if (data && data.player && typeof data.player === 'object') {
                remote = data.player;
            }
        }
    } catch (err) {
        console.warn('Player settings: could not load from API', err);
    }
    const settings = {
        ...local,
        ...remote,
        language: FIXED_PLAYER_PREFS.language,
        currency: FIXED_PLAYER_PREFS.currency,
        timezone: FIXED_PLAYER_PREFS.timezone
    };
    localStorage.setItem('playerSettings', JSON.stringify(settings));

    if (settings.emailNotifications !== undefined) {
        document.getElementById('emailNotifications').checked = settings.emailNotifications;
    }
    if (settings.twoFactorAuth !== undefined) {
        document.getElementById('twoFactorAuth').checked = settings.twoFactorAuth;
    }
    if (settings.bookingConfirmations !== undefined) {
        document.getElementById('bookingConfirmations').checked = settings.bookingConfirmations;
    }
    if (settings.reminders !== undefined) {
        document.getElementById('reminders').checked = settings.reminders;
    }
    if (settings.venueUpdates !== undefined) {
        document.getElementById('venueUpdates').checked = settings.venueUpdates;
    }
    if (settings.marketingEmails !== undefined) {
        document.getElementById('marketingEmails').checked = settings.marketingEmails;
    }
    if (settings.dataSharing !== undefined && document.getElementById('dataSharing')) {
        document.getElementById('dataSharing').checked = Boolean(settings.dataSharing);
    }
    if (document.getElementById('profileVisibility')) {
        var visibility = PRIVACY_VISIBILITY_ALLOWED.indexOf(settings.profileVisibility) !== -1
            ? settings.profileVisibility
            : 'public';
        document.getElementById('profileVisibility').value = visibility;
    }
    if (settings.language) {
        document.getElementById('language').value = settings.language;
    }
    if (settings.currency) {
        document.getElementById('currency').value = settings.currency;
    }
    if (settings.timezone) {
        document.getElementById('timezone').value = settings.timezone;
    }

    privacySecurityState.profileVisibility = document.getElementById('profileVisibility')
        ? document.getElementById('profileVisibility').value
        : 'public';
    privacySecurityState.dataSharing = document.getElementById('dataSharing')
        ? Boolean(document.getElementById('dataSharing').checked)
        : true;

    accountSettingsState.emailNotifications = document.getElementById('emailNotifications')
        ? Boolean(document.getElementById('emailNotifications').checked)
        : true;
    accountSettingsState.twoFactorAuth = document.getElementById('twoFactorAuth')
        ? Boolean(document.getElementById('twoFactorAuth').checked)
        : false;

    notificationPrefsState.bookingConfirmations = document.getElementById('bookingConfirmations')
        ? Boolean(document.getElementById('bookingConfirmations').checked)
        : true;
    notificationPrefsState.reminders = document.getElementById('reminders')
        ? Boolean(document.getElementById('reminders').checked)
        : true;
    notificationPrefsState.venueUpdates = document.getElementById('venueUpdates')
        ? Boolean(document.getElementById('venueUpdates').checked)
        : true;
    notificationPrefsState.marketingEmails = document.getElementById('marketingEmails')
        ? Boolean(document.getElementById('marketingEmails').checked)
        : false;
}

function saveSettings(options) {
    var opts = options || {};
    const settings = {
        emailNotifications: document.getElementById('emailNotifications').checked,
        twoFactorAuth: document.getElementById('twoFactorAuth').checked,
        bookingConfirmations: document.getElementById('bookingConfirmations').checked,
        reminders: document.getElementById('reminders').checked,
        venueUpdates: document.getElementById('venueUpdates').checked,
        marketingEmails: document.getElementById('marketingEmails').checked,
        dataSharing: document.getElementById('dataSharing').checked,
        profileVisibility: document.getElementById('profileVisibility').value,
        language: FIXED_PLAYER_PREFS.language,
        currency: FIXED_PLAYER_PREFS.currency,
        timezone: FIXED_PLAYER_PREFS.timezone
    };

    localStorage.setItem('playerSettings', JSON.stringify(settings));

    if (savePrefsTimer) {
        clearTimeout(savePrefsTimer);
        savePrefsTimer = null;
    }
    if (opts.skipRemote === true) {
        return;
    }

    savePrefsTimer = setTimeout(function () {
        savePrefsTimer = null;
        if (typeof API !== 'undefined' && API.users && API.users.patchMyPreferences) {
            API.users.patchMyPreferences(settings).catch(function (err) {
                console.warn('Player settings: API save failed', err);
            });
        }
    }, 400);
}

function initializePrivacySecurityHandlers() {
    var profileVisibilityEl = document.getElementById('profileVisibility');
    var dataSharingEl = document.getElementById('dataSharing');

    if (profileVisibilityEl) {
        profileVisibilityEl.addEventListener('change', function() {
            var nextValue = profileVisibilityEl.value;
            if (PRIVACY_VISIBILITY_ALLOWED.indexOf(nextValue) === -1) {
                profileVisibilityEl.value = privacySecurityState.profileVisibility;
                return;
            }
            savePrivacySecuritySettings({
                profileVisibility: nextValue,
                dataSharing: dataSharingEl ? Boolean(dataSharingEl.checked) : privacySecurityState.dataSharing
            });
        });
    }

    if (dataSharingEl) {
        dataSharingEl.addEventListener('change', function() {
            savePrivacySecuritySettings({
                profileVisibility: profileVisibilityEl ? profileVisibilityEl.value : privacySecurityState.profileVisibility,
                dataSharing: Boolean(dataSharingEl.checked)
            });
        });
    }
}

function setPrivacyControlsDisabled(disabled) {
    var profileVisibilityEl = document.getElementById('profileVisibility');
    var dataSharingEl = document.getElementById('dataSharing');
    if (profileVisibilityEl) profileVisibilityEl.disabled = disabled;
    if (dataSharingEl) dataSharingEl.disabled = disabled;
}

function savePrivacySecuritySettings(nextPrefs) {
    var profileVisibilityEl = document.getElementById('profileVisibility');
    var dataSharingEl = document.getElementById('dataSharing');
    if (!profileVisibilityEl || !dataSharingEl) return;
    if (privacySecurityState.isSaving) return;

    var nextVisibility = PRIVACY_VISIBILITY_ALLOWED.indexOf(nextPrefs.profileVisibility) !== -1
        ? nextPrefs.profileVisibility
        : privacySecurityState.profileVisibility;
    var nextDataSharing = Boolean(nextPrefs.dataSharing);

    var prevState = {
        profileVisibility: privacySecurityState.profileVisibility,
        dataSharing: privacySecurityState.dataSharing
    };

    privacySecurityState.profileVisibility = nextVisibility;
    privacySecurityState.dataSharing = nextDataSharing;
    profileVisibilityEl.value = nextVisibility;
    dataSharingEl.checked = nextDataSharing;
    saveSettings({ skipRemote: true });

    if (typeof API === 'undefined' || !API.users || !API.users.patchMyPreferences) {
        return;
    }

    privacySecurityState.isSaving = true;
    setPrivacyControlsDisabled(true);
    API.users.patchMyPreferences({
        profileVisibility: nextVisibility,
        dataSharing: nextDataSharing
    })
        .catch(function(err) {
            privacySecurityState.profileVisibility = prevState.profileVisibility;
            privacySecurityState.dataSharing = prevState.dataSharing;
            profileVisibilityEl.value = prevState.profileVisibility;
            dataSharingEl.checked = prevState.dataSharing;
            saveSettings({ skipRemote: true });
            alert((err && err.message) ? err.message : 'Failed to save privacy settings. Changes were reverted.');
        })
        .finally(function() {
            privacySecurityState.isSaving = false;
            setPrivacyControlsDisabled(false);
        });
}

function initializeNotificationPreferenceHandlers() {
    NOTIFICATION_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.addEventListener('change', function() {
            var nextState = getNotificationPrefsFromDom();
            saveNotificationPreferences(nextState);
        });
    });
}

function getNotificationPrefsFromDom() {
    return {
        emailNotifications: Boolean(document.getElementById('emailNotifications') && document.getElementById('emailNotifications').checked),
        bookingConfirmations: Boolean(document.getElementById('bookingConfirmations') && document.getElementById('bookingConfirmations').checked),
        reminders: Boolean(document.getElementById('reminders') && document.getElementById('reminders').checked),
        venueUpdates: Boolean(document.getElementById('venueUpdates') && document.getElementById('venueUpdates').checked),
        marketingEmails: Boolean(document.getElementById('marketingEmails') && document.getElementById('marketingEmails').checked)
    };
}

function setNotificationControlsDisabled(disabled) {
    NOTIFICATION_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (el) el.disabled = disabled;
    });
}

function applyNotificationPrefsToDom(prefs) {
    NOTIFICATION_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.checked = Boolean(prefs[key]);
    });
}

function saveNotificationPreferences(nextPrefs) {
    if (notificationPrefsState.isSaving) return;

    var prev = {
        bookingConfirmations: notificationPrefsState.bookingConfirmations,
        reminders: notificationPrefsState.reminders,
        venueUpdates: notificationPrefsState.venueUpdates,
        marketingEmails: notificationPrefsState.marketingEmails
    };

    NOTIFICATION_PREF_KEYS.forEach(function(key) {
        notificationPrefsState[key] = Boolean(nextPrefs[key]);
    });
    applyNotificationPrefsToDom(notificationPrefsState);
    saveSettings({ skipRemote: true });

    if (typeof API === 'undefined' || !API.users || !API.users.patchMyPreferences) {
        return;
    }

    notificationPrefsState.isSaving = true;
    setNotificationControlsDisabled(true);
    API.users.patchMyPreferences({
        bookingConfirmations: notificationPrefsState.bookingConfirmations,
        reminders: notificationPrefsState.reminders,
        venueUpdates: notificationPrefsState.venueUpdates,
        marketingEmails: notificationPrefsState.marketingEmails
    })
        .catch(function(err) {
            NOTIFICATION_PREF_KEYS.forEach(function(key) {
                notificationPrefsState[key] = Boolean(prev[key]);
            });
            applyNotificationPrefsToDom(notificationPrefsState);
            saveSettings({ skipRemote: true });
            alert((err && err.message) ? err.message : 'Failed to save notification preferences. Changes were reverted.');
        })
        .finally(function() {
            notificationPrefsState.isSaving = false;
            setNotificationControlsDisabled(false);
        });
}

function initializeAccountSettingsHandlers() {
    ACCOUNT_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.addEventListener('change', function() {
            var next = getAccountSettingsFromDom();
            saveAccountSettings(next);
        });
    });
}

function getAccountSettingsFromDom() {
    return {
        emailNotifications: Boolean(document.getElementById('emailNotifications') && document.getElementById('emailNotifications').checked),
        twoFactorAuth: Boolean(document.getElementById('twoFactorAuth') && document.getElementById('twoFactorAuth').checked)
    };
}

function applyAccountSettingsToDom(values) {
    ACCOUNT_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.checked = Boolean(values[key]);
    });
}

function setAccountControlsDisabled(disabled) {
    ACCOUNT_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (el) el.disabled = disabled;
    });
}

function saveAccountSettings(nextValues) {
    if (accountSettingsState.isSaving) return;

    var prev = {
        emailNotifications: accountSettingsState.emailNotifications,
        twoFactorAuth: accountSettingsState.twoFactorAuth
    };

    accountSettingsState.emailNotifications = Boolean(nextValues.emailNotifications);
    accountSettingsState.twoFactorAuth = Boolean(nextValues.twoFactorAuth);
    applyAccountSettingsToDom(accountSettingsState);
    saveSettings({ skipRemote: true });

    if (typeof API === 'undefined' || !API.users || !API.users.patchMyPreferences) {
        return;
    }

    accountSettingsState.isSaving = true;
    setAccountControlsDisabled(true);
    API.users.patchMyPreferences({
        emailNotifications: accountSettingsState.emailNotifications,
        twoFactorAuth: accountSettingsState.twoFactorAuth
    })
        .catch(function(err) {
            accountSettingsState.emailNotifications = prev.emailNotifications;
            accountSettingsState.twoFactorAuth = prev.twoFactorAuth;
            applyAccountSettingsToDom(accountSettingsState);
            saveSettings({ skipRemote: true });
            alert((err && err.message) ? err.message : 'Failed to save account settings. Changes were reverted.');
        })
        .finally(function() {
            accountSettingsState.isSaving = false;
            setAccountControlsDisabled(false);
        });
}











