// Settings Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Get popup elements (notification handled by notifications.js)
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    
    // Profile popup toggle
    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            var notificationPopup = document.getElementById('notificationPopup');
            if (notificationPopup) notificationPopup.classList.remove('active');
        });
    }
    
    // Close profile popup when clicking outside
    document.addEventListener('click', function(e) {
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
    
    // Change Password Button & Modal
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const changePasswordModal = document.getElementById('changePasswordModal');
    const changePasswordModalClose = document.getElementById('changePasswordModalClose');
    const changePasswordCancel = document.getElementById('changePasswordCancel');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const changePasswordError = document.getElementById('changePasswordError');

    function openChangePasswordModal() {
        if (typeof API === 'undefined' || !API.getAuthToken || !API.getAuthToken()) {
            alert('Please log in to change your password.');
            return;
        }
        if (changePasswordModal) {
            changePasswordModal.classList.add('active');
            changePasswordForm.reset();
            if (changePasswordError) changePasswordError.textContent = '';
            document.getElementById('currentPassword').focus();
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
            var currentPwd = document.getElementById('currentPassword').value;
            var newPwd = document.getElementById('newPassword').value;
            var confirmPwd = document.getElementById('confirmPassword').value;

            if (changePasswordError) changePasswordError.textContent = '';

            if (newPwd.length < 8) {
                if (changePasswordError) changePasswordError.textContent = 'New password must be at least 8 characters.';
                return;
            }
            if (newPwd !== confirmPwd) {
                if (changePasswordError) changePasswordError.textContent = 'New passwords do not match.';
                return;
            }

            var submitBtn = document.getElementById('changePasswordSubmit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';
            }

            API.auth.updatePassword(currentPwd, newPwd)
                .then(function() {
                    closeChangePasswordModal();
                    alert('Your password has been updated successfully.');
                })
                .catch(function(err) {
                    if (changePasswordError) {
                        changePasswordError.textContent = err.message || 'Failed to update password. Please check your current password.';
                    }
                })
                .finally(function() {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Update Password';
                    }
                });
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
    
    // Delete Account Button
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                if (confirm('This will permanently delete all your data. Are you absolutely sure?')) {
                    // TODO: Implement account deletion
                    alert('Account deletion functionality will be implemented soon!');
                }
            }
        });
    }
});

// Load settings from localStorage
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('playerSettings') || '{}');
    
    // Load toggle states
    if (settings.emailNotifications !== undefined) {
        document.getElementById('emailNotifications').checked = settings.emailNotifications;
    }
    if (settings.twoFactorAuth !== undefined) {
        document.getElementById('twoFactorAuth').checked = settings.twoFactorAuth;
    }
    if (settings.bookingConfirmations !== undefined) {
        document.getElementById('bookingConfirmations').checked = settings.bookingConfirmations;
    }
    if (settings.reminders !== undefined) {
        document.getElementById('reminders').checked = settings.reminders;
    }
    if (settings.venueUpdates !== undefined) {
        document.getElementById('venueUpdates').checked = settings.venueUpdates;
    }
    if (settings.marketingEmails !== undefined) {
        document.getElementById('marketingEmails').checked = settings.marketingEmails;
    }
    if (settings.dataSharing !== undefined) {
        document.getElementById('dataSharing').checked = settings.dataSharing;
    }
    
    // Load select values
    if (settings.profileVisibility) {
        document.getElementById('profileVisibility').value = settings.profileVisibility;
    }
    if (settings.language) {
        document.getElementById('language').value = settings.language;
    }
    if (settings.currency) {
        document.getElementById('currency').value = settings.currency;
    }
    if (settings.timezone) {
        document.getElementById('timezone').value = settings.timezone;
    }
}

// Save settings to localStorage
function saveSettings() {
    const settings = {
        emailNotifications: document.getElementById('emailNotifications').checked,
        twoFactorAuth: document.getElementById('twoFactorAuth').checked,
        bookingConfirmations: document.getElementById('bookingConfirmations').checked,
        reminders: document.getElementById('reminders').checked,
        venueUpdates: document.getElementById('venueUpdates').checked,
        marketingEmails: document.getElementById('marketingEmails').checked,
        dataSharing: document.getElementById('dataSharing').checked,
        profileVisibility: document.getElementById('profileVisibility').value,
        language: document.getElementById('language').value,
        currency: document.getElementById('currency').value,
        timezone: document.getElementById('timezone').value
    };
    
    localStorage.setItem('playerSettings', JSON.stringify(settings));
    
    // TODO: Send to API
    console.log('Settings saved:', settings);
}











