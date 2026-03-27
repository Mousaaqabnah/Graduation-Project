// Initialize the contact us page
document.addEventListener('DOMContentLoaded', function() {
    setupForm();
    setupPopups();
});

// Setup contact form
function setupForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                fullName: document.getElementById('fullName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                topic: document.getElementById('topic').value,
                message: document.getElementById('message').value
            };
            
            if (!formData.fullName || !formData.email || !formData.message) {
                alert('Please fill in all required fields.');
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                alert('Please enter a valid email address.');
                return;
            }
            
            const submitBtn = contactForm.querySelector('.btn-submit') || contactForm.querySelector('button[type=\"submit\"]');
            const originalText = submitBtn ? submitBtn.textContent : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';
            }
            
            try {
                if (window.API && window.API.support && window.API.support.contact) {
                    await window.API.support.contact(formData);
                } else {
                    console.log('Contact form (no API.support):', formData);
                }
                alert('Thank you for your message! We will get back to you soon.');
            } catch (err) {
                console.error('Contact form error:', err);
                alert(err.message || 'Failed to send your message. Please try again later.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText || 'Send message';
                }
            }
        });
    }
}

// Setup popups (notification handled by notifications.js for player)
function setupPopups() {
    // Profile popup
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    
    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            var notificationPopup = document.getElementById('notificationPopup');
            if (notificationPopup) notificationPopup.classList.remove('active');
        });
        
        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            if (profilePopup && profilePopup.classList.contains('active')) {
                if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
                    profilePopup.classList.remove('active');
                }
            }
        });
    }
}


