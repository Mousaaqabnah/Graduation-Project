/* Live Server / file:// uses this file. "npm start" serves /scripts/utils/runtime-api-port.js from Express instead (see server.js) with the real PORT. */
(function () {
  if (typeof window === 'undefined') return;
  if (window.__API_PORT__ != null && String(window.__API_PORT__).trim() !== '') return;
  try {
    var p = localStorage.getItem('matchfield_api_port');
    if (p != null && String(p).trim() !== '') {
      var n = parseInt(p, 10);
      if (!isNaN(n) && n > 0 && n <= 65535) window.__API_PORT__ = n;
    }
  } catch (e) {
    /* private mode */
  }
  if (window.__API_PORT__ == null || String(window.__API_PORT__).trim() === '') {
    window.__API_PORT__ = 3000;
  }
})();
