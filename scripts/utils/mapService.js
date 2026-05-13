/**
 * Map Service - Abstraction for map functionality.
 * Currently uses Leaflet + OpenStreetMap. Can be swapped to Google Maps later.
 */
(function(window) {
  'use strict';

  var L = window.L;
  var _map = null;
  var _markers = [];
  var _containerId = null;
  var _onMarkerClick = null;

  function initMap(containerId, options) {
    if (!L) {
      console.error('Leaflet not loaded. Include Leaflet CSS and JS.');
      return null;
    }
    _containerId = containerId;
    var container = document.getElementById(containerId);
    if (!container) return null;

    // Remove existing map
    if (_map) {
      _map.remove();
      _map = null;
      _markers = [];
    }

    var center = options && options.center ? options.center : [41.0082, 28.9784]; // Istanbul
    var zoom = options && options.zoom != null ? options.zoom : 12;

    _map = L.map(containerId).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(_map);

    return _map;
  }

  function addMarker(lat, lng, data) {
    if (!_map || !L) return null;
    var marker = L.marker([lat, lng]).addTo(_map);
    if (data && (data.name || data.price)) {
      var cityDistrict = [data.city, data.district].filter(Boolean).join(' / ');
      var content = (data.name ? '<strong>' + escapeHtml(data.name) + '</strong><br>' : '') +
        (cityDistrict ? escapeHtml(cityDistrict) + '<br>' : '') +
        (data.location ? escapeHtml(data.location) + '<br>' : '') +
        (data.price != null ? '₺' + data.price + '/h' : '');
      marker.bindPopup(content);
    }
    marker._fieldData = data || {};
    marker.on('click', function() {
      if (_onMarkerClick) _onMarkerClick(data);
    });
    _markers.push(marker);
    return marker;
  }

  function clearMarkers() {
    _markers.forEach(function(m) { if (_map) _map.removeLayer(m); });
    _markers = [];
  }

  function fitBounds(bounds) {
    if (!_map) return;
    var pad = 0.05;
    var sw = bounds.sw || bounds[0];
    var ne = bounds.ne || bounds[1];
    if (Array.isArray(sw) && Array.isArray(ne)) {
      _map.fitBounds([sw, ne], { padding: [20, 20], maxZoom: 14 });
    }
  }

  function fitMarkers() {
    if (!_map || _markers.length === 0) return;
    var group = L.featureGroup(_markers);
    _map.fitBounds(group.getBounds().pad(0.1), { padding: [30, 30], maxZoom: 14 });
  }

  function setCenter(lat, lng, zoom) {
    if (!_map) return;
    _map.setView([lat, lng], zoom != null ? zoom : _map.getZoom());
  }

  function setOnMarkerClick(callback) {
    _onMarkerClick = callback;
  }

  function getMap() {
    return _map;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  window.MapService = {
    init: initMap,
    addMarker: addMarker,
    clearMarkers: clearMarkers,
    fitBounds: fitBounds,
    fitMarkers: fitMarkers,
    setCenter: setCenter,
    onMarkerClick: setOnMarkerClick,
    getMap: getMap
  };
})(window);
