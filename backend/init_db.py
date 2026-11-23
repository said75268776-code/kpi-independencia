"""Crea las tablas en la base configurada (MySQL local o en la nube) usando schema_cloud.sql."""
from pathlib import Path
import db

texto = (Path(__file__).parent / 'schema_cloud.sql').read_text(encoding='utf-8')
# primero se quitan las líneas de comentario (pueden contener ';') y luego se separa por ';'
sql = '\n'.join(l for l in texto.splitlines() if not l.strip().startswith('--'))
sentencias = [b.strip() for b in sql.split(';') if b.strip()]

con = db.connect()
try:
    for s in sentencias:
        db.run(con, s)
    con.commit()
    tablas = [list(r.values())[0] for r in db.query(con, 'SHOW TABLES')] if db.USE_MYSQL else []
    print('Listo:', len(sentencias), 'sentencias ejecutadas. Tablas en la base:', len(tablas))
    for t in sorted(tablas):
        print(' -', t)
finally:
    con.close()
