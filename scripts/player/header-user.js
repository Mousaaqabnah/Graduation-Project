/**
 * Fills the header "My Account" popup and profile picture with the logged-in user's
 * name, email, and avatar (initials from name, e.g. Mousa Aqabnah → MA).
 * Include after api.js and auth-guard.js on player pages that have #profileBtn and #profilePopup.
 */
(function() {
    function getAvatarUrl(fullName, size) {
        var name = (fullName || 'User').trim() || 'User';
        return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=007BFF&color=fff&size=' + (size || 128);
    }

    function applyUserToHeader(user) {
        var fullName = user.fullName || user.name || 'Player';
        var email = user.email || '';
        var avatarSrc = user.avatar || (user.id && typeof localStorage !== 'undefined' && localStorage.getItem('userAvatar_' + user.id)) || getAvatarUrl(fullName, 128);

        var headerImg = document.querySelector('#profileBtn img');
        if (headerImg) {
            headerImg.src = avatarSrc;
            headerImg.alt = fullName;
        }

        var popupName = document.querySelector('#profilePopup .profile-name');
        var popupEmail = document.querySelector('#profilePopup .profile-email');
        var popupAvatar = document.querySelector('#profilePopup .profile-avatar-large img');
        if (popupName) popupName.textContent = fullName;
        if (popupEmail) popupEmail.textContent = email;
        if (popupAvatar) {
            popupAvatar.src = avatarSrc;
            popupAvatar.alt = fullName;
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        if (typeof API === 'undefined') return;

        var user = API.getCurrentUser && API.getCurrentUser();
        if (user) {
            applyUserToHeader(user);
            return;
        }

        API.auth.getCurrentUser && API.auth.getCurrentUser().then(function(res) {
            if (res && res.user) {
                if (API.setCurrentUser) API.setCurrentUser(res.user);
                applyUserToHeader(res.user);
            }
        }).catch(function() {});
    });
})();
