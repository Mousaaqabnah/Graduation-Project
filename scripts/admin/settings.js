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
            if (typeof API === 'undefined' || !API.auth || !API.auth.updatePassword) {
                if (changePasswordError) {
                    changePasswordError.textContent = t('settings.passwordUnavailable');
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

    var deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async function() {
            if (!(await MatchFieldDialog.confirm(t('settings.deleteAdminConfirm'), {
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
            alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('settings.saveAccountFailed'));
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
            alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('settings.saveNotifFailed'));
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
            alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(err && err.message)) || t('settings.saveSystemFailed'));
        })
        .finally(function() {
            adminSystemPrefsState.isSaving = false;
            setAdminSystemPrefsControlsDisabled(false);
        });
}
