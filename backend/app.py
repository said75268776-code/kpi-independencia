"""API del Tablero KPI – Independencia (Flask). Devuelve el mismo formato que los JSON de /data,
así el frontend funciona igual con API o sin ella."""
import os
from flask import Flask, jsonify, request
import db

app = Flask(__name__)
ADMIN_KEY = os.getenv('ADMIN_KEY', '')
ORIGINS = [o.strip() for o in os.getenv('CORS_ORIGINS', '*').split(',')]


@app.after_request
def cors(resp):
    origin = request.headers.get('Origin', '')
    if '*' in ORIGINS:
        resp.headers['Access-Control-Allow-Origin'] = '*'
    elif origin in ORIGINS:
        resp.headers['Access-Control-Allow-Origin'] = origin
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS'
    return resp


@app.route('/api/<path:_>', methods=['OPTIONS'])
def preflight(_):
    return ('', 204)


def need_key():
    if not ADMIN_KEY or request.headers.get('X-API-Key') != ADMIN_KEY:
        return jsonify(error='No autorizado'), 401
    return None


def rows(sql, params=()):
    con = db.connect()
    try:
        return db.query(con, sql, params)
    finally:
        con.close()


def metas():
    return {r['clave']: r['valor'] for r in rows('SELECT clave, valor FROM meta')}


@app.get('/api/health')
def health():
    return jsonify(ok=True, motor='mysql' if db.USE_MYSQL else 'sqlite')


@app.get('/api/areas')
def areas():
    return jsonify([{'id': r['id'], 'corto': r['corto'], 'nombre': r['nombre'], 'icono': r['icono'],
                     'responsables': r['responsables'], 'baseLegal': r['base_legal']}
                    for r in rows('SELECT * FROM areas ORDER BY id')])


@app.get('/api/kpis')
def kpis():
    out = []
    for r in rows('SELECT * FROM kpis ORDER BY id'):
        m = rows('SELECT num, den, periodo FROM kpi_mediciones WHERE kpi_id=%s ORDER BY id DESC LIMIT 1', (r['id'],))
        num, den = r['num'], r['den']
        if m:
            num = m[0]['num']
            den = m[0]['den'] if m[0]['den'] is not None else den
        out.append({'id': r['id'], 'areaId': r['area_id'], 'nombre': r['nombre'], 'dimension': r['dimension'],
                    'frecuencia': r['frecuencia'], 'baseLegal': r['base_legal'], 'enlace': r['enlace'],
                    'unidad': r['unidad'], 'formula': r['formula'], 'etiquetaNum': r['etiqueta_num'],
                    'etiquetaDen': r['etiqueta_den'], 'num': num, 'den': den, 'meta': r['meta'],
                    'estrategia': r['estrategia'],
                    'fuente': 'medicion' if m and r['fuente'] == 'ejemplo' else r['fuente'],
                    'periodo': m[0]['periodo'] if m else None})
    return jsonify(out)


@app.get('/api/mediciones')
def ultimas_mediciones():
    # última medición de cada KPI (la que tiene el id más alto)
    return jsonify([{'kpiId': r['kpi_id'], 'periodo': r['periodo'], 'num': r['num'], 'den': r['den']}
                    for r in rows('SELECT m.kpi_id, m.periodo, m.num, m.den FROM kpi_mediciones m '
                                  'JOIN (SELECT kpi_id, MAX(id) AS mid FROM kpi_mediciones GROUP BY kpi_id) x ON x.mid = m.id')])


@app.get('/api/kpis/<kid>/mediciones')
def mediciones(kid):
    return jsonify(rows('SELECT id, periodo, num, den, nota, creado_en FROM kpi_mediciones WHERE kpi_id=%s ORDER BY id DESC', (kid,)))


@app.post('/api/kpis/<kid>/mediciones')
def nueva_medicion(kid):
    bad = need_key()
    if bad:
        return bad
    d = request.get_json(silent=True) or {}
    try:
        num = float(d['num'])
        den = float(d['den']) if d.get('den') not in (None, '') else None
    except (KeyError, ValueError, TypeError):
        return jsonify(error='num es obligatorio y debe ser numérico'), 400
    if not d.get('periodo'):
        return jsonify(error='periodo es obligatorio (ej. 2026-S47)'), 400
    if num < 0 or (den is not None and den <= 0):
        return jsonify(error='valores fuera de rango'), 400
    con = db.connect()
    try:
        if not db.query(con, 'SELECT id FROM kpis WHERE id=%s', (kid,)):
            return jsonify(error='KPI no existe'), 404
        db.run(con, 'INSERT INTO kpi_mediciones (kpi_id, periodo, num, den, nota) VALUES (%s,%s,%s,%s,%s)',
               (kid, str(d['periodo'])[:20], num, den, d.get('nota')))
        con.commit()
    finally:
        con.close()
    return jsonify(ok=True), 201


