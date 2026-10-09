/* Rotina 1.0, gráficos em SVG (sem bibliotecas). As cores vêm do CSS, por isso respeitam o modo escuro. */
'use strict';

function lineChart(series) {
  const { pts, target, unit, fixed, fmt, tfmt } = series;
  if (pts.length < 2) return '<p class="cap">Ainda há poucos registos para desenhar a evolução (precisas de 2 dias ou mais).</p>';
  const W = 340, H = 180, L = 38, R = 10, T = 12, B = 26;
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  if (target !== null && target !== undefined) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
  if (fixed) { lo = fixed[0]; hi = fixed[1]; }
  else { const padv = (hi - lo) * 0.12 || Math.max(1, hi * 0.1); lo = Math.max(0, lo - padv); hi = hi + padv; }
  const t0 = pts[0].k, t1 = pts[pts.length - 1].k, span = Math.max(1, daysBetween(t0, t1));
  const x = k => L + (W - L - R) * (daysBetween(t0, k) / span);
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const ticks = [lo, (lo + hi) / 2, hi];
  const f = fmt || (v => fmt1(v));
  let g = ticks.map(v => `<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="ch-txt" x="${L - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${esc(f(v))}</text>`).join('');
  if (target !== null && target !== undefined) {
    g += `<line class="ch-target" x1="${L}" x2="${W - R}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}"/><text class="ch-txt tg" x="${W - R}" y="${(y(target) - 4).toFixed(1)}" text-anchor="end">objetivo ${esc(tfmt ? tfmt(target) : fmtNum(target))}${!tfmt && unit && unit !== '%' ? ' ' + esc(unit) : ''}</text>`;
  }
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.k).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const dots = pts.length <= 45 ? pts.map(p => `<circle class="ch-dot" cx="${x(p.k).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3"><title>${esc(shortDate(p.k))}: ${esc(f(p.v))}</title></circle>`).join('') : '';
  const lastP = pts[pts.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução de ${esc(shortDate(t0))} a ${esc(shortDate(t1))}, último valor ${esc(f(lastP.v))}">
    ${g}<path class="ch-line" d="${path}"/>${dots}
    <text class="ch-txt" x="${L}" y="${H - 6}">${esc(shortDate(t0))}</text><text class="ch-txt" x="${W - R}" y="${H - 6}" text-anchor="end">${esc(shortDate(t1))}</text></svg>`;
}

function barChart(items, opts) {                    // items: [{label, v (0..1 | null), n}]
  const W = 340, H = 150, T = 18, B = 24, gap = 10;
  const bw = (W - gap * (items.length + 1)) / items.length;
  const best = Math.max(...items.map(i => (i.v === null ? -1 : i.v)));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts && opts.label || 'Gráfico de barras')}">` +
    items.map((it, i) => {
      const x = gap + i * (bw + gap), h = it.v === null ? 0 : (H - T - B) * it.v, y = H - B - h;
      return `<rect class="ch-bar ${it.v === best && best > 0 ? 'hi' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, it.v === null ? 0 : 2).toFixed(1)}" rx="5"><title>${esc(it.label)}: ${esc(pctTxt(it.v))} (${it.n} dias)</title></rect>
        <text class="ch-txt" x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(it.label)}</text>
        <text class="ch-txt v" x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${it.v === null ? '' : Math.round(it.v * 100)}</text>`;
    }).join('') + '</svg>';
}

function sparkBars(vals) {                          // mini barras (0..1 | null)
  return `<span class="spark" aria-hidden="true">${vals.map(v => `<i class="${v === null ? 'nil' : ''}" style="height:${v === null ? 4 : Math.max(4, Math.round(v * 26))}px"></i>`).join('')}</span>`;
}
