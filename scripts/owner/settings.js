// Owner Settings Page JavaScript (aligned with player settings patterns)

var savePrefsTimer = null;
var ACCOUNT_PREF_KEYS = ['emailNotifications', 'twoFactorAuth'];
var accountSettingsState = {
    emailNotifications: true,
    twoFactorAuth: false,
    isSaving: false
};
var OWNER_NOTIFICATION_PREF_KEYS = [
    'bookingNotifications',
    'paymentNotifications',
    'fieldUpdates',
    'marketingEmails'
];
var ownerNotificationPrefsState = {
    bookingNotifications: true,
    paymentNotifications: true,
    fieldUpdates: true,
    marketingEmails: false,
    isSaving: false
};

function readLocaleFromDom() {
    var languageEl = document.getElementById('language');
    var currencyEl = document.getElementById('currency');
    var timezoneEl = document.getElementById('timezone');
    var Prefs = window.MatchFieldPrefs;
    return {
        language: Prefs
            ? Prefs.normalizeLanguage(languageEl && languageEl.value)
            : (languageEl && languageEl.value) || 'en',
        currency: Prefs
            ? Prefs.normalizeCurrency(currencyEl && currencyEl.value)
            : (currencyEl && currencyEl.value) || 'ILS',
        timezone: Prefs
            ? Prefs.normalizeTimezone(timezoneEl && timezoneEl.value)
            : (timezoneEl && timezoneEl.value) || 'Asia/Jerusalem'
    };
}

