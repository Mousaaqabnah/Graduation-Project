/**
 * Favorite fields from profile menu — all player pages with #favoriteFieldsMenuItem + #favoriteFieldsModal.
 * Load after api.js. Optional: home.js passes getCachedVenues into openModal for fewer API calls on home.
 */
(function () {
  function favoriteIdsFromStorage() {
    try {
      var raw = localStorage.getItem('favoriteVenues');
      var parsed = raw ? JSON.parse(raw) : [];
      return (Array.isArray(parsed) ? parsed : []).map(String).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function mapFieldToVenue(field) {
    var id = String(field.id);
    var images = field.images && field.images.length ? field.images : [];
    var img =
      images[0] ||
      'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop&auto=format';
    return {
      id: id,
      name: field.name,
      image: img,
      location: field.location || '',
      distance: field.distanceKm != null ? t('player.distanceKm', { km: Number(field.distanceKm).toFixed(1) }) : t('common.na')
    };
  }

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function playerFieldInfoUrl(fieldId) {
    var p = (window.location.pathname || '').replace(/\\/g, '/');
    if (p.indexOf('/shared/') !== -1 || p.indexOf('/pages/shared') !== -1) {
      return '../player/field-info.html?id=' + encodeURIComponent(fieldId);
    }
    return 'field-info.html?id=' + encodeURIComponent(fieldId);
  }

  async function openModal(options) {
    options = options || {};
    var getCached = options.getCachedVenues;
    var cacheList = typeof getCached === 'function' ? getCached() : [];
    var cacheMap = new Map(
      (cacheList || []).map(function (v) {
        return [String(v.id), v];
      })
    );

    var modal = document.getElementById('favoriteFieldsModal');
    var body = document.getElementById('favoriteFieldsModalBody');
    if (!modal || !body) return;

    body.innerHTML = '<div class="favorite-empty-state">' + t('player.loadingFavorites') + '</div>';
    modal.classList.add('active');

    try {
      var favoriteEntries = [];
      if (typeof API !== 'undefined' && API.getAuthToken && API.getAuthToken()) {
        var favRes = await API.favorites.getAll().catch(function () {
          return { favorites: [] };
        });
        favoriteEntries = favRes && favRes.favorites ? favRes.favorites : [];
      }
      var ids = favoriteEntries
        .map(function (f) {
          return String(f.fieldId || (f.field && f.field.id) || '');
        })
        .filter(Boolean);
      if (!ids.length) ids = favoriteIdsFromStorage();

      var favoriteFields = await Promise.all(
        ids.map(async function (id) {
          if (cacheMap.has(id)) return cacheMap.get(id);
          if (typeof API !== 'undefined' && API.fields && API.fields.getById) {
            var res = await API.fields.getById(id).catch(function () {
              return null;
            });
            if (res && res.field) return mapFieldToVenue(res.field);
          }
          return null;
        })
      );

      var list = favoriteFields.filter(Boolean);
      if (!list.length) {
        body.innerHTML = '<div class="favorite-empty-state">' + t('player.noFavorites') + '</div>';
        return;
      }

      body.innerHTML = list
        .map(function (field) {
          return (
            '<div class="favorite-field-item">' +
            '<img src="' +
            escAttr(field.image) +
            '" alt="' +
            escAttr(field.name) +
            '">' +
            '<div class="favorite-field-item-details">' +
            '<p class="favorite-field-item-title">' +
            escHtml(field.name) +
            '</p>' +
            '<p class="favorite-field-item-meta">' +
            escHtml(field.location) +
            ' · ' +
            escHtml(field.distance) +
            '</p>' +
            '</div>' +
            '<button type="button" class="favorite-field-item-action" data-favorite-view-id="' +
            escAttr(field.id) +
            '">' + t('common.view') + '</button>' +
            '</div>'
          );
        })
        .join('');

      body.querySelectorAll('[data-favorite-view-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-favorite-view-id');
          window.location.href = playerFieldInfoUrl(id);
        });
      });
    } catch (_) {
      body.innerHTML = '<div class="favorite-empty-state">' + t('player.favoritesFailed') + '</div>';
    }
  }

  function closeModal() {
    var modal = document.getElementById('favoriteFieldsModal');
    if (modal) modal.classList.remove('active');
  }

  function init() {
    var menu = document.getElementById('favoriteFieldsMenuItem');
    var modal = document.getElementById('favoriteFieldsModal');
    if (!menu || !modal) return;
    if (menu.getAttribute('data-mf-fav-init') === '1') return;
    menu.setAttribute('data-mf-fav-init', '1');

    menu.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var profilePopup = document.getElementById('profilePopup');
      if (profilePopup) profilePopup.classList.remove('active');
      openModal({});
    });

    var closeBtn = document.getElementById('closeFavoriteFieldsModal');
    var overlay = modal.querySelector('.favorite-fields-modal-overlay');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    });
  }

  window.MatchFieldProfileFavorites = {
    openModal: openModal,
    closeModal: closeModal,
    init: init
  };

  document.addEventListener('DOMContentLoaded', init);
})();
