/**
 * Shared field → map list item (coords + display fields) for player and owner map pages.
 */
(function (global) {
  'use strict';

  var locationCoords = {
    altunizade: [41.0192, 29.0386],
    üsküdar: [41.0225, 29.0136],
    uskudar: [41.0225, 29.0136],
    kadıköy: [40.9927, 29.0234],
    kadikoy: [40.9927, 29.0234],
    beşiktaş: [41.0422, 29.0046],
    besiktas: [41.0422, 29.0046],
    taksim: [41.037, 28.985],
    beyoğlu: [41.033, 28.974],
    fatih: [41.0186, 28.9497],
    sultanahmet: [41.0054, 28.9768],
    istiklal: [41.034, 28.976],
    istanbul: [41.0082, 28.9784]
  };

  function getCoordsForField(field, index) {
    if (field.latitude != null && field.longitude != null) {
      return [parseFloat(field.latitude), parseFloat(field.longitude)];
    }
    var loc = (field.location || field.address || 'istanbul').toLowerCase();
    for (var key in locationCoords) {
      if (loc.indexOf(key) !== -1) return locationCoords[key];
    }
    var base = [41.0082, 28.9784];
    var idx = typeof index === 'number' ? index : 0;
    return [base[0] + (idx % 5) * 0.01 - 0.02, base[1] + Math.floor(idx / 5) * 0.015 - 0.015];
  }

  /**
   * @param {object} field API field shape
   * @param {number} index fallback offset when lat/lng missing
   */
  function mapApiFieldToView(field, index) {
    var coords = getCoordsForField(field, index);
    return {
      id: field.id,
      name: field.name,
      location: field.location || '',
      price: field.pricePerHour != null ? field.pricePerHour : 0,
      rating: field.rating != null ? field.rating : 0,
      reviews: field.reviewCount != null ? field.reviewCount : 0,
      distance: 'N/A',
      amenities: (field.features || []).slice(0, 3),
      sport: (field.sport || 'football').toLowerCase(),
      lat: coords[0],
      lng: coords[1]
    };
  }

  global.FieldMapData = {
    getCoordsForField: getCoordsForField,
    mapApiFieldToView: mapApiFieldToView
  };
})(window);