@app.put('/api/kpis/<kid>')
def editar_kpi(kid):
    bad = need_key()
    if bad:
        return bad
    d = request.get_json(silent=True) or {}
    campos = {k: d[k] for k in ('meta', 'den', 'fuente') if k in d}
    if not campos:
        return jsonify(error='nada que actualizar (meta, den, fuente)'), 400
    con = db.connect()
    try:
        sets = ', '.join(k + '=%s' for k in campos)
        db.run(con, 'UPDATE kpis SET ' + sets + ' WHERE id=%s', tuple(campos.values()) + (kid,))
        con.commit()
    finally:
        con.close()
    return jsonify(ok=True)


ESTADOS = ('pendiente', 'en_proceso', 'entregado')


def entregable_json(r):
    return {'id': r['id'], 'areaId': r['area_id'], 'kpiId': r['kpi_id'], 'titulo': r['titulo'],
            'responsable': r['responsable'], 'semana': r['semana'], 'fechaLimite': r['fecha_limite'],
            'estado': r['estado'], 'nota': r['nota']}


@app.get('/api/entregables')
def entregables():
    return jsonify([entregable_json(r) for r in rows('SELECT * FROM entregables ORDER BY semana DESC, area_id, id')])


@app.post('/api/entregables')
def nuevo_entregable():
    bad = need_key()
    if bad:
        return bad
    d = request.get_json(silent=True) or {}
    estado = d.get('estado') or 'pendiente'
    if not d.get('areaId') or not str(d.get('titulo', '')).strip() or not d.get('semana') or estado not in ESTADOS:
        return jsonify(error='areaId, titulo y semana son obligatorios; estado: ' + ', '.join(ESTADOS)), 400
    con = db.connect()
    try:
        if not db.query(con, 'SELECT id FROM areas WHERE id=%s', (d['areaId'],)):
            return jsonify(error='área no existe'), 404
        new_id = db.run(con, 'INSERT INTO entregables (area_id, kpi_id, titulo, responsable, semana, fecha_limite, estado, nota) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)',
                        (d['areaId'], d.get('kpiId') or None, str(d['titulo']).strip()[:255], (d.get('responsable') or '')[:255],
                         str(d['semana'])[:10], d.get('fechaLimite') or None, estado, d.get('nota')))
        con.commit()
    finally:
        con.close()
    return jsonify(ok=True, id=new_id), 201


@app.put('/api/entregables/<int:eid>')
def editar_entregable(eid):
    bad = need_key()
    if bad:
        return bad
    d = request.get_json(silent=True) or {}
    mapa = {'estado': 'estado', 'nota': 'nota', 'responsable': 'responsable', 'titulo': 'titulo', 'fechaLimite': 'fecha_limite'}
    campos = {mapa[k]: d[k] for k in mapa if k in d}
    if 'estado' in campos and campos['estado'] not in ESTADOS:
        return jsonify(error='estado inválido'), 400
    if not campos:
        return jsonify(error='nada que actualizar'), 400
    con = db.connect()
    try:
        db.run(con, 'UPDATE entregables SET ' + ', '.join(c + '=%s' for c in campos) + ' WHERE id=%s', tuple(campos.values()) + (eid,))
        con.commit()
    finally:
        con.close()
    return jsonify(ok=True)


@app.get('/api/inversiones')
def inversiones():
    inv = [{'cui': r['cui'], 'name': r['nombre'], 'entity': r['entidad'], 'status': r['estado'],
            'costSoles': r['costo'], 'accruedSoles': r['devengado'], 'progressPct': r['avance'],
            'lastUpdate': r['actualizado'], 'url': r['url']} for r in rows('SELECT * FROM inversiones')]
    pro = [{'id': r['id'], 'entity': r['entidad'], 'object': r['objeto'], 'method': r['metodo'],
            'amountSoles': r['monto'], 'date': r['fecha'], 'url': r['url']}
           for r in rows('SELECT * FROM contrataciones ORDER BY fecha DESC')]
    totals = {'count': len(inv), 'costSoles': sum(x['costSoles'] or 0 for x in inv),
              'accruedSoles': sum(x['accruedSoles'] or 0 for x in inv),
              'stalled': sum(1 for x in inv if x['status'] in ('Paralizada', 'Sin avance >12 meses'))}
    return jsonify(investments=inv, procurements=pro, totals=totals, asOf=metas().get('inversiones_asof'))


@app.get('/api/finanzas')
def finanzas():
    m = metas()
    return jsonify(anio=int(m.get('fin_anio', 0) or 0), asOf=m.get('fin_asof'), estado=m.get('fin_estado'),
                   nota=m.get('fin_nota'), piaGastoCapital=float(m.get('fin_pia_capital', 0) or 0),
                   ingresos=rows('SELECT fuente, pia, recaudado FROM fin_ingresos'),
                   gastos=rows('SELECT generica, pia, pim, devengado FROM fin_gastos'),
                   mensual=rows('SELECT mes, ingreso, gasto FROM fin_mensual ORDER BY orden'))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')), debug=os.getenv('DEBUG') == '1')
