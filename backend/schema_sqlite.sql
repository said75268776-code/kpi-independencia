-- Modo de pruebas sin MySQL (se crea solo). Mismas tablas que schema.sql.
CREATE TABLE IF NOT EXISTS meta (clave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS areas (id TEXT PRIMARY KEY, corto TEXT, nombre TEXT, icono TEXT, responsables TEXT, base_legal TEXT);
CREATE TABLE IF NOT EXISTS kpis (id TEXT PRIMARY KEY, area_id TEXT, nombre TEXT, dimension TEXT, frecuencia TEXT, base_legal TEXT, enlace TEXT, unidad TEXT, formula TEXT, etiqueta_num TEXT, etiqueta_den TEXT, num REAL, den REAL, meta REAL, estrategia TEXT, fuente TEXT DEFAULT 'ejemplo');
CREATE TABLE IF NOT EXISTS kpi_mediciones (id INTEGER PRIMARY KEY AUTOINCREMENT, kpi_id TEXT, periodo TEXT, num REAL, den REAL, nota TEXT, creado_en TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS inversiones (cui TEXT PRIMARY KEY, nombre TEXT, entidad TEXT, estado TEXT, costo REAL, devengado REAL, avance REAL, actualizado TEXT, url TEXT);
CREATE TABLE IF NOT EXISTS contrataciones (id TEXT PRIMARY KEY, entidad TEXT, objeto TEXT, metodo TEXT, monto REAL, fecha TEXT, url TEXT);
CREATE TABLE IF NOT EXISTS fin_ingresos (fuente TEXT PRIMARY KEY, pia REAL, recaudado REAL);
CREATE TABLE IF NOT EXISTS fin_gastos (generica TEXT PRIMARY KEY, pia REAL, pim REAL, devengado REAL);
CREATE TABLE IF NOT EXISTS fin_mensual (orden INTEGER PRIMARY KEY, mes TEXT, ingreso REAL, gasto REAL);
CREATE TABLE IF NOT EXISTS entregables (id INTEGER PRIMARY KEY AUTOINCREMENT, area_id TEXT, kpi_id TEXT, titulo TEXT, responsable TEXT, semana TEXT, fecha_limite TEXT, estado TEXT DEFAULT 'pendiente', nota TEXT, creado_en TEXT DEFAULT CURRENT_TIMESTAMP);