function applyLocaleUi() {
    if (window.MatchFieldPrefs) {
        MatchFieldPrefs.applyDocumentLocale(MatchFieldPrefs.getLanguage());
    }
    if (window.MatchFieldI18n) {
        MatchFieldI18n.applyTranslations(document);
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    const notificationPopup = document.getElementById('notificationPopup');

    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            if (notificationPopup) notificationPopup.classList.remove('active');
        });
    }

    document.addEventListener('click', function(e) {
        if (profilePopup && profileBtn && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
            profilePopup.classList.remove('active');
        }
    });

    await loadSettings();

    const toggles = document.querySelectorAll(
        '.toggle-switch input:not(#emailNotifications):not(#twoFactorAuth)' +
        ':not(#bookingNotifications):not(#paymentNotifications):not(#fieldUpdates):not(#marketingEmails)'
    );
    toggles.forEach(function(toggle) {
        toggle.addEventListener('change', function() {
            saveSettings();
        });
    });

    const selects = document.querySelectorAll('.settings-select');
    selects.forEach(function(select) {
        select.addEventListener('change', function() {
            saveSettings();
        });
    });

    initializeAccountSettingsHandlers();
    initializeOwnerNotificationPreferenceHandlers();

    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const changePasswordModal = document.getElementById('changePasswordModal');
    const changePasswordModalClose = document.getElementById('changePasswordModalClose');
    const changePasswordCancel = document.getElementById('changePasswordCancel');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const changePasswordError = document.getElementById('changePasswordError');
    const passwordToggleButtons = document.querySelectorAll('.password-toggle-btn');

    function openChangePasswordModal() {
        if (typeof API === 'undefined' || !API.getAuthToken || !API.getAuthToken()) {
            alert('Please log in to change your password.');
            return;
        }
        if (changePasswordModal) {
            changePasswordModal.classList.add('active');
            if (changePasswordForm) changePasswordForm.reset();
            if (changePasswordError) changePasswordError.textContent = '';
            resetPasswordVisibility();
            var cur = document.getElementById('currentPassword');
            if (cur) cur.focus();
        }
    }

    function closeChangePasswordModal() {
        if (changePasswordModal) changePasswordModal.classList.remove('active');
    }

    function resetPasswordVisibility() {
        passwordToggleButtons.forEach(function(button) {
            var targetId = button.getAttribute('data-toggle-password');
            var input = targetId ? document.getElementById(targetId) : null;
            var icon = button.querySelector('i');
            if (!input) return;
            input.type = 'password';
            button.setAttribute('aria-pressed', 'false');
            button.setAttribute('aria-label', 'Show password');
            if (icon) icon.className = 'fi fi-rr-eye';
        });
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

    passwordToggleButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            var targetId = button.getAttribute('data-toggle-password');
            var input = targetId ? document.getElementById(targetId) : null;
            var icon = button.querySelector('i');
            if (!input) return;

            var isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            button.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
            button.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
            if (icon) icon.className = isHidden ? 'fi fi-rr-eye-crossed' : 'fi fi-rr-eye';
        });
    });

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (typeof API === 'undefined' || !API.auth || !API.auth.updatePassword) {
                if (changePasswordError) {
                    changePasswordError.textContent = 'Password service is unavailable. Please refresh the page.';
                }
                return;
            }
            var currentPwd = document.getElementById('currentPassword').value;
            var newPwd = document.getElementById('newPassword').value;
            var confirmPwd = document.getElementById('confirmPassword').value;

            if (changePasswordError) changePasswordError.textContent = '';

            if (newPwd.length < 8) {
                if (changePasswordError) {
                    changePasswordError.textContent = 'New password must be at least 8 characters.';
                }
                return;
            }
            if (newPwd !== confirmPwd) {
                if (changePasswordError) {
                    changePasswordError.textContent = 'New passwords do not match.';
                }
                return;
            }
            if (newPwd === currentPwd) {
                if (changePasswordError) {
                    changePasswordError.textContent = 'New password must be different from current password.';
                }
                return;
            }

            var submitBtn = document.getElementById('changePasswordSubmit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';
            }

            API.auth.updatePassword(currentPwd, newPwd)
                .then(function() {
                    closeChangePasswordModal();
                    alert('Your password has been updated successfully.');
                })
                .catch(function(err) {
                    if (changePasswordError) {
                        changePasswordError.textContent =
                            (err && err.message) ||
                            'Failed to update password. Check your current password.';
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

    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async function() {
            if (!(await MatchFieldDialog.confirm('Are you sure you want to delete your account? This action cannot be undone.', {
                type: 'danger',
                title: 'Delete account',
                okText: 'Delete Account'
            }))) return;
            if (!(await MatchFieldDialog.confirm('This will permanently delete all your data. Are you absolutely sure?', {
                type: 'danger',
                title: 'Delete account',
                okText: 'Delete permanently'
            }))) return;

            if (typeof API === 'undefined' || !API.auth || !API.auth.deleteAccount) {
                await MatchFieldDialog.alert('Account deletion service is unavailable. Please refresh the page.', { type: 'danger', title: 'Error' });
                return;
            }

            var currentPwd = await MatchFieldDialog.prompt('Please enter your current password to confirm account deletion.', {
                type: 'danger',
                title: 'Confirm password',
                inputType: 'password',
                placeholder: 'Current password',
                okText: 'Continue',
                cancelText: 'Cancel'
            });
            if (currentPwd == null) return;
            currentPwd = String(currentPwd).trim();
            if (!currentPwd) {
                await MatchFieldDialog.alert('Current password is required to delete your account.', { type: 'warning', title: 'Password required' });
                return;
            }

            deleteAccountBtn.disabled = true;
            deleteAccountBtn.textContent = 'Deleting...';
            API.auth.deleteAccount(currentPwd)
                .then(async function() {
                    await MatchFieldDialog.alert('Your account has been deleted successfully.', { type: 'success', title: 'Deleted' });
                    API.auth.logout();
                })
                .catch(async function(err) {
                    await MatchFieldDialog.alert((err && err.message) ? err.message : 'Failed to delete account.', { type: 'danger', title: 'Error' });
                })
                .finally(function() {
                    deleteAccountBtn.disabled = false;
                    deleteAccountBtn.textContent = 'Delete Account';
                });
        });
    }
});

