/* Rotina 1.0, ecrãs: Hoje, Histórico, Análise, Metas e Dados. */
'use strict';

const ui = { tab: 'today', day: null, month: null, sheet: null, pop: null, cat: null, rev: 'w0', metric: 'pct', range: 30 };
const curDay = () => ui.day || todayKey();

/* ---------- peças comuns ---------- */
function catGroups(goals) {
  const out = [];
  state.cats.forEach(c => { const gs = goals.filter(g => g.catId === c.id); if (gs.length) out.push({ cat: c, gs }); });
  const rest = goals.filter(g => !state.cats.some(c => c.id === g.catId));
  if (rest.length) out.push({ cat: null, gs: rest });
  return out;
}

const catDot = c => `<span class="dot" style="background:${c ? c.color : 'var(--box)'}"></span>`;

function hintText(k, g) {
  if (g.kind !== 'number') return '';
  const p = effParams(g, k), alt = typeof ruleFor(g, k) === 'number';
  let t = `${p.cmp === 'max' ? 'no máximo' : 'no mínimo'} ${fmtNum(p.target)}${p.unit ? ' ' + p.unit : ''}`;
  if (alt) t += ` (modo ${modeAt(k).mode.name})`;
  if (g.src === 'sleep') {
    const m = sleepMinutes(state.sleep[k]);
    return m === null ? `${t} · sem registo de sono` : `${t} · dormiste ${fmtDur(m)}`;
  }
  if (g.src === 'wake' || g.src === 'bed') {
    const clk = v => (g.src === 'bed' ? normClock(v) : minToClock(v));
    const lim = `${g.src === 'wake' ? 'acordar' : 'adormecer'} até às ${clk(p.target)}`;
    const v = rawVal(k, g);
    return v === undefined ? `${lim} · sem registo de sono` : `${lim} · ${g.src === 'wake' ? 'acordaste' : 'adormeceste'} às ${clk(v)}`;
  }
  if (isBad(k, g)) return `${t}, ${p.cmp === 'max' ? 'ficaste acima' : 'ficaste abaixo'}`;
  return t;
}

const panelHTML = (k, gs) => gs.map(g => `<span class="tile ${isDone(k, g) ? 'on' : ''}"><i>${esc(g.emoji)}</i></span>`).join('');

function sumHTML(k, gs) {
  const di = dayInfo(k);
  return `<b>${di.done}</b><span>de ${di.total} ${di.total === 1 ? 'meta' : 'metas'}</span>`;
}

function sleepSumHTML(k) {
  const mins = sleepMinutes(state.sleep[k]);
  const goalMin = state.settings.sleepGoal * 60;
  if (mins === null) return '<div class="dur"><span>Preenche as duas horas para ver quanto dormiste.</span></div>';
  const met = mins >= goalMin - 30;
  const w = Math.min(100, Math.round((mins / goalMin) * 100));
  return `<div class="dur"><b>${fmtDur(mins)}</b><span>objetivo de ${fmtNum(state.settings.sleepGoal)}h</span></div>
          <div class="bar ${met ? 'met' : ''}"><i style="width:${w}%"></i></div>`;
}

function scaleHTML(act, f, cur, label, faces) {
  return [1, 2, 3, 4, 5].map(n => `<button class="${cur === n ? 'on' : ''}" data-act="${act}" data-f="${f}" data-v="${n}" aria-pressed="${cur === n}" aria-label="${esc(label)} ${n} de 5">${faces ? faces[n - 1] : n}</button>`).join('');
}

/* ---------- linhas de meta ---------- */
function cycleRowHTML(k, g, done, pop) {
  const c = cycleMap(g)[k] || { type: 'train', pos: 1, on: g.cycleOn };
  const light = !!c.light;
  const lightBtn = label => `<button class="mini ${light ? 'on' : ''}" data-act="light" data-id="${g.id}" aria-pressed="${light}">${light ? label[1] : label[0]}</button>`;
  if (c.type === 'off') {
    const m = modeAt(k);
    return `<div class="row cyc rest" data-rowid="${g.id}">
      <div class="cyc-main"><span class="emo">${esc(g.emoji)}</span>
        <span class="name">${esc(g.name)}<span class="hint">Suspensa${m ? ' em ' + esc(m.mode.name) : ''}</span></span><span class="pill">Suspensa</span></div>
      <div class="minis">${lightBtn(['Estive ativo', 'Ativo registado'])}</div></div>`;
  }
  if (c.type === 'rest') {
    const hint = c.kind === 'explicit' ? 'Pausa marcada' : c.kind === 'absorbed' ? 'Sem treino, conta como pausa' : 'Dia de pausa';
    const main = c.kind === 'explicit'
      ? `<button class="mini" data-act="unrest" data-id="${g.id}">Voltar ao treino</button>`
      : `<button class="mini" data-act="trained" data-id="${g.id}">Treinei na mesma</button>`;
    return `<div class="row cyc rest" data-rowid="${g.id}">
      <div class="cyc-main"><span class="emo">${esc(g.emoji)}</span>
        <span class="name">${esc(g.name)}<span class="hint">${hint}</span></span><span class="pill">Pausa</span></div>
      <div class="minis">${main}${lightBtn(['Treino leve', 'Treino leve registado'])}</div></div>`;
  }
  return `<div class="row cyc ${done ? 'is-done' : ''} ${pop}" data-rowid="${g.id}">
    <button class="cyc-main" data-act="toggle" data-id="${g.id}" aria-pressed="${done}">
      <span class="emo">${esc(g.emoji)}</span>
      <span class="name">${esc(g.name)}<span class="hint">${c.pos > c.on ? 'Treino extra' : `Treino ${c.pos} de ${c.on}`}</span></span>
      <span class="box">${ICON.check}</span>
    </button>
    <div class="minis"><button class="mini" data-act="rest" data-id="${g.id}">Hoje descanso</button>${lightBtn(['Treino leve', 'Treino leve registado'])}</div>
  </div>`;
}

