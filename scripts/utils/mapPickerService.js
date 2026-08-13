(function (window) {
  'use strict';

  function createMapPicker(options) {
    var L = window.L;
    if (!L) throw new Error('Leaflet is required for MapPickerService');
    var cfg = options || {};
    var containerId = cfg.containerId;
    var container = document.getElementById(containerId);
    if (!container) throw new Error('Map picker container not found: ' + containerId);

    var center = Array.isArray(cfg.initialCenter)
      ? cfg.initialCenter
      : (typeof window.MatchFieldGeo !== 'undefined' && window.MatchFieldGeo.mapCenterPair
          ? window.MatchFieldGeo.mapCenterPair()
          : [31.9038, 35.2034]);
    var zoom = Number.isFinite(cfg.initialZoom)
      ? cfg.initialZoom
      : (typeof window.MatchFieldGeo !== 'undefined' && window.MatchFieldGeo.DEFAULT_ZOOM != null
          ? window.MatchFieldGeo.DEFAULT_ZOOM
          : 10);
    var draggable = cfg.draggable !== false;
    var onPositionChange = typeof cfg.onPositionChange === 'function' ? cfg.onPositionChange : function () {};

    if (container._leaflet_id) {
      container._leaflet_id = null;
    }

    var map = L.map(containerId).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var marker = null;

    function notify(source) {
      if (!marker) return;
      var ll = marker.getLatLng();
      onPositionChange(
        {
          lat: ll.lat,
          lng: ll.lng
        },
        source || 'set'
      );
    }

    function setPosition(lat, lng, source, opts) {
      var latNum = parseFloat(lat);
      var lngNum = parseFloat(lng);
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return;
      var silent = opts && opts.silent;
      if (!marker) {
        marker = L.marker([latNum, lngNum], { draggable: draggable }).addTo(map);
        marker.on('dragend', function () {
          notify('drag');
        });
      } else {
        marker.setLatLng([latNum, lngNum]);
      }
      map.setView([latNum, lngNum], Math.max(map.getZoom(), 15));
      if (!silent) notify(source || 'set');
    }

    map.on('click', function (e) {
      var ll = e.latlng;
      setPosition(ll.lat, ll.lng, 'click');
    });

    if (cfg.initialPosition && Number.isFinite(cfg.initialPosition.lat) && Number.isFinite(cfg.initialPosition.lng)) {
      setPosition(cfg.initialPosition.lat, cfg.initialPosition.lng, 'init');
    }

    setTimeout(function () {
      map.invalidateSize();
    }, 0);

    return {
      setPosition: setPosition,
      setCenter: function (lat, lng, zoomLevel) {
        map.setView([lat, lng], Number.isFinite(zoomLevel) ? zoomLevel : map.getZoom());
      },
      getPosition: function () {
        if (!marker) return null;
        var ll = marker.getLatLng();
        return { lat: ll.lat, lng: ll.lng };
      },
      destroy: function () {
        map.remove();
      },
      invalidateSize: function () {
        map.invalidateSize();
      }
    };
  }

  window.MapPickerService = {
    create: createMapPicker
  };
})(window);
