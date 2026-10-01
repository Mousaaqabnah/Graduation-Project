function initPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.password-toggle-btn');

    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const icon = this.querySelector('i');
            if (!passwordInput || !icon) return;

            const isHidden = passwordInput.type === 'password';
            passwordInput.type = isHidden ? 'text' : 'password';
            icon.className = isHidden ? 'fi fi-rr-eye-crossed' : 'fi fi-rr-eye';
            this.setAttribute('aria-label', isHidden ? t('accessibility.hidePassword') : t('accessibility.showPassword'));
        });
    });
}

initPasswordToggles();

var OAUTH_ERROR_KEYS = {
    cancelled: 'auth.google.errorCancelled',
    state_mismatch: 'auth.google.errorStateMismatch',
    email_unverified: 'auth.google.errorEmailUnverified',
    account_exists: 'auth.google.errorAccountExists',
    no_account: 'auth.google.errorNoAccount',
    suspended: 'auth.google.errorSuspended',
    not_allowed: 'auth.google.errorNotAllowed',
    generic: 'auth.google.errorGeneric'
};

(function initGoogleLogin() {
    var btn = document.getElementById('googleLoginBtn');
    var wrap = document.getElementById('googleAuthSection');
    if (!btn || !wrap || typeof API === 'undefined' || !API.auth || !API.auth.isGoogleEnabled) return;
    API.auth.isGoogleEnabled().then(function(enabled) {
        if (!enabled) return;
        wrap.hidden = false;
        btn.addEventListener('click', function() {
            btn.disabled = true;
            btn.querySelector('.btn-google-label').textContent = t('auth.google.signingIn');
            window.location.href = API.auth.googleStartUrl('login');
        });
        window.addEventListener('pageshow', function(e) {
            if (!e.persisted) return;
            btn.disabled = false;
            btn.querySelector('.btn-google-label').textContent = t('auth.google.continue');
        });
    });
})();

(function showOAuthError() {
    var params;
    try {
        params = new URLSearchParams(window.location.search);
    } catch (_) {
        return;
    }
    var code = params.get('oauth_error');
    if (!code) return;
    var key = Object.prototype.hasOwnProperty.call(OAUTH_ERROR_KEYS, code)
        ? OAUTH_ERROR_KEYS[code]
        : OAUTH_ERROR_KEYS.generic;
    var box = document.getElementById('oauthErrorBox');
    if (box) {
        box.setAttribute('data-i18n', key);
        box.textContent = t(key);
        box.hidden = false;
    }
    try {
        params.delete('oauth_error');
        var rest = params.toString();
        history.replaceState(history.state, '', window.location.pathname + (rest ? '?' + rest : ''));
    } catch (_) {
        /* ignore */
    }
})();

// Form submission handler
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const loginButton = document.querySelector('.btn-primary');
    const originalText = loginButton.textContent;
    loginButton.textContent = t('auth.loggingIn');
    loginButton.disabled = true;
    
    try {
        const response = await API.auth.login(email, password);
        await redirectAfterAuth(response.user);
    } catch (error) {
        alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(error.message)) || t('auth.loginFailed'));
        loginButton.textContent = originalText;
        loginButton.disabled = false;
    }
});

// Add smooth focus transitions
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', function() {
        this.parentElement.classList.remove('focused');
    });
});

// Always clear login form fields when we land on the login page
// This prevents old email/password from appearing after logout + back navigation
(function() {
    function clearLoginForm() {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');

        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        try {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        } catch (_) { /* ignore */ }
    }

    // Clear immediately on script load (login.html loads this at the end of body)
    clearLoginForm();

    // Also clear when page is restored from back/forward cache
    window.addEventListener('pageshow', function(e) {
        if (e.persisted) {
            clearLoginForm();
        }
    });
})();

(function loadFieldsListedCount() {
    if (typeof API === 'undefined' || typeof API.getApiBaseUrl !== 'function') return;
    var base = String(API.getApiBaseUrl()).replace(/\/$/, '');
    var el = document.getElementById('loginStatFields');
    if (!el) return;
    fetch(base + '/public/stats')
        .then(function(r) { return r.ok ? r.json() : Promise.reject(new Error('stats')); })
        .then(function(data) {
            var n = data && typeof data.fieldCount === 'number' ? data.fieldCount : NaN;
            if (!Number.isFinite(n)) throw new Error('bad count');
            el.textContent = n.toLocaleString('en-US');
        })
        .catch(function() {
            el.textContent = '—';
        });
})();

