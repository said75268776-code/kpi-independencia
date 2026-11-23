"""Carga data/*.json en la base. Se puede repetir: reemplaza catálogos y datos, conserva kpi_mediciones."""
import json
from pathlib import Path
import db

D = Path(__file__).parent.parent / 'data'
load = lambda n: json.loads((D / n).read_text(encoding='utf-8'))

areas, kpis, inv, fin = load('areas.json'), load('kpis.json'), load('inversiones.json'), load('finanzas.json')
con = db.connect()
try:
    for t in ('contrataciones', 'inversiones', 'fin_ingresos', 'fin_gastos', 'fin_mensual', 'meta'):
        db.run(con, 'DELETE FROM ' + t)
    # areas/kpis: se actualizan sin borrar (las mediciones dependen de ellos)
    for a in areas:
        if db.query(con, 'SELECT id FROM areas WHERE id=%s', (a['id'],)):
            db.run(con, 'UPDATE areas SET corto=%s, nombre=%s, icono=%s, responsables=%s, base_legal=%s WHERE id=%s',
                   (a['corto'], a['nombre'], a['icono'], a['responsables'], a['baseLegal'], a['id']))
        else:
            db.run(con, 'INSERT INTO areas (id, corto, nombre, icono, responsables, base_legal) VALUES (%s,%s,%s,%s,%s,%s)',
                   (a['id'], a['corto'], a['nombre'], a['icono'], a['responsables'], a['baseLegal']))
    cols = ('area_id', 'nombre', 'dimension', 'frecuencia', 'base_legal', 'enlace', 'unidad', 'formula',
            'etiqueta_num', 'etiqueta_den', 'num', 'den', 'meta', 'estrategia', 'fuente')
    for k in kpis:
        vals = (k['areaId'], k['nombre'], k['dimension'], k['frecuencia'], k['baseLegal'], k['enlace'], k['unidad'],
                k['formula'], k['etiquetaNum'], k['etiquetaDen'], k['num'], k['den'], k['meta'], k['estrategia'], k['fuente'])
        if db.query(con, 'SELECT id FROM kpis WHERE id=%s', (k['id'],)):
            db.run(con, 'UPDATE kpis SET ' + ', '.join(c + '=%s' for c in cols) + ' WHERE id=%s', vals + (k['id'],))
        else:
            db.run(con, 'INSERT INTO kpis (id, ' + ', '.join(cols) + ') VALUES (%s,' + ','.join(['%s'] * len(cols)) + ')', (k['id'],) + vals)
    for x in inv['investments']:
        db.run(con, 'INSERT INTO inversiones VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)',
               (x['cui'], x['name'], x['entity'], x['status'], x['costSoles'], x['accruedSoles'], x['progressPct'], x['lastUpdate'], x['url']))
    seen = set()
    for p in inv['procurements']:
        if p['id'] in seen:
            continue
        seen.add(p['id'])
        db.run(con, 'INSERT INTO contrataciones VALUES (%s,%s,%s,%s,%s,%s,%s)',
               (p['id'], p['entity'], p['object'], p['method'], p['amountSoles'], p['date'], p['url']))
    for r in fin['ingresos']:
        db.run(con, 'INSERT INTO fin_ingresos VALUES (%s,%s,%s)', (r['fuente'], r['pia'], r['recaudado']))
    for r in fin['gastos']:
        db.run(con, 'INSERT INTO fin_gastos VALUES (%s,%s,%s,%s)', (r['generica'], r['pia'], r['pim'], r['devengado']))
    for i, r in enumerate(fin['mensual']):
        db.run(con, 'INSERT INTO fin_mensual VALUES (%s,%s,%s,%s)', (i, r['mes'], r['ingreso'], r['gasto']))
    if not db.query(con, 'SELECT id FROM entregables LIMIT 1'):  # solo si está vacía: no pisa lo que ya cargaron
        for e in load('entregables.json'):
            db.run(con, 'INSERT INTO entregables (area_id, kpi_id, titulo, responsable, semana, fecha_limite, estado, nota) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)',
                   (e['areaId'], e['kpiId'], e['titulo'], e['responsable'], e['semana'], e['fechaLimite'], e['estado'], e['nota']))
    for k, v in {'inversiones_asof': inv['asOf'], 'fin_anio': fin['anio'], 'fin_asof': fin['asOf'], 'fin_estado': fin['estado'],
                 'fin_nota': fin['nota'], 'fin_pia_capital': fin['piaGastoCapital']}.items():
        db.run(con, 'INSERT INTO meta VALUES (%s,%s)', (k, str(v)))
    con.commit()
    print('Listo:', len(areas), 'áreas,', len(kpis), 'KPIs,', len(inv['investments']), 'inversiones,', len(seen), 'contrataciones')
finally:
    con.close()
