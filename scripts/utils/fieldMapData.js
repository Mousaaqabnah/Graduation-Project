/**
 * Shared field → map list item (coords + display fields) for player and owner map pages.
 */
(function (global) {
  'use strict';

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = ((lat2 - lat1) * Math.PI) / 180;
    var dLon = ((lon2 - lon1) * Math.PI) / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function formatDistanceFromKm(km) {
    if (!Number.isFinite(km)) return '';
    return km.toFixed(1) + ' km';
  }

  function distanceLabelFromApiField(field) {
    if (field.distanceKm != null && Number.isFinite(Number(field.distanceKm))) {
      return formatDistanceFromKm(Number(field.distanceKm));
    }
    if (field.distanceMeters != null && Number.isFinite(Number(field.distanceMeters))) {
      return formatDistanceFromKm(Number(field.distanceMeters) / 1000);
    }
    return '';
  }

  /**
   * Mutates each item with lat/lng: sets .distance to "X.X km" from the given point.
   */
  function applyDistancesFromPoint(fields, lat, lng) {
    if (!Array.isArray(fields) || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    fields.forEach(function (f) {
      if (f.lat != null && f.lng != null && Number.isFinite(f.lat) && Number.isFinite(f.lng)) {
        f.distance = formatDistanceFromKm(haversineKm(lat, lng, f.lat, f.lng));
      }
    });
  }

  function tryAutoFillDistances(fieldsArray, onDone) {
    if (!navigator.geolocation || !Array.isArray(fieldsArray) || fieldsArray.length === 0) {
      if (typeof onDone === 'function') onDone(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        applyDistancesFromPoint(fieldsArray, lat, lng);
        if (typeof onDone === 'function') onDone({ lat: lat, lng: lng });
      },
      function () {
        if (typeof onDone === 'function') onDone(null);
      },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 10000 }
    );
  }

  function getCoordsForField(field, index) {
    if (field.latitude == null || field.longitude == null) {
      return null;
    }
    var lat = parseFloat(field.latitude);
    var lng = parseFloat(field.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return [lat, lng];
  }

  /**
   * @param {object} field API field shape
   * @param {number} index fallback offset when lat/lng missing
   */
  function mapApiFieldToView(field, index) {
    var coords = getCoordsForField(field, index);
    var fromApi = distanceLabelFromApiField(field);
    var amen = Array.isArray(field.amenities) ? field.amenities : [];
    var feat = Array.isArray(field.features) ? field.features : [];
    var mergedAmenities = [];
    var seenAm = {};
    [].concat(amen, feat).forEach(function (x) {
      var s = String(x || '').trim();
      if (!s) return;
      var k = s.toLowerCase();
      if (seenAm[k]) return;
      seenAm[k] = true;
      mergedAmenities.push(s);
    });
    return {
      id: field.id,
      name: field.name,
      location: field.location || '',
      price: field.pricePerHour != null ? field.pricePerHour : 0,
      rating: field.rating != null ? field.rating : 0,
      reviews: field.reviewCount != null ? field.reviewCount : 0,
      distance: fromApi || (coords ? '' : '—'),
      amenities: mergedAmenities.slice(0, 3),
      sport: (field.sport || 'football').toLowerCase(),
      city: field.city || '',
      district: field.district || '',
      lat: coords ? coords[0] : null,
      lng: coords ? coords[1] : null
    };
  }

  global.FieldMapData = {
    getCoordsForField: getCoordsForField,
    mapApiFieldToView: mapApiFieldToView,
    haversineKm: haversineKm,
    formatDistanceFromKm: formatDistanceFromKm,
    applyDistancesFromPoint: applyDistancesFromPoint,
    tryAutoFillDistances: tryAutoFillDistances
  };
})(window);
