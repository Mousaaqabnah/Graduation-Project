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
            alert(t('settings.pleaseLoginPassword'));
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
            button.setAttribute('aria-label', t('accessibility.showPassword'));
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
            button.setAttribute('aria-label', isHidden ? t('accessibility.hidePassword') : t('accessibility.showPassword'));
            if (icon) icon.className = isHidden ? 'fi fi-rr-eye-crossed' : 'fi fi-rr-eye';
        });
    });

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (typeof API === 'undefined' || !API.auth || !API.auth.updatePassword) {
                if (changePasswordError) {
                    changePasswordError.textContent = t('settings.passwordUnavailable');
                }
                return;
            }
            var currentPwd = document.getElementById('currentPassword').value;
            var newPwd = document.getElementById('newPassword').value;
            var confirmPwd = document.getElementById('confirmPassword').value;

            if (changePasswordError) changePasswordError.textContent = '';

            if (newPwd.length < 8) {
                if (changePasswordError) {
                    changePasswordError.textContent = t('settings.passwordMin');
                }
                return;
            }
            if (newPwd !== confirmPwd) {
                if (changePasswordError) {
                    changePasswordError.textContent = t('settings.passwordMismatch');
                }
                return;
            }
            if (newPwd === currentPwd) {
                if (changePasswordError) {
                    changePasswordError.textContent = t('settings.passwordDifferent');
                }
                return;
            }

            var submitBtn = document.getElementById('changePasswordSubmit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = t('common.updating');
            }

            API.auth.updatePassword(currentPwd, newPwd)
                .then(function() {
                    closeChangePasswordModal();
                    alert(t('settings.passwordUpdated'));
                })
                .catch(function(err) {
                    if (changePasswordError) {
                        changePasswordError.textContent =
                            (window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) ||
                            t('settings.passwordFailed');
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
            alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('settings.saveNotifFailed'));
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
            alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('settings.saveAccountFailed'));
        })
        .finally(function() {
            accountSettingsState.isSaving = false;
            setOwnerAccountControlsDisabled(false);
        });
}
