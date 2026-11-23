/* Tablero de Desempeño Municipal – Independencia (demo)
   JS sin dependencias. Lee data/*.json y dibuja las vistas según el hash de la URL. */
(function () {
  'use strict';

  var MDI = 'MUNICIPALIDAD DISTRITAL DE INDEPENDENCIA';
  var ROUTES = ['resumen', 'kpis', 'entregables', 'finanzas', 'inversiones', 'marco', 'notas'];
  var TOLERANCIA = 12; // puntos bajo la meta para "En proceso"

  var S = { areas: [], kpis: [], inv: null, ent: [], med: {}, fin: null, invOpts: { alcance: 'mdi', estado: 'todos', q: '', n: 25 }, marco: [], area: 'todas', estado: 'todos', eEstado: 'todos', eSemana: 'todas', sim: {}, msg: '' };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = $('#view');

  /* ---------- utilidades ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var nf0 = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  function soles(n) { return n == null ? '—' : 'S/ ' + nf0.format(n); }
  function millones(n) { return n == null ? '—' : 'S/ ' + nf2.format(n / 1e6) + ' M'; }
  function pct(n) { return n == null || !isFinite(n) ? '—' : nf1.format(n) + '%'; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function fecha(s) {
    if (!s) return '—';
    var p = String(s).split('-');
    var m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
    return p.length === 3 ? p[2] + ' ' + m[+p[1] - 1] + ' ' + p[0] : p.length === 2 ? m[+p[1] - 1] + ' ' + p[0] : s;
  }
  function areaOf(id) { return S.areas.find(function (a) { return a.id === id; }); }
  function isMDI(x) { return String(x.entity || '').toUpperCase().indexOf(MDI) === 0; }

  /* ---------- KPIs ---------- */
  var ESTADO = {
    optimo: { t: 'Óptimo', c: 'optimo' },
    proceso: { t: 'En proceso', c: 'proceso' },
    critico: { t: 'Crítico', c: 'critico' },
    sin: { t: 'Sin meta', c: '' }
  };

  function realValues(k) {
    var mdi = S.inv.investments.filter(isMDI);
    if (k.id === 'KPI-13') {
      // Referencia: avance financiero acumulado de la cartera de la MDI (devengado / costo actualizado)
      var dev = mdi.reduce(function (s, x) { return s + (x.accruedSoles || 0); }, 0);
      var cost = mdi.reduce(function (s, x) { return s + (x.costSoles || 0); }, 0);
      return { num: dev / 1e6, den: cost / 1e6, meta: null, nota: 'Referencia real: devengado acumulado ÷ costo de la cartera de la MDI (' + mdi.length + ' inversiones, fuente Invierte.pe). No es la fórmula oficial (devengado del año ÷ meta anual), por eso no tiene meta.' };
    }
    if (k.id === 'KPI-14') {
      var pre = mdi.filter(function (x) { return x.status === 'En preinversión'; }).length;
      var exp = mdi.filter(function (x) { return x.status === 'Con expediente técnico'; }).length;
      return { num: exp, den: exp + pre, meta: k.meta, nota: 'Referencia real: inversiones de la MDI que ya tienen expediente técnico ÷ (en preinversión + con expediente). No mide “aprobados en plazo”; es un proxy.' };
    }
    return null;
  }

  function calc(k) {
    var real = k.fuente === 'inversiones' ? realValues(k) : null;
    var num = real ? real.num : k.num;
    var den = real ? real.den : k.den;
    var meta = real ? real.meta : k.meta;
    var m = !real ? S.med[k.id] : null;
    if (m) { num = m.num; if (m.den != null) den = m.den; }
    var sim = S.sim[k.id];
    if (!real && sim != null) num = sim;
    var p = den > 0 ? (num / den) * 100 : null;
    var e = 'sin';
    if (p != null && meta != null) e = p >= meta ? 'optimo' : p >= meta - TOLERANCIA ? 'proceso' : 'critico';
    return { k: k, num: num, den: den, meta: meta, pct: p, estado: e, real: !!real, medido: m || null, nota: real && real.nota, simulado: !real && sim != null };
  }

  function allCalc() { return S.kpis.map(calc); }
  function filtered() {
    return allCalc().filter(function (c) {
      return (S.area === 'todas' || c.k.areaId === S.area) && (S.estado === 'todos' || c.estado === S.estado);
    });
  }

  function badgeFuente(c) {
    if (c.real) return '<span class="badge real">Dato real</span>';
    if (c.medido) return '<span class="badge real">Medición ' + esc(c.medido.periodo || '') + '</span>';
    return '<span class="badge ejemplo">Ejemplo</span>';
  }
  function badgeEstado(e) {
    var s = ESTADO[e];
    return '<span class="badge"><i class="dot ' + s.c + '"></i>' + s.t + '</span>';
  }

  /* ---------- gráficos ---------- */
  function hbar(label, value, max, opts) {
    opts = opts || {};
    var w = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
    var tick = opts.meta != null && max > 0 ? '<span class="meta-tick" style="left:' + clamp((opts.meta / max) * 100, 0, 100) + '%"></span>' : '';
    var tip = opts.tip || label + ': ' + (opts.valTxt || nf1.format(value));
    return '<div class="hb" data-tip="' + esc(tip) + '" tabindex="0">' +
      '<span class="hb-name" title="' + esc(label) + '">' + esc(label) + '</span>' +
      '<span class="track"><span class="fill ' + (opts.cls || '') + '" style="width:' + w + '%"></span>' + tick + '</span>' +
      '<span class="hb-val">' + esc(opts.valTxt || nf1.format(value)) + '</span></div>';
  }


  function colChart(rows) {
    // rows: [{mes, ingreso, gasto}] -> columnas pareadas, un solo eje
    var W = 640, H = 240, L = 44, B = 28, T = 10, R = 8;
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.ingreso, r.gasto); }));
    var top = Math.ceil(max / 2e6) * 2e6;
    var ih = H - B - T, iw = W - L - R, gw = iw / rows.length, bw = Math.min(16, gw / 2 - 3);
    var out = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ingresos y gastos mensuales, millones de soles" style="width:100%;height:auto">';
    for (var t = 0; t <= 4; t++) {
      var v = (top / 4) * t, y = T + ih - (v / top) * ih;
      out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)"/>' +
        '<text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="var(--ink-3)">' + nf0.format(v / 1e6) + '</text>';
    }
    rows.forEach(function (r, i) {
      var cx = L + gw * i + gw / 2;
      [['ingreso', 'var(--water)', -bw - 1], ['gasto', 'var(--dark)', 1]].forEach(function (s) {
        var h = (r[s[0]] / top) * ih;
        out += '<rect x="' + (cx + s[2]) + '" y="' + (T + ih - h) + '" width="' + bw + '" height="' + h + '" rx="3" fill="' + s[1] + '"/>';
      });
      out += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="var(--ink-3)">' + r.mes + '</text>' +
        '<rect x="' + (cx - gw / 2) + '" y="' + T + '" width="' + gw + '" height="' + ih + '" fill="transparent" tabindex="0" data-tip="' +
        esc(r.mes + ' · Ingresos ' + millones(r.ingreso) + ' · Gastos ' + millones(r.gasto)) + '"/>';
    });
    return out + '</svg>';
  }


  /* ---------- vistas ---------- */
  function head(titulo, sub, extra) {
    return '<div class="page-head"><div><h1>' + esc(titulo) + '</h1><p>' + sub + '</p></div>' + (extra || '') + '</div>';
  }


  function kpiCard(c) {
    var k = c.k, a = areaOf(k.areaId);
    var meta = c.meta != null ? c.meta + '%' : 'sin meta';
    var sim = '';
    if (!c.real) {
      sim = '<div class="sim"><h4>Simular valor (solo demo)</h4><div class="sim-row"><span>' + esc(k.etiquetaNum) + '</span><strong class="num" data-sim-val>' + nf0.format(c.num) + '</strong></div>' +
        '<input type="range" min="0" max="' + c.den + '" value="' + c.num + '" step="1" data-sim="' + k.id + '" aria-label="Valor simulado de ' + esc(k.etiquetaNum) + '">' +
        '<div class="sim-row"><span>' + esc(k.etiquetaDen) + '</span><strong class="num">' + nf0.format(c.den) + '</strong></div>' +
        (c.simulado ? '<button type="button" class="btn" data-reset="' + k.id + '">Restablecer valor</button>' : '') + '</div>' +
        (puedeEditar() ? '<form class="sim" data-kform="' + k.id + '"><h4>Registrar medición real</h4><div class="filters">' +
          '<label class="field"><span class="sr-only">Periodo</span><input name="periodo" placeholder="Periodo (2026-S48)" required pattern="\\d{4}-(S\\d{2}|\\d{2})" value="' + esc(semanaIso(new Date())) + '"></label>' +
          '<label class="field"><span class="sr-only">Valor</span><input name="num" type="number" step="any" min="0" placeholder="' + esc(k.etiquetaNum) + '" required></label>' +
          '<label class="field"><span class="sr-only">Clave</span><input type="password" class="key-input" placeholder="Clave" value="' + esc(clave()) + '" autocomplete="off"></label>' +
          '<button type="submit" class="btn primary">Guardar</button></div></form>' : '');
    } else {
      sim = '<div class="callout">' + esc(c.nota) + '</div>';
    }
    return '<details class="kpi" id="' + k.id + '"' + (S.open === k.id ? ' open' : '') + '><summary>' +
      '<span class="kpi-title"><span class="chips"><span class="badge">' + esc(k.id) + '</span>' + badgeFuente(c) + badgeEstado(c.estado) + '</span><h3>' + esc(k.nombre) + '</h3>' +
      '<span class="muted">' + esc(a.corto) + ' · ' + esc(k.dimension) + ' · ' + esc(k.frecuencia) + '</span></span>' +
      '<span><div class="kpi-value">' + pct(c.pct) + '</div><div class="kpi-meta">meta ' + meta + '</div></span></summary>' +
      '<div class="kpi-body"><div>' +
      '<h4>Meta y avance</h4><div class="hbars">' + hbar('Avance', c.pct || 0, 100, { meta: c.meta, valTxt: pct(c.pct), cls: c.estado === 'sin' ? 'lime' : ESTADO[c.estado].c, tip: 'Avance ' + pct(c.pct) + (c.meta != null ? ' · meta ' + c.meta + '%' : '') }) + '</div>' +
      '<div class="legend"><span><i class="tick"></i>Meta propuesta</span></div>' +
      '<h4>Fórmula</h4><p class="formula">' + esc(k.formula) + '</p>' +
      '<h4>Base legal <span class="badge ejemplo">por verificar</span></h4><p>' + esc(k.baseLegal) + (k.enlace ? ' · <a href="' + esc(k.enlace) + '" target="_blank" rel="noopener">enlace</a>' : '') + '</p>' +
      '</div><div>' + sim + '<h4>Unidad responsable</h4><p>' + esc(k.unidad) + '</p><h4>Estrategia</h4><p>' + esc(k.estrategia) + '</p></div></div></details>';
  }

  function vKpis() {
    var cs = filtered();
    var chips = [['todos', 'Todos'], ['optimo', 'Óptimo'], ['proceso', 'En proceso'], ['critico', 'Crítico'], ['sin', 'Sin meta']];
    return head('Matriz de 24 KPIs', 'Semáforo: <strong>Óptimo</strong> si cumple la meta, <strong>En proceso</strong> si está a menos de ' + TOLERANCIA + ' puntos, <strong>Crítico</strong> si está más lejos. Metas propuestas, no oficiales.') +
      '<div class="filters" role="group" aria-label="Filtrar por estado">' + chips.map(function (c) {
        return '<button type="button" class="btn' + (S.estado === c[0] ? ' primary' : '') + '" data-estado="' + c[0] + '" aria-pressed="' + (S.estado === c[0]) + '">' + c[1] + '</button>';
      }).join('') + '<span class="muted">' + cs.length + ' KPIs</span></div>' +
      '<div class="kpi-list">' + (cs.length ? cs.map(kpiCard).join('') : '<div class="empty">Ningún KPI coincide con el filtro.</div>') + '</div>';
  }


  /* ---------- entregables ---------- */
  var ESTADO_E = { pendiente: 'Pendiente', en_proceso: 'En proceso', entregado: 'Entregado', atrasado: 'Atrasado' };
  var DOT_E = { pendiente: '', en_proceso: 'proceso', entregado: 'optimo', atrasado: 'critico' };

  function hoy() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function semanaIso(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return t.getUTCFullYear() + '-S' + String(Math.ceil(((t - y0) / 864e5 + 1) / 7)).padStart(2, '0');
  }
  function estadoE(e) { return e.estado !== 'entregado' && e.fechaLimite && e.fechaLimite < hoy() ? 'atrasado' : e.estado; }
  function badgeE(k) { return '<span class="badge"><i class="dot ' + DOT_E[k] + '"></i>' + ESTADO_E[k] + '</span>'; }
  function entFiltrados() {
    return S.ent.filter(function (e) {
      return (S.area === 'todas' || e.areaId === S.area) && (S.eSemana === 'todas' || e.semana === S.eSemana) && (S.eEstado === 'todos' || estadoE(e) === S.eEstado);
    });
  }
  function puedeEditar() { return !!API && !S.offline; }
  function clave() { try { return sessionStorage.getItem('kpi-key') || ''; } catch (e) { return ''; } }

  function apiCall(method, path, body) {
    return fetch(API + path, { method: method, headers: { 'Content-Type': 'application/json', 'X-API-Key': clave() }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
  }
  function recargarEnt() { return load('entregables').then(function (d) { S.ent = d; rerender(); }); }

  function resumenMuni() {
    var mdi = S.inv.investments.filter(isMDI);
    var dev = mdi.reduce(function (a, x) { return a + (x.accruedSoles || 0); }, 0);
    var cost = mdi.reduce(function (a, x) { return a + (x.costSoles || 0); }, 0);
    var pim = S.fin.gastos.reduce(function (a, x) { return a + x.pim; }, 0);
    var gdev = S.fin.gastos.reduce(function (a, x) { return a + x.devengado; }, 0);
    var lk = ' style="text-decoration:none;color:inherit"';
    return '<div class="grid g-4">' +
      '<a class="card tile" href="#inversiones"' + lk + '><div class="tile-label"><span>Inversiones de la MDI</span><span class="badge real">Real</span></div><div class="tile-value">' + nf0.format(mdi.length) + '</div><div class="tile-note">' + mdi.filter(function (x) { return x.status === 'En ejecución'; }).length + ' en ejecución</div></a>' +
      '<a class="card tile" href="#inversiones"' + lk + '><div class="tile-label"><span>Devengado acumulado</span><span class="badge real">Real</span></div><div class="tile-value">' + nf0.format(dev / 1e6) + '<small>M soles</small></div><div class="tile-note">' + pct(cost ? dev / cost * 100 : null) + ' del costo de la cartera</div></a>' +
      '<a class="card tile" href="#finanzas"' + lk + '><div class="tile-label"><span>Ejecución del gasto</span><span class="badge ejemplo">Ejemplo</span></div><div class="tile-value">' + nf1.format(gdev / pim * 100) + '<small>%</small></div><div class="tile-note">devengado ÷ PIM</div></a>' +
      '<a class="card tile" href="#finanzas"' + lk + '><div class="tile-label"><span>PIM</span><span class="badge ejemplo">Ejemplo</span></div><div class="tile-value">' + nf1.format(pim / 1e6) + '<small>M soles</small></div><div class="tile-note">presupuesto modificado</div></a></div>';
  }

  function vResumen() {
    var cs = filtered(), n = cs.length;
    var cnt = { optimo: 0, proceso: 0, critico: 0, sin: 0 };
    cs.forEach(function (c) { cnt[c.estado]++; });
    var conMeta = n - cnt.sin;
    var semana = semanaIso(new Date());
    var ents = S.ent.filter(function (e) { return S.area === 'todas' || e.areaId === S.area; });
    var deSem = ents.filter(function (e) { return e.semana === semana; });
    var entSem = deSem.filter(function (e) { return e.estado === 'entregado'; }).length;
    var atras = ents.filter(function (e) { return estadoE(e) === 'atrasado'; });

    var porArea = S.areas.map(function (a) {
      var l = allCalc().filter(function (c) { return c.k.areaId === a.id && c.meta != null && c.pct != null; });
      var avg = l.length ? l.reduce(function (s, c) { return s + clamp((c.pct / c.meta) * 100, 0, 100); }, 0) / l.length : null;
      return { a: a, avg: avg, n: l.length };
    }).filter(function (x) { return x.avg != null && (S.area === 'todas' || x.a.id === S.area); });

    var entArea = S.areas.filter(function (a) { return S.area === 'todas' || a.id === S.area; }).map(function (a) {
      var l = S.ent.filter(function (e) { return e.areaId === a.id; });
      return { a: a, tot: l.length, ok: l.filter(function (e) { return e.estado === 'entregado'; }).length };
    }).filter(function (x) { return x.tot > 0; });

    var criticos = cs.filter(function (c) { return c.estado === 'critico'; }).sort(function (a, b) { return (a.pct - a.meta) - (b.pct - b.meta); }).slice(0, 5);

    return head('Dashboard ejecutivo', 'Desempeño por área: KPIs contra meta y entregables semanales. ' +
      '<strong>Los valores con etiqueta “Ejemplo” son cifras ficticias de demostración.</strong>') +
      '<div class="grid g-4">' +
      '<div class="card tile hero"><div class="tile-label"><span>KPIs en Óptimo</span></div><div class="tile-value">' + cnt.optimo + '<small>/ ' + conMeta + '</small></div><div class="tile-note">con meta definida · ' + n + ' KPIs en vista</div></div>' +
      '<div class="card tile"><div class="tile-label"><span>En proceso / Crítico</span></div><div class="tile-value">' + cnt.proceso + ' · ' + cnt.critico + '</div><div class="tile-note">dentro de ' + TOLERANCIA + ' puntos de la meta · fuera</div></div>' +
      '<div class="card tile"><div class="tile-label"><span>Entregables ' + esc(semana) + '</span></div><div class="tile-value">' + entSem + '<small>/ ' + deSem.length + '</small></div><div class="tile-note">entregados esta semana</div></div>' +
      '<div class="card tile"><div class="tile-label"><span>Entregables atrasados</span></div><div class="tile-value">' + atras.length + '</div><div class="tile-note">pasaron su fecha límite sin entregarse</div></div>' +
      '</div>' + resumenMuni() +
      '<div class="grid g-2">' +
      '<section class="card"><h2>Cumplimiento de KPIs por área</h2><p class="sub">Promedio de avance respecto de la meta (tope 100%). Solo KPIs con meta.</p><div class="hbars">' +
      (porArea.length ? porArea.map(function (x) {
        var cls = x.avg >= 90 ? 'optimo' : x.avg >= 75 ? 'proceso' : 'critico';
        return hbar(x.a.corto, x.avg, 100, { valTxt: nf0.format(x.avg) + '%', cls: cls, tip: x.a.nombre + ' · ' + nf0.format(x.avg) + '% sobre ' + x.n + ' KPIs' });
      }).join('') : '<p class="muted">Sin datos para esta vista.</p>') +
      '</div><div class="legend"><span><i style="background:var(--normal)"></i>≥ 90%</span><span><i style="background:var(--atencion)"></i>75–90%</span><span><i style="background:var(--emergencia)"></i>&lt; 75%</span></div></section>' +
      '<section class="card"><h2>Entregables completados por área</h2><p class="sub">Entregados ÷ total registrados.</p><div class="hbars">' +
      (entArea.length ? entArea.map(function (x) {
        var p = x.ok / x.tot * 100;
        return hbar(x.a.corto, p, 100, { valTxt: nf0.format(p) + '%', cls: 'water', tip: x.a.nombre + ' · ' + x.ok + ' de ' + x.tot + ' entregados' });
      }).join('') : '<p class="muted">Aún no hay entregables.</p>') + '</div></section>' +
      '</div>' +
      '<div class="grid g-2">' +
      '<section class="card"><h2>KPIs que requieren atención</h2><p class="sub">Estado Crítico, de mayor a menor brecha.</p><div class="attn-list">' +
      (criticos.length ? criticos.map(function (c) {
        return '<a class="attn" href="#kpis" data-open="' + c.k.id + '"><i class="dot critico"></i><span>' + esc(c.k.nombre) + '<br><small>' + esc(areaOf(c.k.areaId).corto) + ' · ' + esc(c.k.id) + '</small></span><strong class="num">' + pct(c.pct) + ' / ' + c.meta + '%</strong></a>';
      }).join('') : '<p class="muted">No hay KPIs críticos en esta vista.</p>') + '</div></section>' +
      '<section class="card"><h2>Entregables atrasados</h2><p class="sub">Más antiguos primero.</p><div class="attn-list">' +
      (atras.length ? atras.sort(function (a, b) { return String(a.fechaLimite).localeCompare(String(b.fechaLimite)); }).slice(0, 5).map(function (e) {
        return '<a class="attn" href="#entregables"><i class="dot critico"></i><span>' + esc(e.titulo) + '<br><small>' + esc(e.responsable || '—') + ' · límite ' + esc(fecha(e.fechaLimite)) + '</small></span><strong class="num">' + esc(e.semana) + '</strong></a>';
      }).join('') : '<p class="muted">No hay entregables atrasados.</p>') + '</div></section>' +
      '</div>';
  }

  function vEntregables() {
    var list = entFiltrados();
    var semanas = Array.from(new Set(S.ent.map(function (e) { return e.semana; }))).sort().reverse();
    var chips = [['todos', 'Todos'], ['pendiente', 'Pendiente'], ['en_proceso', 'En proceso'], ['entregado', 'Entregado'], ['atrasado', 'Atrasado']];
    var edit = puedeEditar();
    var form = '';
    if (edit) {
      form = '<section class="card"><h2>Registrar y actualizar</h2><p class="sub">Requiere la clave de administración (se guarda solo en esta pestaña).</p>' +
        (S.msg ? '<div class="callout">' + esc(S.msg) + '</div>' : '') +
        '<form id="ent-form" class="filters">' +
        '<label class="field"><span class="sr-only">Clave</span><input type="password" id="ent-key" placeholder="Clave de administración" value="' + esc(clave()) + '" autocomplete="off"></label>' +
        '<label class="field"><span class="sr-only">Área</span><select name="areaId" required>' + S.areas.map(function (a) { return '<option value="' + a.id + '"' + (S.area === a.id ? ' selected' : '') + '>' + esc(a.corto) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span class="sr-only">Entregable</span><input name="titulo" placeholder="Entregable" required maxlength="255"></label>' +
        '<label class="field"><span class="sr-only">Responsable</span><input name="responsable" placeholder="Responsable" maxlength="255"></label>' +
        '<label class="field"><span class="sr-only">Semana</span><input name="semana" placeholder="Semana (ej. 2026-S48)" value="' + esc(semanaIso(new Date())) + '" required pattern="\\d{4}-S\\d{2}"></label>' +
        '<label class="field"><span class="sr-only">Fecha límite</span><input type="date" name="fechaLimite"></label>' +
        '<button type="submit" class="btn primary">Agregar</button></form></section>';
    }
    var rows = list.map(function (e) {
      var k = estadoE(e), a = areaOf(e.areaId);
      var estadoCell = edit
        ? '<select data-ent-estado="' + e.id + '" aria-label="Estado de ' + esc(e.titulo) + '">' + ['pendiente', 'en_proceso', 'entregado'].map(function (s) { return '<option value="' + s + '"' + (e.estado === s ? ' selected' : '') + '>' + ESTADO_E[s] + '</option>'; }).join('') + '</select> ' + (k === 'atrasado' ? badgeE('atrasado') : '')
        : badgeE(k);
      return '<tr><td class="num">' + esc(e.semana) + '</td><td>' + esc(a ? a.corto : e.areaId) + '</td><td class="cell-name">' + esc(e.titulo) + (e.kpiId ? '<br><a href="#kpis" data-open="' + esc(e.kpiId) + '" class="muted">' + esc(e.kpiId) + '</a>' : '') + '</td><td>' + esc(e.responsable || '—') + '</td><td class="num">' + esc(fecha(e.fechaLimite)) + '</td><td>' + estadoCell + '</td></tr>';
    }).join('');
    return head('Entregables semanales', 'Seguimiento de lo que cada área debe entregar. ' + (edit ? 'Conectado a la base de datos: los cambios se guardan.' : 'Modo lectura (sin API): para registrar entregables se necesita el backend.')) +
      form +
      '<section class="card"><div class="filters"><label class="field"><span class="sr-only">Semana</span><select id="ent-semana"><option value="todas">Todas las semanas</option>' +
      semanas.map(function (s) { return '<option' + (S.eSemana === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></label>' +
      chips.map(function (c) { return '<button type="button" class="btn' + (S.eEstado === c[0] ? ' primary' : '') + '" data-eestado="' + c[0] + '" aria-pressed="' + (S.eEstado === c[0]) + '">' + c[1] + '</button>'; }).join('') +
      '<span class="muted">' + list.length + ' entregables</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Semana</th><th>Área</th><th>Entregable</th><th>Responsable</th><th>Límite</th><th>Estado</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6">Sin entregables con este filtro.</td></tr>') + '</tbody></table></div></section>';
  }

  function vFinanzas() {
    var f = S.fin;
    var pia = f.gastos.reduce(function (s, x) { return s + x.pia; }, 0);
    var pim = f.gastos.reduce(function (s, x) { return s + x.pim; }, 0);
    var dev = f.gastos.reduce(function (s, x) { return s + x.devengado; }, 0);
    var iPia = f.ingresos.reduce(function (s, x) { return s + x.pia; }, 0);
    var iRec = f.ingresos.reduce(function (s, x) { return s + x.recaudado; }, 0);
    var tablaM = '<div class="table-wrap"><table><thead><tr><th>Mes</th><th class="r">Ingresos</th><th class="r">Gastos</th></tr></thead><tbody>' +
      f.mensual.map(function (r) { return '<tr><td>' + r.mes + '</td><td class="r">' + soles(r.ingreso) + '</td><td class="r">' + soles(r.gasto) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return head('Finanzas y presupuesto', 'Ingresos, gastos y ejecución presupuestal ' + f.anio + ' (corte ' + esc(fecha(f.asOf)) + ').') +
      '<div class="callout warn">' + esc(f.nota) + '</div>' +
      '<div class="grid g-4">' +
      '<div class="card tile hero"><div class="tile-label"><span>Ejecución del gasto</span></div><div class="tile-value">' + nf1.format(dev / pim * 100) + '<small>%</small></div><div class="tile-note">devengado ÷ PIM</div></div>' +
      '<div class="card tile"><div class="tile-label"><span>PIA</span><span class="badge ejemplo">Ejemplo</span></div><div class="tile-value">' + nf1.format(pia / 1e6) + '<small>M soles</small></div><div class="tile-note">presupuesto inicial</div></div>' +
      '<div class="card tile"><div class="tile-label"><span>PIM</span><span class="badge ejemplo">Ejemplo</span></div><div class="tile-value">' + nf1.format(pim / 1e6) + '<small>M soles</small></div><div class="tile-note">presupuesto modificado</div></div>' +
      '<div class="card tile"><div class="tile-label"><span>Ingresos captados</span><span class="badge ejemplo">Ejemplo</span></div><div class="tile-value">' + nf1.format(iRec / 1e6) + '<small>M soles</small></div><div class="tile-note">' + nf1.format(iRec / iPia * 100) + '% del PIA de ingresos</div></div>' +
      '</div>' +
      '<section class="card"><h2>Ingresos y gastos por mes</h2><p class="sub">Millones de soles.</p>' + colChart(f.mensual) +
      '<div class="legend"><span><i style="background:var(--water)"></i>Ingresos</span><span><i style="background:var(--dark)"></i>Gastos</span></div>' +
      '<details><summary class="muted" style="cursor:pointer">Ver como tabla</summary>' + tablaM + '</details></section>' +
      '<div class="grid g-2">' +
      '<section class="card"><h2>Ejecución del gasto por genérica</h2><p class="sub">Devengado ÷ PIM.</p><div class="hbars">' +
      f.gastos.map(function (g) {
        var p = g.devengado / g.pim * 100;
        return hbar(g.generica, p, 100, { valTxt: nf0.format(p) + '%', cls: 'water', tip: g.generica + ' · devengado ' + millones(g.devengado) + ' de ' + millones(g.pim) });
      }).join('') + '</div></section>' +
      '<section class="card"><h2>Recaudación por fuente</h2><p class="sub">Captado ÷ PIA de ingresos.</p><div class="hbars">' +
      f.ingresos.map(function (g) {
        var p = g.recaudado / g.pia * 100;
        return hbar(g.fuente, p, 100, { valTxt: nf0.format(p) + '%', cls: 'lime', tip: g.fuente + ' · ' + millones(g.recaudado) + ' de ' + millones(g.pia) });
      }).join('') + '</div></section></div>';
  }

  function invRows() {
    var o = S.invOpts;
    var q = o.q.trim().toLowerCase();
    return S.inv.investments.filter(function (x) {
      return (o.alcance === 'todas' || isMDI(x)) && (o.estado === 'todos' || x.status === o.estado) &&
        (!q || x.name.toLowerCase().indexOf(q) >= 0 || String(x.cui).indexOf(q) >= 0);
    }).sort(function (a, b) { return (b.costSoles || 0) - (a.costSoles || 0); });
  }

  function invTable() {
    var rows = invRows(), o = S.invOpts, shown = rows.slice(0, o.n);
    return '<p class="muted">' + nf0.format(rows.length) + ' inversiones · ordenadas por costo</p>' +
      '<div class="table-wrap"><table><thead><tr><th>CUI</th><th>Proyecto</th><th>Entidad</th><th>Estado</th><th class="r">Costo</th><th class="r">Devengado</th><th>Avance</th></tr></thead><tbody>' +
      (shown.length ? shown.map(function (x) {
        var p = x.progressPct || 0;
        return '<tr><td><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.cui) + '</a></td><td class="cell-name">' + esc(x.name) + '</td><td>' + esc(x.entity) + '</td><td>' + esc(x.status) + '</td>' +
          '<td class="r">' + soles(x.costSoles) + '</td><td class="r">' + soles(x.accruedSoles) + '</td><td><div class="mini"><span class="track"><span class="fill water" style="width:' + clamp(p, 0, 100) + '%"></span></span><span class="muted">' + pct(p) + '</span></div></td></tr>';
      }).join('') : '<tr><td colspan="7">Sin resultados.</td></tr>') + '</tbody></table></div>' +
      (rows.length > o.n ? '<button type="button" class="btn" id="inv-more">Mostrar más (' + nf0.format(rows.length - o.n) + ' restantes)</button>' : '');
  }

  function vInversiones() {
    var o = S.invOpts, t = S.inv.totals;
    var estados = Array.from(new Set(S.inv.investments.map(function (x) { return x.status; }))).sort();
    var seen = {};
    var procs = S.inv.procurements.filter(function (p) { if (seen[p.id]) return false; seen[p.id] = 1; return true; })
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    return head('Inversiones y contrataciones', 'Proyectos en el distrito (Invierte.pe) y procesos de contratación (OSCE). <span class="badge real">Datos reales</span> con corte al ' + esc(fecha(S.inv.asOf)) + '.') +
      '<div class="grid g-4">' +
      '<div class="card tile"><div class="tile-label"><span>Inversiones en el distrito</span></div><div class="tile-value">' + nf0.format(t.count) + '</div><div class="tile-note">todas las entidades</div></div>' +
      '<div class="card tile"><div class="tile-label"><span>Costo total</span></div><div class="tile-value">' + nf1.format(t.costSoles / 1e9) + '<small>mil M soles</small></div><div class="tile-note">suma de costos actualizados</div></div>' +
      '<div class="card tile"><div class="tile-label"><span>Devengado acumulado</span></div><div class="tile-value">' + nf0.format(t.accruedSoles / 1e6) + '<small>M soles</small></div><div class="tile-note">' + pct(t.accruedSoles / t.costSoles * 100) + ' del costo</div></div>' +
      '<div class="card tile"><div class="tile-label"><span>Paralizadas</span></div><div class="tile-value">' + t.stalled + '</div><div class="tile-note">según Invierte.pe</div></div></div>' +
      '<section class="card"><h2>Proyectos de inversión</h2>' +
      '<div class="filters"><label class="field"><span class="sr-only">Alcance</span><select id="inv-alcance"><option value="mdi"' + (o.alcance === 'mdi' ? ' selected' : '') + '>Solo Municipalidad de Independencia</option><option value="todas"' + (o.alcance === 'todas' ? ' selected' : '') + '>Todas las entidades</option></select></label>' +
      '<label class="field"><span class="sr-only">Estado</span><select id="inv-estado"><option value="todos">Todos los estados</option>' + estados.map(function (e) { return '<option' + (o.estado === e ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span class="sr-only">Buscar</span><input type="search" id="inv-q" placeholder="Buscar por nombre o CUI" value="' + esc(o.q) + '"></label></div>' +
      '<div id="inv-table">' + invTable() + '</div></section>' +
      '<section class="card"><h2>Contrataciones públicas</h2><p class="sub">' + procs.length + ' procesos (sin duplicados), más recientes primero. Fuente: OSCE – Contrataciones Abiertas.</p>' +
      '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Objeto</th><th>Entidad</th><th>Método</th><th class="r">Monto</th></tr></thead><tbody>' +
      procs.map(function (p) {
        return '<tr><td class="num">' + esc(fecha(p.date)) + '</td><td class="cell-name"><a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.object) + '</a></td><td>' + esc(p.entity) + '</td><td>' + esc(p.method) + '</td><td class="r">' + soles(p.amountSoles) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }


  function vMarco() {
    return head('Marco legal', 'Normas que sustentan los KPIs (Ley N.° 27972, Ley Orgánica de Municipalidades, y sus modificaciones). <span class="badge ejemplo">por verificar</span> Contrasta cada ficha con la norma oficial antes de citarla.') +
      '<div class="grid g-2">' + S.marco.map(function (law) {
        var badges = (law.relatedKpis || []).map(function (id) {
          var k = S.kpis.find(function (x) { return x.id === id; });
          return k ? '<a class="badge" href="#kpis" data-open="' + esc(id) + '">' + esc(id) + ' · ' + pct(calc(k).pct) + '</a>' : '';
        }).join('');
        return '<section class="card"><div class="chips"><span class="badge">' + esc(law.code) + '</span><span class="muted">' + esc(law.date) + '</span></div>' +
          '<h2>' + esc(law.title) + '</h2><p class="formula">' + esc(law.articlesModified) + '</p>' +
          '<ul class="notes">' + (law.keyChanges || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
          '<h4 class="muted">KPIs vinculados</h4><div class="chips">' + badges + '</div>' +
          (law.sourceUrl ? '<a href="' + esc(law.sourceUrl) + '" target="_blank" rel="noopener">Ver fuente</a>' : '') + '</section>';
      }).join('') + '</div>';
  }

  function vNotas() {
    return head('Fuentes y notas', 'Qué es real, qué es ejemplo y cómo completar los datos.') +
      '<div class="grid g-2"><section class="card"><h2>Qué es real</h2><ul class="notes">' +
      '<li>La estructura: 8 áreas y 24 KPIs con fórmula, unidad responsable y estrategia, tomados del documento de trabajo.</li>' +
      '<li>KPI-13 y KPI-14: se calculan con inversiones públicas reales de la MDI (Invierte.pe, corte ' + esc(fecha(S.inv.asOf)) + ') como referencia, no con la fórmula oficial.</li>' +
      '<li>Inversiones y contrataciones (Invierte.pe y OSCE, corte ' + esc(fecha(S.inv.asOf)) + ').</li>' +
      '<li>Lo que se registre desde “Entregables” o desde un KPI queda guardado en la base de datos.</li></ul></section>' +
      '<section class="card"><h2>Qué es ejemplo</h2><ul class="notes">' +
      '<li>Los valores de los otros 22 KPIs, los entregables iniciales y todo lo de Finanzas son ficticios (salvo el PIA de gasto de capital, por verificar).</li>' +
      '<li>Las metas son propuestas, no aprobadas por la municipalidad.</li>' +
      '<li>Las bases legales vienen de un documento de trabajo y están por verificar.</li></ul></section></div>' +
      '<section class="card"><h2>Cómo reemplazar datos</h2><ul class="notes">' +
      '<li>Valores de un KPI: <code>POST /api/kpis/&lt;id&gt;/mediciones</code> con el periodo y el valor. La última medición es la vigente.</li>' +
      '<li>Entregables: desde la vista Entregables, o <code>POST /api/entregables</code>.</li>' +
      '<li>Datos que se pueden obtener de fuentes públicas: ejecución presupuestal (MEF), inversiones (Invierte.pe), obras (Infobras), transparencia estándar. El resto lo tiene que entregar cada área.</li></ul></section>' +
      '<p class="muted">Demo académica. No es un sitio oficial de la Municipalidad Distrital de Independencia.</p>';
  }


  /* ---------- router ---------- */
  var VIEWS = { resumen: vResumen, kpis: vKpis, entregables: vEntregables, finanzas: vFinanzas, inversiones: vInversiones, marco: vMarco, notas: vNotas };

  function route() {
    var r = (location.hash || '#resumen').slice(1);
    if (ROUTES.indexOf(r) < 0) r = 'resumen';
    document.querySelectorAll('#nav a').forEach(function (a) {
      if (a.dataset.route === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('.area-filter').hidden = !(r === 'resumen' || r === 'kpis' || r === 'entregables');
    view.innerHTML = VIEWS[r]();
    S.route = r;
    document.title = 'KPI Independencia · ' + ({ resumen: 'Resumen', kpis: 'KPIs', entregables: 'Entregables', finanzas: 'Finanzas', inversiones: 'Inversiones', marco: 'Marco legal', notas: 'Notas' })[r];
    closeMenu();
    if (S.open) { var el = document.getElementById(S.open); if (el) el.scrollIntoView({ block: 'center' }); S.open = null; }
  }

  function rerender() { var y = window.scrollY; view.innerHTML = VIEWS[S.route](); window.scrollTo(0, y); }


  /* ---------- menú móvil ---------- */
  function openMenu() { $('#sidebar').classList.add('open'); $('#scrim').hidden = false; $('#menu-open').setAttribute('aria-expanded', 'true'); }
  function closeMenu() { $('#sidebar').classList.remove('open'); $('#scrim').hidden = true; $('#menu-open').setAttribute('aria-expanded', 'false'); }

  /* ---------- tooltip ---------- */
  var tip = $('#tip');
  function showTip(el, x, y) {
    tip.textContent = el.getAttribute('data-tip');
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = clamp(x + 12, 8, window.innerWidth - w - 8) + 'px';
    tip.style.top = clamp(y + 14, 8, window.innerHeight - h - 8) + 'px';
  }
  document.addEventListener('mousemove', function (e) {
    var el = e.target.closest && e.target.closest('[data-tip]');
    if (el) showTip(el, e.clientX, e.clientY); else tip.hidden = true;
  });
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('[data-tip]');
    if (el) { var b = el.getBoundingClientRect(); showTip(el, b.left + 12, b.top); }
  });
  document.addEventListener('focusout', function () { tip.hidden = true; });


  /* ---------- eventos ---------- */
  function saveSim() { try { localStorage.setItem('kpi-sim', JSON.stringify(S.sim)); } catch (e) { /* sin storage */ } }

  view.addEventListener('click', function (e) {
    var t = e.target;
    var est = t.closest('[data-estado]');
    if (est) { S.estado = est.dataset.estado; rerender(); return; }
    var ee = t.closest('[data-eestado]');
    if (ee) { S.eEstado = ee.dataset.eestado; rerender(); return; }
    var rs = t.closest('[data-reset]');
    if (rs) { e.preventDefault(); delete S.sim[rs.dataset.reset]; saveSim(); S.open = rs.dataset.reset; rerender(); var d = document.getElementById(rs.dataset.reset); if (d) d.open = true; return; }
    var op = t.closest('[data-open]');
    if (op) { S.open = op.dataset.open; S.estado = 'todos'; }
    if (t.id === 'inv-more') { S.invOpts.n += 50; $('#inv-table').innerHTML = invTable(); }
  });
  view.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.sim) {
      S.sim[t.dataset.sim] = +t.value; saveSim();
      var d = t.closest('details'), c = calc(S.kpis.find(function (k) { return k.id === t.dataset.sim; }));
      t.parentNode.querySelector('[data-sim-val]').textContent = nf0.format(c.num);
      d.querySelector('.kpi-value').textContent = pct(c.pct);
      var f = d.querySelector('.fill'); f.style.width = clamp(c.pct, 0, 100) + '%'; f.className = 'fill ' + (c.estado === 'sin' ? 'lime' : ESTADO[c.estado].c);
      d.querySelector('summary .chips').lastElementChild.outerHTML = badgeEstado(c.estado);
    } else if (t.id === 'inv-q') { S.invOpts.q = t.value; S.invOpts.n = 25; $('#inv-table').innerHTML = invTable();
    } else if (t.classList && t.classList.contains('key-input')) {
      try { sessionStorage.setItem('kpi-key', t.value); } catch (err) { /* sin storage */ }
    } else if (t.id === 'ent-key') {
      try { sessionStorage.setItem('kpi-key', t.value); } catch (err) { /* sin storage */ }
    }
  });
  view.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.sim) rerender(); // refresca el botón "Restablecer"
    if (t.id === 'inv-alcance') { S.invOpts.alcance = t.value; S.invOpts.n = 25; $('#inv-table').innerHTML = invTable(); }
    if (t.id === 'inv-estado') { S.invOpts.estado = t.value; S.invOpts.n = 25; $('#inv-table').innerHTML = invTable(); }
    if (t.id === 'ent-semana') { S.eSemana = t.value; rerender(); }
    if (t.dataset && t.dataset.entEstado) {
      apiCall('PUT', '/api/entregables/' + t.dataset.entEstado, { estado: t.value })
        .then(function () { S.msg = 'Estado actualizado.'; return recargarEnt(); })
        .catch(function (err) { S.msg = 'No se pudo guardar: ' + err.message; recargarEnt(); });
    }
  });
  view.addEventListener('submit', function (e) {
    var kf = e.target.dataset && e.target.dataset.kform;
    if (kf) {
      e.preventDefault();
      var el = e.target.elements;
      apiCall('POST', '/api/kpis/' + kf + '/mediciones', { periodo: el.periodo.value, num: +el.num.value })
        .then(function () { delete S.sim[kf]; saveSim(); S.open = kf; return load('mediciones'); })
        .then(function (d) { S.med = medMap(d); S.msg = ''; rerender(); var x = document.getElementById(kf); if (x) x.open = true; })
        .catch(function (err) { alert('No se pudo guardar: ' + err.message); });
      return;
    }
    if (e.target.id !== 'ent-form') return;
    e.preventDefault();
    var f = e.target, b = {};
    ['areaId', 'titulo', 'responsable', 'semana', 'fechaLimite'].forEach(function (k) { b[k] = f.elements[k].value; });
    apiCall('POST', '/api/entregables', b)
      .then(function () { S.msg = 'Entregable agregado.'; return recargarEnt(); })
      .catch(function (err) { S.msg = 'No se pudo guardar: ' + err.message; rerender(); });
  });
  $('#area-filter').addEventListener('change', function (e) { S.area = e.target.value; rerender(); });
  $('#menu-open').addEventListener('click', openMenu);
  $('#scrim').addEventListener('click', closeMenu);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('hashchange', function () { route(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });

  /* ---------- arranque ---------- */
  var API = ((window.KPI_CONFIG || {}).API_BASE || '').replace(/\/$/, '');
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + ' → ' + r.status); return r.json(); }); }
  /* Catálogos (áreas, KPIs, inversiones, finanzas, marco legal) salen de los archivos de /data.
     Solo lo que se llena desde la página (mediciones y entregables) pasa por la API/base de datos. */
  function fromFile(name) { return getJSON('data/' + name + '.json'); }
  function load(name) {
    if (!API) return name === 'mediciones' ? Promise.resolve([]) : fromFile(name);
    return getJSON(API + '/api/' + name).catch(function () { S.offline = true; return name === 'mediciones' ? [] : fromFile(name); });
  }
  function medMap(list) { var m = {}; list.forEach(function (x) { m[x.kpiId] = x; }); return m; }

  Promise.all([fromFile('areas'), fromFile('kpis'), fromFile('inversiones'), fromFile('finanzas'), fromFile('marco_legal'), load('entregables'), load('mediciones')])
    .then(function (d) {
      S.areas = d[0]; S.kpis = d[1]; S.inv = d[2]; S.fin = d[3]; S.marco = d[4]; S.ent = d[5]; S.med = medMap(d[6]);
      try { S.sim = JSON.parse(localStorage.getItem('kpi-sim') || '{}') || {}; } catch (e) { S.sim = {}; }
      $('#area-filter').innerHTML = '<option value="todas">Todas las áreas</option>' + S.areas.map(function (a) { return '<option value="' + a.id + '">' + esc(a.corto) + '</option>'; }).join('');
      $('#asof').textContent = API ? (S.offline ? 'Sin API (datos locales de ejemplo)' : 'Conectado a la base de datos') : 'Demo con datos de ejemplo';
      route();
    })
    .catch(function (err) {
      view.innerHTML = '<div class="empty"><strong>No se pudieron cargar los datos.</strong><br>' + esc(err.message) +
        '<br><br>Abre el sitio con un servidor local (por ejemplo <code>npx serve .</code> o Live Server) en lugar de abrir el archivo directamente.</div>';
    });
})();
