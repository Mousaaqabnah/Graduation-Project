/**
 * Field-owner pages: after auth-guard, ensure the logged-in user has role OWNER.
 * Mirrors the idea that player routes are for PLAYER and admin routes for ADMIN.
 * Include after auth-guard.js on owner-area pages.
 */
(function() {
  function redirectForRole(role) {
    if (role === 'PLAYER') {
      window.location.replace('/pages/player/home.html');
      return true;
    }
    if (role === 'ADMIN') {
      window.location.replace('/pages/admin/dashboard.html');
      return true;
    }
    return false;
  }

  function guard(user) {
    if (!user || !user.role) return;
    if (user.role === 'OWNER') return;
    redirectForRole(user.role);
  }

  if (typeof API === 'undefined') return;

  var u = API.getCurrentUser && API.getCurrentUser();
  if (u) {
    guard(u);
    return;
  }

  if (API.auth && API.auth.getCurrentUser) {
    API.auth.getCurrentUser().then(function(res) {
      if (res && res.user) {
        if (API.setCurrentUser) API.setCurrentUser(res.user);
        guard(res.user);
      }
    }).catch(function() {});
  }
})();