async function loadSettings() {
    const local = JSON.parse(localStorage.getItem('ownerSettings') || '{}');
    var remote = {};
    try {
        if (typeof API !== 'undefined' && API.users && API.users.getMyPreferences) {
            var data = await API.users.getMyPreferences();
            if (data && data.owner && typeof data.owner === 'object') {
                remote = data.owner;
            }
        }
    } catch (err) {
        console.warn('Owner settings: could not load from API', err);
    }
    var locale = window.MatchFieldPrefs
        ? MatchFieldPrefs.normalizeLocalePrefs(Object.assign({}, local, remote))
        : Object.assign(
            { language: 'en', currency: 'ILS', timezone: 'Asia/Jerusalem' },
            local,
            remote
          );
    const settings = Object.assign({}, local, remote, {
        language: locale.language,
        currency: locale.currency,
        timezone: locale.timezone
    });
    localStorage.setItem('ownerSettings', JSON.stringify(settings));
    if (window.MatchFieldPrefs) {
        MatchFieldPrefs.setLocalePrefs(
            {
                language: settings.language,
                currency: settings.currency,
                timezone: settings.timezone
            },
            'OWNER'
        );
    }

    if (settings.emailNotifications !== undefined) {
        document.getElementById('emailNotifications').checked = settings.emailNotifications;
    }
    if (settings.twoFactorAuth !== undefined) {
        document.getElementById('twoFactorAuth').checked = settings.twoFactorAuth;
    }
    if (settings.bookingNotifications !== undefined) {
        document.getElementById('bookingNotifications').checked = settings.bookingNotifications;
    }
    if (settings.paymentNotifications !== undefined) {
        document.getElementById('paymentNotifications').checked = settings.paymentNotifications;
    }
    if (settings.fieldUpdates !== undefined) {
        document.getElementById('fieldUpdates').checked = settings.fieldUpdates;
    }
    if (settings.marketingEmails !== undefined) {
        document.getElementById('marketingEmails').checked = settings.marketingEmails;
    }
    if (document.getElementById('language')) {
        document.getElementById('language').value = settings.language;
    }
    if (document.getElementById('currency')) {
        document.getElementById('currency').value = settings.currency;
    }
    if (document.getElementById('timezone')) {
        document.getElementById('timezone').value = settings.timezone;
    }

    accountSettingsState.emailNotifications = document.getElementById('emailNotifications')
        ? Boolean(document.getElementById('emailNotifications').checked)
        : true;
    accountSettingsState.twoFactorAuth = document.getElementById('twoFactorAuth')
        ? Boolean(document.getElementById('twoFactorAuth').checked)
        : false;

    ownerNotificationPrefsState.bookingNotifications = document.getElementById('bookingNotifications')
        ? Boolean(document.getElementById('bookingNotifications').checked)
        : true;
    ownerNotificationPrefsState.paymentNotifications = document.getElementById('paymentNotifications')
        ? Boolean(document.getElementById('paymentNotifications').checked)
        : true;
    ownerNotificationPrefsState.fieldUpdates = document.getElementById('fieldUpdates')
        ? Boolean(document.getElementById('fieldUpdates').checked)
        : true;
    ownerNotificationPrefsState.marketingEmails = document.getElementById('marketingEmails')
        ? Boolean(document.getElementById('marketingEmails').checked)
        : false;

    applyLocaleUi();
}

function saveSettings(options) {
    var opts = options || {};
    var locale = readLocaleFromDom();
    const settings = {
        emailNotifications: document.getElementById('emailNotifications').checked,
        twoFactorAuth: document.getElementById('twoFactorAuth').checked,
        bookingNotifications: document.getElementById('bookingNotifications').checked,
        paymentNotifications: document.getElementById('paymentNotifications').checked,
        fieldUpdates: document.getElementById('fieldUpdates').checked,
        marketingEmails: document.getElementById('marketingEmails').checked,
        language: locale.language,
        currency: locale.currency,
        timezone: locale.timezone
    };

    localStorage.setItem('ownerSettings', JSON.stringify(settings));
    if (window.MatchFieldPrefs) {
        MatchFieldPrefs.setLocalePrefs(locale, 'OWNER');
    }
    applyLocaleUi();

    if (savePrefsTimer) {
        clearTimeout(savePrefsTimer);
        savePrefsTimer = null;
    }
    if (opts.skipRemote === true) {
        return;
    }

    savePrefsTimer = setTimeout(function() {
        savePrefsTimer = null;
        if (typeof API !== 'undefined' && API.users && API.users.patchMyPreferences) {
            API.users.patchMyPreferences(settings).catch(function(err) {
                console.warn('Owner settings: API save failed', err);
            });
        }
    }, 400);
}

function initializeOwnerNotificationPreferenceHandlers() {
    OWNER_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.addEventListener('change', function() {
            var nextState = getOwnerNotificationPrefsFromDom();
            saveOwnerNotificationPreferences(nextState);
        });
    });
}

function getOwnerNotificationPrefsFromDom() {
    return {
        bookingNotifications: Boolean(document.getElementById('bookingNotifications') && document.getElementById('bookingNotifications').checked),
        paymentNotifications: Boolean(document.getElementById('paymentNotifications') && document.getElementById('paymentNotifications').checked),
        fieldUpdates: Boolean(document.getElementById('fieldUpdates') && document.getElementById('fieldUpdates').checked),
        marketingEmails: Boolean(document.getElementById('marketingEmails') && document.getElementById('marketingEmails').checked)
    };
}

