/**
 * Shared HTML escaping for frontend scripts (S1).
 * Prefer textContent / createElement when building DOM; use this when
 * interpolating untrusted strings into HTML templates.
 */
(function (global) {
  function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  /**
   * Fetch a private API resource with Authorization and display as blob URL.
   * Never put JWTs in query strings.
   */
  async function authFetchBlobUrl(apiPath) {
    if (typeof API === 'undefined' || !API.getAuthToken) {
      throw new Error('Not authenticated');
    }
    const base =
      typeof API.getBaseUrl === 'function'
        ? API.getBaseUrl()
        : typeof window !== 'undefined' && window.API_BASE
          ? window.API_BASE
          : '';
    const url = apiPath.startsWith('http')
      ? apiPath
      : `${base}${apiPath.startsWith('/') ? '' : '/'}${apiPath}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API.getAuthToken()}` },
      credentials: 'same-origin'
    });
    if (!res.ok) {
      const err = new Error('Failed to load protected resource');
      err.status = res.status;
      throw err;
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  global.MatchFieldSafeDOM = {
    escapeHtml,
    escapeAttr,
    authFetchBlobUrl
  };
  global.escapeHtml = global.escapeHtml || escapeHtml;
})(typeof window !== 'undefined' ? window : globalThis);
