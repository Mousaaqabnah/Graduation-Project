// Profile Page JavaScript

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
        
        document.getElementById('editFullName').value = profileData.fullName || '';
        document.getElementById('editEmail').value = profileData.email || '';
        document.getElementById('editPhone').value = profileData.phone || '';
        
        // Handle date of birth (convert from display format to date input format)
        const dateOfBirth = profileData.dateOfBirth || '';
        if (dateOfBirth) {
            // Try to parse common date formats
            const dateInput = document.getElementById('editDateOfBirth');
            if (dateInput) {
                // If it's already in a parseable format, use it; otherwise leave empty
                const parsedDate = new Date(dateOfBirth);
                if (!isNaN(parsedDate.getTime())) {
                    dateInput.value = parsedDate.toISOString().split('T')[0];
                }
            }
        }
        
        document.getElementById('editGender').value = profileData.gender || 'Male';
        document.getElementById('editStreetAddress').value = profileData.streetAddress || '';
        document.getElementById('editCity').value = profileData.city || '';
        document.getElementById('editState').value = profileData.state || '';
        document.getElementById('editPostalCode').value = profileData.postalCode || '';
        document.getElementById('editCountry').value = profileData.country || '';
    }
    
    // Get current profile data from display
    function getCurrentProfileData() {
        return {
            fullName: document.getElementById('fullName')?.textContent || '',
            email: document.getElementById('emailAddress')?.textContent || '',
            phone: document.getElementById('phoneNumber')?.textContent || '',
            dateOfBirth: document.getElementById('dateOfBirth')?.textContent || '',
            gender: document.getElementById('gender')?.textContent || '',
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
                const dateOfBirthInput = document.getElementById('editDateOfBirth');
                let dateOfBirthDisplay = '';
                if (dateOfBirthInput && dateOfBirthInput.value) {
                    const date = new Date(dateOfBirthInput.value);
                    dateOfBirthDisplay = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                }
                
                const formData = {
                    fullName: document.getElementById('editFullName').value,
                    email: document.getElementById('editEmail').value,
                    phone: document.getElementById('editPhone').value,
                    dateOfBirth: dateOfBirthDisplay || document.getElementById('dateOfBirth')?.textContent || '',
                    gender: document.getElementById('editGender').value,
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
        if (profileNameMain) profileNameMain.textContent = data.fullName;
        if (profileEmailMain) profileEmailMain.textContent = data.email;
        
        // Update personal information
        document.getElementById('fullName').textContent = data.fullName;
        document.getElementById('emailAddress').textContent = data.email;
        document.getElementById('phoneNumber').textContent = data.phone;
        if (data.dateOfBirth) {
            document.getElementById('dateOfBirth').textContent = data.dateOfBirth;
        }
        document.getElementById('gender').textContent = data.gender;
        
        // Update address information
        document.getElementById('streetAddress').textContent = data.streetAddress;
        document.getElementById('city').textContent = data.city;
        document.getElementById('state').textContent = data.state;
        document.getElementById('postalCode').textContent = data.postalCode;
        document.getElementById('country').textContent = data.country;
        
        // Update avatar (regenerate with new name)
        const profileAvatar = document.getElementById('profileAvatar');
        if (profileAvatar) {
            const avatarName = data.fullName.replace(/\s+/g, '+');
            profileAvatar.src = `https://ui-avatars.com/api/?name=${avatarName}&background=007BFF&color=fff&size=256`;
        }
        
        // Update profile popup
        const profilePopupName = document.querySelector('#profilePopup .profile-name');
        const profilePopupEmail = document.querySelector('#profilePopup .profile-email');
        const profilePopupAvatar = document.querySelector('#profilePopup .profile-avatar-large img');
        const headerProfileAvatar = document.querySelector('#profileBtn img');
        
        if (profilePopupName) profilePopupName.textContent = data.fullName;
        if (profilePopupEmail) profilePopupEmail.textContent = data.email;
        if (profilePopupAvatar) {
            const avatarName = data.fullName.replace(/\s+/g, '+');
            profilePopupAvatar.src = `https://ui-avatars.com/api/?name=${avatarName}&background=007BFF&color=fff&size=128`;
        }
        if (headerProfileAvatar) {
            const avatarName = data.fullName.replace(/\s+/g, '+');
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
    
    // Copy Player ID functionality
    const copyPlayerIdBtn = document.getElementById('copyPlayerIdBtn');
    if (copyPlayerIdBtn) {
        copyPlayerIdBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const playerIdElement = document.getElementById('playerId');
            if (playerIdElement) {
                const playerId = playerIdElement.textContent;
                
                // Try using modern clipboard API first
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(playerId).then(() => {
                        // Show success feedback
                        copyPlayerIdBtn.classList.add('copied');
                        const originalIcon = copyPlayerIdBtn.innerHTML;
                        copyPlayerIdBtn.innerHTML = '<i class="fi fi-rr-check"></i>';
                        
                        setTimeout(() => {
                            copyPlayerIdBtn.classList.remove('copied');
                            copyPlayerIdBtn.innerHTML = originalIcon;
                        }, 2000);
                    }).catch(() => {
                        // Fallback method
                        fallbackCopyTextToClipboard(playerId, copyPlayerIdBtn);
                    });
                } else {
                    // Fallback method for older browsers
                    fallbackCopyTextToClipboard(playerId, copyPlayerIdBtn);
                }
            }
        });
    }
});

