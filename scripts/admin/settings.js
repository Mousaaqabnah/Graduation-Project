// Admin Settings Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Get popup elements
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationPopup = document.getElementById('notificationPopup');
    
    // Notification popup toggle
    if (notificationBtn && notificationPopup) {
        notificationBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationPopup.classList.toggle('active');
            // Close profile popup if open
            if (profilePopup) {
                profilePopup.classList.remove('active');
            }
        });
    }
    
    // Profile popup toggle
    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            // Close notification popup if open
            if (notificationPopup) {
                notificationPopup.classList.remove('active');
            }
        });
    }
    
    // Close popups when clicking outside
    document.addEventListener('click', function(e) {
        if (notificationPopup && !notificationPopup.contains(e.target) && notificationBtn && !notificationBtn.contains(e.target)) {
            notificationPopup.classList.remove('active');
        }
        if (profilePopup && !profilePopup.contains(e.target) && profileBtn && !profileBtn.contains(e.target)) {
            profilePopup.classList.remove('active');
        }
    });
    
    // Load saved settings
    loadSettings();
    
    // Toggle switches event listeners
    const toggles = document.querySelectorAll('.toggle-switch input');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', function() {
            saveSettings();
        });
    });
    
    // Select dropdowns event listeners
    const selects = document.querySelectorAll('.settings-select');
    selects.forEach(select => {
        select.addEventListener('change', function() {
            saveSettings();
        });
    });
    
    // Change Password Button
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            // TODO: Open change password modal
            alert('Change password functionality will be implemented soon!');
        });
    }
    
    // Manage Sessions Button
    const manageSessionsBtn = document.getElementById('manageSessionsBtn');
    if (manageSessionsBtn) {
        manageSessionsBtn.addEventListener('click', function() {
            // TODO: Open session management modal
            alert('Session management functionality will be implemented soon!');
        });
    }
    
    // Reset Password Button
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to reset your admin password? This will require verification.')) {
                // TODO: Implement password reset
                alert('Password reset functionality will be implemented soon!');
            }
        });
    }
    
    // Deactivate Account Button
    const deactivateAccountBtn = document.getElementById('deactivateAccountBtn');
    if (deactivateAccountBtn) {
        deactivateAccountBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to deactivate your admin account? You will need to contact support to reactivate it.')) {
                if (confirm('This will temporarily disable your admin access. Are you absolutely sure?')) {
                    // TODO: Implement account deactivation
                    alert('Account deactivation functionality will be implemented soon!');
                }
            }
        });
    }
});

// Load settings from localStorage
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('adminSettings') || '{}');
    
    // Load toggle states
    if (settings.emailNotifications !== undefined) {
        const emailNotifications = document.getElementById('emailNotifications');
        if (emailNotifications) emailNotifications.checked = settings.emailNotifications;
    }
    
    if (settings.twoFactorAuth !== undefined) {
        const twoFactorAuth = document.getElementById('twoFactorAuth');
        if (twoFactorAuth) twoFactorAuth.checked = settings.twoFactorAuth;
    }
    
    if (settings.userRegistrationAlerts !== undefined) {
        const userRegistrationAlerts = document.getElementById('userRegistrationAlerts');
        if (userRegistrationAlerts) userRegistrationAlerts.checked = settings.userRegistrationAlerts;
    }
    
    if (settings.verificationRequests !== undefined) {
        const verificationRequests = document.getElementById('verificationRequests');
        if (verificationRequests) verificationRequests.checked = settings.verificationRequests;
    }
    
    if (settings.systemErrors !== undefined) {
        const systemErrors = document.getElementById('systemErrors');
        if (systemErrors) systemErrors.checked = settings.systemErrors;
    }
    
    if (settings.securityAlerts !== undefined) {
        const securityAlerts = document.getElementById('securityAlerts');
        if (securityAlerts) securityAlerts.checked = settings.securityAlerts;
    }
    
    if (settings.ipWhitelist !== undefined) {
        const ipWhitelist = document.getElementById('ipWhitelist');
        if (ipWhitelist) ipWhitelist.checked = settings.ipWhitelist;
    }
    
    if (settings.auditLogAccess !== undefined) {
        const auditLogAccess = document.getElementById('auditLogAccess');
        if (auditLogAccess) auditLogAccess.checked = settings.auditLogAccess;
    }
    
    // Load select values
    if (settings.sessionTimeout) {
        const sessionTimeout = document.getElementById('sessionTimeout');
        if (sessionTimeout) sessionTimeout.value = settings.sessionTimeout;
    }
    
    if (settings.language) {
        const language = document.getElementById('language');
        if (language) language.value = settings.language;
    }
    
    if (settings.timezone) {
        const timezone = document.getElementById('timezone');
        if (timezone) timezone.value = settings.timezone;
    }
    
    if (settings.dateFormat) {
        const dateFormat = document.getElementById('dateFormat');
        if (dateFormat) dateFormat.value = settings.dateFormat;
    }
    
    if (settings.itemsPerPage) {
        const itemsPerPage = document.getElementById('itemsPerPage');
        if (itemsPerPage) itemsPerPage.value = settings.itemsPerPage;
    }
}

// Save settings to localStorage
function saveSettings() {
    const settings = {
        emailNotifications: document.getElementById('emailNotifications')?.checked || false,
        twoFactorAuth: document.getElementById('twoFactorAuth')?.checked || false,
        userRegistrationAlerts: document.getElementById('userRegistrationAlerts')?.checked || false,
        verificationRequests: document.getElementById('verificationRequests')?.checked || false,
        systemErrors: document.getElementById('systemErrors')?.checked || false,
        securityAlerts: document.getElementById('securityAlerts')?.checked || false,
        ipWhitelist: document.getElementById('ipWhitelist')?.checked || false,
        auditLogAccess: document.getElementById('auditLogAccess')?.checked || false,
        sessionTimeout: document.getElementById('sessionTimeout')?.value || '30',
        language: document.getElementById('language')?.value || 'en',
        timezone: document.getElementById('timezone')?.value || 'Europe/Istanbul',
        dateFormat: document.getElementById('dateFormat')?.value || 'DD/MM/YYYY',
        itemsPerPage: document.getElementById('itemsPerPage')?.value || '25',
        lastUpdated: new Date().toISOString()
    };
    
    localStorage.setItem('adminSettings', JSON.stringify(settings));
    console.log('Settings saved:', settings);
}







