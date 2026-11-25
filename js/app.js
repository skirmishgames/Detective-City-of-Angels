// Case Builder app: views, forms and actions.
import { LOCATIONS, DISTRICTS, MOTIVES } from './data/locations.js';
import { KIT_ART } from './data/kit.js';
import { GUIDE } from './guide.js';
import {
  LETTERS, CARD_TYPES, MAX_CASE_CARDS, MAX_MYSTERY, newCase, newCard, newSearch, newMystery, newResponse,
  suspects, cardName, letterOf, frameOf, cellResponses, setCell, orderedCell, assignCodes, allResponses,
  searchTitle, searchInstruction, lookLine, locName, locLabel, locRefs, getPath, setPath, wordCount, uid, migrate,
} from './model.js';
import * as store from './store.js';
import {
  fontsReady, kitThumb, renderCaseCard, renderCaseBack, renderMysteryFront, renderMysteryBack,
  renderSearchFront, renderSearchBack, renderResponseCard, renderBriefing, responseCards,
} from './render.js';
import { runChecks, districtsUsed, placeNumbers } from './checks.js';
import { buildPDF, PARTS } from './print.js';
import { demoCase } from './data/demo.js';
import { playView } from './play.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const view = $('#view');

const state = {
  c: null, tab: 'guide', step: 'story',
  selCard: null, selSearch: null, selMystery: null, respSuspect: null,
};

const STEPS = [
  ['story', 'Story'], ['city', 'City'], ['cards', 'Case cards'], ['responses', 'Responses'],
  ['search', 'Search'], ['mystery', 'Mystery'], ['checks', 'Checks'], ['epilogue', 'Epilogue'], ['briefing', 'Briefing'],
];

