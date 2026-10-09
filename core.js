/* Rotina 1.0, núcleo: constantes, utilitários, estado e migração de dados.
   Sem dependências e sem servidor: tudo fica guardado neste telemóvel (localStorage).
   Os ficheiros são scripts simples que partilham o mesmo âmbito (ordem em index.html). */
'use strict';

const KEY = 'rotina:v1';                  // (o nome da chave mantém-se; a versão dos dados vai em state.v)
const BAK_KEY = 'rotina:bak-v2';          // cópia automática feita antes de migrar dados antigos
const SCHEMA = 3;
const APP_VERSION = '1.0';
const ROUTINE_START = '2026-10-06';       // dia em que a rotina nova começou
const EMOJIS = ['🌅','📰','📚','📖','🌙','📵','🏋️','⚽','🏃','🧘','💧','🥗','☕','🧠','✍️','🎸','🎧','🌿','⏰','🎯','🤝','🧹','🛏️','🍎'];
const CAT_COLORS = ['#3A5BD9', '#D9A03A', '#3E9B6B', '#D4574E', '#8A5BD0', '#2F9AA8', '#D4579B', '#7A859C'];
const MOODS = ['😞', '🙁', '😐', '🙂', '😄'];
const SLOTS = [['tm', 'Manhã'], ['ta', 'Tarde'], ['tn', 'Noite']];
const MONTHS3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const DEFAULT_CATS = [
  { id: 'corpo', name: 'Corpo', emoji: '💪', color: CAT_COLORS[0] },
  { id: 'sono', name: 'Sono', emoji: '🌙', color: CAT_COLORS[4] },
  { id: 'mente', name: 'Mente', emoji: '🧠', color: CAT_COLORS[1] },
  { id: 'digital', name: 'Digital', emoji: '📵', color: CAT_COLORS[5] },
  { id: 'trabalho', name: 'Trabalho', emoji: '💼', color: CAT_COLORS[2] }
];
const SEED_CAT = {
  'Sem telemóvel ao acordar': 'digital', 'Notícias ao almoço (15 min)': 'mente', 'Ler nos tempos mortos': 'mente',
  'Ler 30 min antes de dormir': 'mente', 'Deitar por volta das 23h45': 'sono', 'Tempo viciante no ecrã': 'digital',
  'Ginásio': 'corpo', 'Desporto coletivo': 'corpo', 'Dormir o suficiente': 'sono'
};

const ICON = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  prev:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
  next:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5L16 12l-6.5 6.5"/></svg>',
  up:    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14.5l6-6 6 6"/></svg>',
  down:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>'
};

/* ======================= utilitários ======================= */
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
const isKey = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const parseNum = s => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmtNum = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ','));
const fmt1 = n => String(Math.round(n * 10) / 10).replace('.', ',');
const pctTxt = p => (p === null || p === undefined ? '—' : Math.round(p * 100) + '%');
const oneEmoji = s => Array.from((s || '').trim() || '🎯').slice(0, 2).join('');
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const shortDate = k => `${parseKey(k).getDate()} ${MONTHS3[parseKey(k).getMonth()]}`;
const inRange = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi;

function fmtDate(k, opts) {
  try { return new Intl.DateTimeFormat('pt-PT', opts).format(parseKey(k)); }
  catch (e) { return k; }
}

/* ======================= estado ======================= */
const todayKeyFor = rollover => dkey(new Date(Date.now() - rollover * 3600000));

function newState() {
  return {
    v: SCHEMA,
    settings: { rollover: 4, sleepGoal: 8, lastBackup: null },
    cats: [], goals: [], logs: {}, weekly: {}, sleep: {}, checks: {}, modes: [], spans: [], closed: {}
  };
}

const PARAM_KEYS = ['target', 'cmp', 'unit', 'step', 'cycleOn', 'cycleOff'];

function cleanVer(v, number) {
  const span = (n, d) => { n = Math.round(Number(n)); return n >= 1 && n <= 14 ? n : d; };
  return {
    from: v.from,
    target: number ? (Number(v.target) || 0) : null,
    cmp: v.cmp === 'min' ? 'min' : 'max',
    unit: String(v.unit || '').slice(0, 10),
    step: Number(v.step) > 0 ? Number(v.step) : 1,
    cycleOn: span(v.cycleOn, 3),
    cycleOff: span(v.cycleOff, 1)
  };
}

