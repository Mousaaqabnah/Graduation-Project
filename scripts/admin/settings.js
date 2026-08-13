// Admin Settings Page JavaScript (aligned with owner/player patterns)

var ACCOUNT_PREF_KEYS = ['emailNotifications', 'twoFactorAuth'];
var accountSettingsState = {
    emailNotifications: true,
    twoFactorAuth: false,
    isSaving: false
};

var ADMIN_NOTIFICATION_PREF_KEYS = [
    'userRegistrationAlerts',
    'verificationRequests',
    'systemErrors',
    'securityAlerts'
];
var adminNotificationPrefsState = {
    userRegistrationAlerts: true,
    verificationRequests: true,
    systemErrors: true,
    securityAlerts: true,
    isSaving: false
};

var adminSystemPrefsState = {
    dateFormat: 'DD/MM/YYYY',
    itemsPerPage: '25',
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
    var profileBtn = document.getElementById('profileBtn');
    var profilePopup = document.getElementById('profilePopup');
    var notificationPopup = document.getElementById('notificationPopup');

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

    initializeAccountSettingsHandlers();
    initializeAdminNotificationPreferenceHandlers();
    initializeAdminSystemPrefsHandlers();

    var changePasswordBtn = document.getElementById('changePasswordBtn');
    var changePasswordModal = document.getElementById('changePasswordModal');
    var changePasswordModalClose = document.getElementById('changePasswordModalClose');
    var changePasswordCancel = document.getElementById('changePasswordCancel');
    var changePasswordForm = document.getElementById('changePasswordForm');
    var changePasswordError = document.getElementById('changePasswordError');

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
            if (typeof API === 'undefined' || !API.auth || !API.auth.updatePassword) {
                if (changePasswordError) {
                    changePasswordError.textContent = 'Password service is unavailable. Please refresh the page.';
                }
                return;
            }
            var currentPwdEl = document.getElementById('currentPassword');
            var newPwdEl = document.getElementById('newPassword');
            var confirmPwdEl = document.getElementById('confirmPassword');
            var currentPwd = currentPwdEl ? currentPwdEl.value : '';
            var newPwd = newPwdEl ? newPwdEl.value : '';
            var confirmPwd = confirmPwdEl ? confirmPwdEl.value : '';

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

    var deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async function() {
            if (!(await MatchFieldDialog.confirm('Are you sure you want to delete your admin account? This action cannot be undone.', {
                type: 'danger',
                title: 'Delete account',
                okText: 'Delete Account'
            }))) return;
            if (!(await MatchFieldDialog.confirm('This will permanently delete your admin account and data. Are you absolutely sure?', {
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
    var local = JSON.parse(localStorage.getItem('adminSettings') || '{}');
    var remote = {};
    try {
        if (typeof API !== 'undefined' && API.users && API.users.getMyPreferences) {
            var data = await API.users.getMyPreferences();
            if (data && data.admin && typeof data.admin === 'object') {
                remote = data.admin;
            }
        }
    } catch (err) {
        console.warn('Admin settings: could not load from API', err);
    }

    var locale = window.MatchFieldPrefs
        ? MatchFieldPrefs.normalizeLocalePrefs(Object.assign({}, local, remote))
        : Object.assign(
            { language: 'en', currency: 'ILS', timezone: 'Asia/Jerusalem' },
            local,
            remote
          );

    var settings = Object.assign({}, local, remote, {
        language: locale.language,
        currency: locale.currency,
        timezone: locale.timezone
    });
    localStorage.setItem('adminSettings', JSON.stringify(settings));
    if (window.MatchFieldPrefs) {
        MatchFieldPrefs.setLocalePrefs(
            {
                language: settings.language,
                currency: settings.currency,
                timezone: settings.timezone
            },
            'ADMIN'
        );
    }

    if (settings.emailNotifications !== undefined) {
        var el = document.getElementById('emailNotifications');
        if (el) el.checked = Boolean(settings.emailNotifications);
    }
    if (settings.twoFactorAuth !== undefined) {
        var el2 = document.getElementById('twoFactorAuth');
        if (el2) el2.checked = Boolean(settings.twoFactorAuth);
    }
    ADMIN_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        if (settings[key] !== undefined) {
            var n = document.getElementById(key);
            if (n) n.checked = Boolean(settings[key]);
        }
    });

    var langEl = document.getElementById('language');
    if (langEl) langEl.value = settings.language;
    var curEl = document.getElementById('currency');
    if (curEl) curEl.value = settings.currency;
    var tzEl = document.getElementById('timezone');
    if (tzEl) tzEl.value = settings.timezone;

    if (settings.dateFormat) {
        var df = document.getElementById('dateFormat');
        if (df) df.value = settings.dateFormat;
    }
    if (settings.itemsPerPage) {
        var ipp = document.getElementById('itemsPerPage');
        if (ipp) ipp.value = settings.itemsPerPage;
    }

    syncAdminStateFromDom();
    applyLocaleUi();
}

function buildAdminSettingsFromDom() {
    var locale = readLocaleFromDom();
    return {
        emailNotifications: Boolean(document.getElementById('emailNotifications') && document.getElementById('emailNotifications').checked),
        twoFactorAuth: Boolean(document.getElementById('twoFactorAuth') && document.getElementById('twoFactorAuth').checked),
        userRegistrationAlerts: Boolean(document.getElementById('userRegistrationAlerts') && document.getElementById('userRegistrationAlerts').checked),
        verificationRequests: Boolean(document.getElementById('verificationRequests') && document.getElementById('verificationRequests').checked),
        systemErrors: Boolean(document.getElementById('systemErrors') && document.getElementById('systemErrors').checked),
        securityAlerts: Boolean(document.getElementById('securityAlerts') && document.getElementById('securityAlerts').checked),
        language: locale.language,
        currency: locale.currency,
        timezone: locale.timezone,
        dateFormat: document.getElementById('dateFormat') ? document.getElementById('dateFormat').value : 'DD/MM/YYYY',
        itemsPerPage: document.getElementById('itemsPerPage') ? document.getElementById('itemsPerPage').value : '25',
        lastUpdated: new Date().toISOString()
    };
}

function saveSettings() {
    var settings = buildAdminSettingsFromDom();
    localStorage.setItem('adminSettings', JSON.stringify(settings));
    if (window.MatchFieldPrefs) {
        MatchFieldPrefs.setLocalePrefs(
            {
                language: settings.language,
                currency: settings.currency,
                timezone: settings.timezone
            },
            'ADMIN'
        );
    }
    applyLocaleUi();
}

function syncAdminStateFromDom() {
    accountSettingsState.emailNotifications = Boolean(document.getElementById('emailNotifications') && document.getElementById('emailNotifications').checked);
    accountSettingsState.twoFactorAuth = Boolean(document.getElementById('twoFactorAuth') && document.getElementById('twoFactorAuth').checked);

    ADMIN_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        adminNotificationPrefsState[key] = Boolean(document.getElementById(key) && document.getElementById(key).checked);
    });

    var df = document.getElementById('dateFormat');
    var ipp = document.getElementById('itemsPerPage');
    adminSystemPrefsState.dateFormat = df ? df.value : 'DD/MM/YYYY';
    adminSystemPrefsState.itemsPerPage = ipp ? ipp.value : '25';
}

function initializeAccountSettingsHandlers() {
    ACCOUNT_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.addEventListener('change', function() {
            var next = {
                emailNotifications: Boolean(document.getElementById('emailNotifications') && document.getElementById('emailNotifications').checked),
                twoFactorAuth: Boolean(document.getElementById('twoFactorAuth') && document.getElementById('twoFactorAuth').checked)
            };
            saveAdminAccountSettings(next);
        });
    });
}

