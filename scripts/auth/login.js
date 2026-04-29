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

// Form submission handler
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    
    const loginButton = document.querySelector('.btn-primary');
    const originalText = loginButton.textContent;
    loginButton.textContent = 'Logging in...';
    loginButton.disabled = true;
    
    try {
        const response = await API.auth.login(email, password);
        
        // Redirect based on user role
        const user = response.user;
        if (user.role === 'ADMIN') {
            window.location.href = '/pages/admin/dashboard.html';
        } else if (user.role === 'OWNER') {
            window.location.href = '/pages/owner/dashboard.html';
        } else {
            window.location.href = '/pages/player/home.html';
        }
    } catch (error) {
        alert(error.message || 'Login failed. Please check your credentials.');
        loginButton.textContent = originalText;
        loginButton.disabled = false;
    }
});

// Google Sign In handler
document.getElementById('googleSignIn').addEventListener('click', function() {
    const button = this;
    const originalText = button.innerHTML;
    
    button.innerHTML = '<span>Connecting to Google...</span>';
    button.disabled = true;
    
    // Here you would integrate with Google OAuth
    setTimeout(() => {
        alert('Google Sign-In would integrate with Google OAuth API here.');
        button.innerHTML = originalText;
        button.disabled = false;
    }, 1000);
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
        const rememberCheckbox = document.getElementById('remember');
        
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (rememberCheckbox) rememberCheckbox.checked = false;
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

