/* Si API_BASE está vacío, el sitio lee los JSON de /data (modo estático, p. ej. Vercel sin backend).
   Con una URL (ej. 'http://localhost:5000' o 'https://tu-api.onrender.com') lee de la API y,
   si la API no responde, vuelve a los JSON. */
window.KPI_CONFIG = { API_BASE: 'http://127.0.0.1:5000' };
