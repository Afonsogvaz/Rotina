/* Rotina 1.0, regras: versões de meta, modos, ciclo, estados e totais do dia. */
'use strict';

const goalById = id => state.goals.find(g => g.id === id);
const catById = id => state.cats.find(c => c.id === id) || null;
const goalsFor = k => state.goals.filter(g => g.createdAt <= k && (!g.archivedAt || k < g.archivedAt));
const weekStart = k => addDays(k, -((parseKey(k).getDay() + 6) % 7));

/* ---------- versões de meta: cada dia usa os parâmetros que valiam nesse dia ---------- */
function paramsFor(g, k) {
  const vs = g.vers;
  let p = vs[0];
  for (let i = 1; i < vs.length; i++) { if (vs[i].from <= k) p = vs[i]; else break; }
  return p;
}

/* ---------- modos (férias, doente, ...) ---------- */
function modeAt(k) {
  let best = null;
  for (const sp of state.spans) {
    if (sp.from <= k && (!sp.to || k <= sp.to) && (!best || sp.from >= best.from)) best = sp;
  }
  if (!best) return null;
  const mode = state.modes.find(m => m.id === best.modeId);
  return mode ? { span: best, mode } : null;
}

function ruleFor(g, k) {                         // 'off' | número (meta alterada) | null (normal)
  const m = modeAt(k);
  if (!m) return null;
  const r = m.mode.rules[g.id];
  if (r === undefined) return m.mode.def === 'off' ? 'off' : null;
  return r === 'normal' ? null : r;
}
const suspended = (g, k) => ruleFor(g, k) === 'off';

function effParams(g, k) {
  const p = paramsFor(g, k);
  const r = ruleFor(g, k);
  return (typeof r === 'number' && g.kind === 'number') ? Object.assign({}, p, { target: r }) : p;
}

function weekSuspended(g, wk) {                  // semana "suspensa": o modo cobre 4 ou mais dias
  let n = 0;
  for (let i = 0; i < 7; i++) if (suspended(g, addDays(wk, i))) n++;
  return n >= 4;
}
const weekApplies = (g, wk) => g.createdAt <= addDays(wk, 6) && (!g.archivedAt || wk < g.archivedAt) && !weekSuspended(g, wk);

/* ---------- ciclo em blocos fixos ----------
   Bloco = dias de treino + dias de pausa (por exemplo 3+1). Se falhas um dia, essa falha passa a ser a
   pausa do bloco e o dia de pausa prevista torna-se dia de treino. "Recomeçar o ciclo" e as mudanças
   de parâmetros abrem um bloco novo. Um modo que suspende o ciclo pára a contagem e, quando acaba,
   o ciclo recomeça no dia 1. "Treino leve" fica registado mas não conta como treino do ciclo. */
function cycleMap(g) {
  const end = todayKey();
  const hit = cycleCache[g.id];
  if (hit && hit.end === end) return hit.map;
  const map = {};
  const anchors = new Set((g.cycleStarts || []).concat(g.vers.map(v => v.from)));
  let idx = 0, done = 0, allowance = 0, on = g.cycleOn, off = g.cycleOff, L = on + off, fresh = true, wasOff = false;
  for (let k = g.createdAt; k <= end; k = addDays(k, 1)) {
    const v = state.logs[k] ? state.logs[k][g.id] : undefined;
    const light = v === 'light';
    if (suspended(g, k)) { map[k] = { type: 'off', light }; wasOff = true; continue; }
    if (fresh || wasOff || idx >= L || anchors.has(k)) {
      const p = paramsFor(g, k);
      on = p.cycleOn; off = p.cycleOff; L = on + off;
      idx = 0; done = 0; allowance = off; fresh = false; wasOff = false;
    }
    if (v === true) { map[k] = { type: 'train', pos: done + 1, on }; done++; }
    else if (v === 'rest') { map[k] = { type: 'rest', kind: 'explicit', light: false }; allowance = Math.max(0, allowance - 1); }
    else if (done >= on) map[k] = { type: 'rest', kind: 'planned', light };
    else if (k === end) map[k] = { type: 'train', pos: done + 1, on, light };
    else if (allowance > 0) { map[k] = { type: 'rest', kind: 'absorbed', light }; allowance--; }
    else map[k] = { type: 'train', pos: done + 1, on, light };
    idx++;
  }
  cycleCache[g.id] = { end, map };
  return map;
}

/* ---------- metas do dia ---------- */
const dayGoals = k => goalsFor(k).filter(g => g.freq !== 'weekly');
const weekGoalsFor = k => goalsFor(k).filter(g => g.freq === 'weekly' && weekApplies(g, weekStart(k)));

