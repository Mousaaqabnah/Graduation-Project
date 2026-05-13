(function () {
  const form = document.getElementById('forgotForm');
  const submitBtn = document.getElementById('submitBtn');
  if (!form || !submitBtn) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const original = submitBtn.textContent;
    submitBtn.textContent = 'Sending…';
    submitBtn.disabled = true;

    try {
      const data = await API.auth.forgotPassword(email);
      const baseMsg = data.message || 'If an account exists, you will receive instructions.';

      if (data.devResetUrl) {
        const full =
          baseMsg +
          '\n\n(Development) Open this link to reset your password:\n' +
          data.devResetUrl;
        if (window.MatchFieldDialog && typeof window.MatchFieldDialog.alert === 'function') {
          await window.MatchFieldDialog.alert(full);
        } else {
          window.alert(full);
        }
      } else {
        if (window.MatchFieldDialog && typeof window.MatchFieldDialog.alert === 'function') {
          await window.MatchFieldDialog.alert(baseMsg);
        } else {
          window.alert(baseMsg);
        }
      }
    } catch (err) {
      window.alert((err && err.message) || 'Something went wrong. Try again.');
    } finally {
      submitBtn.textContent = original;
      submitBtn.disabled = false;
    }
  });
})();
