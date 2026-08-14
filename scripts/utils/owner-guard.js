/**
 * Field-owner pages: after auth-guard, ensure the logged-in user has role OWNER.
 * Mirrors the idea that player routes are for PLAYER and admin routes for ADMIN.
 * Include after auth-guard.js on owner-area pages.
 */
(function() {
  function injectVerificationPromptStyles() {
    if (document.getElementById('owner-verification-prompt-styles')) return;
    var style = document.createElement('style');
    style.id = 'owner-verification-prompt-styles';
    style.textContent = [
      '.owner-verification-prompt{',
      'position:sticky;top:12px;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:12px;',
      'padding:12px 16px;background:#FEF3C7;color:#92400E;font:500 14px/1.4 Poppins,Arial,sans-serif;',
      'border-radius:12px;margin:16px 0;',
      '}',
      '.owner-verification-prompt__text{margin:0;}',
      '.owner-verification-prompt__btn{',
      'display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:10px;border:1px solid #B45309;',
      'background:#fff;color:#92400E;text-decoration:none;font-weight:600;white-space:nowrap;',
      '}',
      '.owner-verification-prompt__btn:hover{background:#FFFBEB;}'
    ].join('');
    document.head.appendChild(style);
  }

  function isOwnerVerified(user) {
    if (!user || String(user.role || '').toUpperCase() !== 'OWNER') return true;
    return String(user.verificationStatus || '').toUpperCase() === 'APPROVED';
  }

  function showVerificationPromptIfNeeded(user) {
    if (!user || String(user.role || '').toUpperCase() !== 'OWNER') return;
    if (isOwnerVerified(user)) return;
    if (document.getElementById('ownerVerificationPrompt')) return;
    injectVerificationPromptStyles();

    var isProfilePage = String(window.location.pathname || '').toLowerCase().endsWith('/owner/profile.html');
    var prompt = document.createElement('div');
    prompt.id = 'ownerVerificationPrompt';
    prompt.className = 'owner-verification-prompt';
    prompt.innerHTML =
      '<p class="owner-verification-prompt__text">' +
      (isProfilePage
        ? t('owner.notVerifiedYet')
        : t('owner.verifyNow')) +
      '</p>' +
      '<a class="owner-verification-prompt__btn" href="/pages/owner/profile.html">' + t('owner.verifyAccount') + '</a>';

    var mainContent = document.querySelector('.main-content') || document.querySelector('main');
    if (mainContent) {
      var header = mainContent.querySelector('.main-header');
      if (header && header.parentNode === mainContent) {
        if (header.nextSibling) mainContent.insertBefore(prompt, header.nextSibling);
        else mainContent.appendChild(prompt);
      } else {
        mainContent.insertBefore(prompt, mainContent.firstChild);
      }
    } else {
      document.body.insertBefore(prompt, document.body.firstChild);
    }
  }

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
    showVerificationPromptIfNeeded(u);
    return;
  }

  if (API.auth && API.auth.getCurrentUser) {
    API.auth.getCurrentUser().then(function(res) {
      if (res && res.user) {
        if (API.setCurrentUser) API.setCurrentUser(res.user);
        guard(res.user);
        showVerificationPromptIfNeeded(res.user);
      }
    }).catch(function() {});
  }
})();
