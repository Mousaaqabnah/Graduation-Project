/**
 * Auth guard for protected pages.
 * Include this script on player/owner/admin pages.
 * Redirects to login if no auth token. Handles logout link.
 */
(function() {
  if (typeof API === 'undefined') {
    console.warn('auth-guard: API not loaded. Include api.js before auth-guard.js');
    return;
  }
  var token = API.getAuthToken && API.getAuthToken();
  if (!token) {
    window.location.replace('/pages/auth/login.html');
    return;
  }
  API.auth.getCurrentUser && API.auth.getCurrentUser().then(function(res) {
    if (res && res.user) API.setCurrentUser(res.user);
  }).catch(function() {});

  // When user presses Back and this page is restored from cache, send them to login if no token
  window.addEventListener('pageshow', function(e) {
    if (e.persisted && !(API.getAuthToken && API.getAuthToken())) {
      window.location.replace('/pages/auth/login.html');
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    document.body.addEventListener('click', function(e) {
      // Sidebar "Log out" and profile popup "Log Out" must clear token and redirect
      var link = e.target.closest && (
        e.target.closest('a.nav-item.logout') ||
        e.target.closest('a.profile-menu-item-logout')
      );
      if (link && link.href) {
        e.preventDefault();
        if (window.API && window.API.auth && window.API.auth.logout) {
          window.API.auth.logout();
        }
      }
    });
  });
})();
