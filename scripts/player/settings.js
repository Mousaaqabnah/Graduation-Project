// Settings Page JavaScript

var savePrefsTimer = null;
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
    if (window.MatchFieldI18n && typeof MatchFieldI18n.applyLanguage === 'function') {
        MatchFieldI18n.applyLanguage();
        return;
    }
    if (window.MatchFieldPrefs) {
        MatchFieldPrefs.applyDocumentLocale(MatchFieldPrefs.getLanguage());
    }
    if (window.MatchFieldI18n) {
        MatchFieldI18n.applyTranslations(document);
    }
}

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
    
    const toggles = document.querySelectorAll('.toggle-switch input:not(#emailNotifications):not(#twoFactorAuth):not(#bookingConfirmations):not(#reminders):not(#venueUpdates):not(#marketingEmails)');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', function() {
            saveSettings();
        });
    });
    
    const selects = document.querySelectorAll('.settings-select');
    selects.forEach(select => {
        select.addEventListener('change', function() {
            saveSettings();
        });
    });

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
            alert(t('settings.pleaseLoginPassword'));
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
                if (changePasswordError) changePasswordError.textContent = t('settings.passwordMin');
                return;
            }
            if (newPwd !== confirmPwd) {
                if (changePasswordError) changePasswordError.textContent = t('settings.passwordMismatch');
                return;
            }
            if (newPwd === currentPwd) {
                if (changePasswordError) changePasswordError.textContent = t('settings.passwordDifferent');
                return;
            }

            var submitBtn = document.getElementById('changePasswordSubmit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = t('common.updating');
            }

            if (typeof API === 'undefined' || !API.auth || !API.auth.updatePassword) {
                if (changePasswordError) {
                    changePasswordError.textContent = t('settings.passwordUnavailable');
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = t('auth.updatePassword');
                }
                return;
            }

            API.auth.updatePassword(currentPwd, newPwd)
                .then(function() {
                    closeChangePasswordModal();
                    alert(t('settings.passwordUpdated'));
                })
                .catch(function(err) {
                    if (changePasswordError) {
                        changePasswordError.textContent = (window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('settings.passwordFailed');
                    }
                })
                .finally(function() {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = t('auth.updatePassword');
                    }
                });
        });
    }
    // Delete Account Button
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async function() {
            if (!(await MatchFieldDialog.confirm(t('settings.deleteConfirm'), {
                type: 'danger',
                title: t('settings.deleteTitle'),
                okText: t('settings.deleteAccount')
            }))) return;
            if (!(await MatchFieldDialog.confirm(t('settings.deleteConfirm2'), {
                type: 'danger',
                title: t('settings.deleteTitle'),
                okText: t('settings.deletePermanently')
            }))) return;

            if (typeof API === 'undefined' || !API.auth || !API.auth.deleteAccount) {
                await MatchFieldDialog.alert(t('settings.deleteUnavailable'), { type: 'danger', title: t('common.error') });
                return;
            }

            var currentPwd = await MatchFieldDialog.prompt(t('settings.enterCurrentToDelete'), {
                type: 'danger',
                title: t('auth.confirmPassword'),
                inputType: 'password',
                placeholder: t('settings.currentPassword'),
                okText: t('common.continue'),
                cancelText: t('common.cancel')
            });
            if (currentPwd == null) return;
            currentPwd = String(currentPwd).trim();
            if (!currentPwd) {
                await MatchFieldDialog.alert(t('settings.currentRequired'), { type: 'warning', title: t('settings.passwordRequired') });
                return;
            }

            deleteAccountBtn.disabled = true;
            deleteAccountBtn.textContent = t('common.deleting');
            API.auth.deleteAccount(currentPwd)
                .then(async function() {
                    await MatchFieldDialog.alert(t('settings.deletedOk'), { type: 'success', title: t('settings.deleted') });
                    API.auth.logout();
                })
                .catch(async function(err) {
                    await MatchFieldDialog.alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('settings.deleteFailed'), { type: 'danger', title: t('common.error') });
                })
                .finally(function() {
                    deleteAccountBtn.disabled = false;
                    deleteAccountBtn.textContent = t('settings.deleteAccount');
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
    localStorage.setItem('playerSettings', JSON.stringify(settings));
    if (window.MatchFieldPrefs) {
        MatchFieldPrefs.setLocalePrefs(
            {
                language: settings.language,
                currency: settings.currency,
                timezone: settings.timezone
            },
            'PLAYER'
        );
    }

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

    applyLocaleUi();
}

function saveSettings(options) {
    var opts = options || {};
    var locale = readLocaleFromDom();
    const settings = {
        emailNotifications: document.getElementById('emailNotifications').checked,
        twoFactorAuth: document.getElementById('twoFactorAuth').checked,
        bookingConfirmations: document.getElementById('bookingConfirmations').checked,
        reminders: document.getElementById('reminders').checked,
        venueUpdates: document.getElementById('venueUpdates').checked,
        marketingEmails: document.getElementById('marketingEmails').checked,
        language: locale.language,
        currency: locale.currency,
        timezone: locale.timezone
    };

    localStorage.setItem('playerSettings', JSON.stringify(settings));
    if (window.MatchFieldPrefs) {
        MatchFieldPrefs.setLocalePrefs(locale, 'PLAYER');
    }
    applyLocaleUi();

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
                console.warn('Player settings: could not save to API', err);
            });
        }
    }, 400);
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
            alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('settings.saveNotifFailed'));
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
            alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('settings.saveAccountFailed'));
        })
        .finally(function() {
            accountSettingsState.isSaving = false;
            setAccountControlsDisabled(false);
        });
}











