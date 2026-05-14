// User type tab switching
const playerTab = document.getElementById('playerTab');
const ownerTab = document.getElementById('ownerTab');
const signupForm = document.getElementById('signupForm');

const SIGNUP_DRAFT_KEY = 'matchfield_signup_draft';
let suppressSignupDraftPersist = false;

function saveSignupDraft() {
    if (suppressSignupDraftPersist || !signupForm || !playerTab || !ownerTab) return;
    const draft = {
        v: 1,
        userType: playerTab.classList.contains('active') ? 'player' : 'owner',
        fullName: document.getElementById('fullName')?.value ?? '',
        phone: document.getElementById('phone')?.value ?? '',
        dateOfBirth: document.getElementById('dateOfBirth')?.value ?? '',
        email: document.getElementById('email')?.value ?? '',
        gender: document.getElementById('gender')?.value ?? '',
        location: document.getElementById('location')?.value ?? '',
        password: document.getElementById('password')?.value ?? '',
        confirmPassword: document.getElementById('confirmPassword')?.value ?? '',
        terms: document.getElementById('terms')?.checked ?? false
    };
    try {
        sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
    } catch (_) {
        /* ignore quota / private mode */
    }
}

function clearSignupDraft() {
    try {
        sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
    } catch (_) {
        /* ignore */
    }
}

function initPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.password-toggle-btn');

    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const passwordField = document.getElementById(targetId);
            const icon = this.querySelector('i');
            if (!passwordField || !icon) return;

            const isHidden = passwordField.type === 'password';
            passwordField.type = isHidden ? 'text' : 'password';
            icon.className = isHidden ? 'fi fi-rr-eye-crossed' : 'fi fi-rr-eye';
            this.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        });
    });
}

initPasswordToggles();

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

    saveSignupDraft();
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

function restoreSignupDraft() {
    let draft;
    try {
        const raw = sessionStorage.getItem(SIGNUP_DRAFT_KEY);
        if (!raw) return;
        draft = JSON.parse(raw);
    } catch {
        return;
    }
    if (!draft || draft.v !== 1) return;

    if (draft.userType === 'owner') {
        ownerTab.classList.add('active');
        playerTab.classList.remove('active');
    } else {
        playerTab.classList.add('active');
        ownerTab.classList.remove('active');
    }

    const fullName = document.getElementById('fullName');
    const phone = document.getElementById('phone');
    const dateOfBirth = document.getElementById('dateOfBirth');
    const email = document.getElementById('email');
    const gender = document.getElementById('gender');
    const location = document.getElementById('location');
    const terms = document.getElementById('terms');
    if (fullName) fullName.value = draft.fullName || '';
    if (phone) phone.value = draft.phone || '';
    if (dateOfBirth) dateOfBirth.value = draft.dateOfBirth || '';
    if (email) email.value = draft.email || '';
    if (gender) gender.value = draft.gender || '';
    if (location) location.value = draft.location || '';
    if (passwordInput) passwordInput.value = draft.password || '';
    if (confirmPasswordInput) confirmPasswordInput.value = draft.confirmPassword || '';
    if (terms) terms.checked = !!draft.terms;

    if (passwordInput) {
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (confirmPasswordInput) {
        confirmPasswordInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

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
document.getElementById('signupForm').addEventListener('submit', async function(e) {
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
    
    const userType = playerTab.classList.contains('active') ? 'PLAYER' : 'OWNER';
    const formData = {
        role: userType,
        fullName: document.getElementById('fullName').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        dateOfBirth: document.getElementById('dateOfBirth').value,
        gender: document.getElementById('gender').value,
        location: document.getElementById('location').value,
        password: password
    };
    
    const signupButton = document.querySelector('.btn-primary');
    const originalText = signupButton.textContent;
    signupButton.textContent = 'Creating account...';
    signupButton.disabled = true;
    
    try {
        const response = await API.auth.register(formData);

        suppressSignupDraftPersist = true;
        clearSignupDraft();

        // Show success message
        alert('Account created successfully! Redirecting to login...');
        
        // Store token and user if login is automatic
        if (response.token && response.user) {
            API.setAuthToken(response.token);
            API.setCurrentUser(response.user);
            
            // Redirect based on role
            if (response.user.role === 'ADMIN') {
                window.location.href = '/pages/admin/dashboard.html';
            } else if (response.user.role === 'OWNER') {
                window.location.href = '/pages/owner/dashboard.html';
            } else {
                window.location.href = '/pages/player/home.html';
            }
        } else {
            // Redirect to login page
            window.location.href = '/pages/auth/login.html';
        }
    } catch (error) {
        alert(error.message || 'Signup failed. Please try again.');
        signupButton.textContent = originalText;
        signupButton.disabled = false;
    }
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

restoreSignupDraft();

signupForm.addEventListener('input', saveSignupDraft);
signupForm.addEventListener('change', saveSignupDraft);
window.addEventListener('pagehide', saveSignupDraft);