function applyAdminAccountSettingsToDom(values) {
    ACCOUNT_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.checked = Boolean(values[key]);
    });
}

function setAdminAccountControlsDisabled(disabled) {
    ACCOUNT_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (el) el.disabled = disabled;
    });
}

function saveAdminAccountSettings(nextValues) {
    if (accountSettingsState.isSaving) return;

    var prev = {
        emailNotifications: accountSettingsState.emailNotifications,
        twoFactorAuth: accountSettingsState.twoFactorAuth
    };

    accountSettingsState.emailNotifications = Boolean(nextValues.emailNotifications);
    accountSettingsState.twoFactorAuth = Boolean(nextValues.twoFactorAuth);
    applyAdminAccountSettingsToDom(accountSettingsState);
    saveSettings();

    if (typeof API === 'undefined' || !API.users || !API.users.patchMyPreferences) {
        return;
    }

    accountSettingsState.isSaving = true;
    setAdminAccountControlsDisabled(true);
    API.users.patchMyPreferences({
        emailNotifications: accountSettingsState.emailNotifications,
        twoFactorAuth: accountSettingsState.twoFactorAuth
    })
        .catch(function(err) {
            accountSettingsState.emailNotifications = prev.emailNotifications;
            accountSettingsState.twoFactorAuth = prev.twoFactorAuth;
            applyAdminAccountSettingsToDom(accountSettingsState);
            saveSettings();
            alert((err && err.message) ? err.message : 'Failed to save account settings. Changes were reverted.');
        })
        .finally(function() {
            accountSettingsState.isSaving = false;
            setAdminAccountControlsDisabled(false);
        });
}

function initializeAdminNotificationPreferenceHandlers() {
    ADMIN_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.addEventListener('change', function() {
            var nextState = {};
            ADMIN_NOTIFICATION_PREF_KEYS.forEach(function(k) {
                nextState[k] = Boolean(document.getElementById(k) && document.getElementById(k).checked);
            });
            saveAdminNotificationPreferences(nextState);
        });
    });
}

