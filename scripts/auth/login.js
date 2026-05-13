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
            this.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        });
    });
}

initPasswordToggles();

async function redirectAfterAuth(user) {
    if (!user) return;
    if (String(user.status || '').toUpperCase() === 'SUSPENDED') {
        var contactPath =
            String(user.role || '').toUpperCase() === 'OWNER'
                ? '/pages/owner/contact-us.html'
                : '/pages/shared/contact-us.html';
        if (window.MatchFieldDialog && typeof MatchFieldDialog.alert === 'function') {
            await MatchFieldDialog.alert(
                'Your account has been suspended. You can only use Contact Us until support restores your access.',
                { type: 'warning', title: 'Account suspended' }
            );
        }
        try {
            sessionStorage.setItem('matchfield_suspended_notice_shown', '1');
        } catch (_) {
            /* ignore */
        }
        window.location.href = contactPath;
        return;
    }
    if (user.role === 'ADMIN') {
        window.location.href = '/pages/admin/dashboard.html';
    } else if (user.role === 'OWNER') {
        window.location.href = '/pages/owner/dashboard.html';
    } else {
        window.location.href = '/pages/player/home.html';
    }
}

// Form submission handler
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const loginButton = document.querySelector('.btn-primary');
    const originalText = loginButton.textContent;
    loginButton.textContent = 'Logging in...';
    loginButton.disabled = true;
    
    try {
        const response = await API.auth.login(email, password);
        await redirectAfterAuth(response.user);
    } catch (error) {
        alert(error.message || 'Login failed. Please check your credentials.');
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

