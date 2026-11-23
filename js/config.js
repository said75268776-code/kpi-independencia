/* En tu PC (localhost) usa la API local. En internet, sin API, lee los archivos de /data.
   Cuando la API esté en Render, pon su dirección en PROD_API. */
(function () {
  var local = ['localhost', '127.0.0.1'].indexOf(location.hostname) >= 0;
  var PROD_API = '';
  window.KPI_CONFIG = { API_BASE: local ? 'http://127.0.0.1:5000' : PROD_API };
})();
