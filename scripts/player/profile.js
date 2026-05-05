// Profile Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Get popup elements
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    // Notification popup is handled by shared notifications.js
    
    // Profile popup toggle
    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            // Close notification popup if open (notifications.js handles it)
            var notificationPopup = document.getElementById('notificationPopup');
            if (notificationPopup) {
                notificationPopup.classList.remove('active');
            }
        });
    }
    
    // Close profile popup when clicking outside (notification popup handled by notifications.js)
    document.addEventListener('click', function(e) {
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
        saveProfileBtn.addEventListener('click', async function() {
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
                
                const activeUser = (typeof API !== 'undefined' && API.getCurrentUser) ? API.getCurrentUser() : null;
                const userId = activeUser && activeUser.id ? activeUser.id : null;
                if (!userId) {
                    alert('Unable to identify your account. Please log in again.');
                    return;
                }

                const locationParts = [
                    formData.streetAddress,
                    formData.city,
                    formData.state,
                    formData.postalCode,
                    formData.country
                ].filter(function(part) {
                    return part && String(part).trim();
                });
                const combinedLocation = locationParts.join(', ');

                const payload = {
                    fullName: formData.fullName,
                    phone: formData.phone,
                    dateOfBirth: dateOfBirthInput && dateOfBirthInput.value ? dateOfBirthInput.value : null,
                    gender: formData.gender,
                    location: combinedLocation
                };

                try {
                    saveProfileBtn.disabled = true;
                    saveProfileBtn.textContent = 'Saving...';

                    // Persist supported profile fields to backend.
                    const res = await API.users.update(userId, payload);
                    if (res && res.user && API.setCurrentUser) {
                        API.setCurrentUser(res.user);
                    }

                    // Persist detailed address fields locally per user to avoid losing UI fields not modeled in DB.
                    saveAddressPartsForUser(userId, {
                        streetAddress: formData.streetAddress,
                        city: formData.city,
                        state: formData.state,
                        postalCode: formData.postalCode,
                        country: formData.country
                    });

                    // Keep email display in sync with authenticated account (email update is not supported on this endpoint).
                    if (res && res.user && res.user.email) {
                        formData.email = res.user.email;
                    }

                    updateProfileFromForm(formData);
                    closeEditModal();
                    alert('Profile updated successfully!');
                } catch (error) {
                    alert(error && error.message ? error.message : 'Failed to update profile.');
                } finally {
                    saveProfileBtn.disabled = false;
                    saveProfileBtn.textContent = 'Save Changes';
                }
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
    
    // Avatar edit button - opens file picker to choose profile picture
    const avatarEditBtn = document.getElementById('avatarEditBtn');
    const avatarFileInput = document.getElementById('avatarFileInput');
    if (avatarEditBtn && avatarFileInput) {
        avatarEditBtn.addEventListener('click', function(e) {
            e.preventDefault();
            avatarFileInput.click();
        });
        avatarFileInput.addEventListener('change', function() {
            var file = this.files && this.files[0];
            if (!file || !file.type.startsWith('image/')) {
                alert('Please select an image file (JPEG, PNG, GIF, etc.).');
                this.value = '';
                return;
            }
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert('Image must be less than 5MB. Please choose a smaller image.');
                this.value = '';
                return;
            }
            handleAvatarSelected(file);
            this.value = '';
        });
    }
    
    // Load profile data from API / current auth user
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

// Handle selected avatar image: resize, convert to base64, save via API or localStorage, update UI
function handleAvatarSelected(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        var dataUrl = e.target.result;
        var img = new Image();
        img.onload = function() {
            var maxSize = 256;
            var w = img.width;
            var h = img.height;
            if (w > maxSize || h > maxSize) {
                var scale = Math.min(maxSize / w, maxSize / h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            var resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            saveAndShowAvatar(resizedDataUrl);
        };
        img.onerror = function() {
            saveAndShowAvatar(dataUrl);
        };
        img.src = dataUrl;
    };
    reader.readAsDataURL(file);
}

function saveAndShowAvatar(avatarUrl) {
    var user = (typeof API !== 'undefined' && API.getCurrentUser) ? API.getCurrentUser() : null;
    var userId = user ? user.id : null;

    if (
        typeof API !== 'undefined' &&
        API.getAuthToken &&
        API.getAuthToken() &&
        userId &&
        API.users &&
        (API.users.updateAvatar || API.users.update)
    ) {
        var savePromise = API.users.updateAvatar
            ? API.users.updateAvatar(userId, avatarUrl)
            : API.users.update(userId, { avatar: avatarUrl });
        savePromise
            .then(function(res) {
                if (res && res.user && API.setCurrentUser) {
                    API.setCurrentUser(res.user);
                }
                if (userId) localStorage.setItem('userAvatar_' + userId, avatarUrl);
                applyAvatarToAllDisplays(avatarUrl);
                alert('Profile picture updated successfully!');
            })
            .catch(function(err) {
                alert(err.message || 'Failed to update profile picture.');
            });
    } else {
        if (userId) localStorage.setItem('userAvatar_' + userId, avatarUrl);
        applyAvatarToAllDisplays(avatarUrl);
        alert('Profile picture updated! (Logged-in users: it will sync when you sign in.)');
    }
}

function applyAvatarToAllDisplays(avatarUrl) {
    var profileAvatar = document.getElementById('profileAvatar');
    var popupAvatar = document.querySelector('#profilePopup .profile-avatar-large img');
    var headerAvatar = document.querySelector('#profileBtn img');
    if (profileAvatar) { profileAvatar.src = avatarUrl; }
    if (popupAvatar) { popupAvatar.src = avatarUrl; }
    if (headerAvatar) { headerAvatar.src = avatarUrl; }
}

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
    var user = (typeof API !== 'undefined' && API.getCurrentUser) ? API.getCurrentUser() : null;
    var userKey = user && user.id ? String(user.id) : 'anonymous';
    var storageKey = 'playerId_' + userKey;
    let playerId = localStorage.getItem(storageKey);
    if (!playerId) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = 'PLR-';
        for (let i = 0; i < 8; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        playerId = id;
        localStorage.setItem(storageKey, playerId);
    }
    return playerId;
}

function getAddressPartsForUser(userId) {
    if (!userId) return null;
    try {
        var raw = localStorage.getItem('profileAddress_' + String(userId));
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            streetAddress: parsed.streetAddress || '',
            city: parsed.city || '',
            state: parsed.state || '',
            postalCode: parsed.postalCode || '',
            country: parsed.country || ''
        };
    } catch (_) {
        return null;
    }
}

function saveAddressPartsForUser(userId, addressData) {
    if (!userId || !addressData) return;
    localStorage.setItem('profileAddress_' + String(userId), JSON.stringify({
        streetAddress: addressData.streetAddress || '',
        city: addressData.city || '',
        state: addressData.state || '',
        postalCode: addressData.postalCode || '',
        country: addressData.country || ''
    }));
}

// Function to format full date (e.g., January 15, 1995)
function formatFullDate(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Function to format month/year (e.g., March 2023)
function formatMonthYear(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
    });
}

// Function to calculate membership months
function calculateMemberMonths(isoDate) {
    if (!isoDate) return 0;
    const start = new Date(isoDate);
    const now = new Date();
    if (isNaN(start.getTime())) return 0;
    const years = now.getFullYear() - start.getFullYear();
    const months = now.getMonth() - start.getMonth();
    return years * 12 + months + (now.getDate() >= start.getDate() ? 0 : -1);
}

// Function to load profile data (from backend auth/me + localStorage)
async function loadProfileData() {
    // Ensure API helper is available
    if (typeof API === 'undefined') {
        console.warn('Profile: API helper not loaded. Showing placeholder data.');
        return;
    }

    // Start with any cached user
    let user = API.getCurrentUser && API.getCurrentUser();

    // Try to refresh from backend /auth/me
    try {
        if (API.auth && API.auth.getCurrentUser) {
            const res = await API.auth.getCurrentUser();
            if (res && res.user) {
                user = res.user;
                if (API.setCurrentUser) {
                    API.setCurrentUser(user);
                }
            }
        }
    } catch (e) {
        console.warn('Profile: failed to load user from /auth/me, using cached user if available.', e);
    }

    // If still no user, redirect to login
    if (!user) {
        window.location.href = '/pages/auth/login.html';
        return;
    }

    var avatarUrl = user.avatar || (user.id && localStorage.getItem('userAvatar_' + user.id)) || null;

    // Map backend user → profile view model
    const savedAddress = user && user.id ? getAddressPartsForUser(user.id) : null;

    const profileData = {
        fullName: user.fullName || 'Player',
        email: user.email || '',
        avatar: avatarUrl,
        playerId: generatePlayerId(),
        phone: user.phone || 'Not provided',
        dateOfBirth: formatFullDate(user.dateOfBirth),
        gender: user.gender || 'Not specified',
        memberSince: formatMonthYear(user.createdAt),
        streetAddress: (savedAddress && savedAddress.streetAddress) || user.location || 'Not set',
        city: (savedAddress && savedAddress.city) || '',
        state: (savedAddress && savedAddress.state) || '',
        postalCode: (savedAddress && savedAddress.postalCode) || '',
        country: (savedAddress && savedAddress.country) || '',
        totalBookings: 0,
        upcomingBookings: 0,
        averageRating: 0,
        memberMonths: calculateMemberMonths(user.createdAt)
    };

    // Fetch booking and review stats from API
    try {
        if (API.bookings && API.bookings.getAll) {
            const bookingsRes = await API.bookings.getAll({ limit: 500 });
            const bookings = bookingsRes.bookings || [];
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            profileData.totalBookings = bookings.filter(function(b) {
                return b.status !== 'CANCELLED';
            }).length;
            profileData.upcomingBookings = bookings.filter(function(b) {
                if (b.status === 'CANCELLED') return false;
                var d = new Date(b.date);
                d.setHours(0, 0, 0, 0);
                return d >= now && (b.status === 'UPCOMING' || b.status === 'CONFIRMED' || b.status === 'PENDING');
            }).length;
        }
        if (API.reviews && API.reviews.getMyReviews) {
            const reviewsRes = await API.reviews.getMyReviews();
            profileData.averageRating = (reviewsRes.averageRating != null)
                ? reviewsRes.averageRating
                : 0;
        }
    } catch (e) {
        console.warn('Profile: failed to load booking/review stats', e);
    }
    
    updateProfileDisplay(profileData);
}

// Build avatar URL from full name (e.g. "Mousa Aqabnah" → initials "MA")
function getAvatarUrl(fullName, size) {
    const name = (fullName || 'User').trim() || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=007BFF&color=fff&size=${size || 128}`;
}

// Function to update profile display
function updateProfileDisplay(data) {
    const fullName = data.fullName || 'Player';
    const email = data.email || '';
    var avatarUrl = data.avatar || null;
    var fallbackUrl = getAvatarUrl(fullName, 256);

    // Update main profile info
    const profileNameMain = document.getElementById('profileNameMain');
    const profileEmailMain = document.getElementById('profileEmailMain');

    if (profileNameMain) profileNameMain.textContent = fullName;
    if (profileEmailMain) profileEmailMain.textContent = email;

    // Main profile avatar (custom pic or initials)
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.src = avatarUrl || fallbackUrl;
        profileAvatar.alt = fullName;
    }

    // My Account popup: name, email, and avatar
    const popupName = document.querySelector('#profilePopup .profile-name');
    const popupEmail = document.querySelector('#profilePopup .profile-email');
    const popupAvatar = document.querySelector('#profilePopup .profile-avatar-large img');
    if (popupName) popupName.textContent = fullName;
    if (popupEmail) popupEmail.textContent = email;
    if (popupAvatar) {
        popupAvatar.src = avatarUrl || getAvatarUrl(fullName, 128);
        popupAvatar.alt = fullName;
    }

    // Header profile picture (top-right)
    const headerAvatar = document.querySelector('#profileBtn img');
    if (headerAvatar) {
        headerAvatar.src = avatarUrl || getAvatarUrl(fullName, 128);
        headerAvatar.alt = fullName;
    }

    // Update personal information
    const fullNameEl = document.getElementById('fullName');
    const emailAddressEl = document.getElementById('emailAddress');
    if (fullNameEl) fullNameEl.textContent = fullName;
    if (emailAddressEl) emailAddressEl.textContent = email;
    const playerIdEl = document.getElementById('playerId');
    if (playerIdEl && data.playerId) playerIdEl.textContent = data.playerId;

    const phoneNumberEl = document.getElementById('phoneNumber');
    const dateOfBirthEl = document.getElementById('dateOfBirth');
    const genderEl = document.getElementById('gender');
    const memberSinceEl = document.getElementById('memberSince');
    if (phoneNumberEl) phoneNumberEl.textContent = data.phone;
    if (dateOfBirthEl) dateOfBirthEl.textContent = data.dateOfBirth;
    if (genderEl) genderEl.textContent = data.gender;
    if (memberSinceEl) memberSinceEl.textContent = data.memberSince;

    // Update address information
    const streetAddressEl = document.getElementById('streetAddress');
    const cityEl = document.getElementById('city');
    const stateEl = document.getElementById('state');
    const postalCodeEl = document.getElementById('postalCode');
    const countryEl = document.getElementById('country');
    if (streetAddressEl) streetAddressEl.textContent = data.streetAddress;
    if (cityEl) cityEl.textContent = data.city;
    if (stateEl) stateEl.textContent = data.state;
    if (postalCodeEl) postalCodeEl.textContent = data.postalCode;
    if (countryEl) countryEl.textContent = data.country;

    // Update statistics
    const totalBookingsEl = document.getElementById('totalBookings');
    const upcomingBookingsEl = document.getElementById('upcomingBookings');
    const averageRatingEl = document.getElementById('averageRating');
    const memberMonthsEl = document.getElementById('memberMonths');
    if (totalBookingsEl) totalBookingsEl.textContent = data.totalBookings;
    if (upcomingBookingsEl) upcomingBookingsEl.textContent = data.upcomingBookings;
    if (averageRatingEl) averageRatingEl.textContent = data.averageRating;
    if (memberMonthsEl) memberMonthsEl.textContent = data.memberMonths;
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

