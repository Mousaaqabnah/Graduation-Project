/**
 * Palestine-oriented geographic product defaults (fallback only).
 * Real geolocation and field coordinates always take precedence.
 */
(function (global) {
  /** Approximate central West Bank / Palestine view */
  var PALESTINE_CENTER = Object.freeze({
    name: 'Ramallah',
    lat: 31.9038,
    lng: 35.2034,
    zoom: 10
  });

  var DEFAULT_LOCATION = Object.freeze({
    name: PALESTINE_CENTER.name,
    lat: PALESTINE_CENTER.lat,
    lng: PALESTINE_CENTER.lng,
    source: 'default'
  });

  function mapCenterPair() {
    return [PALESTINE_CENTER.lat, PALESTINE_CENTER.lng];
  }

  global.MatchFieldGeo = {
    PALESTINE_CENTER: PALESTINE_CENTER,
    DEFAULT_LOCATION: DEFAULT_LOCATION,
    mapCenterPair: mapCenterPair,
    DEFAULT_ZOOM: PALESTINE_CENTER.zoom
  };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PALESTINE_CENTER: { name: 'Ramallah', lat: 31.9038, lng: 35.2034, zoom: 10 },
    DEFAULT_LOCATION: { name: 'Ramallah', lat: 31.9038, lng: 35.2034, source: 'default' },
    mapCenterPair: function () {
      return [31.9038, 35.2034];
    },
    DEFAULT_ZOOM: 10
  };
}
