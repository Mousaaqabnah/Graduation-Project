(function (window) {
  'use strict';

  var NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
  var DEFAULT_LANGUAGE = 'tr';

  function buildAddressParts(parts) {
    return parts.filter(Boolean).join(', ');
  }

  function pickCity(address) {
    return (
      address.city ||
      address.town ||
      address.county ||
      address.state ||
      ''
    );
  }

  function pickDistrict(address) {
    return (
      address.suburb ||
      address.city_district ||
      address.neighbourhood ||
      address.quarter ||
      address.borough ||
      ''
    );
  }

  function normalizeAddressPayload(item) {
    var address = item && item.address ? item.address : {};
    var city = pickCity(address);
    var district = pickDistrict(address);
    var fullAddress =
      item && item.display_name
        ? item.display_name
        : buildAddressParts([
            address.road,
            address.house_number,
            district,
            city,
            address.country
          ]);

    return {
      address: String(fullAddress || '').trim(),
      city: String(city || '').trim(),
      district: String(district || '').trim()
    };
  }

  async function geocodeAddress(query) {
    var q = String(query || '').trim();
    if (!q) return null;
    var url =
      NOMINATIM_BASE +
      '/search?format=json&addressdetails=1&limit=1&accept-language=' +
      encodeURIComponent(DEFAULT_LANGUAGE) +
      '&q=' +
      encodeURIComponent(q);
    var res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Address search failed');
    var items = await res.json();
    if (!Array.isArray(items) || items.length === 0) return null;
    var first = items[0];
    var lat = parseFloat(first.lat);
    var lng = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat: lat,
      lng: lng,
      metadata: normalizeAddressPayload(first)
    };
  }

  async function reverseGeocode(lat, lng) {
    var latNum = parseFloat(lat);
    var lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
    var url =
      NOMINATIM_BASE +
      '/reverse?format=json&addressdetails=1&accept-language=' +
      encodeURIComponent(DEFAULT_LANGUAGE) +
      '&lat=' +
      encodeURIComponent(String(latNum)) +
      '&lon=' +
      encodeURIComponent(String(lngNum));
    var res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Reverse geocoding failed');
    var item = await res.json();
    if (!item) return null;
    return normalizeAddressPayload(item);
  }

  window.GeocodingService = {
    geocodeAddress: geocodeAddress,
    reverseGeocode: reverseGeocode
  };
})(window);