// ---------- utilities ----------
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms);
}
let saveTimer;
function scheduleSave() {
  if (!state.c) return;
  $('#saveState').textContent = 'Saving';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await store.putCase(state.c); $('#saveState').textContent = 'Saved'; }
    catch (e) { $('#saveState').textContent = 'Not saved'; toast('Could not save: ' + e.message); }
  }, 400);
}
function download(name, data, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const slug = s => (s || 'case').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'case';

const LOC_OPTS = [['', 'None']].concat(LOCATIONS.map(l => [String(l.n), `${l.n} · ${l.names.join(' / ')}`]));

// ---------- form helpers ----------
const val = path => getPath(state.c, path) ?? '';
function fText(label, path, o = {}) {
  return `<label class="f"><span>${label}</span><input type="text" data-bind="${path}" value="${esc(val(path))}" placeholder="${esc(o.ph || '')}"${o.rr ? ' data-rr="1"' : ''}></label>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}`;
}
function fArea(label, path, o = {}) {
  return `<label class="f"><span>${label}</span><textarea data-bind="${path}" rows="${o.rows || 4}" class="${o.cls || ''}" placeholder="${esc(o.ph || '')}"${o.id ? ` id="${o.id}"` : ''}>${esc(val(path))}</textarea></label>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}`;
}
function fSelect(label, path, opts, o = {}) {
  const v = String(val(path));
  return `<label class="f"><span>${label}</span><select data-bind="${path}"${o.rr ? ' data-rr="1"' : ''}>${opts.map(([k, l]) => `<option value="${esc(k)}"${String(k) === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
function fCheck(label, path, o = {}) {
  return `<label class="check"><input type="checkbox" data-bind="${path}"${val(path) ? ' checked' : ''}${o.rr ? ' data-rr="1"' : ''}> ${label}</label>`;
}
function cardOpts(filter = () => true, none = 'None') {
  return [['', none]].concat(state.c.cards.filter(filter).map(k => [k.id, `${letterOf(state.c, k.id)} · ${cardName(state.c, k)}`]));
}
function motiveChips(path) {
  const sel = new Set(getPath(state.c, path) || []);
  return `<div class="chips">${MOTIVES.map(m => `<button type="button" class="chip${sel.has(m) ? ' on' : ''}" data-act="motive" data-path="${path}" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div>`;
}
function imageControls(path, o = {}) {
  const im = getPath(state.c, path) || {};
  const src = im.src || '';
  const kinds = o.kit || ['Male', 'Female', 'Evidence'];
  const custom = src.startsWith('img:');
  return `<div class="imgctl">
    <span class="lbl">Picture</span>
    <div class="btns">
      <button type="button" class="btn small" data-act="upload" data-path="${path}">Upload picture</button>
      ${o.useSuspect ? `<button type="button" class="btn small ghost" data-act="setimg" data-path="${path}" data-src="suspect">Use suspect's picture</button>` : ''}
      ${src ? `<button type="button" class="btn small ghost" data-act="setimg" data-path="${path}" data-src="">Remove picture</button>` : ''}
    </div>
    <div class="hint">${src.startsWith('kit:') ? 'Kit art in use.' : custom ? 'Your picture is in use. Zoom and move it below.' : src === 'suspect' ? 'Using the suspect\'s Case card picture.' : 'No picture yet. Pick kit art or upload your own.'}</div>
    ${custom ? `<div class="row">
      <label class="f"><span>Zoom</span><input type="range" min="1" max="3" step="0.02" data-bind="${path}.zoom" data-num="1" value="${im.zoom || 1}"></label>
      <label class="f"><span>Left / right</span><input type="range" min="-1" max="1" step="0.02" data-bind="${path}.x" data-num="1" value="${im.x || 0}"></label>
      <label class="f"><span>Up / down</span><input type="range" min="-1" max="1" step="0.02" data-bind="${path}.y" data-num="1" value="${im.y || 0}"></label>
    </div>` : ''}
    <details class="gallery"${o.openKit ? ' open' : ''}><summary>Kit art</summary>
      <div class="kitgrid">${KIT_ART.filter(a => kinds.includes(a.group)).map(a => `<button type="button" title="${esc(a.label)}" class="${src === 'kit:' + a.key ? 'on' : ''}" data-act="setimg" data-path="${path}" data-src="kit:${a.key}"><img loading="lazy" src="${kitThumb(a.key)}" alt="${esc(a.label)}"></button>`).join('')}</div>
    </details>
  </div>`;
}

// ---------- routing ----------
function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return { tab: parts[0] || 'guide', sub: parts[1] || '', rest: parts.slice(1) };
}
async function route() {
  const { tab, sub, rest } = parseHash();
  state.tab = ['guide', 'files', 'play', 'cases', 'build', 'print', 'about'].includes(tab) ? tab : 'guide';
  state.playParts = rest;
  if (state.tab === 'build' && sub) state.step = STEPS.some(s => s[0] === sub) ? sub : 'story';
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === state.tab));
  render();
  if (state.tab === 'guide' && sub) setTimeout(() => document.getElementById('g-' + sub)?.scrollIntoView(), 30);
  else window.scrollTo(0, 0);
}
function render() {
  updatePill();
  const t = state.tab;
  if (t === 'guide') view.innerHTML = guideView();
  else if (t === 'cases') casesView();
  else if (t === 'files') filesView();
  else if (t === 'play') playView(view, state.playParts || []);
  else if (t === 'about') view.innerHTML = aboutView();
  else if (!state.c) view.innerHTML = noCaseView();
  else if (t === 'print') view.innerHTML = printView();
  else view.innerHTML = buildView();
  afterRender();
}
function afterRender() {
  schedulePreviews(0);
  if (state.tab === 'build' && state.step === 'checks') runCheckView();
}
function updatePill() {
  $('#casePill').textContent = state.c ? (state.c.title || 'Untitled case') : 'No case open';
}

// ---------- guide ----------
function guideView() {
  return `<div class="hero"><span class="stamp">Case open</span>
    <h1>Write your own case</h1>
    <p>A step-by-step guide to designing a case for <em>Detective: City of Angels</em>, with the tools to write it, lay out every card and print a playable set.</p>
    <div class="btns"><a class="btn" href="#/build/story">Start building</a><a class="btn ghost" style="color:#f4ecd8;border-color:#f4ecd8" href="#/play">Play a case</a></div>
  </div>
  <div class="guide-grid">
    <nav class="toc panel" aria-label="Guide contents"><span class="lbl">Contents</span><ol>${GUIDE.map(g => `<li><a href="#/guide/${g.id}">${esc(g.title)}</a></li>`).join('')}</ol></nav>
    <div class="guide">${GUIDE.map(g => `<section class="panel" id="g-${g.id}"><h2>${esc(g.title)}</h2>${g.html}</section>`).join('')}
    <p class="small muted">Based on the official Case Design Guide v1.0 by Van Ryder Games, which ships in the Case Design Kit with worked examples. Get the kit from the publisher's Detective downloads page.</p></div>
  </div>`;
}

// ---------- cases library ----------
async function casesView() {
  const list = await store.listCases();
  view.innerHTML = `<h1>My cases</h1>
  <p class="muted">Cases you write are saved in this browser only. Back them up to a file to keep them safe or move them to another device. Looking for something to play? See <a href="#/files">Case files</a>.</p>
  <div class="btns">
    <button class="btn" data-act="newcase">New case</button>
    <button class="btn ghost" data-act="import">Restore from backup</button>
    <button class="btn ghost" data-act="demo">Load the example case</button>
  </div>
  ${list.length ? `<div class="cases">${list.map(c => `<div class="casecard${state.c?.id === c.id ? ' current' : ''}">
    <h3>${esc(c.title || 'Untitled case')}</h3>
    <div class="meta">${c.cards.length} Case cards · ${suspects(c).length} suspects · ${allResponses(c).length} responses · ${c.search.length} Search cards</div>
    <div class="meta">Edited ${new Date(c.updated).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</div>
    <div class="btns">
      <button class="btn small" data-act="open" data-id="${c.id}">Open</button>
      <a class="btn small red" href="#/play/my/${c.id}">Play</a>
      <button class="btn small ghost" data-act="export" data-id="${c.id}">Back up</button>
      <button class="btn small ghost" data-act="dupe" data-id="${c.id}">Duplicate</button>
      <button class="btn small ghost" data-act="del" data-id="${c.id}">Delete</button>
    </div></div>`).join('')}</div>` : '<div class="panel empty">No cases yet. Start a new one or load the example case to see how it works.</div>'}`;
}
function noCaseView() {
  return `<div class="panel empty"><h2>No case open</h2><p>Start a new case, or load the example to see a finished one.</p>
  <div class="btns" style="justify-content:center"><button class="btn" data-act="newcase">New case</button><button class="btn ghost" data-act="demo">Load the example case</button><a class="btn ghost" href="#/cases">Your cases</a></div></div>`;
}
async function openCase(c) {
  state.c = migrate(c);
  state.selCard = state.selSearch = state.selMystery = state.respSuspect = null;
  try { localStorage.setItem('dcoa-current', c.id); } catch { /* private mode */ }
  updatePill();
}


// ---------- case files (published library) ----------
let library = null;
async function loadLibrary() {
  if (!library) library = fetch('cases/index.json', { cache: 'no-cache' }).then(r => r.json()).then(j => {
    const need = j.playtestsNeeded || 3;
    for (const x of j.cases) {
      if (Array.isArray(x.playtests)) x.status = x.playtests.length >= need ? 'playtested' : 'untested';
      x.need = need;
    }
    return j.cases;
  });
  return library;
}
const caseData = new Map();
async function loadLibraryCase(entry) {
  if (!caseData.has(entry.slug)) caseData.set(entry.slug, fetch(entry.data, { cache: 'no-cache' }).then(r => r.json()));
  return caseData.get(entry.slug);
}
let libFilter = 'all', libStatus = '';
const STATUS = {
  untested: { label: 'Needs playtest', note: 'Fewer than 3 playtests so far. Responses and clues may change after feedback.' },
  playtested: { label: 'Playtested', note: 'Played at least 3 times and adjusted after feedback.' },
};
function feedbackMail(x) {
  const body = [
    'Case: ' + x.title + ' (version ' + x.version + ')',
    'Number of detectives:',
    'Mode (Chisel and detectives, head to head, or Sleuth solo):',
    'Playing time:',
    'Days used:',
    'Result (who solved it, on which day, and was the suspect, weapon and motive right?):',
    'When were Solve tokens used?',
    '',
    'FOR EVERYONE',
    ...(x.testNotes || []).map((t, k) => `${k + 1}. ${t}\nAnswer:\n`),
    'FOR THE CHISEL (spoilers)',
    ...(x.chiselNotes || []).map((t, k) => `C${k + 1}. ${t}\nAnswer:\n`),
    'Anything else:',
  ].join('\n');
  return `mailto:skirmishgames.app@gmail.com?subject=${encodeURIComponent(`Playtest: ${x.title} v${x.version}`)}&body=${encodeURIComponent(body)}`;
}
async function filesView() {
  view.innerHTML = '<p class="progress">Opening the files ...</p>';
  let list;
  try { list = await loadLibrary(); } catch { view.innerHTML = '<div class="panel empty">Could not load the case files.</div>'; return; }
  if (state.tab !== 'files') return;
  const shown = list.filter(x => (libFilter === 'all' || x.kind === libFilter) && (!libStatus || x.status === libStatus));
  const nStatus = k => list.filter(x => (libFilter === 'all' || x.kind === libFilter) && (!k || x.status === k)).length;
  const byslug = Object.fromEntries(list.map(x => [x.slug, x]));
  const card = x => `<article class="libcard" id="lib-${x.slug}">
    <img class="cover" loading="lazy" src="${esc(x.cover)}" alt="Briefing for ${esc(x.title)}">
    <div class="libbody">
      <div class="libkind ${x.kind}">${x.kind === 'original' ? 'Case Builder original' : 'Fan case'}</div>
      <h3>${esc(x.title)}</h3>
      <div class="by">by ${x.authorUrl ? `<a href="${esc(x.authorUrl)}" rel="noopener">${esc(x.author)}</a>` : esc(x.author)}</div>
      ${x.status ? `<span class="status status-${x.status}" title="${esc(STATUS[x.status].note)}">${STATUS[x.status].label}</span>` : ''}
      <div class="tags">${x.difficulty ? `<span>${esc(x.difficulty)}</span>` : ''}${x.version ? `<span>Version ${esc(x.version)}</span>` : ''}${x.modes.map(m => `<span>${esc(m)}${m === 'Sleuth' ? ' (solo)' : ''}</span>`).join('')}</div>
      <p>${esc(x.blurb)}</p>
      ${x.requires ? `<p class="small"><strong>Needs:</strong> <a href="#/files" data-act="libjump" data-slug="${x.requires}">${esc(byslug[x.requires]?.title || x.requires)}</a></p>` : ''}
      ${x.kind === 'original' ? `<div class="btns">
          <a class="btn small red" href="#/play/lib/${x.slug}">Play</a>
          <button class="btn small" data-act="libpdf" data-slug="${x.slug}">Print set (PDF)</button>
          <button class="btn small ghost spoil" data-act="libdoc" data-doc="grid" data-slug="${x.slug}">Chisel grid</button>
          <button class="btn small ghost spoil" data-act="libdoc" data-doc="epilogue" data-slug="${x.slug}">Epilogue</button>
          <button class="btn small ghost" data-act="libcopy" data-slug="${x.slug}">Open a copy to edit</button>
          ${x.status ? `<a class="btn small" href="${feedbackMail(x)}">Send feedback</a>` : ''}
        </div><div class="progress" id="libprog-${x.slug}"></div>
        ${x.status === 'untested' && x.testNotes?.length ? `<details class="focus"><summary><strong>What to pay attention to (${x.testNotes.length})</strong></summary><ol>${x.testNotes.map(t => `<li>${esc(t)}</li>`).join('')}</ol></details>` : ''}
        ${x.status === 'untested' && x.chiselNotes?.length ? `<details class="focus chisel"><summary><strong>For the Chisel (${x.chiselNotes.length})</strong> <span class="spoiltag">Spoilers</span></summary><ol>${x.chiselNotes.map(t => `<li>${esc(t)}</li>`).join('')}</ol></details>` : ''}
        ${x.changes?.length ? `<details class="focus"><summary><strong>Changes (${x.changes.length})</strong></summary><ul>${x.changes.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>` : ''}
        ${x.status ? `<p class="muted small">${x.playtests.length >= x.need ? `Playtested ${x.playtests.length} times.` : `Playtests: ${x.playtests.length} of ${x.need}. It counts as playtested after ${x.need}.`}</p>` : ''}`
      : `<ul class="dl">${x.downloads.map(d => `<li><a href="${esc(d.file)}" download>${esc(d.label)}</a> <span class="muted small">PDF, ${d.pages} page${d.pages > 1 ? 's' : ''}, ${d.mb} MB</span>${d.spoiler === 'solo' ? ' <span class="spoiltag solo">Solo player only</span>' : d.spoiler ? ' <span class="spoiltag">Chisel only</span>' : ''}${d.note ? ` <span class="small muted">${esc(d.note)}</span>` : ''}</li>`).join('')}</ul>
        ${x.source ? `<p class="small"><a href="${esc(x.source)}" rel="noopener">Author's own download page</a> may have newer versions.</p>` : ''}`}
    </div></article>`;
  const statusFilter = list.some(x => x.status) ? `<label class="f inline"><span>Status</span><select id="libStatus"><option value="">Any (${nStatus('')})</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${libStatus === k ? ' selected' : ''}>${v.label} (${nStatus(k)})</option>`).join('')}</select></label>` : '';
  view.innerHTML = `<h1>Case files</h1>
    <p class="muted">Cases ready to print and play. Downloads marked <span class="spoiltag">Chisel only</span> give the game away, so only the Chisel should open them. Print card sheets at 100% (actual size).</p>
    <p class="muted">A case is marked <strong>Playtested</strong> after 3 playtests. Until then it shows <strong>Needs playtest</strong>: play it, check what to pay attention to, then use <strong>Send feedback</strong> so it can be tuned. Detectives can read their list before playing; the Chisel list has spoilers.</p>
    ${statusFilter}
    ${new Set(list.map(x => x.kind)).size > 1 ? `<div class="chips" style="margin:.6rem 0 1rem">${[['all', 'All cases'], ['original', 'Case Builder originals'], ['fan', 'Fan cases']].map(([k, l]) => `<button class="chip${libFilter === k ? ' on' : ''}" data-act="libfilter" data-k="${k}">${l}</button>`).join('')}</div>` : '<div style="height:.6rem"></div>'}
    <div class="library">${shown.map(card).join('') || '<div class="panel empty">No cases match this filter.</div>'}</div>
    <div class="panel small" style="margin-top:1rem">
      ${list.some(x => x.kind === 'fan') ? '<p>Fan cases are credited to their authors and shared here with their permission. They are free and may not be sold. Authors who would like their case updated or removed can write to <a href="mailto:skirmishgames.app@gmail.com">skirmishgames.app@gmail.com</a>.</p>' : ''}
      <p>Made a case of your own? Build it in <a href="#/cases">My cases</a>, then send the backup file to <a href="mailto:skirmishgames.app@gmail.com">skirmishgames.app@gmail.com</a> to have it considered for this page.</p>
    </div>`;
}

// ---------- build ----------
function buildView() {
  const steps = `<nav class="steps" aria-label="Build steps">${STEPS.map(([k, l], i) => `<a href="#/build/${k}" class="${state.step === k ? 'on' : ''}"><span class="n">${i + 1}</span>${l}</a>`).join('')}</nav>`;
  const fn = { story: storyStep, city: cityStep, cards: cardsStep, responses: responsesStep, search: searchStep, mystery: mysteryStep, checks: checksStep, epilogue: epilogueStep, briefing: briefingStep }[state.step] || storyStep;
  const guideLink = { story: 'story', city: 'city', cards: 'cards', responses: 'responses', search: 'search', mystery: 'anatomy', checks: 'checks', epilogue: 'epilogue', briefing: 'briefing' }[state.step];
  return steps + fn() + `<p class="small"><a href="#/guide/${guideLink}">Read the guide for this step</a></p>`;
}

function storyStep() {
  const c = state.c;
  const susOpts = cardOpts(k => k.type === 'suspect', 'Choose the guilty suspect');
  const wOpts = cardOpts(k => k.type === 'evidence', 'Choose the weapon');
  return `<div class="panel folder" data-tab="Case file">
    <div class="row">${fText('Case title', 'title', { ph: 'The Vexed Accountant' })}${fText('Case ID', 'caseId', { ph: 'Printed on the briefing' })}</div>
    <div class="row">${fText('Author', 'author')}<label class="f"><span>Difficulty</span><input type="text" list="difficulties" data-bind="difficulty" value="${esc(c.difficulty)}"></label></div>
    <datalist id="difficulties"><option value="Gumshoe"><option value="Veteran"><option value="Hardboiled"></datalist>
    ${fArea('Story outline (what really happened)', 'outline', { rows: 12, ph: '- Victim is ...\n- The killer is ...\n- The crime looks like ...', hint: 'Short bullet points of what really happened. Give every suspect a secret and a reason they could be guilty. Keep revising this as the case grows.' })}
  </div>
  <div class="panel"><h2>Solution</h2>
    ${c.cards.length ? '' : '<p class="hint">Add suspects and evidence on the Case cards step, then pick them here.</p>'}
    <div class="row">${fSelect('Guilty suspect', 'solution.suspect', susOpts)}${fSelect('Murder weapon', 'solution.weapon', wOpts)}</div>
    <span class="lbl">Motives (select every one that applies)</span>${motiveChips('solution.motives')}
  </div>
  <div class="panel"><h2>Alternate guesses</h2>
    <p class="hint">Plausible wrong solutions. Lies and misdirections that point at these give the Chisel good choices.</p>
    ${c.alternates.map((a, i) => `<div class="list-row"><div class="row">${fSelect('Suspect', `alternates.${i}.suspect`, cardOpts(k => k.type === 'suspect'))}${fSelect('Weapon', `alternates.${i}.weapon`, cardOpts(k => k.type === 'evidence'))}<div class="fit"><button class="btn small ghost" data-act="delalt" data-i="${i}">Remove</button></div></div>${motiveChips(`alternates.${i}.motives`)}${fText('Why it looks right', `alternates.${i}.note`)}</div>`).join('')}
    <button class="btn small" data-act="addalt">Add alternate guess</button>
  </div>
  <div class="panel"><h2>Unanswered questions</h2>
    <p class="hint">Leads the detectives don't start with. Tick each one off when a response, Search card or Case card answers it, and note where.</p>
    ${c.questions.map((q, i) => `<div class="list-row"><div class="row"><div class="fit">${fCheck('Answered', `questions.${i}.done`)}</div>${fText('Question', `questions.${i}.text`, { ph: 'How will players learn about ...?' })}${fText('Answered by', `questions.${i}.by`, { ph: 'Alice on Shamus (2a), Search (52)' })}<div class="fit"><button class="btn small ghost" data-act="delq" data-i="${i}">Remove</button></div></div></div>`).join('')}
    <button class="btn small" data-act="addq">Add question</button>
  </div>
  <div class="panel"><h2>Designer notes</h2>${fArea('Notes for yourself or the Chisel', 'notes', { rows: 5 })}</div>`;
}

function cityStep() {
  const c = state.c;
  const used = new Set(placeNumbers(c));
  const labels = new Map();
  c.places.forEach(p => { if (p.loc) labels.set(Number(p.loc), p.what || locName(p.loc)); });
  c.search.forEach(s => { if (s.kind === 'location' && s.loc && !labels.has(Number(s.loc))) labels.set(Number(s.loc), searchTitle(c, s) === String(s.loc) ? locName(s.loc) : searchTitle(c, s)); });
  const ds = districtsUsed(c);
  return `<div class="split"><div>
    <div class="panel folder" data-tab="City planning guide">
      <p class="hint">Tap a number on the map to add it to your plan. Red boxes are places the case uses.</p>
      <div class="map"><img src="assets/kit/templates/city_planner.jpg" alt="City planning map of Los Angeles with numbered locations">
      ${LOCATIONS.map(l => `<button type="button" class="hot${used.has(l.n) ? ' used' : ''}" style="left:${l.xy[0] * 100}%;top:${l.xy[1] * 100}%" title="${l.n} · ${esc(l.names.join(' / '))} (${l.districts.join(', ')})" data-act="addplace" data-loc="${l.n}" aria-label="Location ${l.n}"></button>`).join('')}
      ${[...labels].map(([n, t]) => { const l = LOCATIONS[n - 1]; return `<span class="pin" style="left:${l.xy[0] * 100}%;top:${l.xy[1] * 100}%">${esc(t)}</span>`; }).join('')}
      </div>
      <div class="dist">${DISTRICTS.map(d => `<span class="${ds.includes(d) ? 'on' : ''}">${d}</span>`).join('')}</div>
      <p class="small ${ds.length > 4 ? '' : 'muted'}">${ds.length} district${ds.length === 1 ? '' : 's'} in use. ${ds.length > 4 ? '<strong>Too spread out: keep it to four.</strong>' : 'Keep it to four at most, including Central L.A.'} Spots on a district border count toward whichever district you already use.</p>
    </div>
  </div><div class="side">
    <div class="panel"><h2>Places in this case</h2>
      ${c.places.length ? '' : '<p class="hint">Nothing placed yet.</p>'}
      ${c.places.map((p, i) => `<div class="list-row">
        ${fSelect('Location', `places.${i}.loc`, LOC_OPTS, { rr: 1 })}
        ${fText("What's here", `places.${i}.what`, { ph: 'Crime scene, Alice Dooley, the ledger' })}
        <div class="row">${fSelect('Kind', `places.${i}.kind`, [['', '-'], ['crime', 'Crime scene'], ['suspect', 'Suspect'], ['evidence', 'Evidence'], ['lead', 'Lead'], ['herring', 'Red herring']])}<div class="fit"><button class="btn small ghost" data-act="delplace" data-i="${i}">Remove</button></div></div>
        <div class="hint">${p.loc ? esc(LOCATIONS[p.loc - 1]?.districts.join(' / ')) : ''}</div>
      </div>`).join('')}
      <button class="btn small" data-act="addplace" data-loc="">Add place</button>
    </div>
  </div></div>`;
}

function cardsStep() {
  const c = state.c;
  if (!state.selCard || !c.cards.some(k => k.id === state.selCard)) state.selCard = c.cards[0]?.id || null;
  const card = c.cards.find(k => k.id === state.selCard);
  const tiles = `<div class="tiles">${c.cards.map((k, i) => `<button type="button" class="tile${k.id === state.selCard ? ' on' : ''}" data-act="selcard" data-id="${k.id}">
      <span class="L">${LETTERS[i]}</span>${k.faceUp ? '<span class="up">FACE UP</span>' : ''}
      <div class="t">${CARD_TYPES[k.type].label}${k.weapon ? ' · weapon' : ''}</div><div class="nm">${esc(k.name || (k.type === 'info' ? k.text.slice(0, 40) : '') || 'Unnamed')}</div></button>`).join('')}</div>`;
  const add = c.cards.length < MAX_CASE_CARDS ? `<div class="btns">${Object.entries(CARD_TYPES).map(([t, d]) => `<button class="btn small${t === 'suspect' ? '' : ' ghost'}" data-act="addcard" data-type="${t}">+ ${d.label}</button>`).join('')}</div>` : '<p class="hint">All 12 Case cards used.</p>';
  if (!card) return `<div class="panel folder" data-tab="Case cards A to L"><p>Case cards are the backbone of the case. Card A is usually the victim (or the crime), followed by the suspects, evidence and information.</p>${add}</div>`;
  const i = c.cards.indexOf(card), p = `cards.${i}`;
  const frame = frameOf(card);
  const kit = card.type === 'evidence' || card.type === 'crime' ? ['Evidence', 'Male', 'Female'] : ['Male', 'Female', 'Evidence'];
  return `<div class="panel folder" data-tab="Case cards A to L">${tiles}${add}</div>
  <div class="split"><div class="panel">
    <h2>Case card ${LETTERS[i]}</h2>
    <div class="btns"><button class="btn small ghost" data-act="movecard" data-dir="-1" ${i === 0 ? 'disabled' : ''}>Move earlier</button><button class="btn small ghost" data-act="movecard" data-dir="1" ${i === c.cards.length - 1 ? 'disabled' : ''}>Move later</button><button class="btn small ghost" data-act="delcard">Delete card</button></div>
    <div class="row">${fSelect('Type', `${p}.type`, Object.entries(CARD_TYPES).map(([k, d]) => [k, d.label]), { rr: 1 })}${fSelect('Layout', `${p}.frame`, [['', `Default (${frame === 'tag' ? 'tag' : frame === 'info' ? 'information sheet' : 'notebook'})`], ['notebook', 'Notebook (people)'], ['tag', 'Tag (evidence)'], ['info', 'Information sheet']], { rr: 1 })}</div>
    ${frame === 'info' ? fArea('Information', `${p}.text`, { rows: 3, ph: 'Jack Shamus was blackmailing Reginald Dooley.', hint: 'Short and punchy. It is written by hand on the sheet.' }) + fText('Short name (for the grid and lists)', `${p}.name`, { ph: 'Shamus blackmail' }) : `
    ${fText('Name', `${p}.name`, { ph: frame === 'tag' ? 'Granite paperweight' : 'Alice Dooley', rr: 0 })}
    ${frame === 'notebook' ? fText('Role (red line)', `${p}.role`, { ph: card.type === 'victim' ? 'The victim' : "Victim's wife" }) : ''}
    ${fArea('Description', `${p}.text`, { rows: 4, ph: frame === 'tag' ? 'A heavy paperweight made out of granite. The corner is covered in dried blood.' : 'Alice is surprisingly chipper for someone who just lost her husband.', hint: 'Use **double asterisks** for bold words.' })}`}
    <div class="row">${fSelect('Found at', `${p}.foundAt`, LOC_OPTS)}</div>
    ${frame === 'tag' ? '<div class="hint">For evidence, "Found at" is printed at the bottom of the tag.</div>' : ''}
    <div>${fCheck('Face up at the start', `${p}.faceUp`, { rr: 1 })}${card.type === 'evidence' ? fCheck('Possible murder weapon', `${p}.weapon`, { rr: 1 }) : ''}</div>
    ${frame === 'info' ? '' : imageControls(`${p}.image`, { kit })}
  </div><div class="side panel"><div class="preview" data-pv="case:${card.id}"></div></div></div>`;
}

function responsesStep() {
  const c = state.c;
  const sus = suspects(c);
  if (!sus.length) return `<div class="panel empty">Add suspects on the <a href="#/build/cards">Case cards</a> step first. Each suspect answers questions about every Case card.</div>`;
  if (!state.respSuspect || !sus.some(s => s.id === state.respSuspect)) state.respSuspect = sus[0].id;
  const { codes, cards } = assignCodes(c);
  const s = c.cards.find(k => k.id === state.respSuspect);
  const total = allResponses(c).length, est = c.cards.length * sus.length * 2;
  const matrix = `<div class="matrix-wrap"><table class="matrix"><thead><tr><th></th>${c.cards.map((k, i) => `<th title="${esc(cardName(c, k))}">${LETTERS[i]}</th>`).join('')}</tr></thead><tbody>
    ${sus.map(x => `<tr><th class="rowh">${esc(cardName(c, x))}</th>${c.cards.map(k => {
      const list = cellResponses(c, x.id, k.id), u = list.filter(r => r.kind === 'useful').length, l = list.length - u;
      const cls = !list.length ? 'st-none' : u === 1 ? 'st-ok' : u > 1 ? 'st-bad' : 'st-part';
      return `<td class="${cls}" data-act="jump" data-s="${x.id}" data-k="${k.id}" title="${esc(cardName(c, x))} about ${esc(cardName(c, k))}">${list.length ? `${u}${l ? '+' + l : ''}` : '-'}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="small muted">Cells show most useful + lies. Green: done. Amber: lies but no most useful. Red: more than one most useful.</p>`;
  const lookOpts = [['', 'No card to look at']].concat(c.cards.map((k, i) => [k.id, `Look at Case card ${LETTERS[i]}`])).concat(c.mystery.map((m, i) => ['M:' + m.id, `Look at Mystery card ${i + 1}`]));
  const sections = c.cards.map((k, ci) => {
    const list = cellResponses(c, s.id, k.id);
    const ordered = orderedCell(list);
    const u = list.filter(r => r.kind === 'useful').length;
    const st = !list.length ? '<span class="muted">Not written</span>' : u === 1 ? '<span style="color:var(--ok)">Has most useful</span>' : u > 1 ? '<span style="color:var(--red)">Two most useful</span>' : '<span style="color:var(--warn)">Needs most useful</span>';
    return `<div class="q" id="q-${k.id}"><div class="qh"><span class="L">${LETTERS[ci]}</span><span class="nm">${esc(cardName(c, k))}</span><span class="muted small">${CARD_TYPES[k.type].label}${k.id === s.id ? ' (themselves)' : ''}</span><span class="st">${st}</span></div><div class="body">
      ${ordered.map(r => { const idx = list.indexOf(r); const path = `responses.${s.id}.${k.id}.${idx}`; return `<div class="resp ${r.kind === 'useful' ? 'useful' : 'lie'}"><div class="bar"><span class="code">${codes.get(r.id) || ''}</span>
        <span class="seg"><button type="button" class="useful${r.kind === 'useful' ? ' on' : ''}" data-act="kind" data-s="${s.id}" data-k="${k.id}" data-r="${r.id}" data-v="useful">Most useful</button><button type="button" class="lie${r.kind !== 'useful' ? ' on' : ''}" data-act="kind" data-s="${s.id}" data-k="${k.id}" data-r="${r.id}" data-v="lie">Lie / misdirection</button></span>
        <select data-bind="${path}.look" aria-label="Look at a card">${lookOpts.map(([v, l]) => `<option value="${esc(v)}"${v === (r.look || '') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <button type="button" class="btn small ghost" data-act="delresp" data-s="${s.id}" data-k="${k.id}" data-r="${r.id}">Delete</button></div>
        <textarea data-bind="${path}.text" rows="3" placeholder="${r.kind === 'useful' ? 'Always true. Never a confession from the killer.' : 'A lie, or a truth that points the wrong way.'}">${esc(r.text)}</textarea></div>`; }).join('')}
      <div class="btns"><button class="btn small" data-act="addresp" data-s="${s.id}" data-k="${k.id}" data-v="useful" ${u ? 'disabled' : ''}>+ Most useful</button><button class="btn small ghost" data-act="addresp" data-s="${s.id}" data-k="${k.id}" data-v="lie">+ Lie / misdirection</button></div>
    </div></div>`;
  }).join('');
  const myCards = cards.filter(x => x.suspectId === s.id).length;
  return `<div class="panel folder" data-tab="Chisel grid">
    ${matrix}
    <p class="small">${total} responses written. Rough target: ${est} (Case cards x suspects x 2). ${cards.length} Response card${cards.length === 1 ? '' : 's'}.</p>
    <div>${fCheck('Start each suspect on a new Response card', 'settings.newCardPerSuspect', { rr: 1 })}${fCheck("Show the suspect's portrait on Response cards", 'settings.portraits')}</div>
  </div>
  <div class="panel"><span class="lbl">Questioning</span><div class="chips">${sus.map(x => `<button type="button" class="chip${x.id === s.id ? ' on' : ''}" data-act="pickSus" data-id="${x.id}">${esc(cardName(c, x))}</button>`).join('')}</div>
    <p class="hint">What does ${esc(cardName(c, s))} say when asked about each Case card? Stay in character: what do they know, and what are they hiding?</p>
    ${sections}
  </div>
  <div class="panel"><h2>${esc(cardName(c, s))}'s Response cards (${myCards})</h2><p class="hint">Front and back of each card. Each side's text faces its edge, ready for the ARC sleeve.</p><div class="preview" data-pv="resp:${s.id}"></div></div>`;
}

function searchStep() {
  const c = state.c;
  if (!state.selSearch || !c.search.some(s => s.id === state.selSearch)) state.selSearch = c.search[0]?.id || null;
  const s = c.search.find(x => x.id === state.selSearch);
  const tiles = `<div class="tiles">${c.search.map(x => `<button type="button" class="tile${x.id === state.selSearch ? ' on' : ''}" data-act="selsearch" data-id="${x.id}">
    <span class="L" style="font-size:1.2rem">${esc(x.kind === 'location' ? (x.loc ? `(${x.loc})` : '( )') : 'Suspect')}</span>${x.archive ? '<span class="up" style="color:#6b3fb0">ARCHIVE</span>' : ''}
    <div class="nm">${esc(x.kind === 'location' ? (x.title || locName(x.loc) || 'Location') : searchTitle(c, x))}</div><div class="t">${esc(searchInstruction(c, x).slice(0, 34))}</div></button>`).join('')}</div>`;
  const head = `<div class="panel folder" data-tab="Search cards">
    <p class="hint">One card for every suspect and every location that could be searched, including red herrings mentioned in responses.</p>
    ${tiles}
    <div class="btns"><button class="btn small" data-act="addsearch" data-kind="location">+ Location</button><button class="btn small ghost" data-act="addsearch" data-kind="suspect">+ Suspect</button><button class="btn small ghost" data-act="fillsearch">Add missing cards</button></div>
    <div class="hint">"Add missing cards" creates a card for each suspect, each place on your city plan and each (number) mentioned anywhere in the case.</div></div>`;
  if (!s) return head;
  const i = c.search.indexOf(s), p = `search.${i}`;
  const targetOpts = s.action === 'mystery' ? [['', 'Choose']].concat(c.mystery.map((m, j) => [m.id, `Mystery card ${j + 1}${m.title ? ' · ' + m.title : ''}`]))
    : s.action === 'place' ? cardOpts(k => k.type === 'suspect', 'Choose suspect') : cardOpts(() => true, 'Choose card');
  return head + `<div class="split"><div class="panel">
    <h2>${esc(searchTitle(c, s) || 'New Search card')}</h2>
    <div class="btns"><button class="btn small ghost" data-act="movesearch" data-dir="-1" ${i === 0 ? 'disabled' : ''}>Move earlier</button><button class="btn small ghost" data-act="movesearch" data-dir="1" ${i === c.search.length - 1 ? 'disabled' : ''}>Move later</button><button class="btn small ghost" data-act="delsearch">Delete card</button></div>
    <div class="row">${fSelect('Searching', `${p}.kind`, [['location', 'A location'], ['suspect', 'A suspect']], { rr: 1 })}
    ${s.kind === 'location' ? fSelect('Location', `${p}.loc`, LOC_OPTS, { rr: 1 }) : fSelect('Suspect', `${p}.suspect`, cardOpts(k => k.type === 'suspect', 'Choose suspect'), { rr: 1 })}</div>
    ${fText('Heading (leave blank for the default)', `${p}.title`, { ph: s.kind === 'location' ? 'Defaults to the location number' : 'Defaults to the suspect name' })}
    ${fArea('What the detective finds', `${p}.text`, { rows: 6, ph: 'You frisk Alice and find a bank receipt in her left pocket ...', hint: 'If this card is not archived, more than one detective will read it. Write it so it can happen again.' })}
    <div class="row">${fSelect('Result', `${p}.action`, [['none', 'Nothing more'], ['take', 'Take a Case card'], ['flip', 'Flip a Case card'], ['place', 'Flip a suspect and place them'], ['mystery', 'Reveal a Mystery card'], ['custom', 'Write my own instruction']], { rr: 1 })}
    ${['take', 'flip', 'place', 'mystery'].includes(s.action) ? fSelect(s.action === 'place' ? 'Suspect card' : 'Card', `${p}.target`, targetOpts, { rr: 1 }) : ''}
    ${s.action === 'place' ? fSelect('Place them at', `${p}.place`, LOC_OPTS, { rr: 1 }) : ''}</div>
    ${s.action === 'custom' ? fArea('Instruction (printed in bold)', `${p}.instruction`, { rows: 2, ph: 'TAKE CASE CARD H' }) : `<div class="hint">Printed instruction: <strong>${esc(searchInstruction(c, s) || 'none')}</strong></div>`}
    ${fCheck('Archive after reading (single use)', `${p}.archive`, { rr: 1 })}
    ${imageControls(`${p}.image`, { useSuspect: s.kind === 'suspect' })}
  </div><div class="side panel"><div class="preview" data-pv="search:${s.id}"></div></div></div>`;
}

function mysteryStep() {
  const c = state.c;
  if (!state.selMystery || !c.mystery.some(m => m.id === state.selMystery)) state.selMystery = c.mystery[0]?.id || null;
  const m = c.mystery.find(x => x.id === state.selMystery);
  const head = `<div class="panel folder" data-tab="Mystery cards">
    <p class="hint">Optional. Twists, new rules or a card that replaces a Case card later in the game. Not every case needs them. The kit has backs for six.</p>
    <div class="tiles">${c.mystery.map((x, i) => `<button type="button" class="tile${x.id === state.selMystery ? ' on' : ''}" data-act="selmys" data-id="${x.id}"><span class="L">${i + 1}</span><div class="nm">${esc(x.title || 'Untitled')}</div></button>`).join('')}</div>
    ${c.mystery.length < MAX_MYSTERY ? '<button class="btn small" data-act="addmys">+ Mystery card</button>' : ''}</div>`;
  if (!m) return head;
  const i = c.mystery.indexOf(m), p = `mystery.${i}`;
  return head + `<div class="split"><div class="panel"><h2>Mystery card ${i + 1}</h2>
    <div class="btns"><button class="btn small ghost" data-act="movemys" data-dir="-1" ${i === 0 ? 'disabled' : ''}>Move earlier</button><button class="btn small ghost" data-act="movemys" data-dir="1" ${i === c.mystery.length - 1 ? 'disabled' : ''}>Move later</button><button class="btn small ghost" data-act="delmys">Delete card</button></div>
    ${fText('Title', `${p}.title`, { ph: 'Vice dossier' })}
    ${fArea('Text', `${p}.text`, { rows: 7, hint: 'Blank lines separate paragraphs. Use **bold** for emphasis.' })}
    ${fSelect('Replaces Case card (for your notes)', `${p}.replaces`, cardOpts())}
    ${imageControls(`${p}.image`, { kit: ['Evidence', 'Male', 'Female'] })}
  </div><div class="side panel"><div class="preview" data-pv="mystery:${m.id}"></div></div></div>`;
}

function checksStep() {
  return `<div class="panel folder" data-tab="Checks"><p class="hint">Rules of thumb from the design guide. Errors make the case broken or unplayable; warnings are worth a second look.</p><div id="checkOut" class="progress">Checking layouts and links ...</div></div>`;
}
async function runCheckView() {
  const c = state.c;
  const overflow = [];
  await fontsReady();
  for (const k of c.cards) { const r = await renderCaseCard(c, k); if (r.overflow) overflow.push({ step: 'cards', text: `Text on Case card ${letterOf(c, k.id)} is too long and has been squeezed or cut.` }); }
  for (const s of c.search) { const r = await renderSearchFront(c, s); if (r.overflow) overflow.push({ step: 'search', text: `Text on the Search card "${searchTitle(c, s)}" is too long.` }); }
  for (const [i, m] of c.mystery.entries()) { const r = await renderMysteryFront(c, m); if (r.overflow) overflow.push({ step: 'mystery', text: `Text on Mystery card ${i + 1} is too long.` }); }
  for (const rc of responseCards(c)) for (const side of ['front', 'back']) {
    const r = await renderResponseCard(c, rc, side);
    for (const [L, o] of Object.entries(r.overflow)) if (o) overflow.push({ step: 'responses', text: `Response ${rc.num}${L} is too long for its side of the card.` });
  }
  const b = await renderBriefing(c);
  if (b.overflow) overflow.push({ step: 'briefing', text: 'The briefing does not fit on the page.' });
  if (state.tab !== 'build' || state.step !== 'checks' || state.c !== c) return;
  const list = runChecks(c, { overflow });
  const order = { error: 0, warn: 1, info: 2 };
  list.sort((a, b2) => order[a.level] - order[b2.level]);
  const n = l => list.filter(x => x.level === l).length;
  $('#checkOut').outerHTML = `<p><strong>${n('error')}</strong> errors, <strong>${n('warn')}</strong> warnings, ${n('info')} notes.</p>
    <ul class="checks">${list.map(x => `<li><span class="lv ${x.level}">${x.level === 'warn' ? 'Warning' : x.level === 'error' ? 'Error' : 'Note'}</span><span>${esc(x.text)}</span><a href="#/build/${x.step}">Go</a></li>`).join('')}</ul>`;
}

function epilogueStep() {
  return `<div class="panel folder" data-tab="Epilogue">
    ${fArea('Epilogue (read aloud at the end)', 'epilogue', { rows: 18, cls: 'tall', hint: 'Peel the case back layer by layer and save the killer for the last paragraph.' })}
    <p class="small muted">${wordCount(state.c).toLocaleString()} words in the case so far.</p>
  </div>`;
}

function briefingStep() {
  const c = state.c;
  const b = c.briefing;
  const letterOpts = c.cards.map((k, i) => `<option value="${LETTERS[i]}">${LETTERS[i]} · ${esc(cardName(c, k))}</option>`).join('');
  return `<div class="split"><div>
    <div class="panel folder" data-tab="Detective briefing">
    ${fArea('Briefing', 'briefing.body', { rows: 16, cls: 'tall', id: 'briefBody', hint: 'Blank lines separate paragraphs. Put setup instructions in brackets at the right moment.' })}
    <div class="row">
      <label class="f"><span>Flip a Case card</span><select id="insCard">${letterOpts}</select></label>
      <div class="fit"><button class="btn small ghost" data-act="ins" data-what="flip">Insert</button></div>
      <label class="f"><span>Crime scene marker at</span><select id="insLoc">${LOC_OPTS.slice(1).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label>
      <div class="fit"><button class="btn small ghost" data-act="ins" data-what="scene">Insert</button></div>
    </div>
    ${fArea('Solving the case', 'briefing.solving', { rows: 2 })}
    ${fArea('Special rules', 'briefing.special', { rows: 5 })}
    ${fSelect('Briefing text size', 'briefing.fontSize', [['0', 'Automatic'], ['32', 'Large'], ['28', 'Medium'], ['24', 'Small'], ['21', 'Very small']])}
    </div>
    <div class="panel"><h2>Locations of interest</h2><p class="hint">Every important place named in the briefing, gathered in one list.</p>
      ${b.locations.map((x, i) => `<div class="list-row"><div class="row">${fSelect('Location', `briefing.locations.${i}.loc`, LOC_OPTS)}${fText('Name (optional)', `briefing.locations.${i}.name`, { ph: locName(x.loc) || 'Dooley residence' })}${fText('Label', `briefing.locations.${i}.label`, { ph: 'Crime scene' })}<div class="fit"><button class="btn small ghost" data-act="delbloc" data-i="${i}">Remove</button></div></div></div>`).join('')}
      <div class="btns"><button class="btn small" data-act="addbloc">Add location</button><button class="btn small ghost" data-act="suggestbloc">Add every (number) in the briefing</button></div>
    </div>
  </div><div class="side panel"><div class="preview pv-briefing" data-pv="brief"></div><p class="small muted" style="text-align:center">Letter size. Print it from the Print tab.</p></div></div>`;
}

// ---------- print ----------
function printOpts() {
  try { return { paper: 'letter', cropMarks: true, backs: true, ...JSON.parse(localStorage.getItem('dcoa-print') || '{}') }; } catch { return { paper: 'letter', cropMarks: true, backs: true }; }
}
function printView() {
  const c = state.c, o = printOpts();
  const counts = { briefing: 1, case: c.cards.length, mystery: c.mystery.length, search: c.search.length, response: responseCards(c).length };
  return `<h1>Print ${esc(c.title || 'your case')}</h1>
  <div class="panel folder" data-tab="Print settings">
    <div class="row">
      <label class="f"><span>Paper</span><select id="pPaper"><option value="letter"${o.paper === 'letter' ? ' selected' : ''}>Letter</option><option value="a4"${o.paper === 'a4' ? ' selected' : ''}>A4</option></select></label>
      <div><label class="check"><input type="checkbox" id="pMarks"${o.cropMarks ? ' checked' : ''}> Crop marks</label><label class="check"><input type="checkbox" id="pBacks"${o.backs ? ' checked' : ''}> Include card backs</label></div>
    </div>
    <p class="hint">Print at 100% (actual size), not "fit to page". Each fronts page is followed by its backs page, mirrored for printing double-sided and flipping on the long edge. Cards share cut lines, so one cut separates two cards.</p>
  </div>
  <div class="panel"><h2>Cards and briefing (PDF)</h2>
    <div class="btns">${Object.entries(PARTS).map(([k, p]) => `<button class="btn ghost" data-act="pdf" data-part="${k}" ${counts[k] ? '' : 'disabled'}>${p.label} (${counts[k]})</button>`).join('')}</div>
    <div class="btns"><button class="btn" data-act="pdf" data-part="all">Everything in one PDF</button></div>
    <div class="progress" id="pdfProgress"></div>
    <p class="small muted">Sizes: Case and Mystery cards 2.25 x 3.5 in, Response cards 3 x 3 in, Search cards 1.77 x 2.68 in. Response cards need the ARC sleeve from the game.</p>
  </div>
  <div class="panel"><h2>For the Chisel and the designer</h2>
    <div class="btns">
      <button class="btn ghost" data-act="doc" data-doc="grid">Chisel grid</button>
      <button class="btn ghost" data-act="doc" data-doc="epilogue">Epilogue</button>
      <button class="btn ghost" data-act="doc" data-doc="bible">Case bible</button>
      <button class="btn ghost" data-act="doc" data-doc="city">City plan</button>
    </div>
    <p class="small muted">These open your browser's print dialog. Choose "Save as PDF" to keep a copy.</p>
  </div>
  <div class="panel"><h2>Back up</h2><p class="hint">Save the whole case, pictures included, as a file. Restore it from the Cases tab on any device.</p><button class="btn ghost" data-act="export" data-id="${c.id}">Download backup</button></div>`;
}

function docHTML(kind, c = state.c) {
  const base = location.href.split('#')[0].replace(/[^/]*$/, '');
  const css = `@page{size:${kind === 'grid' || kind === 'city' ? 'letter landscape' : 'letter'};margin:10mm}
  body{font:10pt/1.35 "Courier Prime","Courier New",monospace;color:#111;margin:0}
  h1{font:400 20pt "Special Elite","Courier New",monospace;margin:0 0 6pt}
  h2{font:600 11pt Oswald,Arial Narrow,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin:12pt 0 4pt;border-bottom:1px solid #999}
  table{border-collapse:collapse;width:100%;table-layout:fixed;page-break-inside:auto}
  th,td{border:1px solid #777;vertical-align:top;padding:2pt 3pt;font-size:6.6pt;line-height:1.22}
  th{font:600 7pt Oswald,Arial Narrow,sans-serif;text-transform:uppercase;background:#eee}
  tr{page-break-inside:avoid}
  .code{font-weight:700;background:#111;color:#fff;padding:0 2pt;margin-right:2pt}
  .lie{color:#b3241f}
  .look{font-weight:700}
  .rowh{width:9%;font-size:7.5pt}
  .meta{color:#555;font-size:9pt}
  p{margin:0 0 6pt;white-space:pre-wrap}
  .map{position:relative}.map img{width:100%;display:block}
  .pin{position:absolute;transform:translate(-50%,-50%);width:22pt;height:22pt;border:3pt solid #c00;border-radius:4pt}
  ul{margin:0;padding-left:14pt}`;
  const fonts = `<link rel="stylesheet" href="${base}css/styles.css" media="none" onload="this.media='all'">`;
  let body = '';
  if (kind === 'grid') {
    const { codes } = assignCodes(c);
    const sus = suspects(c);
    const halves = [c.cards.slice(0, 6), c.cards.slice(6)].filter(h => h.length);
    body = `<h1>${esc(c.title)}: Chisel grid</h1>` + halves.map(cols => `<table><thead><tr><th class="rowh"></th>${cols.map(k => `<th>(${letterOf(c, k.id)}) ${esc(CARD_TYPES[k.type].label)}<br>${esc(cardName(c, k))}</th>`).join('')}</tr></thead><tbody>
      ${sus.map(s => `<tr><th class="rowh">${esc(cardName(c, s))}</th>${cols.map(k => `<td>${orderedCell(cellResponses(c, s.id, k.id)).map(r => `<div class="${r.kind === 'useful' ? '' : 'lie'}"><span class="code">${codes.get(r.id)}</span>${esc(r.text)}${r.look ? ` <span class="look">${esc(lookLine(c, r.look))}</span>` : ''}</div>`).join('<div style="height:3pt"></div>')}</td>`).join('')}</tr>`).join('')}
      </tbody></table><div style="height:8pt"></div>`).join('') + '<p class="meta">Black: most useful response. Red: lie or misdirection.</p>';
  } else if (kind === 'epilogue') {
    body = `<h1>${esc(c.title)}: epilogue</h1><p>${esc(c.epilogue)}</p>`;
  } else if (kind === 'city') {
    const nums = placeNumbers(c);
    body = `<h1>${esc(c.title)}: city plan</h1><div class="map"><img src="${base}assets/kit/templates/city_planner.jpg">${nums.map(n => { const l = LOCATIONS[n - 1]; return `<span class="pin" style="left:${l.xy[0] * 100}%;top:${l.xy[1] * 100}%"></span>`; }).join('')}</div>
      <p class="meta">Districts: ${esc(districtsUsed(c).join(', ') || 'none')}</p>`;
  } else {
    const k = id => cardName(c, c.cards.find(x => x.id === id));
    body = `<h1>${esc(c.title)}: case bible</h1><p class="meta">${esc([c.caseId, c.author, c.difficulty].filter(Boolean).join(' · '))}</p>
      <h2>Solution</h2><p>Suspect: ${esc(k(c.solution.suspect) || '-')}\nWeapon: ${esc(k(c.solution.weapon) || '-')}\nMotive: ${esc(c.solution.motives.join(', ') || '-')}</p>
      <h2>Outline</h2><p>${esc(c.outline)}</p>
      <h2>Alternate guesses</h2><ul>${c.alternates.map(a => `<li>${esc(k(a.suspect) || '?')}, ${esc(k(a.weapon) || '?')}, ${esc((a.motives || []).join(', '))}${a.note ? ': ' + esc(a.note) : ''}</li>`).join('')}</ul>
      <h2>Unanswered questions</h2><ul>${c.questions.map(q => `<li>${q.done ? '[x]' : '[ ]'} ${esc(q.text)}${q.by ? ` (${esc(q.by)})` : ''}</li>`).join('')}</ul>
      <h2>Case cards</h2><ul>${c.cards.map((x, i) => `<li>${LETTERS[i]}: ${esc(cardName(c, x))} (${CARD_TYPES[x.type].label}${x.faceUp ? ', face up' : ', hidden'}${x.foundAt ? ', ' + esc(locLabel(x.foundAt)) : ''})</li>`).join('')}</ul>
      <h2>Places</h2><ul>${c.places.map(p => `<li>${esc(locLabel(p.loc))}: ${esc(p.what)}</li>`).join('')}</ul>
      <h2>Search cards</h2><ul>${c.search.map(s => `<li>${esc(searchTitle(c, s))}: ${esc(searchInstruction(c, s) || 'no result')}${s.archive ? ' (archive)' : ''}</li>`).join('')}</ul>
      <h2>Notes</h2><p>${esc(c.notes)}</p>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.title)}</title>${fonts}<style>${css}</style></head><body>${body}</body></html>`;
}
function printDoc(kind, c = state.c) {
  const f = $('#printFrame');
  const d = f.contentDocument;
  d.open(); d.write(docHTML(kind, c)); d.close();
  const go = () => setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); }, 350);
  const imgs = [...d.images];
  if (!imgs.length) go();
  else Promise.all(imgs.map(im => im.complete ? 1 : new Promise(r => { im.onload = im.onerror = r; }))).then(go);
}

// ---------- about ----------
function aboutView() {
  return `<h1>About</h1><div class="panel">
  <p>Case Builder is a free fan project for writing your own cases for <em>Detective: City of Angels</em>. It is not made by or affiliated with Van Ryder Games.</p>
  <p><em>Detective: City of Angels</em> is designed by Evan Derrick, illustrated by Vincent Dutrait and published by <a href="https://vanrydergames.com/dcoa" rel="noopener">Van Ryder Games</a>. The card templates, kit art, card backs, briefing sheet and city planning map come from the official Case Design Kit, and the guide here summarises its Case Design Guide. All of that content is © Van Ryder Games. Cases made with the kit may not be sold or exchanged for money without Van Ryder Games' written permission.</p>
  <p>Fonts: Special Elite (Astigmatic), Courier Prime (Alan Dague-Greene), Permanent Marker (Font Diner), Caveat (Pablo Impallari) and Oswald (Vernon Adams), all under the SIL Open Font License. PDFs are made with jsPDF (MIT licence).</p>
  <p>Your cases stay in your browser. Nothing is uploaded anywhere.</p>
  <p>Made by <a href="https://boardgamegeek.com/profile/slyfoxbgg" rel="noopener">Ivan</a>. Questions or suggestions: <a href="mailto:skirmishgames.app@gmail.com">skirmishgames.app@gmail.com</a>.</p>
  </div>`;
}

// ---------- previews ----------
let pvTimer, pvToken = 0;
function schedulePreviews(ms = 220) { clearTimeout(pvTimer); pvTimer = setTimeout(refreshPreviews, ms); }
async function refreshPreviews() {
  const els = $$('[data-pv]', view);
  if (!els.length || !state.c) return;
  const token = ++pvToken;
  await fontsReady();
  const c = state.c;
  for (const el of els) {
    const [kind, id] = el.dataset.pv.split(':');
    let parts = [];
    if (kind === 'case') {
      const k = c.cards.find(x => x.id === id); if (!k) continue;
      parts = [[(await renderCaseCard(c, k)), 'Front'], [(await renderCaseBack(letterOf(c, k.id))), 'Back']];
    } else if (kind === 'search') {
      const s = c.search.find(x => x.id === id); if (!s) continue;
      parts = [[await renderSearchFront(c, s), 'Front'], [await renderSearchBack(s.archive), 'Back']];
    } else if (kind === 'mystery') {
      const i = c.mystery.findIndex(x => x.id === id); if (i < 0) continue;
      parts = [[await renderMysteryFront(c, c.mystery[i]), 'Front'], [await renderMysteryBack(i + 1), 'Back']];
    } else if (kind === 'resp') {
      for (const rc of responseCards(c).filter(x => x.suspectId === id)) {
        parts.push([await renderResponseCard(c, rc, 'front'), `Card ${rc.num} front`], [await renderResponseCard(c, rc, 'back'), `Card ${rc.num} back`]);
      }
      if (!parts.length) { el.innerHTML = '<p class="hint">No responses yet.</p>'; continue; }
    } else if (kind === 'brief') {
      parts = [[await renderBriefing(c), '']];
    }
    if (token !== pvToken) return;
    el.innerHTML = '';
    for (const [r, cap] of parts) {
      const d = document.createElement('div');
      d.className = 'pv' + (kind === 'resp' || kind === 'brief' ? ' wide' : '');
      d.appendChild(r.canvas);
      const over = r.overflow && (r.overflow === true || Object.values(r.overflow).some(Boolean));
      if (cap || over) d.insertAdjacentHTML('beforeend', `<div class="cap">${esc(cap)}${over ? ' <span style="color:var(--red)">· text too long</span>' : ''}</div>`);
      el.appendChild(d);
    }
  }
}

// ---------- actions ----------
function rerender() { const y = window.scrollY; view.innerHTML = buildView(); afterRender(); window.scrollTo(0, y); }
function changedStructure() { scheduleSave(); rerender(); }

async function processUpload(file) {
  const bmp = await createImageBitmap(file);
  const max = 1800, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise(res => cv.toBlob(res, 'image/jpeg', 0.9));
}
let pendingUpload = null;
const filePick = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', hidden: true });
document.body.appendChild(filePick);
filePick.addEventListener('change', async () => {
  const f = filePick.files[0]; filePick.value = '';
  if (!f || !pendingUpload) return;
  try {
    const blob = await processUpload(f);
    const id = await store.putImage(blob);
    setPath(state.c, pendingUpload, { src: 'img:' + id, zoom: 1, x: 0, y: 0 });
    changedStructure();
  } catch (e) { toast('Could not read that picture.'); }
});
const importPick = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json', hidden: true });
document.body.appendChild(importPick);
importPick.addEventListener('change', async () => {
  const f = importPick.files[0]; importPick.value = '';
  if (!f) return;
  try {
    const c = await store.importCase(JSON.parse(await f.text()));
    await openCase(c);
    toast(`Restored "${c.title}".`);
    location.hash = '#/build/story';
  } catch (e) { toast(e.message || 'Could not restore that file.'); }
});

function moveIn(arr, id, dir) {
  const i = arr.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

const ACTIONS = {
  libfilter(el) { libFilter = el.dataset.k; filesView(); },
  libjump(el) { libFilter = 'all'; filesView().then(() => document.getElementById('lib-' + el.dataset.slug)?.scrollIntoView({ behavior: 'smooth' })); },
  async libpdf(el) {
    const entry = (await loadLibrary()).find(x => x.slug === el.dataset.slug);
    const prog = $('#libprog-' + entry.slug);
    el.disabled = true;
    try {
      const data = await loadLibraryCase(entry);
      const name = await buildPDF(migrate(JSON.parse(JSON.stringify(data.case))), Object.keys(PARTS), { ...printOpts(), progress: t => { prog.textContent = `Drawing: ${t} ...`; } });
      prog.textContent = `Saved ${name}. Print at 100% (actual size).`;
    } catch (e) { prog.textContent = e.message || 'Could not make the PDF.'; }
    el.disabled = false;
  },
  async libdoc(el) {
    const entry = (await loadLibrary()).find(x => x.slug === el.dataset.slug);
    if (!confirm('This shows the solution. Only the Chisel should open it. Continue?')) return;
    const data = await loadLibraryCase(entry);
    printDoc(el.dataset.doc, migrate(JSON.parse(JSON.stringify(data.case))));
  },
  async libcopy(el) {
    const entry = (await loadLibrary()).find(x => x.slug === el.dataset.slug);
    if (!confirm('Opening a copy shows every answer and the solution. Continue?')) return;
    const data = await loadLibraryCase(entry);
    const c = await store.importCase(JSON.parse(JSON.stringify(data)), { asCopy: true });
    await openCase(c);
    toast(`"${c.title}" copied to My cases.`);
    location.hash = '#/build/story';
  },
  async newcase() {
    const c = newCase();
    await store.putCase(c); await openCase(c);
    location.hash = '#/build/story';
  },
  async demo() {
    const c = demoCase();
    await store.putCase(c); await openCase(c);
    toast('Example case loaded. It is a copy, so edit freely.');
    location.hash = '#/build/cards';
  },
  import() { importPick.click(); },
  async open(el) { await openCase(await store.getCase(el.dataset.id)); location.hash = '#/build/story'; },
  async export(el) {
    const c = el.dataset.id === state.c?.id ? state.c : await store.getCase(el.dataset.id);
    const data = await store.exportCase(c);
    download(`${slug(c.title)}-backup.json`, JSON.stringify(data));
  },
  async dupe(el) {
    const c = await store.getCase(el.dataset.id);
    const data = await store.exportCase(c);
    data.case.title += ' (copy)';
    await store.importCase(data, { asCopy: true });
    casesView();
  },
  async del(el) {
    const c = await store.getCase(el.dataset.id);
    if (!confirm(`Delete "${c.title}"? This cannot be undone. Back it up first if you might want it later.`)) return;
    await store.deleteCase(c);
    if (state.c?.id === c.id) { state.c = null; updatePill(); }
    casesView();
  },
  motive(el) {
    const p = el.dataset.path, m = el.dataset.m;
    const list = getPath(state.c, p) || [];
    setPath(state.c, p, list.includes(m) ? list.filter(x => x !== m) : [...list, m]);
    el.classList.toggle('on'); scheduleSave();
  },
  addalt() { state.c.alternates.push({ suspect: '', weapon: '', motives: [], note: '' }); changedStructure(); },
  delalt(el) { state.c.alternates.splice(+el.dataset.i, 1); changedStructure(); },
  addq() { state.c.questions.push({ text: '', by: '', done: false }); changedStructure(); },
  delq(el) { state.c.questions.splice(+el.dataset.i, 1); changedStructure(); },
  addplace(el) {
    const loc = el.dataset.loc;
    const at = state.c.places.findIndex(p => String(p.loc) === String(loc) && loc);
    if (at >= 0) { $(`[data-bind="places.${at}.what"]`)?.focus(); return; }
    state.c.places.push({ loc: loc ? Number(loc) : '', what: '', kind: '' });
    changedStructure();
    setTimeout(() => $(`[data-bind="places.${state.c.places.length - 1}.what"]`)?.focus(), 50);
  },
  delplace(el) { state.c.places.splice(+el.dataset.i, 1); changedStructure(); },
  addcard(el) {
    if (state.c.cards.length >= MAX_CASE_CARDS) return;
    const k = newCard(el.dataset.type);
    if (el.dataset.type === 'evidence') k.weapon = false;
    state.c.cards.push(k); state.selCard = k.id; changedStructure();
  },
  selcard(el) { state.selCard = el.dataset.id; rerender(); },
  movecard(el) { moveIn(state.c.cards, state.selCard, +el.dataset.dir); changedStructure(); },
  delcard() {
    const c = state.c, k = c.cards.find(x => x.id === state.selCard);
    if (!k || !confirm(`Delete Case card ${letterOf(c, k.id)} (${cardName(c, k)}) and every response about it?`)) return;
    c.cards = c.cards.filter(x => x.id !== k.id);
    delete c.responses[k.id];
    for (const s of Object.keys(c.responses)) delete c.responses[s][k.id];
    for (const s of Object.values(c.responses)) for (const list of Object.values(s)) for (const r of list) if (r.look === k.id) r.look = '';
    c.search.forEach(s => { if (s.target === k.id) s.target = ''; if (s.suspect === k.id) s.suspect = ''; });
    if (c.solution.suspect === k.id) c.solution.suspect = '';
    if (c.solution.weapon === k.id) c.solution.weapon = '';
    state.selCard = null; changedStructure();
  },
  upload(el) { pendingUpload = el.dataset.path; filePick.click(); },
  setimg(el) {
    const im = getPath(state.c, el.dataset.path) || {};
    setPath(state.c, el.dataset.path, { ...im, src: el.dataset.src, zoom: 1, x: 0, y: 0 });
    changedStructure();
  },
  pickSus(el) { state.respSuspect = el.dataset.id; rerender(); },
  jump(el) {
    state.respSuspect = el.dataset.s; rerender();
    setTimeout(() => document.getElementById('q-' + el.dataset.k)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  },
  addresp(el) {
    const { s, k, v } = el.dataset;
    const list = [...cellResponses(state.c, s, k)];
    const r = newResponse(v);
    list.push(r); setCell(state.c, s, k, list); changedStructure();
    setTimeout(() => { const i = list.indexOf(r); $(`[data-bind="responses.${s}.${k}.${i}.text"]`)?.focus(); }, 40);
  },
  kind(el) {
    const { s, k, r, v } = el.dataset;
    const list = cellResponses(state.c, s, k);
    const x = list.find(y => y.id === r);
    if (v === 'useful' && list.some(y => y.kind === 'useful' && y.id !== r)) toast('There is already a most useful response for this question. Each suspect gets one per question.');
    x.kind = v; changedStructure();
  },
  delresp(el) {
    const { s, k, r } = el.dataset;
    const list = cellResponses(state.c, s, k);
    const x = list.find(y => y.id === r);
    if (x.text.trim() && !confirm('Delete this response?')) return;
    setCell(state.c, s, k, list.filter(y => y.id !== r)); changedStructure();
  },
  addsearch(el) { const s = newSearch(el.dataset.kind); state.c.search.push(s); state.selSearch = s.id; changedStructure(); },
  selsearch(el) { state.selSearch = el.dataset.id; rerender(); },
  movesearch(el) { moveIn(state.c.search, state.selSearch, +el.dataset.dir); changedStructure(); },
  delsearch() {
    if (!confirm('Delete this Search card?')) return;
    state.c.search = state.c.search.filter(x => x.id !== state.selSearch); state.selSearch = null; changedStructure();
  },
  fillsearch() {
    const c = state.c;
    let n = 0;
    for (const s of suspects(c)) if (!c.search.some(x => x.kind === 'suspect' && x.suspect === s.id)) { const x = newSearch('suspect'); x.suspect = s.id; x.image.src = s.image?.src ? 'suspect' : ''; c.search.push(x); n++; }
    const locs = new Set(c.places.map(p => Number(p.loc)).filter(Boolean));
    const textLocs = [c.briefing.body, ...c.cards.map(k => k.text), ...c.mystery.map(m => m.text), ...allResponses(c).map(x => x.r.text), ...c.search.map(s => s.text)];
    textLocs.forEach(t => locRefs(t).forEach(n2 => locs.add(n2)));
    for (const loc of [...locs].sort((a, b) => a - b)) if (!c.search.some(x => x.kind === 'location' && Number(x.loc) === loc)) { const x = newSearch('location'); x.loc = loc; c.search.push(x); n++; }
    toast(n ? `Added ${n} Search card${n > 1 ? 's' : ''}.` : 'Nothing missing.');
    changedStructure();
  },
  addmys() { if (state.c.mystery.length >= MAX_MYSTERY) return; const m = newMystery(); state.c.mystery.push(m); state.selMystery = m.id; changedStructure(); },
  selmys(el) { state.selMystery = el.dataset.id; rerender(); },
  movemys(el) { moveIn(state.c.mystery, state.selMystery, +el.dataset.dir); changedStructure(); },
  delmys() {
    if (!confirm('Delete this Mystery card?')) return;
    const id = state.selMystery;
    state.c.mystery = state.c.mystery.filter(x => x.id !== id);
    state.c.search.forEach(s => { if (s.action === 'mystery' && s.target === id) s.target = ''; });
    state.selMystery = null; changedStructure();
  },
  ins(el) {
    const ta = $('#briefBody');
    let text = '';
    if (el.dataset.what === 'flip') text = `(flip Case card ${$('#insCard').value})`;
    else text = `(place the crime scene marker at ${$('#insLoc').value})`;
    const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
    ta.value = ta.value.slice(0, a) + text + ta.value.slice(b);
    ta.focus(); ta.selectionStart = ta.selectionEnd = a + text.length;
    state.c.briefing.body = ta.value; scheduleSave(); schedulePreviews();
  },
  addbloc() { state.c.briefing.locations.push({ loc: '', name: '', label: '' }); changedStructure(); },
  delbloc(el) { state.c.briefing.locations.splice(+el.dataset.i, 1); changedStructure(); },
  suggestbloc() {
    const b = state.c.briefing;
    const have = new Set(b.locations.map(x => Number(x.loc)));
    let n = 0;
    for (const loc of locRefs(b.body)) if (!have.has(loc)) { b.locations.push({ loc, name: '', label: '' }); have.add(loc); n++; }
    toast(n ? `Added ${n} location${n > 1 ? 's' : ''}.` : 'No new (numbers) found in the briefing.');
    changedStructure();
  },
  async pdf(el) {
    const part = el.dataset.part;
    const o = printOpts();
    const parts = part === 'all' ? Object.keys(PARTS) : [part];
    const prog = $('#pdfProgress');
    $$('[data-act="pdf"]').forEach(b => { b.dataset.was = b.disabled ? '1' : ''; b.disabled = true; });
    try {
      const name = await buildPDF(state.c, parts, { ...o, progress: t => { prog.textContent = `Drawing: ${t} ...`; } });
      prog.textContent = `Saved ${name}. Print at 100% (actual size).`;
    } catch (e) { prog.textContent = e.message || 'Could not make the PDF.'; }
    $$('[data-act="pdf"]').forEach(b => { b.disabled = b.dataset.was === '1'; });
  },
  doc(el) { printDoc(el.dataset.doc); },
};

view.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el); }
});
$('#casePill').addEventListener('click', () => { location.hash = '#/cases'; });
view.addEventListener('input', e => {
  const el = e.target.closest('[data-bind]');
  if (!el || !state.c) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.num) v = Number(v);
  const path = el.dataset.bind;
  if (/\.(loc|foundAt|place)$/.test(path) && v !== '') v = Number(v);
  setPath(state.c, path, v);
  if (path === 'title') updatePill();
  scheduleSave();
  if (el.dataset.rr && el.tagName !== 'INPUT' || el.dataset.rr && el.type === 'checkbox') rerender();
  else schedulePreviews();
});
view.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'libStatus') { libStatus = el.value; filesView(); return; }
  if (el.id === 'pPaper' || el.id === 'pMarks' || el.id === 'pBacks') {
    const o = { paper: $('#pPaper').value, cropMarks: $('#pMarks').checked, backs: $('#pBacks').checked };
    try { localStorage.setItem('dcoa-print', JSON.stringify(o)); } catch { /* ignore */ }
  }
});
view.addEventListener('focusout', e => {
  // Re-render after editing a name so tiles and lists catch up.
  const el = e.target.closest('[data-bind]');
  if (el && /\.name$|^title$/.test(el.dataset.bind) && state.tab === 'build' && ['cards', 'search'].includes(state.step)) {
    setTimeout(() => { if (!view.contains(document.activeElement) || document.activeElement === document.body) rerender(); }, 0);
  }
});

$('#themeBtn').addEventListener('click', () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('dcoa-theme', t); } catch { /* ignore */ }
});

window.addEventListener('hashchange', route);
(async function init() {
  try {
    const id = localStorage.getItem('dcoa-current');
    if (id) { const c = await store.getCase(id); if (c) await openCase(c); }
  } catch { /* first visit */ }
  route();
  fontsReady().then(() => schedulePreviews(0));
})();

// For the smoke test and the browser console.
window.CaseBuilder = { state, store, ACTIONS, newCase, uid };
