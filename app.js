/* Rotina 1.0, ações, eventos e arranque. */
'use strict';

/* ======================= backup e exportação ======================= */
function markBackup() { state.settings.lastBackup = new Date().toISOString(); save(); }

function backupJSON() {
  return JSON.stringify(Object.assign({ app: 'rotina', exportedAt: new Date().toISOString() }, state), null, 2);
}

async function shareFile(name, text, mime, title) {
  try {
    const file = new File([text], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'aborted';
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    return 'downloaded';
  } catch (e) { return 'failed'; }
}

async function exportData() {
  const r = await shareFile(`rotina-backup-${todayKey()}.json`, backupJSON(), 'application/json', 'Backup da Rotina');
  if (r === 'aborted') return;
  if (r === 'failed') { toast('Não deu para exportar. Usa "Copiar dados".'); return; }
  markBackup(); render(); toast(r === 'shared' ? 'Backup pronto' : 'Backup descarregado');
}

async function exportCsv() {
  const r = await shareFile(`rotina-dados-${todayKey()}.csv`, csvText(), 'text/csv', 'Dados da Rotina');
  if (r === 'aborted') return;
  toast(r === 'failed' ? 'Não deu para exportar a tabela.' : r === 'shared' ? 'Tabela pronta' : 'Tabela descarregada');
}

function importText(txt) {
  let obj;
  try { obj = JSON.parse(txt); } catch (e) { toast('Não é um backup da Rotina (ficheiro ilegível).'); return; }
  if (!obj || !Array.isArray(obj.goals) || !isObj(obj.logs)) { toast('Este ficheiro não parece um backup da Rotina.'); return; }
  const ns = normalize(obj);
  const days = Object.keys(Object.assign({}, ns.logs, ns.closed, ns.sleep, ns.checks)).length;
  if (!confirm(`Importar backup com ${ns.goals.length} metas e ${days} dias registados?\n\nIsto substitui os dados que tens agora.`)) return;
  if ((Number(obj.v) || 1) < SCHEMA) { try { localStorage.setItem(BAK_KEY, txt); } catch (e) { /* ignorar */ } }
  state = ns; save();
  ui.day = null; ui.month = null; ui.sheet = null; ui.cat = null; renderSheet();
  render(); toast('Backup importado');
}

/* ======================= aviso ======================= */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ======================= ações ======================= */
const actions = {
  tab(el) { ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },

  day(el) {
    const n = addDays(curDay(), Number(el.dataset.dir));
    if (n > todayKey() || n < minDay()) return;
    ui.day = n === todayKey() ? null : n;
    render();
  },

  goto(el) {
    const k = el.dataset.day;
    ui.day = k === todayKey() ? null : k;
    ui.tab = 'today'; render(); window.scrollTo(0, 0);
  },

  month(el) {
    const [y, m] = (ui.month || todayKey().slice(0, 7)).split('-').map(Number);
    const d = new Date(y, m - 1 + Number(el.dataset.dir), 1);
    const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    if (ym > todayKey().slice(0, 7) || ym < minDay().slice(0, 7)) return;
    ui.month = ym; render();
  },

  'hist-cat'(el) { ui.cat = el.dataset.id || null; render(); },
  'an-rev'(el) { ui.rev = el.dataset.v; render(); },
  'an-range'(el) { ui.range = Number(el.dataset.v); render(); },

  toggle(el) {
    const g = goalById(el.dataset.id), k = curDay();
    if (!g) return;
    const nowDone = val(k, g) !== true;
    setVal(k, g, nowDone ? true : null);
    ui.pop = nowDone ? g.id : null;
    render(); ui.pop = null;
  },

  step(el) {
    const g = goalById(el.dataset.id), k = curDay();
    if (!g) return;
    const input = el.parentElement.querySelector('input');
    const typed = input ? parseNum(input.value) : null;
    const base = typed !== null ? typed : (typeof val(k, g) === 'number' ? val(k, g) : 0);
    const next = Math.max(0, Math.round((base + Number(el.dataset.dir) * effParams(g, k).step) * 100) / 100);
    setVal(k, g, next);
    ui.pop = isDone(k, g) ? g.id : null;
    render(); ui.pop = null;
  },

  rest(el) {
    const g = goalById(el.dataset.id);
    if (!g) return;
    setVal(curDay(), g, 'rest');
    render(); toast('Pausa marcada');
  },

  trained(el) {
    const g = goalById(el.dataset.id);
    if (!g) return;
    setVal(curDay(), g, true);
    ui.pop = g.id; render(); ui.pop = null;
  },

  unrest(el) {
    const g = goalById(el.dataset.id);
    if (!g) return;
    setVal(curDay(), g, null);
    render();
  },

  light(el) {                                   // treino leve: fica registado mas não conta para o ciclo
    const g = goalById(el.dataset.id), k = curDay();
    if (!g) return;
    const on = val(k, g) !== 'light';
    setVal(k, g, on ? 'light' : null);
    render(); toast(on ? 'Treino leve registado' : 'Treino leve retirado');
  },

  'check-set'(el) {
    const k = curDay(), f = el.dataset.f, v = Number(el.dataset.v);
    const c = Object.assign({}, state.checks[k]);
    if (c[f] === v) delete c[f]; else c[f] = v;
    if (Object.keys(c).length) state.checks[k] = c; else delete state.checks[k];
    save(); render();
  },

  'sleep-q'(el) {
    const k = curDay(), v = Number(el.dataset.v);
    const s = Object.assign({}, state.sleep[k]);
    if (s.q === v) delete s.q; else s.q = v;
    if (Object.keys(s).length) state.sleep[k] = s; else delete state.sleep[k];
    save(); render();
  },

  close() {
    const k = curDay();
    if (state.closed[k]) { delete state.closed[k]; save(); render(); }
    else { state.closed[k] = true; save(); render(); toast('Check-in concluído'); }
  },

  /* ----- metas ----- */
  'new-goal'() { ui.tab = 'goals'; render(); openGoalSheet(null); },
  'edit-goal'(el) { openGoalSheet(el.dataset.id); },

  move(el) {
    const g = goalById(el.dataset.id), dir = Number(el.dataset.dir);
    if (!g) return;
    const sib = state.goals.filter(x => !x.archivedAt && (x.catId || null) === (g.catId || null));
    const i = sib.indexOf(g), j = i + dir;
    if (j < 0 || j >= sib.length) return;
    const a = state.goals.indexOf(sib[i]), b = state.goals.indexOf(sib[j]);
    [state.goals[a], state.goals[b]] = [state.goals[b], state.goals[a]];
    save(); render();
  },

  archive(el) {
    const g = goalById(el.dataset.id);
    if (!g) return;
    g.archivedAt = addDays(todayKey(), 1);
    save(); closeSheet(); render(); toast('Meta arquivada');
  },

  restore(el) {
    const g = goalById(el.dataset.id);
    if (!g) return;
    g.archivedAt = null; save(); render(); toast('Meta restaurada');
  },

  delete(el) {
    const g = goalById(el.dataset.id);
    if (!g) return;
    if (!confirm(`Apagar "${g.name}" e todo o seu histórico?\n\nNão dá para desfazer. Se só queres deixar de a ver, usa Arquivar.`)) return;
    state.goals = state.goals.filter(x => x.id !== g.id);
    Object.keys(state.logs).forEach(k => {
      delete state.logs[k][g.id];
      if (!Object.keys(state.logs[k]).length) delete state.logs[k];
    });
    Object.keys(state.weekly).forEach(w => {
      delete state.weekly[w][g.id];
      if (!Object.keys(state.weekly[w]).length) delete state.weekly[w];
    });
    state.modes.forEach(m => { delete m.rules[g.id]; });
    save(); closeSheet(); render(); toast('Meta apagada');
  },

  'restart-cycle'(el) {
    const g = goalById(el.dataset.id);
    if (!g) return;
    if (!confirm('Recomeçar o ciclo hoje? O dia de hoje passa a ser o dia 1.')) return;
    const t = todayKey();
    g.cycleStarts = Array.from(new Set((g.cycleStarts || []).concat(t))).sort();
    save(); closeSheet(); render(); toast('Ciclo recomeçado hoje');
  },

  /* ----- categorias ----- */
  'new-cat'() { openCatSheet(null); },
  'edit-cat'(el) { openCatSheet(el.dataset.id); },
  'cat-move'(el) {
    const i = state.cats.findIndex(c => c.id === el.dataset.id), j = i + Number(el.dataset.dir);
    if (i < 0 || j < 0 || j >= state.cats.length) return;
    [state.cats[i], state.cats[j]] = [state.cats[j], state.cats[i]];
    save(); render();
  },
  'cat-del'(el) {
    const c = catById(el.dataset.id);
    if (!c) return;
    if (!confirm(`Apagar a categoria "${c.name}"?\n\nAs metas ficam sem categoria.`)) return;
    state.goals.forEach(g => { if (g.catId === c.id) g.catId = null; });
    state.cats = state.cats.filter(x => x.id !== c.id);
    if (ui.cat === c.id) ui.cat = null;
    save(); closeSheet(); render(); toast('Categoria apagada');
  },

  /* ----- modos e períodos ----- */
  'new-mode'() { openModeSheet(null); },
  'edit-mode'(el) { openModeSheet(el.dataset.id); },
  'mode-del'(el) {
    const m = state.modes.find(x => x.id === el.dataset.id);
    if (!m) return;
    if (!confirm(`Apagar o modo "${m.name}"?\n\nOs períodos em que foi usado também desaparecem (os dias voltam a contar normalmente).`)) return;
    state.modes = state.modes.filter(x => x.id !== m.id);
    state.spans = state.spans.filter(p => p.modeId !== m.id);
    save(); closeSheet(); render(); toast('Modo apagado');
  },
  'span-new'() { openSpanSheet(null); },
  'edit-span'(el) { openSpanSheet(el.dataset.id); },
  'span-del'(el) {
    if (!confirm('Apagar este período? Os dias voltam a contar normalmente.')) return;
    state.spans = state.spans.filter(p => p.id !== el.dataset.id);
    save(); closeSheet(); render(); toast('Período apagado');
  },
  'span-end'(el) {
    const sp = state.spans.find(p => p.id === el.dataset.id);
    if (!sp) return;
    const e = addDays(todayKey(), -1);
    if (e < sp.from) state.spans = state.spans.filter(p => p.id !== sp.id); else sp.to = e;
    save(); render(); toast('Modo terminado, hoje conta normalmente');
  },

  /* ----- folha ----- */
  'sheet-set'(el) {
    if (!ui.sheet) return;
    const f = el.dataset.f, d = ui.sheet.d, v = el.dataset.v, prevKind = d.kind;
    d[f] = v;
    if (ui.sheet.type === 'goal') {
      if (f === 'freq' && v === 'cycle') d.kind = 'check';
      if (f === 'freq' && v === 'weekly' && ['sleep', 'wake', 'bed'].includes(d.kind)) d.kind = 'check';
      if ((f === 'freq' && v === 'weekly' && d.kind === 'number') || (f === 'kind' && v === 'number' && d.freq === 'weekly')) {
        if (d.target === '') { d.target = '1'; d.cmp = 'min'; d.unit = 'vezes'; d.step = '1'; }
      }
      if (f === 'kind' && v === 'number' && d.step === '') d.step = '1';
      if (f === 'kind' && ['sleep', 'wake', 'bed'].includes(v) && v !== prevKind) {
        if (v === 'sleep') { d.cmp = 'min'; d.unit = 'h'; d.step = '0.5'; d.target = String(state.settings.sleepGoal); }
        else d.target = v === 'wake' ? '08:00' : '00:00';
      }
    }
    renderSheet();
  },
  'open-lib'() { openLibrarySheet(); },
  'open-align'() { openAlignSheet(); },
  'sheet-day'(el) {
    if (!ui.sheet || ui.sheet.type !== 'goal') return;
    const i = Number(el.dataset.i), d = ui.sheet.d;
    let a = d.days.length ? d.days.slice() : [0, 1, 2, 3, 4, 5, 6];
    a = a.includes(i) ? a.filter(x => x !== i) : a.concat(i).sort();
    d.days = (a.length === 7 || !a.length) ? [] : a;
    renderSheet();
  },
  'lib-toggle'(el) { if (ui.sheet && ui.sheet.type === 'lib') { const k = el.dataset.key; ui.sheet.d.sel[k] = !ui.sheet.d.sel[k]; renderSheet(); } },
  'sheet-save'() { if (ui.sheet) saveSheet(); },
  'sheet-close'(el, e) {
    if (el.classList.contains('backdrop') && e.target !== el) return;
    closeSheet();
  },

  /* ----- dados ----- */
  export() { exportData(); },
  'export-csv'() { exportCsv(); },
  import() { const f = $('#importFile'); if (f) f.click(); },
  async copy() {
    try { await navigator.clipboard.writeText(backupJSON()); markBackup(); render(); toast('Dados copiados'); }
    catch (e) {
      const box = $('#pasteBox');
      if (box) { box.value = backupJSON(); box.focus(); box.select(); toast('Seleciona o texto e copia-o à mão.'); }
    }
  },
  'paste-import'() {
    const box = $('#pasteBox');
    if (!box || !box.value.trim()) { toast('Cola primeiro o texto do backup.'); return; }
    importText(box.value);
  },
  'restore-bak'() {
    let raw = null;
    try { raw = localStorage.getItem(BAK_KEY); } catch (e) { /* ignorar */ }
    if (!raw) { toast('Não há cópia automática guardada.'); return; }
    importText(raw);
  },

  wipe() {
    if (!confirm('Apagar TODOS os dados (metas, registos, sono e humor)?\n\nNão dá para desfazer.')) return;
    if (!confirm('Tens a certeza? Se ainda não fizeste backup, perdes tudo.')) return;
    state = newState(); save();
    ui.day = null; ui.month = null; ui.cat = null; ui.tab = 'today'; render(); toast('Dados apagados');
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el, e);
});

