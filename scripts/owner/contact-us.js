// Contact Us — field owner (same API path as player/shared)
document.addEventListener('DOMContentLoaded', function () {
  setupForm();
  setupPopups();
  loadSupportDisplayInfo();
  prefillContactForm();
});

async function loadSupportDisplayInfo() {
  const emailEl = document.getElementById('supportEmailText');
  const waEl = document.getElementById('supportWhatsappText');
  const phoneEl = document.getElementById('supportPhoneText');
  if (!emailEl && !waEl && !phoneEl) return;
  try {
    if (window.API && window.API.support && window.API.support.getContactInfo) {
      const data = await window.API.support.getContactInfo();
      if (emailEl && data.email) emailEl.textContent = data.email;
      if (waEl && data.whatsapp) waEl.textContent = data.whatsapp;
      if (phoneEl && data.phoneLine) phoneEl.textContent = data.phoneLine;
    }
  } catch (e) {
    console.warn('Contact page: could not load support display info', e);
  }
}

async function prefillContactForm() {
  const nameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  if (!nameInput || !emailInput || !window.API) return;

  let user = typeof API.getCurrentUser === 'function' ? API.getCurrentUser() : null;
  try {
    if (typeof API.getAuthToken === 'function' && API.getAuthToken() && API.auth && API.auth.getCurrentUser) {
      const res = await API.auth.getCurrentUser();
      if (res && res.user) {
        user = res.user;
        if (typeof API.setCurrentUser === 'function') API.setCurrentUser(user);
      }
    }
  } catch (_) {
    /* keep cached user */
  }

  if (!user) return;
  if (!String(nameInput.value || '').trim() && user.fullName) nameInput.value = user.fullName;
  if (!String(emailInput.value || '').trim() && user.email) emailInput.value = user.email;
  if (phoneInput && !String(phoneInput.value || '').trim() && user.phone) phoneInput.value = user.phone;
}

function setupForm() {
  const contactForm = document.getElementById('contactForm');

  if (contactForm) {
    contactForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const formData = {
        fullName: String(document.getElementById('fullName').value || '').trim(),
        email: String(document.getElementById('email').value || '').trim(),
        phone: String(document.getElementById('phone').value || '').trim(),
        topic: String(document.getElementById('topic').value || '').trim(),
        message: String(document.getElementById('message').value || '').trim()
      };

      if (!formData.fullName || !formData.email || !formData.message) {
        alert('Please fill in all required fields.');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        alert('Please enter a valid email address.');
        return;
      }

      const submitBtn =
        contactForm.querySelector('.btn-submit') ||
        contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }

      try {
        if (!(window.API && window.API.support && window.API.support.contact)) {
          throw new Error('Contact API is not available. Reload the page and ensure the server is running.');
        }
        const payload = {
          fullName: formData.fullName,
          email: formData.email,
          message: formData.message,
          ...(formData.phone ? { phone: formData.phone } : {}),
          ...(formData.topic ? { topic: formData.topic } : {})
        };
        const res = await window.API.support.contact(payload);
        alert((res && res.message) || 'Thank you for your message! We will get back to you soon.');
        contactForm.reset();
      } catch (err) {
        console.error('Contact form error:', err);
        alert(err.message || 'Failed to send your message. Please try again later.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText || 'Send message';
        }
      }
    });
  }
}

function setupPopups() {
  const notificationPopup = document.getElementById('notificationPopup');
  const profileBtn = document.getElementById('profileBtn');
  const profilePopup = document.getElementById('profilePopup');

  if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      profilePopup.classList.toggle('active');
      if (notificationPopup) notificationPopup.classList.remove('active');
    });

    document.addEventListener('click', function (e) {
      if (profilePopup && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('active');
      }
    });
  }
}
