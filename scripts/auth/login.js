// Form submission handler
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    
    // Here you would typically send this data to your backend
    console.log('Login attempt:', {
        email,
        password: '***',
        remember
    });
    
    // Simulate login process
    const loginButton = document.querySelector('.btn-primary');
    const originalText = loginButton.textContent;
    loginButton.textContent = 'Logging in...';
    loginButton.disabled = true;
    
    setTimeout(() => {
        alert('Login functionality would connect to your backend API here.');
        loginButton.textContent = originalText;
        loginButton.disabled = false;
    }, 1000);
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


