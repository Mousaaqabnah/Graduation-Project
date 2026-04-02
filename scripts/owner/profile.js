// Profile Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Get popup elements
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    const notificationPopup = document.getElementById('notificationPopup');

    // Notification bell: scripts/player/notifications.js

    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            if (notificationPopup) notificationPopup.classList.remove('active');
        });
    }

    document.addEventListener('click', function(e) {
        if (profilePopup && profileBtn && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
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
        
        document.getElementById('editBusinessName').value = profileData.businessName || '';
        document.getElementById('editBusinessType').value = profileData.businessType || '';
        document.getElementById('editTaxId').value = profileData.taxId || '';
        document.getElementById('editEmail').value = profileData.email || '';
        document.getElementById('editPhone').value = profileData.phone || '';
        document.getElementById('editWebsite').value = profileData.website || '';
        document.getElementById('editAltContact').value = profileData.alternativeContact || '';
        document.getElementById('editStreetAddress').value = profileData.streetAddress || '';
        document.getElementById('editCity').value = profileData.city || '';
        document.getElementById('editState').value = profileData.state || '';
        document.getElementById('editPostalCode').value = profileData.postalCode || '';
        document.getElementById('editCountry').value = profileData.country || '';
    }
    
    // Get current profile data from display
    function getCurrentProfileData() {
        return {
            businessName: document.getElementById('businessName')?.textContent || '',
            businessType: document.getElementById('businessType')?.textContent || '',
            taxId: document.getElementById('taxId')?.textContent || '',
            email: document.getElementById('emailAddress')?.textContent || '',
            phone: document.getElementById('phoneNumber')?.textContent || '',
            website: document.getElementById('website')?.textContent || '',
            alternativeContact: document.getElementById('alternativeContact')?.textContent || '',
            streetAddress: document.getElementById('streetAddress')?.textContent || '',
            city: document.getElementById('city')?.textContent || '',
            state: document.getElementById('state')?.textContent || '',
            postalCode: document.getElementById('postalCode')?.textContent || '',
            country: document.getElementById('country')?.textContent || ''
        };
    }
    
    // Save profile changes
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', function() {
            const form = document.getElementById('editProfileForm');
            if (form && form.checkValidity()) {
                const formData = {
                    businessName: document.getElementById('editBusinessName').value,
                    businessType: document.getElementById('editBusinessType').value,
                    taxId: document.getElementById('editTaxId').value,
                    email: document.getElementById('editEmail').value,
                    phone: document.getElementById('editPhone').value,
                    website: document.getElementById('editWebsite').value,
                    alternativeContact: document.getElementById('editAltContact').value,
                    streetAddress: document.getElementById('editStreetAddress').value,
                    city: document.getElementById('editCity').value,
                    state: document.getElementById('editState').value,
                    postalCode: document.getElementById('editPostalCode').value,
                    country: document.getElementById('editCountry').value
                };
                
                // Update profile display
                updateProfileFromForm(formData);
                
                // TODO: Here you would typically send the data to your API
                console.log('Profile updated:', formData);
                
                // Close modal
                closeEditModal();
                
                // Show success message (optional)
                alert('Profile updated successfully!');
            } else {
                form.reportValidity();
            }
        });
    }
    
    // Update profile display from form data
    function updateProfileFromForm(data) {
        // Update main profile info
        const profileNameMain = document.getElementById('profileNameMain');
        const profileEmailMain = document.getElementById('profileEmailMain');
        if (profileNameMain) profileNameMain.textContent = data.businessName;
        if (profileEmailMain) profileEmailMain.textContent = data.email;
        
        // Update business information
        document.getElementById('businessName').textContent = data.businessName;
        document.getElementById('businessType').textContent = data.businessType;
        document.getElementById('taxId').textContent = data.taxId;
        
        // Update contact information
        document.getElementById('emailAddress').textContent = data.email;
        document.getElementById('phoneNumber').textContent = data.phone;
        document.getElementById('website').textContent = data.website;
        document.getElementById('alternativeContact').textContent = data.alternativeContact;
        
        // Update address information
        document.getElementById('streetAddress').textContent = data.streetAddress;
        document.getElementById('city').textContent = data.city;
        document.getElementById('state').textContent = data.state;
        document.getElementById('postalCode').textContent = data.postalCode;
        document.getElementById('country').textContent = data.country;
        
        // Update avatar (regenerate with new name)
        const profileAvatar = document.getElementById('profileAvatar');
        if (profileAvatar) {
            const avatarName = data.businessName.replace(/\s+/g, '+');
            profileAvatar.src = `https://ui-avatars.com/api/?name=${avatarName}&background=007BFF&color=fff&size=256`;
        }
        
        // Update profile popup
        const profilePopupName = document.querySelector('#profilePopup .profile-name');
        const profilePopupEmail = document.querySelector('#profilePopup .profile-email');
        const profilePopupAvatar = document.querySelector('#profilePopup .profile-avatar-large img');
        const headerProfileAvatar = document.querySelector('#profileBtn img');
        
        if (profilePopupName) profilePopupName.textContent = data.businessName;
        if (profilePopupEmail) profilePopupEmail.textContent = data.email;
        if (profilePopupAvatar) {
            const avatarName = data.businessName.replace(/\s+/g, '+');
            profilePopupAvatar.src = `https://ui-avatars.com/api/?name=${avatarName}&background=007BFF&color=fff&size=128`;
        }
        if (headerProfileAvatar) {
            const avatarName = data.businessName.replace(/\s+/g, '+');
            headerProfileAvatar.src = `https://ui-avatars.com/api/?name=${avatarName}&background=007BFF&color=fff&size=128`;
        }
    }
    
    // Avatar edit button
    const avatarEditBtn = document.getElementById('avatarEditBtn');
    if (avatarEditBtn) {
        avatarEditBtn.addEventListener('click', function() {
            // TODO: Open image upload dialog
            console.log('Avatar edit clicked');
            alert('Avatar upload functionality will be implemented soon!');
        });
    }
    
    // Load profile data (this would typically come from an API)
    loadProfileData();
});