function applyAdminNotificationPrefsToDom(prefs) {
    ADMIN_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (!el) return;
        el.checked = Boolean(prefs[key]);
    });
}

function setAdminNotificationControlsDisabled(disabled) {
    ADMIN_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        var el = document.getElementById(key);
        if (el) el.disabled = disabled;
    });
}

function saveAdminNotificationPreferences(nextPrefs) {
    if (adminNotificationPrefsState.isSaving) return;

    var prev = {};
    ADMIN_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        prev[key] = adminNotificationPrefsState[key];
    });

    ADMIN_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        adminNotificationPrefsState[key] = Boolean(nextPrefs[key]);
    });
    applyAdminNotificationPrefsToDom(adminNotificationPrefsState);
    saveSettings();

    if (typeof API === 'undefined' || !API.users || !API.users.patchMyPreferences) {
        return;
    }

    var payload = {};
    ADMIN_NOTIFICATION_PREF_KEYS.forEach(function(key) {
        payload[key] = adminNotificationPrefsState[key];
    });

    adminNotificationPrefsState.isSaving = true;
    setAdminNotificationControlsDisabled(true);
    API.users.patchMyPreferences(payload)
        .catch(function(err) {
            ADMIN_NOTIFICATION_PREF_KEYS.forEach(function(key) {
                adminNotificationPrefsState[key] = Boolean(prev[key]);
            });
            applyAdminNotificationPrefsToDom(adminNotificationPrefsState);
            saveSettings();
            alert((err && err.message) ? err.message : 'Failed to save notification preferences. Changes were reverted.');
        })
        .finally(function() {
            adminNotificationPrefsState.isSaving = false;
            setAdminNotificationControlsDisabled(false);
        });
}

function initializeAdminSystemPrefsHandlers() {
    var df = document.getElementById('dateFormat');
    if (df) {
        df.addEventListener('change', function() {
            saveAdminSystemPreferences({
                dateFormat: df.value,
                itemsPerPage: document.getElementById('itemsPerPage') ? document.getElementById('itemsPerPage').value : adminSystemPrefsState.itemsPerPage
            });
        });
    }
    var ipp = document.getElementById('itemsPerPage');
    if (ipp) {
        ipp.addEventListener('change', function() {
            saveAdminSystemPreferences({
                dateFormat: document.getElementById('dateFormat') ? document.getElementById('dateFormat').value : adminSystemPrefsState.dateFormat,
                itemsPerPage: ipp.value
            });
        });
    }
    ['language', 'currency', 'timezone'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function () {
            saveSettings();
            saveAdminSystemPreferences({
                dateFormat: adminSystemPrefsState.dateFormat,
                itemsPerPage: adminSystemPrefsState.itemsPerPage
            });
        });
    });
}

function applyAdminSystemPrefsToDom(prefs) {
    var df = document.getElementById('dateFormat');
    if (df && prefs.dateFormat) df.value = prefs.dateFormat;
    var ipp = document.getElementById('itemsPerPage');
    if (ipp && prefs.itemsPerPage) ipp.value = prefs.itemsPerPage;
}

function setAdminSystemPrefsControlsDisabled(disabled) {
    var df = document.getElementById('dateFormat');
    var ipp = document.getElementById('itemsPerPage');
    if (df) df.disabled = disabled;
    if (ipp) ipp.disabled = disabled;
}

function saveAdminSystemPreferences(next) {
    if (adminSystemPrefsState.isSaving) return;

    var prev = {
        dateFormat: adminSystemPrefsState.dateFormat,
        itemsPerPage: adminSystemPrefsState.itemsPerPage
    };

    adminSystemPrefsState.dateFormat = next.dateFormat || prev.dateFormat;
    adminSystemPrefsState.itemsPerPage = next.itemsPerPage || prev.itemsPerPage;
    applyAdminSystemPrefsToDom(adminSystemPrefsState);
    saveSettings();

    if (typeof API === 'undefined' || !API.users || !API.users.patchMyPreferences) {
        return;
    }

    adminSystemPrefsState.isSaving = true;
    setAdminSystemPrefsControlsDisabled(true);
    API.users.patchMyPreferences({
        dateFormat: adminSystemPrefsState.dateFormat,
        itemsPerPage: adminSystemPrefsState.itemsPerPage,
        language: readLocaleFromDom().language,
        currency: readLocaleFromDom().currency,
        timezone: readLocaleFromDom().timezone
    })
        .catch(function(err) {
            adminSystemPrefsState.dateFormat = prev.dateFormat;
            adminSystemPrefsState.itemsPerPage = prev.itemsPerPage;
            applyAdminSystemPrefsToDom(adminSystemPrefsState);
            saveSettings();
            alert((err && err.message) ? err.message : 'Failed to save system preferences. Changes were reverted.');
        })
        .finally(function() {
            adminSystemPrefsState.isSaving = false;
            setAdminSystemPrefsControlsDisabled(false);
        });
}
