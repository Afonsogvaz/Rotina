/* Rotina 1.0, folhas de edição: metas, categorias, modos e períodos. */
'use strict';

function sheetShell(title, bodyHTML, first, label, saveLabel) {
  return `<div class="backdrop" data-act="sheet-close">
    <div class="sheet ${first ? 'enter' : ''}" role="dialog" aria-modal="true" aria-label="${esc(label || title)}">
      <div class="grab"></div>
      <div class="sheet-body">
        <h2>${esc(title)}</h2>
        ${bodyHTML}
      </div>
      <div class="sheet-foot">
        <button class="btn" data-act="sheet-close">Cancelar</button>
        <button class="btn main" data-act="sheet-save">${saveLabel || 'Guardar'}</button>
      </div>
    </div></div>`;
}

const emojiField = d => `<div class="fld">
    <label for="f-name">Nome</label>
    <div class="emoji-row">
      <input class="inp" data-f="emoji" value="${esc(d.emoji)}" aria-label="Ícone" autocomplete="off">
      <input class="inp" id="f-name" data-f="name" value="${esc(d.name)}" placeholder="${esc(d.ph || '')}" maxlength="60" autocomplete="off">
    </div>
    <div class="chips">${EMOJIS.map(e => `<button class="${e === d.emoji ? 'on' : ''}" data-act="sheet-set" data-f="emoji" data-v="${e}" aria-label="Ícone ${e}">${e}</button>`).join('')}</div>
  </div>`;

/* ---------- meta ---------- */
function openGoalSheet(id) {
  const g = id ? goalById(id) : null;
  ui.sheet = {
    type: 'goal', id: id || null,
    d: g
      ? { name: g.name, emoji: g.emoji, catId: g.catId || '', freq: g.freq, kind: g.src || g.kind, target: g.target == null ? '' : (g.src === 'wake' ? minToClock(g.target) : g.src === 'bed' ? normClock(g.target) : String(g.target)), cmp: g.cmp, unit: g.unit, step: String(g.step), on: String(g.cycleOn), off: String(g.cycleOff), apply: 'today', applyDate: todayKey(), days: (g.days || []).slice(), start: g.createdAt, end: '', ph: 'Ex.: Ler 30 minutos' }
      : { name: '', emoji: '🎯', catId: '', freq: 'daily', kind: 'check', target: '', cmp: 'max', unit: '', step: '1', on: '3', off: '1', apply: 'today', applyDate: todayKey(), days: [], start: todayKey(), end: '', ph: 'Ex.: Ler 30 minutos' }
  };
  renderSheet();
}

