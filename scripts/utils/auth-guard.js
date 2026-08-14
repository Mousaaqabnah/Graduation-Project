/**
 * Auth guard for protected pages.
 * Include this script on player/owner/admin pages.
 * Redirects to login if no auth token. Handles logout link.
 * Suspended accounts may only use their role’s Contact Us page (and logout).
 */
(function() {
  if (typeof API === 'undefined') {
    console.warn('auth-guard: API not loaded. Include api.js before auth-guard.js');
    return;
  }

  function normalizePathname(path) {
    return String(path || '').replace(/\\/g, '/');
  }

  function roleContactPath(role) {
    var r = String(role || '').toUpperCase();
    if (r === 'OWNER') return '/pages/owner/contact-us.html';
    return '/pages/shared/contact-us.html';
  }

  function isSuspendedUser(u) {
    return u && String(u.status || '').toUpperCase() === 'SUSPENDED';
  }

  function pathAllowsSuspendedUser(pathname, role) {
    var p = normalizePathname(pathname).toLowerCase();
    if (String(role || '').toUpperCase() === 'OWNER') {
      return p.endsWith('/pages/owner/contact-us.html');
    }
    return p.endsWith('/pages/shared/contact-us.html');
  }

  function showSuspendedNoticeOnce() {
    try {
      if (sessionStorage.getItem('matchfield_suspended_notice_shown') === '1') return;
      sessionStorage.setItem('matchfield_suspended_notice_shown', '1');
    } catch (err) {
      return;
    }
    if (window.MatchFieldDialog && typeof MatchFieldDialog.alert === 'function') {
      MatchFieldDialog.alert(
        t('errors.suspendedContact'),
        { type: 'warning', title: t('auth.accountSuspendedTitle') }
      );
    }
  }

  function applySuspendedLayout(user) {
    if (!isSuspendedUser(user)) return;
    var path = normalizePathname(window.location.pathname);
    if (!pathAllowsSuspendedUser(path, user.role)) return;

    function run() {
      document.body.classList.add('matchfield-suspended-account');
      var bell = document.querySelector('.notification-wrapper');
      if (bell) bell.style.display = 'none';
      var nav = document.querySelector('aside.sidebar .sidebar-nav');
      if (nav) {
        nav.querySelectorAll('a.nav-item').forEach(function(a) {
          var isLogout = a.classList.contains('logout');
          var isContact = /contact-us\.html/i.test(a.getAttribute('href') || '');
          if (!isLogout && !isContact) a.style.display = 'none';
        });
      }
      var popup = document.getElementById('profilePopup');
      if (popup) {
        popup.querySelectorAll('.profile-menu-item').forEach(function(a) {
          if (!a.classList.contains('profile-menu-item-logout')) a.style.display = 'none';
        });
      }
      var footer = document.querySelector('aside.sidebar .sidebar-footer');
      if (footer) {
        footer.querySelectorAll('a').forEach(function(a) {
          if (!a.classList.contains('logout')) a.style.display = 'none';
        });
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  }

  var token = API.getAuthToken && API.getAuthToken();
  if (!token) {
    window.location.replace('/pages/auth/login.html');
    return;
  }

  var pathname = normalizePathname(window.location.pathname);

  try {
    var cached = API.getCurrentUser && API.getCurrentUser();
    if (cached && isSuspendedUser(cached) && !pathAllowsSuspendedUser(pathname, cached.role)) {
      window.location.replace(roleContactPath(cached.role));
      return;
    }
  } catch (e1) {
    /* ignore */
  }

  API.auth.getCurrentUser &&
    API.auth.getCurrentUser().then(function(res) {
      if (res && res.user) API.setCurrentUser(res.user);
      var u = res && res.user;
      if (!u) return;
      var pathNow = normalizePathname(window.location.pathname);
      if (isSuspendedUser(u)) {
        if (!pathAllowsSuspendedUser(pathNow, u.role)) {
          window.location.replace(roleContactPath(u.role));
          return;
        }
        applySuspendedLayout(u);
        showSuspendedNoticeOnce();
      }
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
