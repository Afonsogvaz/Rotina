/* Rotina 1.0, estatísticas: streaks, padrões, sono, cruzamentos, revisões e CSV. */
'use strict';

/* dias com registo, sem o dia de hoje enquanto não estiver fechado (para não enviesar as médias) */
function statDays() {
  const tk = todayKey(), out = [];
  for (let k = minDay(); k <= tk; k = addDays(k, 1)) {
    if (!isRegistered(k)) continue;
    if (k === tk && !state.closed[k]) continue;
    out.push(k);
  }
  return out;
}

function dayPctEx(k, skip) {                       // % do dia sem as metas que `skip` indicar
  const gs = countedGoals(k).filter(g => !skip(g));
  return gs.length ? gs.filter(g => isDone(k, g)).length / gs.length : null;
}

/* ---------- consistência ---------- */
function streakOf(g) {
  const tk = todayKey();
  let run = 0, best = 0;
  if (g.freq === 'weekly') {
    const cur = weekStart(tk);
    for (let wk = weekStart(g.createdAt); wk <= cur; wk = addDays(wk, 7)) {
      if (!weekApplies(g, wk)) continue;
      if (isWeekDone(wk, g)) { run++; best = Math.max(best, run); }
      else if (wk !== cur) run = 0;
    }
    return { cur: run, best, unit: 'semanas' };
  }
  for (let k = g.createdAt; k <= tk; k = addDays(k, 1)) {
    if (g.archivedAt && k >= g.archivedAt) break;
    if (!counts(k, g)) continue;
    if (isDone(k, g)) { run++; best = Math.max(best, run); }
    else if (k === tk && !state.closed[k]) { /* dia em curso */ }
    else run = 0;
  }
  return { cur: run, best, unit: 'dias' };
}

function weeklyRates(g, n) {                       // taxa por semana, da mais antiga para a mais recente
  const tk = todayKey(), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const wk = addDays(weekStart(tk), -7 * i);
    if (g.freq === 'weekly') {
      if (!weekApplies(g, wk) || (i === 0 && !isWeekDone(wk, g)) || !weekRegistered(wk)) { out.push(null); continue; }
      out.push(isWeekDone(wk, g) ? 1 : 0);
    } else {
      const b = addDays(wk, 6) > tk ? tk : addDays(wk, 6);
      out.push(goalRateRange(g, wk, b).rate);
    }
  }
  return out;
}

/* ---------- padrões ---------- */
function weekdayPattern() {
  const acc = Array.from({ length: 7 }, () => ({ d: 0, t: 0, n: 0 }));
  statDays().forEach(k => {
    const di = dayInfo(k);
    if (!di.total) return;
    const i = (parseKey(k).getDay() + 6) % 7;
    acc[i].d += di.done; acc[i].t += di.total; acc[i].n++;
  });
  return acc.map(a => ({ pct: a.t ? a.d / a.t : null, n: a.n }));
}

function keystone() {                              // que meta "puxa" as outras?
  const days = statDays(), items = [];
  state.goals.filter(g => g.freq !== 'weekly').forEach(g => {
    const A = [], B = [];
    days.forEach(k => {
      if (!(g.createdAt <= k && (!g.archivedAt || k < g.archivedAt)) || !counts(k, g)) return;
      const others = countedGoals(k).filter(x => x.id !== g.id);
      if (!others.length) return;
      const pct = others.filter(x => isDone(k, x)).length / others.length;
      (isDone(k, g) ? A : B).push(pct);
    });
    if (A.length >= 5 && B.length >= 5) items.push({ g, withG: mean(A), without: mean(B), lift: mean(A) - mean(B), nA: A.length, nB: B.length });
  });
  items.sort((x, y) => y.lift - x.lift);
  return { items, days: days.length };
}