function goalSheetBody(s) {
  const d = s.d, cyc = d.freq === 'cycle', autoK = !cyc && ['sleep', 'wake', 'bed'].includes(d.kind), sleepK = autoK && d.kind === 'sleep', num = !cyc && d.kind === 'number';
  const g = s.id ? goalById(s.id) : null;
  const catChips = `<div class="pchips">
      <button class="pc ${!d.catId ? 'on' : ''}" data-act="sheet-set" data-f="catId" data-v="">Nenhuma</button>
      ${state.cats.map(c => `<button class="pc ${d.catId === c.id ? 'on' : ''}" data-act="sheet-set" data-f="catId" data-v="${c.id}">${catDot(c)}${esc(c.name)}</button>`).join('')}</div>`;
  return `${emojiField(d)}
    <div class="fld"><label>Categoria</label>${catChips}</div>
    <div class="fld">
      <label>Com que frequência</label>
      <div class="seg three">
        <button class="${d.freq === 'daily' ? 'on' : ''}" data-act="sheet-set" data-f="freq" data-v="daily">Todos os dias</button>
        <button class="${d.freq === 'weekly' ? 'on' : ''}" data-act="sheet-set" data-f="freq" data-v="weekly">Por semana</button>
        <button class="${cyc ? 'on' : ''}" data-act="sheet-set" data-f="freq" data-v="cycle">Ciclo</button>
      </div>
      ${d.freq === 'weekly' ? '<p class="help">Avalias a meta ao domingo. Podes registar sim ou não, ou contar vezes.</p>' : ''}
    </div>
    ${cyc ? `
    <div class="two fld">
      <div><label for="f-on">Dias de treino</label><input class="inp" id="f-on" data-f="on" type="text" inputmode="numeric" value="${esc(d.on)}" placeholder="3"></div>
      <div><label for="f-off">Dias de pausa</label><input class="inp" id="f-off" data-f="off" type="text" inputmode="numeric" value="${esc(d.off)}" placeholder="1"></div>
      <p class="help span2">O ciclo tem sempre ${(parseNum(d.on) || 0) + (parseNum(d.off) || 0)} dias. Se falhares um treino, essa falha conta como a pausa e treinas no dia que seria de pausa.</p>
      ${g ? `<button class="btn span2" data-act="restart-cycle" data-id="${g.id}">Recomeçar o ciclo hoje</button>` : ''}
    </div>` : `
    <div class="fld">
      <label>Como registas</label>
      <div class="seg three">
        <button class="${d.kind === 'check' ? 'on' : ''}" data-act="sheet-set" data-f="kind" data-v="check">Sim ou não</button>
        <button class="${num ? 'on' : ''}" data-act="sheet-set" data-f="kind" data-v="number">Número</button>
        <button class="${autoK ? 'on' : ''}" data-act="sheet-set" data-f="kind" data-v="${autoK ? d.kind : 'sleep'}" ${d.freq === 'weekly' ? 'disabled' : ''}>Automático</button>
      </div>
      ${autoK ? `<div class="pchips" style="margin-top:10px">
        <button class="pc ${d.kind === 'sleep' ? 'on' : ''}" data-act="sheet-set" data-f="kind" data-v="sleep">Horas de sono</button>
        <button class="pc ${d.kind === 'wake' ? 'on' : ''}" data-act="sheet-set" data-f="kind" data-v="wake">Hora de acordar</button>
        <button class="pc ${d.kind === 'bed' ? 'on' : ''}" data-act="sheet-set" data-f="kind" data-v="bed">Hora de adormecer</button></div>
        <p class="help">Usa as horas que registas no cartão do Sono. Não precisas de a marcar à mão.</p>` : ''}
    </div>`}
    ${num ? `
    <div class="fld">
      <label>Objetivo</label>
      <div class="seg">
        <button class="${d.cmp === 'max' ? 'on' : ''}" data-act="sheet-set" data-f="cmp" data-v="max">No máximo</button>
        <button class="${d.cmp === 'min' ? 'on' : ''}" data-act="sheet-set" data-f="cmp" data-v="min">No mínimo</button>
      </div>
    </div>
    <div class="two fld">
      <div><label for="f-target">Valor</label><input class="inp" id="f-target" data-f="target" type="text" inputmode="decimal" value="${esc(d.target)}" placeholder="60"></div>
      <div><label for="f-unit">Unidade</label><input class="inp" id="f-unit" data-f="unit" value="${esc(d.unit)}" placeholder="min" maxlength="10" autocomplete="off"></div>
    </div>
    <div class="fld">
      <label for="f-step">Os botões − e + mudam de quanto em quanto?</label>
      <input class="inp" id="f-step" data-f="step" type="text" inputmode="decimal" value="${esc(d.step)}" placeholder="5">
    </div>` : ''}
    ${sleepK ? `<div class="fld"><label for="f-target">Horas de sono, no mínimo</label><input class="inp" id="f-target" data-f="target" type="text" inputmode="decimal" value="${esc(d.target)}" placeholder="8"></div>` : ''}
    ${autoK && !sleepK ? `<div class="fld"><label for="f-target">${d.kind === 'wake' ? 'Acordar até às' : 'Adormecer até às'}</label><input class="inp" id="f-target" data-f="target" type="time" value="${esc(d.target)}"></div>` : ''}
    ${g && (cyc || num || autoK) ? `<div class="fld"><label>Se mudares o objetivo, aplicar</label>
      <div class="seg three"><button class="${d.apply === 'today' ? 'on' : ''}" data-act="sheet-set" data-f="apply" data-v="today">Desde hoje</button><button class="${d.apply === 'date' ? 'on' : ''}" data-act="sheet-set" data-f="apply" data-v="date">Desde uma data</button><button class="${d.apply === 'all' ? 'on' : ''}" data-act="sheet-set" data-f="apply" data-v="all">Desde o início</button></div>
      ${d.apply === 'date' ? `<input class="inp" id="f-applydate" data-f="applyDate" type="date" value="${esc(d.applyDate)}" style="margin-top:8px">` : ''}
      <p class="help">${d.apply === 'today' ? 'O passado fica avaliado com o objetivo que tinhas nessa altura.' : d.apply === 'date' ? 'Os dias antes dessa data mantêm o objetivo antigo; dessa data em diante vale o novo.' : 'Corrige também o passado. Usa isto só se o valor antigo estava errado.'}</p></div>` : ''}
    ${!cyc && d.freq === 'daily' ? `<div class="fld"><label>Dias da semana</label>
      <div class="seg wd">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((l, i) => `<button class="${!d.days.length || d.days.includes(i) ? 'on' : ''}" data-act="sheet-day" data-i="${i}" aria-label="${['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'][i]}">${l}</button>`).join('')}</div>
      <p class="help">${d.days.length ? 'Nos outros dias a meta não aparece nem conta.' : 'Todos os dias. Toca nos dias em que a meta se aplica.'}</p></div>` : ''}
    <div class="two fld">
      <div><label for="f-start">Começa em</label><input class="inp" id="f-start" data-f="start" type="date" ${g ? '' : `min="${todayKey()}"`} value="${esc(d.start)}"></div>
      <div><label for="f-end">Último dia (opcional)</label><input class="inp" id="f-end" data-f="end" type="date" min="${todayKey()}" value="${esc(d.end)}"></div>
      <p class="help span2">Antes da data de início a meta não aparece nem conta. Se adiares o início, o que já registaste antes dessa data fica guardado mas deixa de contar. Depois do último dia deixa de aparecer, e tudo o que registaste até lá fica no histórico.</p>
    </div>
    ${g ? `<div class="actions"><div class="two"><button class="btn" data-act="archive" data-id="${g.id}">Terminar hoje</button><button class="btn danger" data-act="delete" data-id="${g.id}">Apagar</button></div></div>` : ''}`;
}

