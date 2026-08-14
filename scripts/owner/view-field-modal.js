/**
 * Owner "View field" modal — shared by My Fields and Map.
 * Requires #viewFieldModal markup (same ids as fields page) and API.fields.getById.
 */
(function () {
  'use strict';
  let viewGalleryImages = [];
  let viewGalleryIndex = 0;
  let viewTouchStartX = null;

  function ownerFieldEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function formatOwnerFieldPrice(n) {
    if (typeof MatchFieldPrefs !== 'undefined' && MatchFieldPrefs.formatMoney) {
      return MatchFieldPrefs.formatMoney(Number(n) || 0);
    }
    return '₪' + (Number(n) || 0).toLocaleString('en-IL');
  }

  function reviewerInitials(fullName) {
    if (!fullName || typeof fullName !== 'string') return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  }

  function formatReviewDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  function mergedAmenitiesAndFeatures(f) {
    var a = Array.isArray(f.amenities) ? f.amenities : [];
    var feat = Array.isArray(f.features) ? f.features : [];
    var seen = {};
    var out = [];
    [].concat(a, feat).forEach(function (x) {
      var s = String(x || '').trim();
      if (!s) return;
      var k = s.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(s);
    });
    return out;
  }

  function populateViewFieldModalFromApi(f) {
    if (!f) return;
    if (!document.getElementById('viewFieldModal')) return;

    const images = Array.isArray(f.images) && f.images.length
      ? f.images.slice()
      : ['https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=500&fit=crop'];
    const typeLabel = String(f.type || '').toUpperCase() === 'INDOOR'
      ? t('sports.indoor')
      : t('sports.outdoor');
    const sport = (window.MatchFieldI18n && MatchFieldI18n.sportLabel)
      ? (MatchFieldI18n.sportLabel(f.sport) || f.sport || t('owner.sportType'))
      : (f.sport || t('owner.sportType'));
    const ratingNum = f.rating != null ? Number(f.rating).toFixed(1) : '—';
    const reviewTotal = f.reviewCount != null ? String(f.reviewCount) : '0';
    const loc = f.location || '—';

    const imageEl = document.getElementById('viewFieldImage');
    viewGalleryImages = images;
    viewGalleryIndex = 0;
    if (imageEl) imageEl.src = images[0];
    renderViewGalleryControls();

    const titleEl = document.getElementById('viewFieldName');
    if (titleEl) titleEl.textContent = f.name || t('owner.colField');

    const metaLine = document.getElementById('viewFieldMeta');
    if (metaLine) {
      metaLine.innerHTML =
        '<i class="fi fi-rr-marker field-meta-icon"></i>' +
        '<span id="viewFieldLocation">' +
        ownerFieldEsc(loc) +
        '</span>' +
        '<span class="field-meta-separator">•</span>' +
        '<span id="viewFieldCategory">' +
        ownerFieldEsc(sport) +
        '</span>' +
        '<span class="field-meta-separator">•</span>' +
        '<span id="viewFieldType">' +
        ownerFieldEsc(typeLabel) +
        '</span>' +
        '<span class="field-meta-separator">•</span>' +
        '<span class="field-star-yellow">★</span> ' +
        '<span id="viewFieldHeaderRating">' +
        ownerFieldEsc(ratingNum) +
        '</span>' +
        ' (<span id="viewFieldHeaderReviewsCount">' +
        ownerFieldEsc(reviewTotal) +
        '</span>)';
    }

    const priceElement = document.getElementById('viewFieldPrice');
    if (priceElement) {
      priceElement.innerHTML =
        ownerFieldEsc(formatOwnerFieldPrice(f.pricePerHour)) +
        '<span class="view-field-price-unit">' + t('common.perHour') + '</span>';
    }

    const features = mergedAmenitiesAndFeatures(f);
    const tagsContainer = document.getElementById('viewFieldTags');
    if (tagsContainer) {
      tagsContainer.innerHTML = features
        .map(function (tag) {
          return '<span class="view-field-feature-tag">' + ownerFieldEsc(tag) + '</span>';
        })
        .join('');
    }

    const locationFullEl = document.getElementById('viewFieldLocationFull');
    const categoryFullEl = document.getElementById('viewFieldCategoryFull');
    const typeFullEl = document.getElementById('viewFieldTypeFull');
    const capacityEl = document.getElementById('viewFieldCapacity');
    const descriptionEl = document.getElementById('viewFieldDescription');

    if (locationFullEl) locationFullEl.textContent = [f.address, f.location].filter(Boolean).join(' · ') || loc;
    if (categoryFullEl) categoryFullEl.textContent = sport;
    if (typeFullEl) typeFullEl.textContent = typeLabel;
    if (capacityEl) capacityEl.textContent = '—';

    if (descriptionEl) {
      descriptionEl.textContent = f.description || t('common.noDescription');
    }

    const amenitiesGrid = document.getElementById('viewFieldAmenities');
    if (amenitiesGrid) {
      if (features.length) {
        amenitiesGrid.innerHTML = features
          .map(function (amenity) {
            return (
              '<div class="view-amenity-item">' +
              '<i class="fi fi-rr-check view-amenity-icon"></i>' +
              '<span>' +
              ownerFieldEsc(amenity) +
              '</span></div>'
            );
          })
          .join('');
      } else {
        amenitiesGrid.innerHTML = '<p style="color:#6B7280;font-size:14px;">' + t('owner.noAmenities') + '</p>';
      }
    }

    const ratingElement = document.getElementById('viewFieldRating');
    const reviewsCountElement = document.getElementById('viewFieldReviewsCount');
    if (ratingElement) ratingElement.textContent = ratingNum;
    if (reviewsCountElement) reviewsCountElement.textContent = reviewTotal;

    const reviewsList = document.getElementById('viewReviewsList');
    if (reviewsList) {
      const apiReviews = Array.isArray(f.reviews) ? f.reviews : [];
      if (!apiReviews.length) {
        reviewsList.innerHTML = '<p style="padding:16px;color:#6B7280;font-size:14px;">' + t('owner.noReviews') + '</p>';
      } else {
        reviewsList.innerHTML = apiReviews
          .map(function (rv) {
            const u = rv.user || {};
            const name = u.fullName || t('owner.player');
            const avatar = (u.avatar || '').trim();
            let r = parseInt(rv.rating, 10);
            if (isNaN(r)) r = 0;
            r = Math.max(0, Math.min(5, r));
            const stars = '★'.repeat(r) + '☆'.repeat(5 - r);
            const text = rv.reviewText || '';
            const ctx = rv.context || '';
            const when = formatReviewDate(rv.createdAt);
            const avatarHtml = avatar
              ? '<img src="' + ownerFieldEsc(avatar) + '" alt="' + ownerFieldEsc(name) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
              : ownerFieldEsc(reviewerInitials(name));
            return (
              '<div class="view-review-card">' +
              '<div class="view-review-header">' +
              '<div class="view-reviewer-info">' +
              '<div class="view-reviewer-avatar">' +
              avatarHtml +
              '</div>' +
              '<div class="view-reviewer-details">' +
              '<div class="view-reviewer-name">' +
              ownerFieldEsc(name) +
              '</div>' +
              '<div class="view-review-context">' +
              ownerFieldEsc(ctx) +
              '</div></div></div>' +
              '<div class="view-review-rating-display">' +
              '<span class="view-star-filled">' +
              stars +
              '</span></div></div>' +
              '<p class="view-review-text">' +
              ownerFieldEsc(text) +
              '</p>' +
              '<div class="view-review-date">' +
              ownerFieldEsc(when) +
              '</div></div>'
            );
          })
          .join('');
      }
    }
  }

  function renderViewGalleryControls() {
    const gallery = document.querySelector('.view-field-gallery');
    if (!gallery) return;
    const existing = gallery.querySelector('.view-gallery-controls');
    if (existing) existing.remove();
    if (!Array.isArray(viewGalleryImages) || viewGalleryImages.length <= 1) return;

    const controls = document.createElement('div');
    controls.className = 'view-gallery-controls';
    controls.innerHTML =
      '<button type="button" class="gallery-nav-btn gallery-nav-left" aria-label="' + t('owner.previousImage') + '"><i class="fi fi-rr-angle-left"></i></button>' +
      '<div class="view-gallery-dots" aria-label="' + t('owner.imageIndicators') + '"></div>' +
      '<button type="button" class="gallery-nav-btn gallery-nav-right" aria-label="' + t('owner.nextImage') + '"><i class="fi fi-rr-angle-right"></i></button>';
    gallery.appendChild(controls);

    controls.querySelector('.gallery-nav-left').addEventListener('click', function () {
      setViewGalleryIndex(viewGalleryIndex - 1);
    });
    controls.querySelector('.gallery-nav-right').addEventListener('click', function () {
      setViewGalleryIndex(viewGalleryIndex + 1);
    });
    updateViewGalleryUi();
  }

  function setViewGalleryIndex(index) {
    if (!viewGalleryImages.length) return;
    const next = (index + viewGalleryImages.length) % viewGalleryImages.length;
    viewGalleryIndex = next;
    const imageEl = document.getElementById('viewFieldImage');
    if (imageEl) imageEl.src = viewGalleryImages[next];
    updateViewGalleryUi();
  }

  function updateViewGalleryUi() {
    const dotsWrap = document.querySelector('.view-gallery-dots');
    if (!dotsWrap || viewGalleryImages.length <= 1) return;
    dotsWrap.innerHTML = viewGalleryImages
      .map(function (_img, idx) {
        return '<button type="button" class="view-gallery-dot ' + (idx === viewGalleryIndex ? 'active' : '') + '" data-idx="' + idx + '" aria-label="' + t('owner.goToImage', { n: idx + 1 }) + '"></button>';
      })
      .join('');
    dotsWrap.querySelectorAll('.view-gallery-dot').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(idx)) setViewGalleryIndex(idx);
      });
    });
  }

  function bindViewGallerySwipe() {
    const gallery = document.querySelector('.view-field-gallery');
    if (!gallery || gallery.dataset.swipeBound === '1') return;
    gallery.dataset.swipeBound = '1';

    gallery.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches.length) return;
      viewTouchStartX = e.touches[0].clientX;
    }, { passive: true });

    gallery.addEventListener('touchend', function (e) {
      if (viewTouchStartX == null || !e.changedTouches || !e.changedTouches.length) return;
      const endX = e.changedTouches[0].clientX;
      const delta = endX - viewTouchStartX;
      viewTouchStartX = null;
      if (Math.abs(delta) < 35) return;
      if (delta < 0) setViewGalleryIndex(viewGalleryIndex + 1);
      else setViewGalleryIndex(viewGalleryIndex - 1);
    }, { passive: true });
  }

  async function openViewFieldModalForFieldId(fieldId) {
    const viewFieldModal = document.getElementById('viewFieldModal');
    if (!viewFieldModal || !fieldId) return;

    viewFieldModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    const titleEl = document.getElementById('viewFieldName');
    if (titleEl) titleEl.textContent = t('common.loading');

    if (typeof API === 'undefined' || !API.fields || !API.fields.getById) {
      alert(t('common.apiUnavailable'));
      closeViewModal();
      return;
    }

    const res = await API.fields.getById(fieldId);
    const f = res && res.field;
    if (!f) {
      alert(t('errors.fieldNotFound'));
      closeViewModal();
      return;
    }

    populateViewFieldModalFromApi(f);
  }

  async function viewFieldDetails(button) {
    try {
      const fieldCard = button.closest('.field-list-card');
      if (!fieldCard) return;

      const fieldId = fieldCard.getAttribute('data-field-id');
      if (!fieldId) return;

      await openViewFieldModalForFieldId(fieldId);
    } catch (error) {
      console.error('Error opening view field modal:', error);
      alert((window.MatchFieldI18n && MatchFieldI18n.localizeError(error && error.message)) || t('owner.couldNotLoadField'));
      closeViewModal();
    }
  }

  function closeViewModal() {
    const viewFieldModal = document.getElementById('viewFieldModal');
    if (viewFieldModal) {
      viewFieldModal.classList.remove('active');
      document.body.style.overflow = '';
      const reviewsList = document.getElementById('viewReviewsList');
      const toggleBtn = document.getElementById('viewToggleReviewsBtn');
      if (reviewsList) reviewsList.style.display = 'none';
      if (toggleBtn) {
        toggleBtn.classList.remove('expanded');
        const toggleText = toggleBtn.querySelector('.view-toggle-text');
        if (toggleText) toggleText.textContent = t('owner.viewReviews');
      }
    }
  }

  function toggleViewReviews() {
    const reviewsList = document.getElementById('viewReviewsList');
    const toggleBtn = document.getElementById('viewToggleReviewsBtn');

    if (reviewsList && toggleBtn) {
      const isHidden = reviewsList.style.display === 'none' || !reviewsList.style.display;

      if (isHidden) {
        reviewsList.style.display = 'flex';
        toggleBtn.classList.add('expanded');
        const toggleText = toggleBtn.querySelector('.view-toggle-text');
            if (toggleText) toggleText.textContent = t('owner.hideReviews');
      } else {
        reviewsList.style.display = 'none';
        toggleBtn.classList.remove('expanded');
        const toggleText = toggleBtn.querySelector('.view-toggle-text');
        if (toggleText) toggleText.textContent = t('owner.viewReviews');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const viewFieldModal = document.getElementById('viewFieldModal');
    if (viewFieldModal) {
      viewFieldModal.addEventListener('click', function (e) {
        if (e.target === viewFieldModal) closeViewModal();
      });
    }
    bindViewGallerySwipe();
  });

  window.ownerFieldEsc = ownerFieldEsc;
  window.formatOwnerFieldPrice = formatOwnerFieldPrice;
  window.populateViewFieldModalFromApi = populateViewFieldModalFromApi;
  window.openViewFieldModalForFieldId = openViewFieldModalForFieldId;
  window.viewFieldDetails = viewFieldDetails;
  window.closeViewModal = closeViewModal;
  window.toggleViewReviews = toggleViewReviews;
})();
