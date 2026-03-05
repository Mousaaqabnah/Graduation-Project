// Initialize the contact us page
document.addEventListener('DOMContentLoaded', function() {
    setupForm();
    setupPopups();
});

// Setup contact form
function setupForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = {
                fullName: document.getElementById('fullName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                topic: document.getElementById('topic').value,
                message: document.getElementById('message').value
            };
            
            // Validate form
            if (!formData.fullName || !formData.email || !formData.message) {
                alert('Please fill in all required fields.');
                return;
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                alert('Please enter a valid email address.');
                return;
            }
            
            // Simulate form submission
            console.log('Form submitted:', formData);
            
            // Show success message
            alert('Thank you for your message! We will get back to you soon.');
            
            // Reset form (optional - you might want to keep the values)
            // contactForm.reset();
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