function saveGoalSheet() {
  const s = ui.sheet, d = s.d, name = d.name.trim();
  if (!name) { toast('Dá um nome à meta.'); return; }
  const cyc = d.freq === 'cycle', autoK = !cyc && ['sleep', 'wake', 'bed'].includes(d.kind), sleepK = autoK && d.kind === 'sleep', num = !cyc && d.kind === 'number';
  const P = { target: null, cmp: d.cmp === 'min' ? 'min' : 'max', unit: '', step: 1, cycleOn: 3, cycleOff: 1 };
  if (cyc) {
    P.cycleOn = Math.round(parseNum(d.on)); P.cycleOff = Math.round(parseNum(d.off));
    if (!(P.cycleOn >= 1 && P.cycleOn <= 14) || !(P.cycleOff >= 1 && P.cycleOff <= 14)) {
      toast('Os dias de treino e de pausa têm de estar entre 1 e 14.'); return;
    }
  } else if (sleepK) {
    P.target = parseNum(d.target);
    if (P.target === null || P.target <= 0 || P.target > 14) { toast('Define as horas de sono (um número entre 1 e 14).'); return; }
    P.cmp = 'min'; P.unit = 'h'; P.step = 0.5;
  } else if (autoK) {
    if (!/^\d{2}:\d{2}$/.test(d.target)) { toast('Escolhe a hora limite.'); return; }
    P.target = d.kind === 'wake' ? Number(d.target.slice(0, 2)) * 60 + Number(d.target.slice(3)) : bedNorm(d.target);
    P.cmp = 'max'; P.unit = ''; P.step = 1;
  } else if (num) {
    P.target = parseNum(d.target);
    if (P.target === null || P.target < 0) { toast('Define o valor do objetivo (um número).'); return; }
    P.unit = d.unit.trim().slice(0, 10);
    P.step = parseNum(d.step);
    if (P.step === null || P.step <= 0) P.step = 1;
  }
  const base = { name, emoji: oneEmoji(d.emoji), catId: d.catId || null, freq: autoK ? 'daily' : d.freq, kind: (num || autoK) ? 'number' : 'check', src: autoK ? d.kind : null };
  const created = !s.id, tk = todayKey(), ok = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
  const gOld = created ? null : goalById(s.id);
  let start = gOld ? gOld.createdAt : tk;
  if (ok(d.start)) start = (!gOld && d.start < tk) ? tk : d.start;
  let archivedAt = gOld ? gOld.archivedAt : null;
  if (ok(d.end)) {
    if (d.end < start || d.end < tk) { toast('O último dia tem de ser hoje ou depois (e depois do início).'); return; }
    archivedAt = addDays(d.end, 1);
  }
  if (created) {
    state.goals.push(cleanGoal(Object.assign({ id: uid(), createdAt: start, archivedAt, cycleStarts: [], days: d.days.slice() }, base, P)));
  } else {
    const g = goalById(s.id);
    const moved = start !== g.createdAt;
    if (moved) {
      g.createdAt = start; g.cycleStarts = [];
      const vs = g.vers.slice().sort((a, b) => (a.from < b.from ? -1 : 1));
      let base = vs[0]; vs.forEach(v => { if (v.from <= start) base = v; });
      g.vers = [Object.assign({}, base, { from: start })].concat(vs.filter(v => v.from > start));
    }
    g.archivedAt = archivedAt;
    const typeChanged = g.kind !== base.kind || g.freq !== base.freq || g.src !== base.src;
    const changed = PARAM_KEYS.some(key => g[key] !== P[key]);
    Object.assign(g, base);
    g.days = base.freq === 'daily' ? d.days.slice() : null;
    if (typeChanged || (changed && (d.apply === 'all' || g.createdAt > tk))) {
      g.vers = [Object.assign({ from: g.createdAt }, P)];
    } else if (changed) {
      const from = (d.apply === 'date' && ok(d.applyDate)) ? (d.applyDate < g.createdAt ? g.createdAt : d.applyDate) : tk, ver = Object.assign({ from }, P);
      const i = g.vers.findIndex(v => v.from === from);
      if (i >= 0) g.vers[i] = ver; else { g.vers.push(ver); g.vers.sort((a, b) => (a.from < b.from ? -1 : 1)); }
    }
    Object.assign(g, g.vers[g.vers.length - 1]);
    delete g.from;
    state.goals[state.goals.indexOf(g)] = cleanGoal(g);
  }
  save(); closeSheet(); render();
  toast(created ? 'Meta criada' : 'Meta guardada');
}

