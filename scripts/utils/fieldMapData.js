/**
 * Shared field → map list item (coords + display fields) for player and owner map pages.
 */
(function (global) {
  'use strict';

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
      city: field.city || '',
      district: field.district || '',
      lat: coords ? coords[0] : null,
      lng: coords ? coords[1] : null
    };
  }

  global.FieldMapData = {
    getCoordsForField: getCoordsForField,
    mapApiFieldToView: mapApiFieldToView
  };
})(window);