function cleanGoal(g) {
  const src = g.src === 'sleep' ? 'sleep' : null;
  const freq = src ? 'daily' : (g.freq === 'weekly' || g.freq === 'cycle' ? g.freq : 'daily');
  const number = src ? true : (g.kind === 'number' && freq !== 'cycle');
  const createdAt = isKey(g.createdAt) ? g.createdAt : todayKeyFor(4);
  let vers = Array.isArray(g.vers) ? g.vers.filter(v => isObj(v) && isKey(v.from)).map(v => cleanVer(v, number)) : [];
  if (!vers.length) vers = [cleanVer(Object.assign({}, g, { from: createdAt }), number)];
  vers.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const cur = vers[vers.length - 1];
  return {
    id: String(g.id),
    name: String(g.name).slice(0, 60),
    emoji: oneEmoji(g.emoji),
    catId: typeof g.catId === 'string' ? g.catId : null,
    kind: number ? 'number' : 'check',
    freq, src,
    target: cur.target, cmp: cur.cmp, unit: cur.unit, step: cur.step, cycleOn: cur.cycleOn, cycleOff: cur.cycleOff,
    vers,
    cycleStarts: Array.isArray(g.cycleStarts) ? g.cycleStarts.filter(isKey).sort() : [],
    createdAt,
    archivedAt: isKey(g.archivedAt) ? g.archivedAt : null
  };
}

function cleanCat(c) {
  return { id: String(c.id), name: String(c.name).slice(0, 30), emoji: oneEmoji(c.emoji), color: CAT_COLORS.includes(c.color) ? c.color : CAT_COLORS[7] };
}

function cleanMode(m) {
  const rules = {};
  if (isObj(m.rules)) Object.keys(m.rules).forEach(id => {
    const r = m.rules[id];
    if (r === 'off' || r === 'normal') rules[id] = r;
    else if (typeof r === 'number' && Number.isFinite(r) && r >= 0) rules[id] = r;
  });
  return { id: String(m.id), name: String(m.name).slice(0, 30), emoji: oneEmoji(m.emoji), def: m.def === 'off' ? 'off' : 'normal', rules };
}

function cleanChecks(c) {
  const out = {};
  if (!isObj(c)) return out;
  Object.keys(c).forEach(k => {
    if (!isKey(k) || !isObj(c[k])) return;
    const o = {};
    ['mood', 'tm', 'ta', 'tn'].forEach(f => { const n = Math.round(Number(c[k][f])); if (inRange(n, 1, 5)) o[f] = n; });
    if (typeof c[k].note === 'string' && c[k].note.trim()) o.note = c[k].note.slice(0, 500);
    if (Object.keys(o).length) out[k] = o;
  });
  return out;
}

function cleanSleep(s) {
  const out = {};
  if (!isObj(s)) return out;
  const t = x => (typeof x === 'string' && /^\d{2}:\d{2}$/.test(x) ? x : null);
  Object.keys(s).forEach(k => {
    if (!isKey(k) || !isObj(s[k])) return;
    const o = {};
    if (t(s[k].bed)) o.bed = s[k].bed;
    if (t(s[k].wake)) o.wake = s[k].wake;
    const q = Math.round(Number(s[k].q));
    if (inRange(q, 1, 5)) o.q = q;
    if (Object.keys(o).length) out[k] = o;
  });
  return out;
}

function normalize(s) {
  const base = newState();
  const st = isObj(s && s.settings) ? s.settings : {};
  const fromV = Number(s && s.v) || 1;
  base.settings.rollover = Number.isFinite(Number(st.rollover)) ? Math.min(8, Math.max(0, Number(st.rollover))) : 4;
  base.settings.sleepGoal = Number(st.sleepGoal) >= 4 && Number(st.sleepGoal) <= 12 ? Number(st.sleepGoal) : 8;
  base.settings.lastBackup = typeof st.lastBackup === 'string' ? st.lastBackup : null;
  const today = todayKeyFor(base.settings.rollover);

  base.cats = Array.isArray(s && s.cats) ? s.cats.filter(c => c && c.id && c.name).map(cleanCat) : [];
  base.goals = Array.isArray(s && s.goals) ? s.goals.filter(g => g && g.id && g.name).map(cleanGoal) : [];
  base.logs = isObj(s && s.logs) ? s.logs : {};
  base.weekly = isObj(s && s.weekly) ? s.weekly : {};
  base.sleep = cleanSleep(s && s.sleep);
  base.checks = cleanChecks(s && s.checks);
  base.closed = isObj(s && s.closed) ? s.closed : {};

  // v1 -> v2: acrescenta uma só vez o ginásio (ciclo) e o desporto coletivo (semanal).
  if (fromV < 2 && base.goals.length && !base.goals.some(g => g.freq !== 'daily')) {
    base.goals = base.goals.concat(phase2Goals(today).map(cleanGoal));
  }
  // v2 -> v3: categorias, meta de sono automática e modos de exemplo.
  if (fromV < 3) {
    base.cats = DEFAULT_CATS.map(c => Object.assign({}, c));
    base.goals.forEach(g => { if (!g.catId && SEED_CAT[g.name]) g.catId = SEED_CAT[g.name]; });
    if (base.goals.length && !base.goals.some(g => g.src === 'sleep')) {
      base.goals.push(cleanGoal(sleepGoalDef(today, base.settings.sleepGoal)));
    }
    base.modes = seedModes(base.goals);
  } else {
    base.modes = Array.isArray(s && s.modes) ? s.modes.filter(m => m && m.id && m.name).map(cleanMode) : [];
  }
  base.goals.forEach(g => { if (g.catId && !base.cats.some(c => c.id === g.catId)) g.catId = null; });
  base.spans = Array.isArray(s && s.spans)
    ? s.spans.filter(p => p && isKey(p.from) && base.modes.some(m => m.id === p.modeId))
        .map(p => ({ id: String(p.id || uid()), modeId: p.modeId, from: p.from, to: isKey(p.to) && p.to >= p.from ? p.to : null }))
    : [];
  base.v = SCHEMA;
  return base;
}