/* ---------- categoria ---------- */
function openCatSheet(id) {
  const c = id ? catById(id) : null;
  ui.sheet = { type: 'cat', id: id || null, d: c ? { name: c.name, emoji: c.emoji, color: c.color, ph: 'Ex.: Estudo' } : { name: '', emoji: '📁', color: CAT_COLORS[state.cats.length % CAT_COLORS.length], ph: 'Ex.: Estudo' } };
  renderSheet();
}
function catSheetBody(s) {
  const d = s.d;
  return `${emojiField(d)}
    <div class="fld"><label>Cor</label><div class="swatches">${CAT_COLORS.map(c => `<button class="sw ${d.color === c ? 'on' : ''}" style="background:${c}" data-act="sheet-set" data-f="color" data-v="${c}" aria-label="Cor ${c}"></button>`).join('')}</div></div>
    ${s.id ? `<div class="actions"><button class="btn danger" data-act="cat-del" data-id="${s.id}">Apagar categoria</button><p class="help">As metas desta categoria ficam sem categoria.</p></div>` : ''}`;
}
function saveCatSheet() {
  const s = ui.sheet, d = s.d, name = d.name.trim();
  if (!name) { toast('Dá um nome à categoria.'); return; }
  const data = { name: name.slice(0, 30), emoji: oneEmoji(d.emoji), color: d.color };
  if (s.id) Object.assign(catById(s.id), data);
  else state.cats.push(cleanCat(Object.assign({ id: 'c' + uid() }, data)));
  save(); closeSheet(); render(); toast('Categoria guardada');
}