/* ---------- sono ---------- */
const bedNorm = bed => { const [h, m] = bed.split(':').map(Number); let v = h * 60 + m; if (h < 18) v += 1440; return v - 1080; };
const normClock = v => { const t = ((Math.round(v) + 1080) % 1440 + 1440) % 1440; return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; };
const sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };

function sleepStats() {
  const tk = todayKey(), rows = [];
  for (let i = 0; i < 90; i++) {
    const k = addDays(tk, -i), s = state.sleep[k], m = sleepMinutes(s);
    if (m !== null) rows.push({ i, k, m, bed: bedNorm(s.bed), q: s.q });
  }
  const win = n => rows.filter(r => r.i < n);
  const goal = state.settings.sleepGoal * 60;
  const r14 = win(14), r7 = win(7), r30 = win(30);
  const free = r => { const d = parseKey(r.k).getDay(); return d === 6 || d === 0; };
  const wk = rows.filter(r => !free(r)), we = rows.filter(free);
  const qs = win(30).map(r => r.q).filter(q => q !== undefined);
  return {
    n: rows.length,
    avg7: r7.length ? mean(r7.map(r => r.m)) : null, n7: r7.length,
    avg30: r30.length ? mean(r30.map(r => r.m)) : null, n30: r30.length,
    regularity: r14.length >= 5 ? sd(r14.map(r => r.bed)) : null,
    avgBed: r14.length >= 3 ? mean(r14.map(r => r.bed)) : null,
    debt: r14.length >= 5 ? r14.reduce((s, r) => s + (goal - r.m), 0) : null, nDebt: r14.length,
    week: wk.length >= 3 ? { m: mean(wk.map(r => r.m)), bed: mean(wk.map(r => r.bed)), n: wk.length } : null,
    free: we.length >= 2 ? { m: mean(we.map(r => r.m)), bed: mean(we.map(r => r.bed)), n: we.length } : null,
    quality: qs.length >= 3 ? mean(qs) : null, nq: qs.length
  };
}

