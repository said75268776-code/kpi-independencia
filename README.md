# KPI Independencia – Tablero de Desempeño Municipal (demo)

Sitio estático (HTML + CSS + JS, sin dependencias) con el estilo del Monitoreo Independencia.
Vistas: Resumen ejecutivo, Matriz de 24 KPIs (semáforo), Finanzas y presupuesto, Inversiones y contrataciones, Fuentes y notas.

## Ejecutar en local
El sitio lee archivos JSON, así que **no se abre con doble clic**; necesita un servidor local:

    npx serve .          (o)   python -m http.server 8000

y abre la dirección que indique (por ejemplo http://localhost:8000). En Windows PowerShell usa `npx.cmd serve .`.
También sirve la extensión Live Server de VS Code.

## Publicar gratis en Vercel
1. Sube esta carpeta a un repositorio de GitHub.
2. En vercel.com: Add New → Project → importa el repositorio. Framework: "Other"; sin comando de build; directorio de salida: la raíz.
3. Deploy. Cada `git push` actualiza el sitio.

## Datos: qué es real y qué es ejemplo
- `data/inversiones.json`: **real** (Invierte.pe y OSCE, corte 12-oct-2026), mismo formato del Monitoreo.
- KPI-13 y KPI-14: calculados con esos datos como referencia (proxy), no con la fórmula oficial.
- `data/kpis.json` (otros 22 KPIs) y `data/finanzas.json`: **cifras de ejemplo**. Las metas son propuestas y las bases legales están por verificar.
- Para pasar un KPI a real: edita `num`, `den`, `meta` y cambia `fuente`.

## Siguiente paso (opcional)
Backend Flask + MySQL para guardar entregables semanales por área en lugar de JSON.

---

# Backend (Flask + MySQL)

    backend/
      app.py            API (Flask)
      db.py             conexión MySQL (o SQLite de pruebas si no hay DB_HOST)
      schema.sql        tablas MySQL (importar en phpMyAdmin)
      seed.py           carga data/*.json en la base
      requirements.txt, .env.example

## Local con XAMPP (MySQL + phpMyAdmin)
1. Inicia **MySQL** en XAMPP. En phpMyAdmin → Importar → `backend/schema.sql`.
2. En `backend/`: copia `.env.example` a `.env` y ajusta `DB_PASSWORD` y `ADMIN_KEY`.
3. Instala y carga datos (en Windows, `py` en vez de `python3` si hace falta):

       cd backend
       pip install -r requirements.txt
       python seed.py
       python app.py

   Prueba http://localhost:5000/api/health (debe decir `"motor": "mysql"`).
4. En `js/config.js` pon `API_BASE: 'http://localhost:5000'` y sirve el front como antes.
   Si la API se cae, el sitio vuelve solo a los JSON.

## Endpoints
| Método | Ruta | Uso |
|---|---|---|
| GET | /api/areas, /api/kpis, /api/inversiones, /api/finanzas | mismos formatos que `data/*.json` |
| GET | /api/kpis/<id>/mediciones | historial de un KPI |
| POST | /api/kpis/<id>/mediciones | registrar entregable: `{"periodo":"2026-S47","num":45,"den":48,"nota":"..."}` |
| PUT | /api/kpis/<id> | cambiar `meta`, `den` o `fuente` |

POST y PUT exigen el encabezado `X-API-Key: <ADMIN_KEY>`. La última medición de cada KPI es su valor vigente; el front la muestra como "Medición <periodo>".

Ejemplo (PowerShell): `curl.exe -X POST http://localhost:5000/api/kpis/KPI-01/mediciones -H "X-API-Key: tu-clave" -H "Content-Type: application/json" -d "{\"periodo\":\"2026-S47\",\"num\":45}"`

## Desplegar
- **Front:** Vercel (estático), como arriba. Vercel no corre Flask con MySQL de forma cómoda.
- **API:** un hosting de Python gratis/barato (Render, Railway, PythonAnywhere). Comando: `gunicorn app:app` desde `backend/`. Define las variables del `.env` en el panel del servicio, con `CORS_ORIGINS` = la URL de tu Vercel.
- **MySQL:** debe ser accesible desde internet (Railway, Aiven, o el MySQL de Hostinger si habilitas acceso remoto). Importa `schema.sql` y corre `python seed.py` apuntando a esa base.
- Luego pon la URL pública de la API en `js/config.js` y haz push.
- **Hostinger:** si ya tienen plan con Python/Node úsenlo; con plan compartido solo PHP/MySQL, la API tendría que ir en otro servicio.

## Para tus compañeros (más módulos)
Cada módulo vive en su carpeta/repositorio y puede consumir la misma base MySQL con tablas propias (prefijo, p. ej. `mon_`, `rec_`) o exponer su propia API. Acordad antes un solo host de MySQL y claves distintas por módulo.

---

# Cómo se reparten los datos

- **Desde archivos** (`data/*.json`, no hace falta base de datos): áreas, catálogo de 24 KPIs, inversiones y contrataciones, finanzas, marco legal. Para actualizarlos se reemplaza el archivo y se hace push.
- **Desde la base de datos** (se llenan en la propia página): **mediciones de los KPIs** y **entregables semanales**. Con la API conectada, cada KPI tiene un formulario "Registrar medición real" y la vista Entregables permite agregar y cambiar estados. Piden la clave `ADMIN_KEY`.
- Sin API, la página funciona igual en modo lectura con los archivos (por ejemplo en Vercel).
- `python seed.py` ya no hace falta repetirlo: sirve una vez para cargar los entregables de ejemplo y los catálogos en MySQL.
- Endpoints usados por la página: `GET /api/entregables`, `POST|PUT /api/entregables`, `GET /api/mediciones`, `POST /api/kpis/<id>/mediciones`.
