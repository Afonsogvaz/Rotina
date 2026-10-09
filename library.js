/* Rotina 1.1, biblioteca de metas sugeridas: adiciona várias metas de uma vez (sem apagar nada). */
'use strict';

const CAT_EXTRA = [
  { id: 'social', name: 'Social', emoji: '🤝', color: CAT_COLORS[6] },
  { id: 'familia', name: 'Família', emoji: '🏡', color: CAT_COLORS[3] },
  { id: 'lazer', name: 'Lazer', emoji: '🎬', color: CAT_COLORS[7] }
];
const catDef = id => DEFAULT_CATS.concat(CAT_EXTRA).find(c => c.id === id);

/* freq: 'daily' | 'weekly'; pre = vem selecionada; replaces = metas antigas (por nome) que ficam arquivadas */
const CATALOG = [
  { key: 'wake', group: 'Diárias', name: 'Acordar até às 08:00', emoji: '⏰', cat: 'sono', src: 'wake', target: 480, cmp: 'max', note: 'automática, a partir da hora de acordar', pre: true },
  { key: 'bed', group: 'Diárias', name: 'Adormecer até às 00:00', emoji: '🌙', cat: 'sono', src: 'bed', target: 360, cmp: 'max', note: 'automática, a partir da hora de adormecer', pre: false },
  { key: 'jornal', group: 'Diárias', name: 'Ler o jornal de manhã', emoji: '🗞️', cat: 'mente', note: 'sim ou não', pre: true, replaces: ['Notícias ao almoço (15 min)'] },
  { key: 'tarefas', group: 'Diárias', name: 'Sem telemóvel a fazer tarefas', emoji: '🎯', cat: 'digital', note: 'sim ou não', pre: true },
  { key: 'ler', group: 'Diárias', name: 'Ler 30 min ou mais', emoji: '📖', cat: 'mente', kind: 'number', target: 30, cmp: 'min', unit: 'min', step: 5, note: 'em minutos', pre: true, replaces: ['Ler 30 min antes de dormir', 'Ler nos tempos mortos'] },
  { key: 'tel', group: 'Diárias', name: 'Menos de 4 h de telemóvel', emoji: '📱', cat: 'digital', kind: 'number', target: 240, cmp: 'max', unit: 'min', step: 15, note: 'em minutos, do Tempo de Ecrã', pre: true },
  { key: 'vicios', group: 'Diárias', name: 'Menos de 30 min em vícios', emoji: '📵', cat: 'digital', kind: 'number', target: 30, cmp: 'max', unit: 'min', step: 5, note: 'em minutos', pre: true, replaces: ['Tempo viciante no ecrã'] },
  { key: 'luz', group: 'Diárias', name: 'Luz natural de manhã', emoji: '☀️', cat: 'corpo', note: 'sim ou não', pre: true },

  { key: 'cardio', group: 'Semanais', name: 'Cardio no ginásio (3 ou mais)', emoji: '🏃', cat: 'corpo', freq: 'weekly', kind: 'number', target: 3, cmp: 'min', unit: 'sessões', step: 1, note: 'conta as sessões', pre: true },
  { key: 'mob', group: 'Semanais', name: 'Mobilidade e alongamentos (3 ou mais)', emoji: '🧘', cat: 'corpo', freq: 'weekly', kind: 'number', target: 3, cmp: 'min', unit: 'sessões', step: 1, note: 'conta as sessões', pre: true },
  { key: 'amigo', group: 'Semanais', name: 'Contactar um amigo afastado', emoji: '📞', cat: 'social', freq: 'weekly', note: 'sim ou não', pre: true },
  { key: 'jantar', group: 'Semanais', name: 'Jantar com amigos', emoji: '🍝', cat: 'social', freq: 'weekly', note: 'sim ou não', pre: true },
  { key: 'dates', group: 'Semanais', name: 'Dates com a namorada (2 ou mais)', emoji: '💕', cat: 'social', freq: 'weekly', kind: 'number', target: 2, cmp: 'min', unit: 'dates', step: 1, note: 'conta os dates', pre: true },
  { key: 'cozinhar', group: 'Semanais', name: 'Cozinhar para a família', emoji: '🍳', cat: 'familia', freq: 'weekly', note: 'sim ou não', pre: true },
  { key: 'avos', group: 'Semanais', name: 'Ligar aos avós', emoji: '👵', cat: 'familia', freq: 'weekly', note: 'sim ou não', pre: true },
  { key: 'receita', group: 'Semanais', name: 'Aprender uma receita nova', emoji: '🥘', cat: 'lazer', freq: 'weekly', note: 'sim ou não', pre: true },
  { key: 'aprender', group: 'Semanais', name: 'Aprender algo novo', emoji: '💡', cat: 'mente', freq: 'weekly', note: 'sim ou não', pre: true },
  { key: 'arlivre', group: 'Semanais', name: 'Atividade ao ar livre', emoji: '🌳', cat: 'lazer', freq: 'weekly', note: 'sim ou não', pre: true },
  { key: 'filme', group: 'Semanais', name: 'Ver um filme', emoji: '🎬', cat: 'lazer', freq: 'weekly', note: 'sim ou não', pre: true },

  { key: 'planear', group: 'Ideias (opcionais)', name: 'Planear o dia seguinte (5 min)', emoji: '📝', cat: 'trabalho', note: 'sim ou não, à noite', pre: false },
  { key: 'cafe', group: 'Ideias (opcionais)', name: 'Cafeína só até às 15h', emoji: '☕', cat: 'sono', note: 'sim ou não', pre: false },
  { key: 'passos', group: 'Ideias (opcionais)', name: 'Passos (8000 ou mais)', emoji: '👟', cat: 'corpo', kind: 'number', target: 8000, cmp: 'min', unit: 'passos', step: 500, note: 'do iPhone', pre: false },
  { key: 'quarto', group: 'Ideias (opcionais)', name: 'Telemóvel fora do quarto ao dormir', emoji: '🛏️', cat: 'digital', note: 'sim ou não', pre: false },
  { key: 'tese', group: 'Ideias (opcionais)', name: 'Blocos de foco na tese', emoji: '🎓', cat: 'trabalho', freq: 'weekly', kind: 'number', target: 3, cmp: 'min', unit: 'blocos', step: 1, note: 'conta os blocos', pre: false },
  { key: 'revsem', group: 'Ideias (opcionais)', name: 'Revisão semanal na app (10 min)', emoji: '🗓️', cat: 'mente', freq: 'weekly', note: 'sim ou não, ao domingo', pre: false },
  { key: 'fin', group: 'Ideias (opcionais)', name: 'Revisão financeira semanal (10 min)', emoji: '💶', cat: 'trabalho', freq: 'weekly', note: 'sim ou não', pre: false }
];

