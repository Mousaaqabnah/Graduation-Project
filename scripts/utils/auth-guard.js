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
    window.location.href = '/pages/auth/login.html';
    return;
  }
  API.auth.getCurrentUser && API.auth.getCurrentUser().then(function(res) {
    if (res && res.user) API.setCurrentUser(res.user);
  }).catch(function() {});

  document.addEventListener('DOMContentLoaded', function() {
    document.body.addEventListener('click', function(e) {
      var link = e.target.closest && e.target.closest('a.nav-item.logout');
      if (link && link.href) {
        e.preventDefault();
        if (window.API && window.API.auth && window.API.auth.logout) window.API.auth.logout();
      }
    });
  });
})();