function setOwnerNotificationControlsDisabled(disabled) {
    OWNER_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (el) el.disabled = disabled;
    });
}

function applyOwnerNotificationPrefsToDom(prefs) {
    OWNER_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.checked = Boolean(prefs[key]);
    });
}

function saveOwnerNotificationPreferences(nextPrefs) {
    if (ownerNotificationPrefsState.isSaving) return;

    var prev = {
        bookingNotifications: ownerNotificationPrefsState.bookingNotifications,
        paymentNotifications: ownerNotificationPrefsState.paymentNotifications,
        fieldUpdates: ownerNotificationPrefsState.fieldUpdates,
        marketingEmails: ownerNotificationPrefsState.marketingEmails
    };

    OWNER_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        ownerNotificationPrefsState[key] = Boolean(nextPrefs[key]);
    });
    applyOwnerNotificationPrefsToDom(ownerNotificationPrefsState);
    saveSettings({ skipRemote: true });

    if (typeof API === 'undefined' || !API.users || !API.users.patchMyPreferences) {
        return;
    }

    ownerNotificationPrefsState.isSaving = true;
    setOwnerNotificationControlsDisabled(true);
    API.users.patchMyPreferences({
        bookingNotifications: ownerNotificationPrefsState.bookingNotifications,
        paymentNotifications: ownerNotificationPrefsState.paymentNotifications,
        fieldUpdates: ownerNotificationPrefsState.fieldUpdates,
        marketingEmails: ownerNotificationPrefsState.marketingEmails
    })
        .catch(function(err) {
            OWNER_NOTIFICATION_PREF_KEYS.forEach(function(key) {
                ownerNotificationPrefsState[key] = Boolean(prev[key]);
            });
            applyOwnerNotificationPrefsToDom(ownerNotificationPrefsState);
            saveSettings({ skipRemote: true });
            alert((err && err.message) ? err.message : 'Failed to save notification preferences. Changes were reverted.');
        })
        .finally(function() {
            ownerNotificationPrefsState.isSaving = false;
            setOwnerNotificationControlsDisabled(false);
        });
}

function initializeAccountSettingsHandlers() {
    ACCOUNT_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.addEventListener('change', function() {
            var next = getOwnerAccountSettingsFromDom();
            saveOwnerAccountSettings(next);
        });
    });
}

function getOwnerAccountSettingsFromDom() {
    return {
        emailNotifications: Boolean(document.getElementById('emailNotifications') && document.getElementById('emailNotifications').checked),
        twoFactorAuth: Boolean(document.getElementById('twoFactorAuth') && document.getElementById('twoFactorAuth').checked)
    };
}

function applyOwnerAccountSettingsToDom(values) {
    ACCOUNT_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.checked = Boolean(values[key]);
    });
}

function setOwnerAccountControlsDisabled(disabled) {
    ACCOUNT_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (el) el.disabled = disabled;
    });
}

function saveOwnerAccountSettings(nextValues) {
    if (accountSettingsState.isSaving) return;

    var prev = {
        emailNotifications: accountSettingsState.emailNotifications,
        twoFactorAuth: accountSettingsState.twoFactorAuth
    };

    accountSettingsState.emailNotifications = Boolean(nextValues.emailNotifications);
    accountSettingsState.twoFactorAuth = Boolean(nextValues.twoFactorAuth);
    applyOwnerAccountSettingsToDom(accountSettingsState);
    saveSettings({ skipRemote: true });

    if (typeof API === 'undefined' || !API.users || !API.users.patchMyPreferences) {
        return;
    }

    accountSettingsState.isSaving = true;
    setOwnerAccountControlsDisabled(true);
    API.users.patchMyPreferences({
        emailNotifications: accountSettingsState.emailNotifications,
        twoFactorAuth: accountSettingsState.twoFactorAuth
    })
        .catch(function(err) {
            accountSettingsState.emailNotifications = prev.emailNotifications;
            accountSettingsState.twoFactorAuth = prev.twoFactorAuth;
            applyOwnerAccountSettingsToDom(accountSettingsState);
            saveSettings({ skipRemote: true });
            alert((err && err.message) ? err.message : 'Failed to save account settings. Changes were reverted.');
        })
        .finally(function() {
            accountSettingsState.isSaving = false;
            setOwnerAccountControlsDisabled(false);
        });
}