/* ---------- cruzamentos (correlações simples, só indícios) ---------- */
function pearson(pairs) {
  const n = pairs.length;
  if (n < 3) return null;
  const mx = mean(pairs.map(p => p[0])), my = mean(pairs.map(p => p[1]));
  let sxx = 0, syy = 0, sxy = 0;
  pairs.forEach(([x, y]) => { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
const strength = r => { const a = Math.abs(r); return a < 0.2 ? 'sem relação clara' : a < 0.4 ? 'relação fraca' : a < 0.6 ? 'relação moderada' : 'relação forte'; };
const fmt2 = n => n.toFixed(2).replace('.', ',');

function corrItem(title, pairs, posText, negText, need) {
  need = need || 15;
  const n = pairs.length;
  if (n < need) return { title, ready: false, n, need };
  const r = pearson(pairs);
  if (r === null) return { title, ready: true, n, text: 'Sem variação suficiente para comparar.', r: null };
  const dir = Math.abs(r) < 0.2 ? '' : (r > 0 ? posText : negText);
  return { title, ready: true, n, r, label: `${strength(r)} (r = ${fmt2(r)}, ${n} dias)`, text: dir };
}

function splitItem(title, A, B, fmt, textFn) {
  const n = Math.min(A.length, B.length);
  if (A.length < 5 || B.length < 5) return { title, ready: false, n, need: 5, nA: A.length, nB: B.length };
  const a = mean(A), b = mean(B);
  return { title, ready: true, n: A.length + B.length, label: `${fmt(a)} vs ${fmt(b)} (${A.length} e ${B.length} dias)`, text: textFn(a, b) };
}

function crossItems() {
  const days = statDays(), noSleep = g => g.src === 'sleep';
  const gyms = state.goals.filter(g => g.freq === 'cycle');
  const items = [];

  items.push(corrItem('Sono e cumprimento do dia',
    days.map(k => [sleepHours(k), dayPctEx(k, noSleep)]).filter(p => p[0] !== undefined && p[1] !== null),
    'Nos dias a seguir a noites mais longas cumpres mais metas.', 'Nos dias a seguir a noites mais longas cumpres menos metas.'));

  const A = [], B = [];
  days.forEach(k => {
    const h = sleepHours(k); if (h === undefined) return;
    const prev = addDays(k, -1);
    if (!gyms.length || !isRegistered(prev)) return;
    (gyms.some(g => isDone(prev, g)) ? A : B).push(h);
  });
  items.push(splitItem('Treino na véspera e sono', A, B, x => fmt1(x) + ' h',
    (a, b) => (Math.abs(a - b) < 0.25 ? 'A diferença é pequena.' : a > b ? 'Dormes mais depois dos dias em que treinas.' : 'Dormes menos depois dos dias em que treinas.')));

  const screen = state.goals.find(g => g.kind === 'number' && !g.src && g.cmp === 'max' && g.unit === 'min');
  items.push(corrItem(screen ? `${screen.name} e hora de deitar` : 'Tempo de ecrã e hora de deitar',
    screen ? days.map(k => {
      const v = (state.logs[addDays(k, -1)] || {})[screen.id], s = state.sleep[k];
      return typeof v === 'number' && s && s.bed ? [v, bedNorm(s.bed) / 60] : null;
    }).filter(Boolean) : [],
    'Mais tempo de ecrã durante o dia vem com deitar-te mais tarde.', 'Mais tempo de ecrã durante o dia vem com deitar-te mais cedo.'));

  items.push(corrItem('Sono e humor',
    days.map(k => [sleepHours(k), checkAt(k).mood]).filter(p => p[0] !== undefined && p[1] !== undefined),
    'Noites mais longas vêm com melhor humor.', 'Noites mais longas vêm com pior humor.'));

  items.push(corrItem('Sono e cansaço',
    days.map(k => [sleepHours(k), tiredAvg(k)]).filter(p => p[0] !== undefined && p[1] !== null),
    'Noites mais longas vêm com mais cansaço ao longo do dia.', 'Noites mais longas vêm com menos cansaço.'));

  items.push(corrItem('Cumprimento do dia e humor',
    days.map(k => [dayPctEx(k, () => false), checkAt(k).mood]).filter(p => p[0] !== null && p[1] !== undefined),
    'Os dias em que cumpres mais metas são também os de melhor humor.', 'Os dias em que cumpres mais metas são os de pior humor.'));
  return items;
}

/* ---------- revisão semanal / mensal ---------- */
function reviewRange(kind, off) {
  const tk = todayKey();
  let a, b, pa, pb, label;
  if (kind === 'w') {
    a = addDays(weekStart(tk), -7 * off); b = addDays(a, 6); pa = addDays(a, -7); pb = addDays(a, -1);
    label = `${shortDate(a)} a ${shortDate(b)}`;
  } else {
    const d = parseKey(tk);
    const first = new Date(d.getFullYear(), d.getMonth() - off, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const pf = new Date(first.getFullYear(), first.getMonth() - 1, 1);
    a = dkey(first); b = dkey(last); pa = dkey(pf); pb = dkey(new Date(pf.getFullYear(), pf.getMonth() + 1, 0));
    label = cap(fmtDate(a, { month: 'long', year: 'numeric' }));
  }
  if (b > tk) b = tk;
  return { a, b, pa, pb, label };
}

function review(kind, off) {
  const R = reviewRange(kind, off);
  const { a, b, pa, pb } = R;
  const cur = rangeStats(a, b), prev = rangeStats(pa, pb);
  const cats = state.cats.map(c => ({ c, cur: rangeStats(a, b, c.id), prev: rangeStats(pa, pb, c.id) })).filter(x => x.cur.total);
  const gs = state.goals.filter(g => g.freq !== 'weekly' && !g.archivedAt || (g.archivedAt && g.archivedAt > a && g.freq !== 'weekly'));
  const goals = gs.map(g => ({ g, cur: goalRateRange(g, a, b), prev: goalRateRange(g, pa, pb) })).filter(x => x.cur.n >= 3);
  const sleepAvg = (x, y) => { const v = []; for (let k = x; k <= y; k = addDays(k, 1)) { const m = sleepMinutes(state.sleep[k]); if (m !== null) v.push(m); } return v.length ? mean(v) : null; };
  const avgOf = (x, y, f) => { const v = []; for (let k = x; k <= y; k = addDays(k, 1)) { const z = f(k); if (z !== undefined && z !== null) v.push(z); } return v.length ? mean(v) : null; };
  const gyms = state.goals.filter(g => g.freq === 'cycle');
  let full = 0, light = 0, modeDays = 0, wDone = 0, wTot = 0;
  for (let k = a; k <= b; k = addDays(k, 1)) {
    gyms.forEach(g => { const v = (state.logs[k] || {})[g.id]; if (v === true) full++; else if (v === 'light') light++; });
    if (modeAt(k)) modeDays++;
  }
  state.goals.filter(g => g.freq === 'weekly').forEach(g => {
    for (let wk = weekStart(a); wk <= b; wk = addDays(wk, 7)) {
      if (addDays(wk, 6) > b && kind === 'w' && off === 0) continue;       // semana ainda em curso
      if (weekApplies(g, wk) && weekRegistered(wk)) { wTot++; if (isWeekDone(wk, g)) wDone++; }
    }
  });
  const out = {
    R, cur, prev, cats, goals,
    sleep: sleepAvg(a, b), sleepPrev: sleepAvg(pa, pb),
    mood: avgOf(a, b, k => checkAt(k).mood), moodPrev: avgOf(pa, pb, k => checkAt(k).mood),
    tired: avgOf(a, b, tiredAvg), tiredPrev: avgOf(pa, pb, tiredAvg),
    full, light, modeDays, wDone, wTot
  };
  // observações automáticas
  const tips = [];
  const hard = goals.filter(x => x.cur.rate !== null && x.cur.rate < 0.8).sort((x, y) => x.cur.rate - y.cur.rate)[0];
  if (hard) tips.push(`"${hard.g.name}" foi a meta mais difícil (${pctTxt(hard.cur.rate)}). Vale a pena ver se o objetivo é realista ou se lhe falta uma hora fixa no dia.`);
  const up = goals.filter(x => x.prev.n >= 3 && x.cur.rate !== null && x.prev.rate !== null).map(x => ({ x, d: x.cur.rate - x.prev.rate })).sort((p, q) => q.d - p.d)[0];
  if (up && up.d >= 0.1) tips.push(`"${up.x.g.name}" melhorou de ${pctTxt(up.x.prev.rate)} para ${pctTxt(up.x.cur.rate)}.`);
  const dn = goals.filter(x => x.prev.n >= 3 && x.cur.rate !== null && x.prev.rate !== null).map(x => ({ x, d: x.cur.rate - x.prev.rate })).sort((p, q) => p.d - q.d)[0];
  if (dn && dn.d <= -0.15) tips.push(`"${dn.x.g.name}" desceu de ${pctTxt(dn.x.prev.rate)} para ${pctTxt(dn.x.cur.rate)}.`);
  if (out.sleep !== null && out.sleep < (state.settings.sleepGoal - 0.5) * 60) tips.push(`Dormiste em média ${fmtDur(Math.round(out.sleep))}, abaixo do teu objetivo de ${fmtNum(state.settings.sleepGoal)} h.`);
  out.tips = tips;
  return out;
}

/* ---------- séries para gráficos ---------- */
function metricOptions() {
  const o = [{ id: 'pct', label: 'Cumprimento do dia (%)' }, { id: 'sleep', label: 'Sono (horas)' }, { id: 'mood', label: 'Humor (1 a 5)' }, { id: 'tired', label: 'Cansaço médio (1 a 5)' }];
  state.goals.filter(g => g.kind === 'number' && !g.src && g.freq !== 'weekly').forEach(g => o.push({ id: 'g:' + g.id, label: `${g.emoji} ${g.name}${g.unit ? ' (' + g.unit + ')' : ''}` }));
  return o;
}

function metricSeries(id, days) {
  const tk = todayKey();
  let a = addDays(tk, -(days - 1));
  if (a < minDay()) a = minDay();
  const pts = [];
  let target = null, unit = '', fixed = null, fmt = v => fmt1(v);
  const g = id.startsWith('g:') ? goalById(id.slice(2)) : null;
  if (g) { target = effParams(g, tk).target; unit = g.unit; }
  if (id === 'pct') { unit = '%'; fixed = [0, 100]; fmt = v => Math.round(v) + '%'; }
  if (id === 'sleep') { unit = 'h'; target = state.settings.sleepGoal; }
  if (id === 'mood' || id === 'tired') fixed = [1, 5];
  for (let k = a; k <= tk; k = addDays(k, 1)) {
    if (!isRegistered(k)) continue;
    let v;
    if (id === 'pct') { const di = dayInfo(k); v = di.total ? di.pct * 100 : undefined; }
    else if (id === 'sleep') v = sleepHours(k);
    else if (id === 'mood') v = checkAt(k).mood;
    else if (id === 'tired') { const t = tiredAvg(k); v = t === null ? undefined : t; }
    else if (g) { const x = (state.logs[k] || {})[g.id]; v = typeof x === 'number' ? x : undefined; }
    if (v !== undefined) pts.push({ k, v });
  }
  return { pts, target, unit, fixed, fmt };
}

/* ---------- CSV (Excel em português: separador ; e vírgula decimal) ---------- */
function csvText() {
  const tk = todayKey();
  const gs = state.goals;
  const cell = v => {
    if (v === undefined || v === null) return '';
    const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = ['data', 'dia_semana', 'modo', 'cumprimento_pct'].concat(gs.map(g => g.name),
    ['sono_deitar', 'sono_acordar', 'sono_horas', 'sono_qualidade', 'humor', 'cansaco_manha', 'cansaco_tarde', 'cansaco_noite', 'nota']);
  const wd = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const rows = [head.map(cell).join(';')];
  for (let k = minDay(); k <= tk; k = addDays(k, 1)) {
    if (!isRegistered(k)) continue;
    const di = dayInfo(k), m = modeAt(k), sl = state.sleep[k] || {}, c = checkAt(k);
    const goalCells = gs.map(g => {
      if (!(g.createdAt <= k && (!g.archivedAt || k < g.archivedAt))) return '';
      if (g.freq === 'weekly') {
        if (parseKey(k).getDay() !== 0) return '';
        const v = (state.weekly[weekStart(k)] || {})[g.id];
        return g.kind === 'check' ? (v === true ? 1 : 0) : (typeof v === 'number' ? v : '');
      }
      if (g.freq === 'cycle') {
        const t = cycleMap(g)[k]; if (!t) return '';
        if (t.type === 'off') return t.light ? 'suspensa (leve)' : 'suspensa';
        if (t.type === 'rest') return t.light ? 'pausa (leve)' : 'pausa';
        return isDone(k, g) ? 'treino' : (t.light ? 'leve' : 'falha');
      }
      if (suspended(g, k)) return 'suspensa';
      const v = rawVal(k, g);
      return g.kind === 'check' ? (v === true ? 1 : 0) : (typeof v === 'number' ? v : '');
    });
    rows.push([k, wd[parseKey(k).getDay()], m ? m.mode.name : '', di.total ? Math.round(di.pct * 100) : ''].concat(goalCells,
      [sl.bed, sl.wake, sleepHours(k), sl.q, c.mood, c.tm, c.ta, c.tn, c.note]).map(cell).join(';'));
  }
  return '﻿' + rows.join('\r\n');
}
