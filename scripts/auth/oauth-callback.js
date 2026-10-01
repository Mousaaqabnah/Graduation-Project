(function () {
    var spinner = document.getElementById('oauthSpinner');
    var status = document.getElementById('oauthStatus');
    var errorBox = document.getElementById('oauthErrorBox');
    var backLink = document.getElementById('oauthBackLink');

    function showError(key) {
        if (spinner) spinner.hidden = true;
        if (status) status.hidden = true;
        if (errorBox) {
            errorBox.setAttribute('data-i18n', key);
            errorBox.textContent = t(key);
            errorBox.hidden = false;
        }
        if (backLink) backLink.hidden = false;
    }

    async function completeGoogleSignIn() {
        if (typeof API === 'undefined' || !API.auth || !API.auth.googleExchange) {
            showError('auth.google.errorGeneric');
            return;
        }
        try {
            var response = await API.auth.googleExchange();
            if (!response || !response.token || !response.user) {
                showError('auth.google.errorGeneric');
                return;
            }
            await redirectAfterAuth(response.user);
        } catch (_) {
            showError('auth.google.errorExpired');
        }
    }

    completeGoogleSignIn();
})();