const hasGoalNamed = name => state.goals.some(g => !g.archivedAt && g.name === name);

function openLibrarySheet() {
  const sel = {};
  CATALOG.forEach(it => { sel[it.key] = !!it.pre && !hasGoalNamed(it.name); });
  ui.sheet = { type: 'lib', id: null, d: { sel } };
  renderSheet();
}

function librarySheetBody(s) {
  const groups = [];
  CATALOG.forEach(it => { if (!groups.includes(it.group)) groups.push(it.group); });
  const chosen = CATALOG.filter(it => s.d.sel[it.key]).length;
  return `<p class="help" style="margin-top:-8px">Toca para escolher. Só adiciona, não apaga nada. As metas antigas que uma nova substitui ficam arquivadas e o histórico mantém-se.</p>
    ${groups.map(gr => `<h3 class="sub-title" style="margin-top:18px">${esc(gr)}</h3><div class="group">${CATALOG.filter(it => it.group === gr).map(it => {
      const have = hasGoalNamed(it.name), on = !!s.d.sel[it.key];
      const rep = (it.replaces || []).filter(hasGoalNamed);
      return `<button class="row lib ${on ? 'is-done' : ''}" ${have ? 'disabled' : ''} data-act="lib-toggle" data-key="${it.key}" aria-pressed="${on}">
        <span class="emo">${esc(it.emoji)}</span>
        <span class="name">${esc(it.name)}<span class="hint">${esc(catDef(it.cat).name)} · ${esc(it.note)}${rep.length ? ' · substitui: ' + esc(rep.join(', ')) : ''}</span></span>
        ${have ? '<span class="pill">Já tens</span>' : `<span class="box">${ICON.check}</span>`}</button>`;
    }).join('')}</div>`).join('')}
    <p class="help">${chosen} ${chosen === 1 ? 'meta escolhida' : 'metas escolhidas'}.</p>`;
}

function saveLibrarySheet() {
  const s = ui.sheet, today = todayKey();
  const items = CATALOG.filter(it => s.d.sel[it.key] && !hasGoalNamed(it.name));
  if (!items.length) { toast('Escolhe pelo menos uma meta.'); return; }
  let archived = 0;
  items.forEach(it => {
    const cd = catDef(it.cat);
    if (!catById(cd.id)) state.cats.push(cleanCat(cd));
    state.goals.push(cleanGoal({
      id: uid(), name: it.name, emoji: it.emoji, catId: cd.id, kind: it.src ? 'number' : (it.kind || 'check'), freq: it.freq || 'daily',
      src: it.src || null, target: it.target == null ? null : it.target, cmp: it.cmp || 'max', unit: it.unit || '', step: it.step || 1,
      createdAt: today, archivedAt: null
    }));
    (it.replaces || []).forEach(n => {
      const old = state.goals.find(g => !g.archivedAt && g.name === n);
      if (!old) return;
      old.archivedAt = (state.logs[today] && old.id in state.logs[today]) ? addDays(today, 1) : today;
      archived++;
    });
  });
  save(); closeSheet(); render();
  toast(`${items.length} ${items.length === 1 ? 'meta adicionada' : 'metas adicionadas'}${archived ? `, ${archived} arquivadas` : ''}`);
}