/* ---------- modo ---------- */
function openModeSheet(id) {
  const m = id ? state.modes.find(x => x.id === id) : null;
  const rules = {};
  state.goals.filter(g => !g.archivedAt).forEach(g => {
    let r = m ? m.rules[g.id] : undefined;
    if (r === undefined) r = (m && m.def === 'off') ? 'off' : 'normal';
    rules[g.id] = typeof r === 'number' ? { t: 'target', v: String(r) } : { t: r === 'off' ? 'off' : 'normal', v: '' };
  });
  ui.sheet = { type: 'mode', id: id || null, d: { name: m ? m.name : '', emoji: m ? m.emoji : '🏖️', def: m ? m.def : 'normal', rules, ph: 'Ex.: Férias' } };
  renderSheet();
}
function modeSheetBody(s) {
  const d = s.d;
  const gs = state.goals.filter(g => !g.archivedAt);
  const rows = gs.map(g => {
    const r = d.rules[g.id] || { t: 'normal', v: '' };
    const p = effParams(g, todayKey());
    return `<div class="mrule"><span class="mr-n">${esc(g.emoji)} ${esc(g.name)}</span>
      <select class="sel" data-rg="${g.id}" aria-label="${esc(g.name)}">
        <option value="normal" ${r.t === 'normal' ? 'selected' : ''}>Normal</option>
        <option value="off" ${r.t === 'off' ? 'selected' : ''}>Suspensa</option>
        ${g.kind === 'number' && g.src !== 'wake' && g.src !== 'bed' ? `<option value="target" ${r.t === 'target' ? 'selected' : ''}>Outro objetivo</option>` : ''}
      </select>
      ${r.t === 'target' ? `<label class="mr-v"><input class="inp" data-rv="${g.id}" type="text" inputmode="decimal" value="${esc(r.v)}" aria-label="Objetivo em modo"><span>${esc(p.unit)}</span></label>` : ''}</div>`;
  }).join('');
  return `${emojiField(d)}
    <div class="fld"><label>Metas que vais criar mais tarde</label>
      <div class="seg"><button class="${d.def === 'normal' ? 'on' : ''}" data-act="sheet-set" data-f="def" data-v="normal">Ficam normais</button><button class="${d.def === 'off' ? 'on' : ''}" data-act="sheet-set" data-f="def" data-v="off">Ficam suspensas</button></div></div>
    <div class="fld"><label>O que acontece a cada meta neste modo</label><div class="mrules">${rows || '<p class="help">Ainda não tens metas.</p>'}</div>
      <p class="help">Uma meta suspensa não conta como falha nem entra nas percentagens. O ciclo do ginásio recomeça no dia 1 quando o modo acaba.</p></div>
    ${s.id ? `<div class="actions"><button class="btn danger" data-act="mode-del" data-id="${s.id}">Apagar modo</button><p class="help">Os períodos em que este modo foi usado também são apagados.</p></div>` : ''}`;
}
function saveModeSheet() {
  const s = ui.sheet, d = s.d, name = d.name.trim();
  if (!name) { toast('Dá um nome ao modo.'); return; }
  const rules = {};
  for (const id of Object.keys(d.rules)) {
    const r = d.rules[id];
    if (r.t === 'off') rules[id] = 'off';
    else if (r.t === 'target') {
      const n = parseNum(r.v);
      if (n === null || n < 0) { toast('Define o objetivo (um número) nas metas com "Outro objetivo".'); return; }
      rules[id] = n;
    } else if (d.def === 'off') rules[id] = 'normal';
  }
  const m = cleanMode({ id: s.id || 'm' + uid(), name, emoji: oneEmoji(d.emoji), def: d.def, rules });
  // mantém regras de metas arquivadas que já existiam
  const old = s.id ? state.modes.find(x => x.id === s.id) : null;
  if (old) Object.keys(old.rules).forEach(id => { if (!(id in d.rules) && goalById(id)) m.rules[id] = old.rules[id]; });
  if (old) state.modes[state.modes.indexOf(old)] = m; else state.modes.push(m);
  save(); closeSheet(); render(); toast('Modo guardado');
}

/* ---------- período ---------- */
function openSpanSheet(id) {
  if (!state.modes.length) { toast('Cria primeiro um modo em Metas.'); return; }
  const sp = id ? state.spans.find(x => x.id === id) : null;
  ui.sheet = { type: 'span', id: id || null, d: sp ? { modeId: sp.modeId, from: sp.from, to: sp.to || '' } : { modeId: state.modes[0].id, from: todayKey(), to: '' } };
  renderSheet();
}
function spanSheetBody(s) {
  const d = s.d;
  return `<div class="fld"><label>Modo</label><div class="pchips">${state.modes.map(m => `<button class="pc ${d.modeId === m.id ? 'on' : ''}" data-act="sheet-set" data-f="modeId" data-v="${m.id}">${esc(m.emoji)} ${esc(m.name)}</button>`).join('')}</div></div>
    <div class="two fld">
      <div><label for="f-from">Começa</label><input class="inp" id="f-from" data-f="from" type="date" value="${esc(d.from)}"></div>
      <div><label for="f-to">Acaba</label><input class="inp" id="f-to" data-f="to" type="date" value="${esc(d.to)}"></div>
      <p class="help span2">Deixa o fim vazio se ainda não sabes quando acaba. Depois, toca em "Terminar" em Hoje.</p>
    </div>
    ${s.id ? `<div class="actions"><button class="btn danger" data-act="span-del" data-id="${s.id}">Apagar período</button></div>` : ''}`;
}
function saveSpanSheet() {
  const s = ui.sheet, d = s.d;
  if (!isKey(d.from)) { toast('Escolhe a data de início.'); return; }
  if (d.to && (!isKey(d.to) || d.to < d.from)) { toast('O fim tem de ser depois do início.'); return; }
  const data = { modeId: d.modeId, from: d.from, to: d.to || null };
  if (s.id) Object.assign(state.spans.find(x => x.id === s.id), data);
  else state.spans.push(Object.assign({ id: 's' + uid() }, data));
  save(); closeSheet(); render(); toast('Período guardado');
}

