// Admin Profile Page JavaScript

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
    
    // Edit profile modal
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    
    // Open edit modal
    if (editProfileBtn && editProfileModal) {
        editProfileBtn.addEventListener('click', function() {
            populateEditForm();
            editProfileModal.classList.add('active');
        });
    }
    
    // Close edit modal
    function closeEditModal() {
        if (editProfileModal) {
            editProfileModal.classList.remove('active');
        }
    }
    
    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener('click', closeEditModal);
    }
    
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditModal);
    }
    
    // Close modal when clicking outside
    if (editProfileModal) {
        editProfileModal.addEventListener('click', function(e) {
            if (e.target === editProfileModal) {
                closeEditModal();
            }
        });
    }
    
    // Populate edit form with current data
    function populateEditForm() {
        const profileData = getCurrentProfileData();
        
        const editFullName = document.getElementById('editFullName');
        const editEmail = document.getElementById('editEmail');
        const editPhone = document.getElementById('editPhone');
        
        if (editFullName) editFullName.value = profileData.fullName || '';
        if (editEmail) editEmail.value = profileData.email || '';
        if (editPhone) editPhone.value = profileData.phone || '';
    }
    
    // Get current profile data from the page
    function getCurrentProfileData() {
        return {
            fullName: document.getElementById('fullName')?.textContent.trim() || '',
            email: document.getElementById('emailAddress')?.textContent.trim() || '',
            phone: document.getElementById('phoneNumber')?.textContent.trim() || ''
        };
    }
    
    // Save profile changes
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', function() {
            const editForm = document.getElementById('editProfileForm');
            if (!editForm) return;
            
            const formData = new FormData(editForm);
            const fullName = document.getElementById('editFullName')?.value || '';
            const email = document.getElementById('editEmail')?.value || '';
            const phone = document.getElementById('editPhone')?.value || '';
            
            // Validate
            if (!fullName || !email || !phone) {
                alert('Please fill in all required fields.');
                return;
            }
            
            // Update the profile display
            const profileNameMain = document.getElementById('profileNameMain');
            const profileEmailMain = document.getElementById('profileEmailMain');
            const fullNameEl = document.getElementById('fullName');
            const emailAddressEl = document.getElementById('emailAddress');
            const phoneNumberEl = document.getElementById('phoneNumber');
            
            if (profileNameMain) profileNameMain.textContent = fullName;
            if (profileEmailMain) profileEmailMain.textContent = email;
            if (fullNameEl) fullNameEl.textContent = fullName;
            if (emailAddressEl) emailAddressEl.textContent = email;
            if (phoneNumberEl) phoneNumberEl.textContent = phone;
            
            // Update avatar
            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar) {
                profileAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=007BFF&color=fff&size=256`;
            }
            
            // Save to localStorage (in a real app, this would be an API call)
            const adminProfile = {
                fullName: fullName,
                email: email,
                phone: phone,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem('adminProfile', JSON.stringify(adminProfile));
            
            // Close modal
            closeEditModal();
            
            // Show success message
            alert('Profile updated successfully!');
        });
    }
    
    // Avatar edit button
    const avatarEditBtn = document.getElementById('avatarEditBtn');
    if (avatarEditBtn) {
        avatarEditBtn.addEventListener('click', function() {
            // TODO: Implement avatar upload
            alert('Avatar upload functionality will be implemented soon!');
        });
    }
    
    // Load saved profile data
    loadProfileData();
});

// Load profile data from localStorage
function loadProfileData() {
    const savedProfile = localStorage.getItem('adminProfile');
    if (savedProfile) {
        try {
            const profile = JSON.parse(savedProfile);
            // Update display if data exists
            // This would typically be done on page load from server
        } catch (e) {
            console.error('Error loading profile data:', e);
        }
    }
}







