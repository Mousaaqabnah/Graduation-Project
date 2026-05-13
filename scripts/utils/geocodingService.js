(function (window) {
  'use strict';

  var NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
  var DEFAULT_LANGUAGE = 'tr';
  /** Nominatim returns the nearest named object; open water often snaps to a distant city — compare with the pin. */
  var MAX_GEOCODE_DRIFT_KM = 1.8;
  var NOMINATIM_FETCH_HEADERS = {
    Accept: 'application/json',
    'User-Agent': 'MatchField/1.0 (student field-booking project; https://github.com/)'
  };

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

  function itemClass(item) {
    return String((item && (item.class || item.category)) || '').toLowerCase();
  }

  function itemType(item) {
    return String((item && item.type) || '').toLowerCase();
  }

  /**
   * Strong signals the reverse hit is a real on-the-ground feature (not a snapped city/region for a sea pin).
   * Do not use generic place=city/town — Nominatim uses those for open water far from shore.
   */
  function isLikelyLandFeature(item) {
    if (!item) return false;
    var a = item.address || {};
    if (String(a.road || '').trim() || String(a.house_number || '').trim() || String(a.building || '').trim()) {
      return true;
    }
    var cls = itemClass(item);
    var typ = itemType(item);
    if (
      cls === 'highway' ||
      cls === 'building' ||
      cls === 'amenity' ||
      cls === 'leisure' ||
      cls === 'shop' ||
      cls === 'tourism' ||
      cls === 'sport' ||
      cls === 'office' ||
      cls === 'historic' ||
      cls === 'railway'
    ) {
      return true;
    }
    if (cls === 'landuse' && typ !== 'basin' && typ !== 'reservoir' && typ !== 'salt_pond') {
      return true;
    }
    if (cls === 'natural' && typ !== 'water' && typ !== 'bay' && typ !== 'strait' && typ !== 'glacier') {
      return true;
    }
    if (cls === 'place') {
      var localPlace = {
        suburb: 1,
        neighbourhood: 1,
        quarter: 1,
        city_block: 1,
        village: 1,
        hamlet: 1,
        isolated_dwelling: 1,
        farm: 1,
        locality: 1,
        allotments: 1
      };
      if (localPlace[typ]) return true;
    }
    return false;
  }

  /** Open water / strait from OSM (after land-feature pass). */
  function isWaterOsmType(item) {
    if (!item) return false;
    var cls = itemClass(item);
    var typ = itemType(item);
    if (cls === 'natural' && (typ === 'water' || typ === 'bay' || typ === 'strait')) {
      return true;
    }
    if (cls === 'place' && (typ === 'sea' || typ === 'ocean')) return true;
    var a = item.address || {};
    if (a.natural === 'water' || a.natural === 'bay' || a.natural === 'strait') return true;
    if (a.water === 'bay' || a.water === 'strait') return true;
    return false;
  }

  function isUnbuildableWater(item) {
    if (!item) return false;
    if (isLikelyLandFeature(item)) return false;
    return isWaterOsmType(item);
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
    var res = await fetch(url, { headers: NOMINATIM_FETCH_HEADERS });
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
      '/reverse?format=json&addressdetails=1&zoom=18&accept-language=' +
      encodeURIComponent(DEFAULT_LANGUAGE) +
      '&lat=' +
      encodeURIComponent(String(latNum)) +
      '&lon=' +
      encodeURIComponent(String(lngNum));
    var res = await fetch(url, { headers: NOMINATIM_FETCH_HEADERS });
    if (!res.ok) throw new Error('Reverse geocoding failed');
    var item = await res.json();
    if (!item || item.error) return null;
    var base = normalizeAddressPayload(item);
    var snapLat = parseFloat(item.lat);
    var snapLng = parseFloat(item.lon);
    var driftKm = 0;
    if (Number.isFinite(snapLat) && Number.isFinite(snapLng)) {
      driftKm = haversineKm(latNum, lngNum, snapLat, snapLng);
    }
    var driftTooFar = Number.isFinite(driftKm) && driftKm > MAX_GEOCODE_DRIFT_KM;
    var waterHit = isUnbuildableWater(item);
    var invalid = driftTooFar || waterHit;
    var invalidPinReason = null;
    if (invalid) {
      invalidPinReason = waterHit ? 'water' : 'drift';
    }
    return {
      address: base.address,
      city: base.city,
      district: base.district,
      isUnbuildableWater: invalid,
      invalidPinReason: invalidPinReason,
      geocodeDriftKm: driftKm
    };
  }

  window.GeocodingService = {
    geocodeAddress: geocodeAddress,
    reverseGeocode: reverseGeocode,
    isUnbuildableWaterFromNominatim: isUnbuildableWater
  };
})(window);