const mkGoal = (start, name, emoji, extra) => Object.assign(
  { id: uid(), name, emoji, catId: SEED_CAT[name] || null, kind: 'check', freq: 'daily', src: null, target: null, cmp: 'max', unit: '', step: 1, cycleOn: 3, cycleOff: 1, cycleStarts: [], createdAt: start, archivedAt: null },
  extra || {}
);
const sleepGoalDef = (start, hours) => mkGoal(start, 'Dormir o suficiente', '😴', { kind: 'number', src: 'sleep', cmp: 'min', target: hours, unit: 'h', step: 0.5 });

function phase2Goals(start) {
  return [
    mkGoal(start, 'Ginásio', '🏋️', { freq: 'cycle', cycleOn: 3, cycleOff: 1 }),
    mkGoal(start, 'Desporto coletivo', '⚽', { freq: 'weekly' })
  ];
}

function seedModes(goals) {
  const nonDaily = {};
  goals.filter(g => g.freq !== 'daily').forEach(g => { nonDaily[g.id] = 'off'; });
  return [
    { id: 'ferias', name: 'Férias', emoji: '🏖️', def: 'normal', rules: Object.assign({}, nonDaily) },
    { id: 'doente', name: 'Doente', emoji: '🤒', def: 'off', rules: {} },
    { id: 'viagem', name: 'Viagem', emoji: '✈️', def: 'normal', rules: Object.assign({}, nonDaily) }
  ];
}

function seedGoals(start, sleepHours) {
  return [
    mkGoal(start, 'Sem telemóvel ao acordar', '🌅'),
    mkGoal(start, 'Notícias ao almoço (15 min)', '📰'),
    mkGoal(start, 'Ler nos tempos mortos', '📚'),
    mkGoal(start, 'Ler 30 min antes de dormir', '📖'),
    mkGoal(start, 'Deitar por volta das 23h45', '🌙'),
    mkGoal(start, 'Tempo viciante no ecrã', '📵', { kind: 'number', target: 60, cmp: 'max', unit: 'min', step: 5 }),
    sleepGoalDef(start, sleepHours)
  ].concat(phase2Goals(start)).map(cleanGoal);
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if ((Number(obj && obj.v) || 1) < SCHEMA) {
        try { if (!localStorage.getItem(BAK_KEY)) localStorage.setItem(BAK_KEY, raw); } catch (e) { /* sem espaço: segue sem cópia */ }
      }
      return normalize(obj);
    }
  } catch (e) { console.warn('Não foi possível ler os dados guardados', e); }
  const s = newState();
  const today = todayKeyFor(s.settings.rollover);
  s.cats = DEFAULT_CATS.map(c => Object.assign({}, c));
  s.goals = seedGoals(today < ROUTINE_START ? today : ROUTINE_START, s.settings.sleepGoal);
  s.modes = seedModes(s.goals);
  return s;
}

let cycleCache = {};
let state = load();
let warnedStorage = false;
function save() {
  cycleCache = {};
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) {
    if (!warnedStorage) { warnedStorage = true; toast('Não consegui guardar. Faz um backup já que puderes.'); }
  }
}
save();

const todayKey = () => todayKeyFor(state.settings.rollover);
