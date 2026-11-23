"""Acceso a datos. Con DB_HOST usa MySQL (PyMySQL); sin él usa SQLite local (solo pruebas)."""
import os, sqlite3
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).with_name('.env'))
except ImportError:
    pass

BASE = Path(__file__).parent
USE_MYSQL = bool(os.getenv('DB_HOST'))


ENTREGABLES_MYSQL = '''CREATE TABLE IF NOT EXISTS entregables (
  id INT AUTO_INCREMENT PRIMARY KEY, area_id VARCHAR(10) NOT NULL, kpi_id VARCHAR(10) NULL,
  titulo VARCHAR(255) NOT NULL, responsable VARCHAR(255), semana VARCHAR(10) NOT NULL,
  fecha_limite VARCHAR(10), estado VARCHAR(12) NOT NULL DEFAULT 'pendiente', nota TEXT,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'''


def connect():
    if USE_MYSQL:
        import pymysql
        extra = {}
        if os.getenv('DB_SSL') == '1':  # bases en la nube (TiDB Cloud, etc.) exigen TLS
            import certifi
            extra['ssl'] = {'ca': certifi.where()}
        con = pymysql.connect(
            host=os.environ['DB_HOST'], port=int(os.getenv('DB_PORT', '3306')),
            user=os.getenv('DB_USER', 'root'), password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'kpi_independencia'), charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor, autocommit=False, **extra)
        con.cursor().execute(ENTREGABLES_MYSQL)
        return con
    path = os.getenv('SQLITE_PATH', str(BASE / 'kpi_local.db'))
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript((BASE / 'schema_sqlite.sql').read_text(encoding='utf-8'))
    return con


def query(con, sql, params=()):
    """SELECT -> lista de dicts. Usa %s como marcador en ambos motores."""
    cur = con.cursor()
    cur.execute(sql if USE_MYSQL else sql.replace('%s', '?'), params)
    return [dict(r) for r in cur.fetchall()]


def run(con, sql, params=()):
    cur = con.cursor()
    cur.execute(sql if USE_MYSQL else sql.replace('%s', '?'), params)
    return cur.lastrowid