// Fallback function to copy text to clipboard (for older browsers)
function fallbackCopyTextToClipboard(text, button) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            button.classList.add('copied');
            const originalIcon = button.innerHTML;
            button.innerHTML = '<i class="fi fi-rr-check"></i>';
            
            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = originalIcon;
            }, 2000);
        } else {
            alert('Failed to copy Player ID. Please copy manually: ' + text);
        }
    } catch (err) {
        alert('Failed to copy Player ID. Please copy manually: ' + text);
    }
    
    document.body.removeChild(textArea);
}

// Function to generate a unique Player ID
function generatePlayerId() {
    // Generate a unique ID format: PLR-XXXXXXXX (8 alphanumeric characters)
    // In a real app, this would come from the server/database
    // For demo purposes, we'll generate one based on a stored value or create a new one
    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = 'PLR-';
        for (let i = 0; i < 8; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        playerId = id;
        localStorage.setItem('playerId', playerId);
    }
    return playerId;
}

// Function to load profile data
function loadProfileData() {
    // TODO: Replace with actual API call
    // For now, using placeholder data
    const profileData = {
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        playerId: generatePlayerId(),
        phone: '+90 555 123 4567',
        dateOfBirth: 'January 15, 1995',
        gender: 'Male',
        memberSince: 'March 2023',
        streetAddress: '123 Main Street, Apt 4B',
        city: 'Istanbul',
        state: 'Istanbul Province',
        postalCode: '34000',
        country: 'Turkey',
        totalBookings: 24,
        upcomingBookings: 5,
        averageRating: 4.8,
        memberMonths: 21
    };
    
    // Update profile information
    updateProfileDisplay(profileData);
}

// Function to update profile display
function updateProfileDisplay(data) {
    // Update main profile info
    const profileNameMain = document.getElementById('profileNameMain');
    const profileEmailMain = document.getElementById('profileEmailMain');
    
    if (profileNameMain) profileNameMain.textContent = data.fullName;
    if (profileEmailMain) profileEmailMain.textContent = data.email;
    
    // Update personal information
    document.getElementById('fullName').textContent = data.fullName;
    document.getElementById('emailAddress').textContent = data.email;
    if (data.playerId) {
        document.getElementById('playerId').textContent = data.playerId;
    }
    document.getElementById('phoneNumber').textContent = data.phone;
    document.getElementById('dateOfBirth').textContent = data.dateOfBirth;
    document.getElementById('gender').textContent = data.gender;
    document.getElementById('memberSince').textContent = data.memberSince;
    
    // Update address information
    document.getElementById('streetAddress').textContent = data.streetAddress;
    document.getElementById('city').textContent = data.city;
    document.getElementById('state').textContent = data.state;
    document.getElementById('postalCode').textContent = data.postalCode;
    document.getElementById('country').textContent = data.country;
    
    // Update statistics
    document.getElementById('totalBookings').textContent = data.totalBookings;
    document.getElementById('upcomingBookings').textContent = data.upcomingBookings;
    document.getElementById('averageRating').textContent = data.averageRating;
    document.getElementById('memberMonths').textContent = data.memberMonths;
}

