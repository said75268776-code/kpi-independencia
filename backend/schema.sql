-- MySQL / MariaDB (XAMPP + phpMyAdmin). Importar en phpMyAdmin o: mysql -u root < schema.sql
CREATE DATABASE IF NOT EXISTS kpi_independencia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kpi_independencia;

CREATE TABLE IF NOT EXISTS meta (
  clave VARCHAR(40) PRIMARY KEY,
  valor TEXT
);

CREATE TABLE IF NOT EXISTS areas (
  id VARCHAR(10) PRIMARY KEY,
  corto VARCHAR(80) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  icono VARCHAR(16),
  responsables TEXT,
  base_legal TEXT
);

CREATE TABLE IF NOT EXISTS kpis (
  id VARCHAR(10) PRIMARY KEY,
  area_id VARCHAR(10) NOT NULL,
  nombre VARCHAR(400) NOT NULL,
  dimension VARCHAR(80),
  frecuencia VARCHAR(40),
  base_legal TEXT,
  enlace TEXT,
  unidad VARCHAR(255),
  formula TEXT,
  etiqueta_num VARCHAR(255),
  etiqueta_den VARCHAR(255),
  num DOUBLE NULL,
  den DOUBLE NULL,
  meta DOUBLE NULL,
  estrategia TEXT,
  fuente VARCHAR(20) NOT NULL DEFAULT 'ejemplo',
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

-- Historial de mediciones (entregables semanales / periódicos). La última por KPI es el valor vigente.
CREATE TABLE IF NOT EXISTS kpi_mediciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kpi_id VARCHAR(10) NOT NULL,
  periodo VARCHAR(20) NOT NULL,         -- ej. 2026-S47 o 2026-11
  num DOUBLE NOT NULL,
  den DOUBLE NULL,                      -- si es NULL se usa el den del KPI
  nota TEXT,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kpi_id) REFERENCES kpis(id)
);

CREATE TABLE IF NOT EXISTS inversiones (
  cui VARCHAR(20) PRIMARY KEY,
  nombre TEXT, entidad VARCHAR(255), estado VARCHAR(60),
  costo DOUBLE, devengado DOUBLE, avance DOUBLE,
  actualizado VARCHAR(10), url TEXT
);

CREATE TABLE IF NOT EXISTS contrataciones (
  id VARCHAR(80) PRIMARY KEY,
  entidad VARCHAR(255), objeto TEXT, metodo VARCHAR(120),
  monto DOUBLE NULL, fecha VARCHAR(10), url TEXT
);

CREATE TABLE IF NOT EXISTS fin_ingresos (fuente VARCHAR(120) PRIMARY KEY, pia DOUBLE, recaudado DOUBLE);
CREATE TABLE IF NOT EXISTS fin_gastos (generica VARCHAR(160) PRIMARY KEY, pia DOUBLE, pim DOUBLE, devengado DOUBLE);
CREATE TABLE IF NOT EXISTS fin_mensual (orden INT PRIMARY KEY, mes VARCHAR(6), ingreso DOUBLE, gasto DOUBLE);

-- Entregables semanales por área (agregado después; también se crea solo al iniciar la API)
CREATE TABLE IF NOT EXISTS entregables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  area_id VARCHAR(10) NOT NULL,
  kpi_id VARCHAR(10) NULL,
  titulo VARCHAR(255) NOT NULL,
  responsable VARCHAR(255),
  semana VARCHAR(10) NOT NULL,
  fecha_limite VARCHAR(10),
  estado VARCHAR(12) NOT NULL DEFAULT 'pendiente',
  nota TEXT,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (area_id) REFERENCES areas(id)
);
