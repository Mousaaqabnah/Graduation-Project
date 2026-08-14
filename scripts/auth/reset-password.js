(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const form = document.getElementById('resetForm');
  const submitBtn = document.getElementById('submitBtn');
  const tokenHint = document.getElementById('tokenHint');
  if (!form || !submitBtn) return;

  function initPasswordToggles() {
    document.querySelectorAll('.password-toggle-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        const targetId = this.getAttribute('data-target');
        const passwordInput = document.getElementById(targetId);
        const icon = this.querySelector('i');
        if (!passwordInput || !icon) return;
        const isHidden = passwordInput.type === 'password';
        passwordInput.type = isHidden ? 'text' : 'password';
        icon.className = isHidden ? 'fi fi-rr-eye-crossed' : 'fi fi-rr-eye';
        this.setAttribute('aria-label', isHidden ? t('accessibility.hidePassword') : t('accessibility.showPassword'));
      });
    });
  }

  if (!token || token.length < 32) {
    if (tokenHint) {
      tokenHint.textContent =
        t('auth.resetMissing');
    }
    form.hidden = true;
    return;
  }

  form.hidden = false;
  initPasswordToggles();

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('passwordConfirm').value;
    if (password !== confirm) {
      window.alert(t('auth.passwordsMismatch'));
      return;
    }
    const original = submitBtn.textContent;
    submitBtn.textContent = t('common.saving');
    submitBtn.disabled = true;

    try {
      const data = await API.auth.resetPassword(token, password);
      const msg = t('auth.passwordUpdated');
      if (window.MatchFieldDialog && typeof window.MatchFieldDialog.alert === 'function') {
        await window.MatchFieldDialog.alert(msg);
      } else {
        window.alert(msg);
      }
      window.location.href = 'login.html';
    } catch (err) {
      window.alert((err && err.message) || t('auth.resetFailed'));
    } finally {
      submitBtn.textContent = original;
      submitBtn.disabled = false;
    }
  });
})();
