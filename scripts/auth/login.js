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
        
        // Show success message
        alert('Login successful! Redirecting...');
        
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


