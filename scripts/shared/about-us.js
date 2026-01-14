// Initialize the about us page
document.addEventListener('DOMContentLoaded', function() {
  setupPopups();
});

// Setup popups (notifications and profile)
function setupPopups() {
  // Notification popup
  const notificationBtn = document.querySelector('.notification-btn');
  const notificationPopup = document.getElementById('notificationPopup');
  const closeNotificationBtn = document.getElementById('closeNotificationBtn');
  
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
      
      // Close notification button
      if (closeNotificationBtn) {
          closeNotificationBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              notificationPopup.classList.remove('active');
          });
      }
      
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