// Function to load profile data
function loadProfileData() {
    // TODO: Replace with actual API call
    // For now, using placeholder data
    const profileData = {
        businessName: 'Fozi Court',
        businessType: 'Sports Facility',
        taxId: 'TR1234567890',
        memberSince: 'January 2022',
        email: 'info@fozicourt.com',
        phone: '+90 212 555 1234',
        website: 'www.fozicourt.com',
        alternativeContact: '+90 555 987 6543',
        streetAddress: '456 Sports Avenue, Building A',
        city: 'Istanbul',
        state: 'Istanbul Province',
        postalCode: '34100',
        country: 'Turkey',
        totalFields: 3,
        totalBookings: 247,
        todayBookings: 8,
        averageRating: 4.9,
        monthlyRevenue: '₺45,200',
        memberMonths: 26
    };
    
    // Update profile information
    updateProfileDisplay(profileData);
}

// Function to update profile display
function updateProfileDisplay(data) {
    // Update main profile info
    const profileNameMain = document.getElementById('profileNameMain');
    const profileEmailMain = document.getElementById('profileEmailMain');
    
    if (profileNameMain) profileNameMain.textContent = data.businessName;
    if (profileEmailMain) profileEmailMain.textContent = data.email;
    
    // Update business information
    document.getElementById('businessName').textContent = data.businessName;
    document.getElementById('businessType').textContent = data.businessType;
    document.getElementById('taxId').textContent = data.taxId;
    document.getElementById('memberSince').textContent = data.memberSince;
    
    // Update contact information
    document.getElementById('emailAddress').textContent = data.email;
    document.getElementById('phoneNumber').textContent = data.phone;
    document.getElementById('website').textContent = data.website;
    document.getElementById('alternativeContact').textContent = data.alternativeContact;
    
    // Update address information
    document.getElementById('streetAddress').textContent = data.streetAddress;
    document.getElementById('city').textContent = data.city;
    document.getElementById('state').textContent = data.state;
    document.getElementById('postalCode').textContent = data.postalCode;
    document.getElementById('country').textContent = data.country;
    
    // Update statistics
    document.getElementById('totalFields').textContent = data.totalFields;
    document.getElementById('totalBookings').textContent = data.totalBookings;
    document.getElementById('todayBookings').textContent = data.todayBookings;
    document.getElementById('averageRating').textContent = data.averageRating;
    document.getElementById('monthlyRevenue').textContent = data.monthlyRevenue;
    document.getElementById('memberMonths').textContent = data.memberMonths;
}