function counts(k, g) {                          // esta meta conta para o total do dia k?
  if (g.freq === 'weekly') return false;
  if (suspended(g, k)) return false;
  if (g.freq === 'cycle') { const c = cycleMap(g)[k]; return !c || c.type === 'train'; }
  return true;
}
const countedGoals = k => dayGoals(k).filter(g => counts(k, g));

function sleepMinutes(s) {
  if (!s || !s.bed || !s.wake) return null;
  const [bh, bm] = s.bed.split(':').map(Number);
  const [wh, wm] = s.wake.split(':').map(Number);
  let m = (wh * 60 + wm) - (bh * 60 + bm);
  if (m === 0) return null;
  if (m < 0) m += 1440;
  return m;
}
const fmtDur = m => `${Math.floor(m / 60)}h ${pad(m % 60)}min`;
function sleepHours(k) { const m = sleepMinutes(state.sleep[k]); return m === null ? undefined : Math.round(m / 60 * 100) / 100; }

function wakeMin(k) { const s = state.sleep[k]; if (!s || !s.wake) return undefined; const [h, m] = s.wake.split(':').map(Number); return h * 60 + m; }
function bedMin(k) { const s = state.sleep[k]; return s && s.bed ? bedNorm(s.bed) : undefined; }

function rawVal(k, g) {
  if (g.src === 'sleep') return sleepHours(k);
  if (g.src === 'wake') return wakeMin(k);
  if (g.src === 'bed') return bedMin(k);
  return g.freq === 'weekly' ? (state.weekly[weekStart(k)] || {})[g.id] : (state.logs[k] || {})[g.id];
}
const val = rawVal;

function evalDone(v, g, p) {
  if (g.kind === 'check') return v === true;
  if (typeof v !== 'number') return false;
  return p.cmp === 'max' ? v <= p.target : v >= p.target;
}
const isDone = (k, g) => evalDone(rawVal(k, g), g, effParams(g, k));
const isWeekDone = (wk, g) => evalDone((state.weekly[wk] || {})[g.id], g, paramsFor(g, wk));
const isBad = (k, g) => g.freq !== 'weekly' && g.kind === 'number' && typeof rawVal(k, g) === 'number' && !isDone(k, g);

function setVal(k, g, v) {
  const clear = (v === null || v === undefined || v === false);
  if (g.freq === 'weekly') {
    const wk = weekStart(k);
    const w = state.weekly[wk] || (state.weekly[wk] = {});
    if (clear) delete w[g.id]; else w[g.id] = v;
    if (!Object.keys(w).length) delete state.weekly[wk];
  } else {
    const l = state.logs[k] || (state.logs[k] = {});
    if (clear) delete l[g.id]; else l[g.id] = v;
    if (!Object.keys(l).length) delete state.logs[k];
  }
  save();
}

function isRegistered(k) {
  const l = state.logs[k];
  return !!(state.closed[k] || (l && Object.keys(l).length) || state.sleep[k] || state.checks[k]);
}

function weekRegistered(wk) {
  if (state.weekly[wk]) return true;
  for (let i = 0; i < 7; i++) if (isRegistered(addDays(wk, i))) return true;
  return false;
}

function minDay() {
  const tk = todayKey();
  return state.goals.reduce((m, g) => (g.createdAt < m ? g.createdAt : m), tk);
}

/* ---------- totais ---------- */
function dayInfo(k, catId) {
  const gs = countedGoals(k).filter(g => !catId || g.catId === catId);
  const done = gs.filter(g => isDone(k, g)).length;
  return { done, total: gs.length, pct: gs.length ? done / gs.length : null };
}

function rangeStats(a, b, catId) {               // só conta dias registados
  let d = 0, t = 0, reg = 0;
  for (let k = a; k <= b; k = addDays(k, 1)) {
    if (!isRegistered(k)) continue;
    const di = dayInfo(k, catId);
    if (!di.total) continue;
    d += di.done; t += di.total; reg++;
  }
  return { pct: t ? d / t : null, reg, done: d, total: t };
}
const windowStats = (end, days, catId) => rangeStats(addDays(end, -(days - 1)), end, catId);

function goalRateRange(g, a, b) {
  let d = 0, t = 0;
  for (let k = a; k <= b; k = addDays(k, 1)) {
    if (!isRegistered(k)) continue;
    if (!(g.createdAt <= k && (!g.archivedAt || k < g.archivedAt))) continue;
    if (!counts(k, g)) continue;
    t++; if (isDone(k, g)) d++;
  }
  return { rate: t ? d / t : null, n: t };
}
const goalRate = (g, end, days) => goalRateRange(g, addDays(end, -(days - 1)), end).rate;

const checkAt = k => state.checks[k] || {};
function tiredAvg(k) {
  const c = checkAt(k);
  const a = ['tm', 'ta', 'tn'].map(f => c[f]).filter(x => x !== undefined);
  return a.length ? mean(a) : null;
}