function rowHTML(k, g) {
  const done = isDone(k, g);
  const pop = ui.pop === g.id ? 'pop' : '';
  if (g.freq === 'cycle') return cycleRowHTML(k, g, done, pop);
  if (g.freq !== 'weekly' && suspended(g, k)) {
    const m = modeAt(k);
    return `<div class="row rest" data-rowid="${g.id}"><span class="emo">${esc(g.emoji)}</span>
      <span class="name">${esc(g.name)}<span class="hint">Suspensa${m ? ' em ' + esc(m.mode.name) : ''}</span></span><span class="pill">Suspensa</span></div>`;
  }
  if (g.src) {
    return `<div class="row num auto ${done ? 'is-done' : ''}" data-rowid="${g.id}"><div class="top">
      <span class="emo">${esc(g.emoji)}</span>
      <span class="name">${esc(g.name)}<span class="hint ${isBad(k, g) ? 'bad' : ''}">${esc(hintText(k, g))}</span></span>
      <span class="box">${ICON.check}</span></div></div>`;
  }
  if (g.kind === 'check') {
    return `<button class="row ${done ? 'is-done' : ''} ${pop}" data-act="toggle" data-id="${g.id}" data-rowid="${g.id}" aria-pressed="${done}">
      <span class="emo">${esc(g.emoji)}</span>
      <span class="name">${esc(g.name)}</span>
      <span class="box">${ICON.check}</span>
    </button>`;
  }
  const p = effParams(g, k), v = val(k, g);
  return `<div class="row num ${done ? 'is-done' : ''} ${pop}" data-rowid="${g.id}">
    <div class="top">
      <span class="emo">${esc(g.emoji)}</span>
      <span class="name">${esc(g.name)}<span class="hint ${isBad(k, g) ? 'bad' : ''}">${esc(hintText(k, g))}</span></span>
      <span class="box">${ICON.check}</span>
    </div>
    <div class="stepper">
      <button data-act="step" data-id="${g.id}" data-dir="-1" aria-label="Menos ${fmtNum(p.step)}">−</button>
      <label class="field">
        <input data-num="${g.id}" type="number" inputmode="decimal" step="any" min="0" placeholder="0" value="${typeof v === 'number' ? v : ''}" aria-label="${esc(g.name)}">
        <span class="unit">${esc(p.unit)}</span>
      </label>
      <button data-act="step" data-id="${g.id}" data-dir="1" aria-label="Mais ${fmtNum(p.step)}">+</button>
    </div>
  </div>`;
}

function backupDue() {
  const days = Object.keys(Object.assign({}, state.logs, state.closed, state.sleep, state.checks)).length;
  if (days < 3) return false;
  const lb = state.settings.lastBackup;
  if (!lb) return true;
  return (Date.now() - new Date(lb).getTime()) > 14 * 86400000;
}

function weekRangeLabel(wk) {
  const end = addDays(wk, 6);
  if (parseKey(wk).getMonth() === parseKey(end).getMonth()) {
    return `${parseKey(wk).getDate()} a ${fmtDate(end, { day: 'numeric', month: 'long' })}`;
  }
  return `${shortDate(wk)} a ${shortDate(end)}`;
}

/* ======================= HOJE ======================= */
function modeBannerHTML(k, isToday) {
  const m = modeAt(k);
  if (!m) return isToday && state.modes.length ? '<div class="tools"><button class="chip-btn" data-act="span-new">＋ Iniciar modo (férias, doente…)</button></div>' : '';
  const sp = m.span;
  const range = sp.to ? `${shortDate(sp.from)} a ${shortDate(sp.to)}` : `desde ${shortDate(sp.from)}`;
  return `<div class="note mode"><span>${esc(m.mode.emoji)} <b>${esc(m.mode.name)}</b> · ${esc(range)}<small>As metas suspensas não contam para as percentagens.</small></span>
    ${isToday ? `<button class="link" data-act="span-end" data-id="${sp.id}">Terminar</button>` : ''}</div>`;
}

function feelHTML(k) {
  const c = checkAt(k);
  return `<h2 class="section-title">Como estás</h2>
    <p class="cap">Regista quando te lembrares. O cansaço pode ser preenchido em momentos diferentes do dia.</p>
    <div class="group feel">
      <div class="fl"><span class="fl-l">Humor</span><div class="scale faces">${scaleHTML('check-set', 'mood', c.mood, 'Humor', MOODS)}</div></div>
      <div class="fl-head"><span class="fl-l">Cansaço</span><small>1 fresco · 5 exausto</small></div>
      ${SLOTS.map(([f, label]) => `<div class="fl slot"><span class="fl-l">${label}</span><div class="scale">${scaleHTML('check-set', f, c[f], 'Cansaço de ' + label.toLowerCase())}</div></div>`).join('')}
      <div class="fl col"><label class="fl-l" for="note">Nota do dia</label>
        <textarea id="note" data-check="note" rows="2" maxlength="500" placeholder="Opcional (por exemplo: reunião longa, treino pesado, mal dormido…)">${esc(c.note || '')}</textarea></div>
    </div>`;
}

