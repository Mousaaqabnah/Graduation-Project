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
        this.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
      });
    });
  }

  if (!token || token.length < 32) {
    if (tokenHint) {
      tokenHint.textContent =
        'This reset link is missing or invalid. Request a new link from the forgot password page.';
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
      window.alert('Passwords do not match.');
      return;
    }
    const original = submitBtn.textContent;
    submitBtn.textContent = 'Saving…';
    submitBtn.disabled = true;

    try {
      const data = await API.auth.resetPassword(token, password);
      const msg = data.message || 'Password updated.';
      if (window.MatchFieldDialog && typeof window.MatchFieldDialog.alert === 'function') {
        await window.MatchFieldDialog.alert(msg);
      } else {
        window.alert(msg);
      }
      window.location.href = 'login.html';
    } catch (err) {
      window.alert((err && err.message) || 'Reset failed. The link may have expired.');
    } finally {
      submitBtn.textContent = original;
      submitBtn.disabled = false;
    }
  });
})();
