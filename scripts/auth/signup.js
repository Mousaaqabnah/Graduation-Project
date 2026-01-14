// User type tab switching
const playerTab = document.getElementById('playerTab');
const ownerTab = document.getElementById('ownerTab');
const signupForm = document.getElementById('signupForm');

function clearFormFields() {
    const inputs = signupForm.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="password"], input[type="date"]');
    inputs.forEach(input => {
        input.value = '';
    });
    
    // Clear select fields
    const selects = signupForm.querySelectorAll('select');
    selects.forEach(select => {
        select.value = '';
    });
    
    // Clear password strength indicator
    const strengthValue = document.getElementById('strengthValue');
    if (strengthValue) {
        strengthValue.textContent = 'Weak';
        strengthValue.className = 'strength-value weak';
    }
    
    // Uncheck terms checkbox
    const termsCheckbox = document.getElementById('terms');
    if (termsCheckbox) {
        termsCheckbox.checked = false;
    }
}

playerTab.addEventListener('click', function(e) {
    e.preventDefault();
    playerTab.classList.add('active');
    ownerTab.classList.remove('active');
    clearFormFields();
});

ownerTab.addEventListener('click', function(e) {
    e.preventDefault();
    ownerTab.classList.add('active');
    playerTab.classList.remove('active');
    clearFormFields();
});

// Password strength checker
const passwordInput = document.getElementById('password');
const passwordStrength = document.getElementById('passwordStrength');
const strengthValue = document.getElementById('strengthValue');

// Password match checker
const confirmPasswordInput = document.getElementById('confirmPassword');

function checkPasswordMatch() {
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    if (confirmPassword.length === 0) {
        confirmPasswordInput.classList.remove('password-error');
        return;
    }
    
    if (password !== confirmPassword) {
        confirmPasswordInput.classList.add('password-error');
    } else {
        confirmPasswordInput.classList.remove('password-error');
    }
}

passwordInput.addEventListener('input', function() {
    const password = this.value;
    
    // Show password strength indicator when user starts typing
    if (password.length > 0) {
        passwordStrength.classList.add('visible');
    } else {
        passwordStrength.classList.remove('visible');
    }
    
    const strength = checkPasswordStrength(password);
    strengthValue.textContent = strength.text;
    strengthValue.className = 'strength-value ' + strength.class;
    
    // Check password match if confirm password field has value
    if (confirmPasswordInput.value.length > 0) {
        checkPasswordMatch();
    }
});

confirmPasswordInput.addEventListener('input', checkPasswordMatch);

function checkPasswordStrength(password) {
    if (password.length === 0) {
        return { text: 'Weak', class: 'weak' };
    }
    
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    
    // Character variety checks
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    if (strength <= 2) {
        return { text: 'Weak', class: 'weak' };
    } else if (strength <= 4) {
        return { text: 'Medium', class: 'medium' };
    } else {
        return { text: 'Strong', class: 'strong' };
    }
}


// Form submission handler
document.getElementById('signupForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Check if passwords match
    if (password !== confirmPassword) {
        alert('Passwords do not match. Please try again.');
        return;
    }
    
    // Check if terms are accepted
    if (!document.getElementById('terms').checked) {
        alert('Please agree to the Terms and Privacy Policy.');
        return;
    }
    
    const formData = {
        userType: playerTab.classList.contains('active') ? 'player' : 'owner',
        fullName: document.getElementById('fullName').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        dateOfBirth: document.getElementById('dateOfBirth').value,
        gender: document.getElementById('gender').value,
        location: document.getElementById('location').value,
        password: '***',
    };
    
    // Here you would typically send this data to your backend
    console.log('Signup attempt:', formData);
    
    // Simulate signup process
    const signupButton = document.querySelector('.btn-primary');
    const originalText = signupButton.textContent;
    signupButton.textContent = 'Creating account...';
    signupButton.disabled = true;
    
    setTimeout(() => {
        alert('Signup functionality would connect to your backend API here.');
        signupButton.textContent = originalText;
        signupButton.disabled = false;
    }, 1500);
});

// Add smooth focus transitions
document.querySelectorAll('input, select').forEach(element => {
    element.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
    });
    
    element.addEventListener('blur', function() {
        this.parentElement.classList.remove('focused');
    });
});


