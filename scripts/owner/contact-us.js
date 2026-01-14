// Initialize the contact us page for field owners
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
            console.log('Contact form submitted:', formData);
            
            // Show success message
            alert('Thank you for your message! We will get back to you soon.');
            
            // Reset form (optional - you might want to keep the values)
            // contactForm.reset();
        });
    }
}

// Setup popups (notifications and profile)
function setupPopups() {
    // Notification popup
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationPopup = document.getElementById('notificationPopup');
    
    if (notificationBtn && notificationPopup) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationPopup.classList.toggle('active');
            // Close profile popup if open
            const profilePopup = document.getElementById('profilePopup');
            if (profilePopup && profilePopup.classList.contains('active')) {
                profilePopup.classList.remove('active');
            }
        });
        
        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            if (notificationPopup && notificationPopup.classList.contains('active')) {
                if (!notificationPopup.contains(e.target) && !notificationBtn.contains(e.target)) {
                    notificationPopup.classList.remove('active');
                }
            }
        });
    }
    
    // Profile popup
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');
    
    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            // Close notification popup if open
            if (notificationPopup && notificationPopup.classList.contains('active')) {
                notificationPopup.classList.remove('active');
            }
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