/* ---------- despacho ---------- */
function renderSheet() {
  const root = $('#sheet-root');
  const s = ui.sheet;
  if (!s) { root.innerHTML = ''; document.body.classList.remove('locked'); return; }
  const prev = root.querySelector('.sheet-body');
  const scrollTop = prev ? prev.scrollTop : 0;
  const first = !prev;
  const T = {
    goal: ['goal', s.id ? 'Editar meta' : 'Nova meta', goalSheetBody],
    cat: ['cat', s.id ? 'Editar categoria' : 'Nova categoria', catSheetBody],
    mode: ['mode', s.id ? 'Editar modo' : 'Novo modo', modeSheetBody],
    span: ['span', s.id ? 'Editar período' : 'Iniciar um modo', spanSheetBody],
    lib: ['lib', 'Metas sugeridas', librarySheetBody],
    align: ['align', 'Alinhar metas', alignSheetBody]
  }[s.type];
  root.innerHTML = sheetShell(T[1], T[2](s), first, null, s.type === 'lib' ? 'Adicionar' : s.type === 'align' ? 'Alinhar' : null);
  const body = root.querySelector('.sheet-body');
  if (body) body.scrollTop = scrollTop;
  document.body.classList.add('locked');
}

function closeSheet() { ui.sheet = null; renderSheet(); }

function saveSheet() {
  const s = ui.sheet;
  if (!s) return;
  ({ goal: saveGoalSheet, cat: saveCatSheet, mode: saveModeSheet, span: saveSpanSheet, lib: saveLibrarySheet, align: saveAlignSheet })[s.type]();
}

/* ---------- alinhar todas as metas desde uma data ---------- */
function openAlignSheet() { ui.sheet = { type: 'align', id: null, d: { from: FIRST_DAY } }; renderSheet(); }
function alignSheetBody(s) {
  const n = state.goals.filter(g => !g.archivedAt || g.archivedAt > todayKey()).length;
  return `<p class="help" style="margin-top:-8px">Põe todas as metas ativas (${n}) iguais desde um dia, com os objetivos que têm agora. Serve para quando acabaste de afinar a rotina e queres que o histórico comece limpo.</p>
    <div class="fld"><label for="f-from">A partir de</label><input class="inp" id="f-from" data-f="from" type="date" value="${esc(s.d.from)}"></div>
    <p class="help">O que acontece: metas adicionadas depois de 6 de outubro e ainda sem registos antes deste dia (ou que começavam depois) passam a começar neste dia; alterações de objetivo feitas depois deste dia passam a valer desde ele. O que já registaste não se apaga. Dias anteriores não mudam.</p>`;
}
function alignGoals(from) {
  let moved = 0;
  state.goals.forEach(g => {
    if (g.archivedAt && g.archivedAt <= from) return;       // já terminada antes
    const latest = g.vers[g.vers.length - 1];
    const logged = Object.keys(state.logs).some(k => k < from && g.id in state.logs[k]) || Object.keys(state.weekly).some(k => k < from && g.id in state.weekly[k]);
    if (g.createdAt >= from || (g.createdAt > ROUTINE_START && !logged)) {   // começou depois e ainda sem registos: puxa o início
      if (g.createdAt !== from) moved++;
      g.createdAt = from; g.vers = [Object.assign({}, latest, { from })]; g.cycleStarts = [];
    } else {
      const before = g.vers.filter(v => v.from < from);
      const last = before[before.length - 1];
      const same = PARAM_KEYS.every(k => last[k] === latest[k]);
      if (g.vers.some(v => v.from >= from)) moved++;
      g.vers = before.concat(same ? [] : [Object.assign({}, latest, { from })]);
      g.cycleStarts = g.cycleStarts.filter(d => d < from);
    }
  });
  state.goals = state.goals.map(cleanGoal);
  return moved;
}
function saveAlignSheet() {
  const from = ui.sheet.d.from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '')) { toast('Escolhe uma data.'); return; }
  const n = alignGoals(from);
  save(); closeSheet(); render(); toast(n ? `${n} metas alinhadas desde ${from.split('-').reverse().join('/')}` : 'Já estava tudo alinhado');
}
