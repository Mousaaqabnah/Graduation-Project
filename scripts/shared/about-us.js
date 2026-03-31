// Initialize the about us page
document.addEventListener('DOMContentLoaded', function() {
  setupPopups();
});

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