document.addEventListener('input', e => {
  const t = e.target;
  if (!ui.sheet || !t.dataset) return;
  if (t.dataset.f) ui.sheet.d[t.dataset.f] = t.value;
  else if (t.dataset.rv && ui.sheet.d.rules[t.dataset.rv]) ui.sheet.d.rules[t.dataset.rv].v = t.value;
});

document.addEventListener('change', e => {
  const t = e.target;
  if (!t.dataset) return;
  if (ui.sheet && t.dataset.f) { ui.sheet.d[t.dataset.f] = t.value; return; }
  if (ui.sheet && t.dataset.rg) {
    const r = ui.sheet.d.rules[t.dataset.rg];
    if (r) { r.t = t.value; if (r.t === 'target' && r.v === '') { const g = goalById(t.dataset.rg); r.v = g ? String(effParams(g, todayKey()).target) : ''; } }
    renderSheet(); return;
  }
  if (t.dataset.num) {
    const g = goalById(t.dataset.num), k = curDay();
    if (!g) return;
    const raw = t.value.trim();
    if (raw === '') setVal(k, g, null);
    else {
      const n = parseNum(raw);
      if (n === null) return;
      setVal(k, g, Math.max(0, n));
    }
    patchToday();
  } else if (t.dataset.sleep) {
    const k = curDay();
    const cur = Object.assign({}, state.sleep[k]);
    if (t.value) cur[t.dataset.sleep] = t.value; else delete cur[t.dataset.sleep];
    if (Object.keys(cur).length) state.sleep[k] = cur; else delete state.sleep[k];
    save();
    const box = $('#sleepsum');
    if (box) box.innerHTML = sleepSumHTML(k);
    patchToday();
  } else if (t.dataset.check === 'note') {
    const k = curDay();
    const c = Object.assign({}, state.checks[k]);
    const txt = t.value.trim();
    if (txt) c.note = txt.slice(0, 500); else delete c.note;
    if (Object.keys(c).length) state.checks[k] = c; else delete state.checks[k];
    save();
  } else if (t.dataset.an === 'metric') {
    ui.metric = t.value; render();
  } else if (t.dataset.setting) {
    const key = t.dataset.setting, n = Number(t.value);
    if (Number.isFinite(n)) { state.settings[key] = n; save(); toast('Guardado'); }
  } else if (t.id === 'importFile') {
    const f = t.files && t.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => importText(String(r.result));
    r.onerror = () => toast('Não consegui ler o ficheiro.');
    r.readAsText(f);
    t.value = '';
  }
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

/* ======================= arranque ======================= */
render();
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignorar */ }
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
