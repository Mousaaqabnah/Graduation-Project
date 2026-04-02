// Initialize the about us page for field owners
document.addEventListener('DOMContentLoaded', function() {
    setupPopups();
});

// Setup popups — notifications: scripts/player/notifications.js
function setupPopups() {
    const notificationPopup = document.getElementById('notificationPopup');
    const profileBtn = document.getElementById('profileBtn');
    const profilePopup = document.getElementById('profilePopup');

    if (profileBtn && profilePopup) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profilePopup.classList.toggle('active');
            if (notificationPopup) notificationPopup.classList.remove('active');
        });

        document.addEventListener('click', (e) => {
            if (profilePopup && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
                profilePopup.classList.remove('active');
            }
        });
    }
}