function viewToday() {
  const k = curDay(), tk = todayKey();
  const dg = dayGoals(k), wg = weekGoalsFor(k);
  const di = dayInfo(k);
  const isToday = k === tk, isYest = k === addDays(tk, -1);
  const title = isToday ? 'Hoje' : isYest ? 'Ontem' : cap(fmtDate(k, { weekday: 'long' }));
  const sameYear = k.slice(0, 4) === tk.slice(0, 4);
  const sub = (isToday || isYest)
    ? fmtDate(k, { weekday: 'long', day: 'numeric', month: 'long' })
    : fmtDate(k, sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  const sl = state.sleep[k] || {};
  const closed = !!state.closed[k];
  const groups = catGroups(dg);
  const cg = [].concat(...groups.map(x => x.gs)).filter(g => counts(k, g));

  let html = `<header class="head">
    <div><h1 class="title">${esc(title)}</h1><p class="date">${esc(sub)}</p></div>
    <div class="daynav">
      <button class="iconbtn" data-act="day" data-dir="-1" aria-label="Dia anterior" ${k <= minDay() ? 'disabled' : ''}>${ICON.prev}</button>
      <button class="iconbtn" data-act="day" data-dir="1" aria-label="Dia seguinte" ${k >= tk ? 'disabled' : ''}>${ICON.next}</button>
    </div>
  </header>`;

  html += modeBannerHTML(k, isToday);
  if (isToday && backupDue()) {
    html += `<div class="note"><span>Já tens progresso guardado. Faz um backup para não o perderes.</span><button class="link" data-act="tab" data-tab="data">Fazer backup</button></div>`;
  }

  if (!dg.length && !wg.length) {
    const none = !state.goals.length;
    html += `<div class="empty"><p>${none ? 'Ainda não tens metas. Cria a primeira e volta aqui para a marcar.' : 'Neste dia ainda não havia metas.'}</p>
      ${none ? '<button class="btn main" data-act="new-goal">Criar meta</button>' : ''}</div>`;
  }

  if (dg.length) {
    if (cg.length) {
      html += `<div class="panel ${di.total > 0 && di.done === di.total ? 'gold' : ''}" style="--cols:${Math.min(cg.length, 8)}" aria-hidden="true">${panelHTML(k, cg)}</div>
        <div class="sum" aria-live="polite">${sumHTML(k, cg)}</div>`;
    }
    html += groups.map(({ cat, gs }) => {
      const cs = gs.filter(g => counts(k, g));
      return `<h3 class="cat-title">${catDot(cat)}<span class="ct">${cat ? esc(cat.emoji) + ' ' + esc(cat.name) : 'Outras'}</span>
        <small data-catsum="${cat ? cat.id : ''}">${cs.length ? `${cs.filter(g => isDone(k, g)).length} de ${cs.length}` : 'suspensa'}</small></h3>
        <div class="group">${gs.map(g => rowHTML(k, g)).join('')}</div>`;
    }).join('');
  }

  if (wg.length) {
    const wk = weekStart(k);
    const sunday = isToday && parseKey(k).getDay() === 0;
    html += `<h2 class="section-title">${wk === weekStart(tk) ? 'Esta semana' : 'Semana'}</h2>
      <p class="cap">${esc(weekRangeLabel(wk))}${sunday ? '. Hoje é domingo, dia de avaliar a semana.' : ''}</p>
      <div class="group">${wg.map(g => rowHTML(k, g)).join('')}</div>`;
  }

  html += `<h2 class="section-title">Sono</h2>
    <p class="cap">A noite que terminou na manhã deste dia.</p>
    <div class="group sleep">
      <div class="times">
        <div><label for="bed">Adormeci</label><input id="bed" type="time" data-sleep="bed" value="${esc(sl.bed || '')}"></div>
        <div><label for="wake">Acordei</label><input id="wake" type="time" data-sleep="wake" value="${esc(sl.wake || '')}"></div>
      </div>
      <div id="sleepsum">${sleepSumHTML(k)}</div>
      <div class="fl slot sq"><span class="fl-l">Qualidade</span><div class="scale">${scaleHTML('sleep-q', 'q', sl.q, 'Qualidade do sono')}</div></div>
    </div>`;

  html += feelHTML(k);

  if (dg.length || wg.length) {
    html += `<button class="primary ${closed ? 'closed' : ''}" data-act="close">${closed ? 'Check-in concluído' : 'Concluir check-in'}</button>
      <p class="after">${closed ? 'Toca outra vez para reabrir o dia.' : 'Marca o dia como fechado quando acabares de registar.'}</p>`;
  }
  return html;
}

/* ======================= HISTÓRICO ======================= */
function weeksHTML(tk) {
  const wgs = state.goals.filter(g => g.freq === 'weekly' && (!ui.cat || g.catId === ui.cat));
  if (!wgs.length) return '';
  const cur = weekStart(tk);
  let rows = '';
  for (let i = 0; i < 8; i++) {
    const wk = addDays(cur, -7 * i);
    const app = wgs.filter(g => weekApplies(g, wk));
    if (!app.length) continue;
    if (i > 0 && !weekRegistered(wk)) continue;
    const done = app.filter(g => isWeekDone(wk, g)).length;
    rows += `<div class="wrow"><span class="wl">${i === 0 ? 'Esta semana' : esc(weekRangeLabel(wk))}<small>${done} de ${app.length}</small></span>
      <span class="wt">${app.map(g => `<span class="tile sm ${isWeekDone(wk, g) ? 'on' : ''}" title="${esc(g.name)}"><i>${esc(g.emoji)}</i></span>`).join('')}</span></div>`;
  }
  if (!rows) return '';
  return `<h2 class="section-title">Semanas</h2><p class="cap">Metas semanais, avaliadas ao domingo.</p><div class="group">${rows}</div>`;
}

function viewHistory() {
  const tk = todayKey();
  if (ui.cat && !catById(ui.cat)) ui.cat = null;
  const ym = ui.month || tk.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const dim = new Date(y, m, 0).getDate();
  const monthLabel = cap(fmtDate(`${ym}-01`, { month: 'long', year: 'numeric' }));

  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span class="cell blank"></span>';
  for (let d = 1; d <= dim; d++) {
    const k = `${ym}-${pad(d)}`;
    const future = k > tk;
    let cls = 'cell', label = `${d}, sem registo`;
    if (future) cls += ' future';
    else if (isRegistered(k)) {
      const di = dayInfo(k, ui.cat);
      if (di.total) {
        cls += di.pct === 1 ? ' l3' : di.pct >= 0.5 ? ' l2' : di.pct > 0 ? ' l1' : ' l0';
        label = `${d}, ${di.done} de ${di.total} metas`;
      }
    }
    if (modeAt(k)) cls += ' mode';
    if (k === tk) cls += ' today';
    cells += `<button class="${cls}" data-act="goto" data-day="${k}" aria-label="${esc(label)}" ${future ? 'disabled' : ''}>${d}</button>`;
  }

  const s7 = windowStats(tk, 7, ui.cat), s30 = windowStats(tk, 30, ui.cat);
  const ss = sleepStats();
  const slAvg = ss.avg7 !== null ? fmtDur(Math.round(ss.avg7)) : '—';

  const rates = dayGoals(tk).filter(g => !ui.cat || g.catId === ui.cat).map(g => {
    const r = goalRate(g, tk, 30);
    return `<div class="rate"><div class="l"><span class="emo">${esc(g.emoji)}</span><span class="name">${esc(g.name)}</span><b>${pctTxt(r)}</b></div>
      <div class="bar"><i style="width:${r === null ? 0 : Math.round(r * 100)}%"></i></div></div>`;
  }).join('');

  const chips = state.cats.length ? `<div class="catbar" role="group" aria-label="Filtrar por categoria">
      <button class="cc ${!ui.cat ? 'on' : ''}" data-act="hist-cat" data-id="">Todas</button>
      ${state.cats.map(c => `<button class="cc ${ui.cat === c.id ? 'on' : ''}" data-act="hist-cat" data-id="${c.id}">${catDot(c)}${esc(c.name)}</button>`).join('')}</div>` : '';

  const minM = minDay().slice(0, 7);
  return `<header class="head"><div><h1 class="title">Histórico</h1></div></header>
    ${chips}
    <div class="month">
      <button class="iconbtn" data-act="month" data-dir="-1" aria-label="Mês anterior" ${ym <= minM ? 'disabled' : ''}>${ICON.prev}</button>
      <h2>${esc(monthLabel)}</h2>
      <button class="iconbtn" data-act="month" data-dir="1" aria-label="Mês seguinte" ${ym >= tk.slice(0, 7) ? 'disabled' : ''}>${ICON.next}</button>
    </div>
    <div class="wk" aria-hidden="true"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div>
    <div class="wall">${cells}</div>
    <div class="legend" aria-hidden="true">
      <span><i></i>sem registo</span><span><i class="l0"></i>nada feito</span><span><i class="l1"></i>menos de metade</span><span><i class="l2"></i>mais de metade</span><span><i class="l3"></i>dia completo</span><span><i class="md"></i>em modo especial</span>
    </div>
    <h2 class="section-title">Resumo</h2>
    <div class="group">
      <div class="kv"><span>Últimos 7 dias<small>${s7.reg} ${s7.reg === 1 ? 'dia registado' : 'dias registados'}</small></span><b>${pctTxt(s7.pct)}</b></div>
      <div class="kv"><span>Últimos 30 dias<small>${s30.reg} ${s30.reg === 1 ? 'dia registado' : 'dias registados'}</small></span><b>${pctTxt(s30.pct)}</b></div>
      <div class="kv"><span>Sono médio<small>últimos 7 dias</small></span><b>${slAvg}</b></div>
    </div>
    ${weeksHTML(tk)}
    ${rates ? `<h2 class="section-title">Por meta</h2><p class="cap">Últimos 30 dias, só nos dias registados.</p><div class="group">${rates}</div>` : ''}`;
}

/* ======================= ANÁLISE ======================= */
const dlt = (a, b, unit, mul) => {
  if (a === null || b === null || a === undefined || b === undefined) return '';
  const d = (a - b) * (mul || 1);
  if (Math.abs(d) < 0.5 * (unit === 'pp' ? 1 : 0.1)) return '<small class="dl">igual ao período anterior</small>';
  const txt = unit === 'pp' ? `${d > 0 ? '+' : ''}${Math.round(d)} pp` : `${d > 0 ? '+' : ''}${fmt1(d)}${unit === 'h' ? ' h' : ''}`;
  return `<small class="dl ${d > 0 ? 'up' : 'dn'}">${txt} face ao período anterior</small>`;
};

function reviewHTML() {
  const kind = ui.rev[0], off = Number(ui.rev.slice(1));
  const r = review(kind, off);
  const seg = [['w0', 'Esta semana'], ['w1', 'Semana passada'], ['m0', 'Este mês'], ['m1', 'Mês passado']]
    .map(([v, l]) => `<button class="${ui.rev === v ? 'on' : ''}" data-act="an-rev" data-v="${v}">${l}</button>`).join('');
  let html = `<div class="seg four">${seg}</div><p class="cap rv">${esc(r.R.label)}</p>`;
  if (!r.cur.reg) return html + '<p class="cap">Sem dias registados neste período.</p>';
  const rows = [];
  rows.push(`<div class="kv"><span>Cumprimento<small>${r.cur.reg} ${r.cur.reg === 1 ? 'dia registado' : 'dias registados'}</small>${dlt(r.cur.pct, r.prev.pct, 'pp', 100)}</span><b>${pctTxt(r.cur.pct)}</b></div>`);
  r.cats.forEach(x => {
    rows.push(`<div class="rate"><div class="l">${catDot(x.c)}<span class="name">${esc(x.c.emoji)} ${esc(x.c.name)}</span><b>${pctTxt(x.cur.pct)}</b></div>
      <div class="bar"><i style="width:${Math.round(x.cur.pct * 100)}%;background:${x.c.color}"></i></div>${dlt(x.cur.pct, x.prev.pct, 'pp', 100)}</div>`);
  });
  if (r.full || r.light) rows.push(`<div class="kv"><span>Ginásio<small>treinos completos e leves</small></span><b>${r.full}${r.light ? ` <em>+ ${r.light} leve${r.light > 1 ? 's' : ''}</em>` : ''}</b></div>`);
  if (r.wTot) rows.push(`<div class="kv"><span>Metas semanais<small>semanas cumpridas</small></span><b>${r.wDone} de ${r.wTot}</b></div>`);
  if (r.sleep !== null) rows.push(`<div class="kv"><span>Sono médio${dlt(r.sleep, r.sleepPrev, 'h', 1 / 60)}</span><b>${fmtDur(Math.round(r.sleep))}</b></div>`);
  if (r.mood !== null) rows.push(`<div class="kv"><span>Humor médio<small>1 a 5</small>${dlt(r.mood, r.moodPrev, 'n')}</span><b>${fmt1(r.mood)}</b></div>`);
  if (r.tired !== null) rows.push(`<div class="kv"><span>Cansaço médio<small>1 fresco, 5 exausto</small>${dlt(r.tired, r.tiredPrev, 'n')}</span><b>${fmt1(r.tired)}</b></div>`);
  if (r.modeDays) rows.push(`<div class="kv"><span>Dias em modo especial<small>férias, doente…</small></span><b>${r.modeDays}</b></div>`);
  html += `<div class="group">${rows.join('')}</div>`;
  if (r.tips.length) html += `<ul class="tips">${r.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
  return html;
}

function consistencyHTML() {
  const gs = state.goals.filter(g => !g.archivedAt);
  if (!gs.length) return '';
  return `<div class="group">${gs.map(g => {
    const s = streakOf(g), w = weeklyRates(g, 8);
    const r = g.freq === 'weekly' ? null : goalRate(g, todayKey(), 30);
    return `<div class="cons"><span class="emo">${esc(g.emoji)}</span>
      <span class="name">${esc(g.name)}<small>${s.cur ? `🔥 ${s.cur} ${s.cur === 1 ? s.unit.slice(0, -1) + '' : s.unit}` : 'sem sequência'} · melhor ${s.best}${r !== null ? ` · 30 dias: ${pctTxt(r)}` : ''}</small></span>
      ${sparkBars(w)}</div>`;
  }).join('')}</div><p class="cap foot">As barras mostram as últimas 8 semanas, da mais antiga (esquerda) à atual.</p>`;
}

function patternsHTML() {
  const wp = weekdayPattern(), names = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const total = wp.reduce((s, x) => s + x.n, 0);
  let html = '';
  if (total < 7) html += '<p class="cap">Precisas de pelo menos uma semana de registos para ver padrões por dia da semana.</p>';
  else {
    html += `<div class="group pad">${barChart(wp.map((x, i) => ({ label: names[i], v: x.pct, n: x.n })), { label: 'Cumprimento por dia da semana' })}</div>`;
    const ok = wp.map((x, i) => ({ i, x })).filter(o => o.x.pct !== null && o.x.n >= 2);
    if (ok.length >= 4) {
      const hi = ok.reduce((a, b) => (b.x.pct > a.x.pct ? b : a)), lo = ok.reduce((a, b) => (b.x.pct < a.x.pct ? b : a));
      if (hi.x.pct - lo.x.pct >= 0.1) html += `<p class="cap">O teu dia mais forte é ${names[hi.i].toLowerCase()} (${pctTxt(hi.x.pct)}) e o mais fraco é ${names[lo.i].toLowerCase()} (${pctTxt(lo.x.pct)}).</p>`;
    }
  }
  const ks = keystone();
  html += '<h3 class="sub-title">Que meta puxa as outras?</h3>';
  const top = ks.items.filter(i => i.lift >= 0.05).slice(0, 3);
  if (!ks.items.length) html += '<p class="cap">Ainda faltam dados: preciso de pelo menos 5 dias com e 5 dias sem cada meta.</p>';
  else if (!top.length) html += '<p class="cap">Ainda nenhuma meta se destaca: nos teus dias, as metas parecem independentes umas das outras.</p>';
  else html += `<div class="group">${top.map(i => `<div class="kv"><span>${esc(i.g.emoji)} ${esc(i.g.name)}<small>Quando a fazes, cumpres ${pctTxt(i.withG)} das outras metas; quando não, ${pctTxt(i.without)}.</small></span><b>+${Math.round(i.lift * 100)} pp</b></div>`).join('')}</div>`;
  return html;
}

function sleepAnalysisHTML() {
  const s = sleepStats();
  if (!s.n) return '<p class="cap">Ainda sem horas de sono registadas.</p>';
  const rows = [];
  rows.push(`<div class="kv"><span>Média dos últimos 7 dias<small>${s.n7} ${s.n7 === 1 ? 'noite' : 'noites'}</small></span><b>${s.avg7 !== null ? fmtDur(Math.round(s.avg7)) : '—'}</b></div>`);
  rows.push(`<div class="kv"><span>Média dos últimos 30 dias<small>${s.n30} ${s.n30 === 1 ? 'noite' : 'noites'}</small></span><b>${s.avg30 !== null ? fmtDur(Math.round(s.avg30)) : '—'}</b></div>`);
  if (s.avgBed !== null) rows.push(`<div class="kv"><span>Hora média de deitar<small>últimos 14 dias</small></span><b>${normClock(s.avgBed)}</b></div>`);
  if (s.regularity !== null) {
    const r = Math.round(s.regularity);
    rows.push(`<div class="kv"><span>Regularidade<small>variação da hora de deitar: ${r <= 30 ? 'boa' : r <= 60 ? 'média' : 'irregular'}</small></span><b>±${r} min</b></div>`);
  }
  if (s.debt !== null) {
    const d = Math.round(s.debt);
    rows.push(`<div class="kv"><span>Balanço face ao objetivo<small>últimas ${s.nDebt} noites registadas</small></span><b class="${d > 0 ? 'neg' : ''}">${d > 0 ? '−' : '+'}${fmtDur(Math.abs(d))}</b></div>`);
  }
  if (s.week && s.free) {
    rows.push(`<div class="kv"><span>Dias úteis vs sáb e dom<small>duração · hora de deitar</small></span><b class="sm">${fmtDur(Math.round(s.week.m))} · ${normClock(s.week.bed)}<br>${fmtDur(Math.round(s.free.m))} · ${normClock(s.free.bed)}</b></div>`);
  }
  if (s.quality !== null) rows.push(`<div class="kv"><span>Qualidade média<small>1 a 5, últimos 30 dias</small></span><b>${fmt1(s.quality)}</b></div>`);
  return `<div class="group">${rows.join('')}</div>`;
}

function crossHTML() {
  const items = crossItems();
  return items.map(it => {
    if (!it.ready) {
      const have = it.need === 5 ? `${Math.min(it.nA || 0, it.nB || 0)} de 5 dias em cada grupo` : `${it.n} de ${it.need} dias`;
      return `<div class="cross"><b>${esc(it.title)}</b><span>A recolher dados: ${have}.</span></div>`;
    }
    return `<div class="cross ok"><b>${esc(it.title)}</b>${it.label ? `<span class="lb">${esc(it.label)}</span>` : ''}<span>${esc(it.text || '')}</span></div>`;
  }).join('') + '<p class="cap foot">São indícios, não provas: correlação não é causa, e com poucas semanas de dados o acaso pesa muito. Só mostro estas relações a partir de 15 dias de dados.</p>';
}

function viewAnalysis() {
  const n = statDays().length;
  if (!metricOptions().some(o => o.id === ui.metric)) ui.metric = 'pct';
  const opts = metricOptions().map(o => `<option value="${esc(o.id)}" ${o.id === ui.metric ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  const ranges = [[30, '30 dias'], [90, '90 dias'], [9999, 'Tudo']].map(([v, l]) => `<button class="${ui.range === v ? 'on' : ''}" data-act="an-range" data-v="${v}">${l}</button>`).join('');
  return `<header class="head"><div><h1 class="title">Análise</h1><p class="date">${n} ${n === 1 ? 'dia' : 'dias'} com registo fechado ou passado.</p></div></header>
    ${n < 7 ? '<div class="note"><span>Isto fica muito mais útil com algumas semanas de registos. Já podes ver a evolução e as sequências.</span></div>' : ''}
    <h2 class="section-title">Revisão</h2>${reviewHTML()}
    <h2 class="section-title">Evolução</h2>
    <div class="fld"><select id="anMetric" class="sel wide" data-an="metric" aria-label="O que ver">${opts}</select></div>
    <div class="seg" style="margin-bottom:12px">${ranges}</div>
    <div class="group pad">${lineChart(metricSeries(ui.metric, ui.range))}</div>
    <h2 class="section-title">Consistência</h2><p class="cap">Sequências e tendência de cada meta.</p>${consistencyHTML()}
    <h2 class="section-title">Padrões</h2>${patternsHTML()}
    <h2 class="section-title">Sono</h2>${sleepAnalysisHTML()}
    <h2 class="section-title">Cruzamentos</h2>${crossHTML()}`;
}

/* ======================= METAS ======================= */
function goalDesc(g) {
  if (g.freq === 'cycle') return `Ciclo: ${g.cycleOn} ${g.cycleOn === 1 ? 'dia' : 'dias'} de treino, ${g.cycleOff} de pausa`;
  if (g.src === 'sleep') return `Horas de sono, no mínimo ${fmtNum(g.target)} h (automático)`;
  if (g.src === 'wake') return `Acordar até às ${minToClock(g.target)} (automático)`;
  if (g.src === 'bed') return `Adormecer até às ${normClock(g.target)} (automático)`;
  const lim = g.kind === 'number'
    ? `${g.cmp === 'max' ? 'no máximo' : 'no mínimo'} ${fmtNum(g.target)}${g.unit ? ' ' + g.unit : ''}`
    : 'sim ou não';
  return g.freq === 'weekly' ? `Por semana, ${lim}` : cap(lim);
}

function modeDesc(m) {
  const act = state.goals.filter(g => !g.archivedAt);
  let off = 0, alt = 0;
  act.forEach(g => { const r = m.rules[g.id]; if (r === 'off' || (r === undefined && m.def === 'off')) off++; else if (typeof r === 'number') alt++; });
  const parts = [];
  parts.push(off ? `${off} ${off === 1 ? 'meta suspensa' : 'metas suspensas'}` : 'nenhuma meta suspensa');
  if (alt) parts.push(`${alt} com objetivo alterado`);
  return parts.join(', ');
}

function viewGoals() {
  const act = state.goals.filter(g => !g.archivedAt);
  const arch = state.goals.filter(g => g.archivedAt);
  const row = (g, i, arr) => `<div class="row list">
    <button class="main" data-act="edit-goal" data-id="${g.id}">
      <span class="emo">${esc(g.emoji)}</span>
      <span class="name">${esc(g.name)}<span class="hint">${esc(goalDesc(g))}</span></span>
    </button>
    <button class="mv" data-act="move" data-id="${g.id}" data-dir="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
    <button class="mv" data-act="move" data-id="${g.id}" data-dir="1" aria-label="Descer" ${i === arr.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
  </div>`;
  let html = `<header class="head"><div><h1 class="title">Metas</h1><p class="date">Toca numa meta para a editar.</p></div></header>`;
  html += act.length
    ? catGroups(act).map(({ cat, gs }) => `<h3 class="cat-title">${catDot(cat)}<span class="ct">${cat ? esc(cat.emoji) + ' ' + esc(cat.name) : 'Sem categoria'}</span></h3><div class="group">${gs.map(row).join('')}</div>`).join('')
    : '<div class="empty"><p>Sem metas ativas. Cria uma para começar a registar.</p></div>';
  html += `<button class="btn main add" data-act="new-goal">Nova meta</button>
    <button class="btn add" data-act="open-lib">Adicionar metas sugeridas</button>
    <button class="btn add" data-act="open-align">Alinhar todas as metas desde uma data</button>`;

  html += `<h2 class="section-title">Categorias</h2><p class="cap">Agrupam as metas em Hoje, no Histórico e na Análise.</p>`;
  html += state.cats.length ? `<div class="group">${state.cats.map((c, i, arr) => `<div class="row list">
      <button class="main" data-act="edit-cat" data-id="${c.id}">${catDot(c)}<span class="emo">${esc(c.emoji)}</span>
        <span class="name">${esc(c.name)}<span class="hint">${act.filter(g => g.catId === c.id).length} metas</span></span></button>
      <button class="mv" data-act="cat-move" data-id="${c.id}" data-dir="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
      <button class="mv" data-act="cat-move" data-id="${c.id}" data-dir="1" aria-label="Descer" ${i === arr.length - 1 ? 'disabled' : ''}>${ICON.down}</button></div>`).join('')}</div>` : '';
  html += `<button class="btn add" data-act="new-cat">Nova categoria</button>`;

  html += `<h2 class="section-title">Modos</h2><p class="cap">Férias, doente, viagem… Um modo suspende metas (ou altera o objetivo) enquanto durar, sem contar como falha.</p>`;
  html += state.modes.length ? `<div class="group">${state.modes.map(m => `<div class="row list">
      <button class="main" data-act="edit-mode" data-id="${m.id}"><span class="emo">${esc(m.emoji)}</span>
        <span class="name">${esc(m.name)}<span class="hint">${esc(modeDesc(m))}</span></span></button></div>`).join('')}</div>` : '';
  html += `<button class="btn add" data-act="new-mode">Novo modo</button>`;

  const spans = state.spans.slice().sort((a, b) => (a.from < b.from ? 1 : -1));
  html += `<h3 class="sub-title">Períodos<small>quando cada modo esteve ou está ativo</small></h3>`;
  html += spans.length ? `<div class="group">${spans.map(sp => { const m = state.modes.find(x => x.id === sp.modeId); return `<div class="row list">
      <button class="main" data-act="edit-span" data-id="${sp.id}"><span class="emo">${esc(m.emoji)}</span>
        <span class="name">${esc(m.name)}<span class="hint">${esc(shortDate(sp.from))} a ${sp.to ? esc(shortDate(sp.to)) : 'em curso'}</span></span></button></div>`; }).join('')}</div>` : '<p class="cap">Ainda sem períodos.</p>';
  html += `<button class="btn add" data-act="span-new">Iniciar um modo</button>`;

  if (arch.length) {
    html += `<h2 class="sub-title">Arquivadas<small>o histórico mantém-se</small></h2><div class="group">${arch.map(g => `<div class="row list">
      <span class="main"><span class="emo">${esc(g.emoji)}</span><span class="name">${esc(g.name)}<span class="hint">${g.archivedAt > todayKey() ? 'ativa até ' + esc(shortDate(addDays(g.archivedAt, -1))) : 'terminada'}</span></span></span>
      <button class="link" data-act="restore" data-id="${g.id}" style="padding:0 12px;min-height:44px">Restaurar</button></div>`).join('')}</div>`;
  }
  return html;
}

/* ======================= DADOS ======================= */
function viewData() {
  const s = state.settings;
  const lb = s.lastBackup ? fmtDate(dkey(new Date(s.lastBackup)), { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const opt = (v, cur, label) => `<option value="${v}" ${Number(v) === Number(cur) ? 'selected' : ''}>${label}</option>`;
  const rolls = [0, 1, 2, 3, 4, 5, 6].map(h => opt(h, s.rollover, `${pad(h)}:00`)).join('');
  const sleeps = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(h => opt(h, s.sleepGoal, `${fmtNum(h)} h`)).join('');
  let hasBak = false;
  try { hasBak = !!localStorage.getItem(BAK_KEY); } catch (e) { /* ignorar */ }
  return `<header class="head"><div><h1 class="title">Dados</h1></div></header>
    <div class="group card">
      <h3>Backup</h3>
      <p>Os teus dados ficam só neste telemóvel. Guarda um ficheiro de backup de vez em quando (por exemplo, no iCloud Drive) para não perderes o progresso se mudares de telemóvel.</p>
      <p>${lb ? `Último backup: ${esc(lb)}.` : 'Ainda não fizeste nenhum backup.'}</p>
      <div class="stack">
        <button class="btn main" data-act="export">Exportar backup</button>
        <button class="btn" data-act="import">Importar backup</button>
      </div>
      <input id="importFile" type="file" accept=".json,application/json,text/plain" hidden>
      <details class="paste">
        <summary>Copiar ou colar como texto</summary>
        <textarea id="pasteBox" placeholder="Cola aqui o texto do backup para o importar" spellcheck="false"></textarea>
        <div class="two">
          <button class="btn" data-act="copy">Copiar dados</button>
          <button class="btn" data-act="paste-import">Importar texto</button>
        </div>
      </details>
    </div>
    <div class="group card" style="margin-top:14px">
      <h3>Para analisares noutro sítio</h3>
      <p>Uma linha por dia registado, com metas, sono, humor e cansaço. Abre bem no Excel (separador ; e vírgula decimal) e no Numbers.</p>
      <button class="btn" data-act="export-csv">Exportar tabela (CSV)</button>
    </div>
    <h2 class="section-title">Definições</h2>
    <div class="group">
      <div class="set"><label for="setRoll">O dia muda às<small>Se te deitares depois da meia-noite, o check-in continua a contar para o dia anterior até esta hora.</small></label>
        <select id="setRoll" class="sel" data-setting="rollover">${rolls}</select></div>
      <div class="set"><label for="setSleep">Objetivo de sono<small>Usado na barra de sono do dia e na análise.</small></label>
        <select id="setSleep" class="sel" data-setting="sleepGoal">${sleeps}</select></div>
    </div>
    ${hasBak ? `<h2 class="section-title">Cópia de segurança automática</h2>
      <p class="cap">Antes de atualizar os dados antigos, a app guardou uma cópia. Só a usas se algo correr mal.</p>
      <button class="btn" data-act="restore-bak">Voltar à cópia anterior à atualização</button>` : ''}
    <h2 class="section-title">Apagar tudo</h2>
    <button class="btn danger" data-act="wipe">Apagar todos os dados</button>
    <p class="about">Rotina, versão ${APP_VERSION}. Sem contas e sem servidores.</p>`;
}

function render() {
  const views = { today: viewToday, history: viewHistory, analysis: viewAnalysis, goals: viewGoals, data: viewData };
  $('#app').innerHTML = views[ui.tab]();
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.tab === ui.tab;
    t.classList.toggle('on', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
}

/* atualizações parciais (não mexem no campo que está a ser editado) */
function patchToday() {
  const k = curDay(), di = dayInfo(k);
  const cg = [].concat(...catGroups(dayGoals(k)).map(x => x.gs)).filter(g => counts(k, g));
  const panel = $('.panel'), sum = $('.sum');
  if (panel) { panel.innerHTML = panelHTML(k, cg); panel.classList.toggle('gold', di.total > 0 && di.done === di.total); }
  if (sum) sum.innerHTML = sumHTML(k, cg);
  dayGoals(k).concat(weekGoalsFor(k)).forEach(g => {
    const row = document.querySelector(`[data-rowid="${g.id}"]`);
    if (!row) return;
    row.classList.toggle('is-done', isDone(k, g));
    const h = row.querySelector('.hint');
    if (h && g.kind === 'number') { h.textContent = hintText(k, g); h.classList.toggle('bad', isBad(k, g)); }
  });
  document.querySelectorAll('[data-catsum]').forEach(el => {
    const id = el.dataset.catsum;
    const cs = dayGoals(k).filter(g => (g.catId || '') === id && counts(k, g));
    el.textContent = cs.length ? `${cs.filter(g => isDone(k, g)).length} de ${cs.length}` : 'suspensa';
  });
}
