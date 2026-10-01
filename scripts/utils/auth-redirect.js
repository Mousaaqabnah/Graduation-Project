/**
 * Shared post-authentication navigation for login, signup, and Google OAuth.
 * The role must come from the server-issued user object only.
 */
(function (global) {
    function translate(key) {
        return typeof global.t === 'function' ? global.t(key) : key;
    }

    async function redirectAfterAuth(user) {
        if (!user) return;
        if (String(user.status || '').toUpperCase() === 'SUSPENDED') {
            var contactPath =
                String(user.role || '').toUpperCase() === 'OWNER'
                    ? '/pages/owner/contact-us.html'
                    : '/pages/shared/contact-us.html';
            if (global.MatchFieldDialog && typeof global.MatchFieldDialog.alert === 'function') {
                await global.MatchFieldDialog.alert(
                    translate('auth.accountSuspended'),
                    { type: 'warning', title: translate('auth.accountSuspendedTitle') }
                );
            }
            try {
                sessionStorage.setItem('matchfield_suspended_notice_shown', '1');
            } catch (_) {
                /* ignore */
            }
            global.location.href = contactPath;
            return;
        }
        if (user.role === 'ADMIN') {
            global.location.href = '/pages/admin/dashboard.html';
        } else if (user.role === 'OWNER') {
            global.location.href = '/pages/owner/dashboard.html';
        } else {
            global.location.href = '/pages/player/home.html';
        }
    }

    global.MatchFieldAuthRedirect = { redirectAfterAuth: redirectAfterAuth };
    global.redirectAfterAuth = redirectAfterAuth;
})(typeof window !== 'undefined' ? window : globalThis);
