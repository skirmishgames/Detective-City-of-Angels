// Play a case on a tablet or phone, without printing. The device belongs to the Chisel.
import {
  LETTERS, CARD_TYPES, suspects, cardName, letterOf, cellResponses, orderedCell, searchTitle, searchInstruction,
  lookLine, locName, migrate, sleuthResponse,
} from './model.js?v=202611261402';
import {
  fontsReady, renderCaseCard, renderCaseBack, renderMysteryFront, renderMysteryBack, renderSearchFront,
} from './render.js?v=202611261402';
import * as store from './store.js?v=202611261402';
import { LOCATIONS, MOTIVES } from './data/locations.js?v=202611261402';

const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const $ = (s, el = document) => el.querySelector(s);
const para = t => String(t || '').split(/\n+/).filter(x => x.trim()).map(p => `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`).join('');

let G = null;            // { c, key, src, id, st }
let root = null;         // the view element
let tab = 'table';
let ask = { s: '', k: '' };
const pics = new Map();  // rendered card images by key

// ---------- loading ----------
async function loadGame(src, id) {
  let c;
  if (src === 'lib') {
    const lib = await fetch('cases/index.json', { cache: 'no-cache' }).then(r => r.json());
    const entry = lib.cases.find(x => x.slug === id);
    if (!entry?.data) throw new Error('That case is not in the case files.');
    c = (await fetch(entry.data, { cache: 'no-cache' }).then(r => r.json())).case;
  } else {
    c = await store.getCase(id);
    if (!c) throw new Error('That case is not saved in this browser.');
  }
  c = migrate(JSON.parse(JSON.stringify(c)));
  const key = `dcoa-play-${src}-${id}`;
  let st = null;
  try { st = JSON.parse(localStorage.getItem(key) || 'null'); } catch { st = null; }
  if (!st || st.caseUpdated !== (c.updated || 0)) st = freshState(c);
  return { c, key, src, id, st };
}
function freshState(c) {
  return {
    caseUpdated: c.updated || 0, stage: 'setup', mode: '',
    up: c.cards.filter(k => k.faceUp).map(k => k.id),
    mystery: [], over: {}, searched: [], log: [], ended: false,
    stress: 0, daysLost: 0, leverage: {}, challenged: [], read: [], guesses: [], outcome: '',
  };
}
function save() { try { localStorage.setItem(G.key, JSON.stringify(G.st)); } catch { /* private mode */ } }
function log(text) { G.st.log.unshift({ t: Date.now(), text }); G.st.log = G.st.log.slice(0, 200); save(); }

const isUp = id => G.st.up.includes(id);
const mysteryIndex = id => G.c.mystery.findIndex(m => m.id === id);

async function pic(key) {
  if (pics.has(key)) return pics.get(key);
  const p = (async () => {
    await fontsReady();
    const [kind, id] = key.split(':');
    const c = G.c;
    let r;
    if (kind === 'case') r = await renderCaseCard(c, c.cards.find(k => k.id === id));
    else if (kind === 'back') r = await renderCaseBack(id);
    else if (kind === 'mys') r = await renderMysteryFront(c, c.mystery.find(m => m.id === id));
    else if (kind === 'mysback') r = await renderMysteryBack(Number(id));
    else if (kind === 'search') r = await renderSearchFront(c, c.search.find(s => s.id === id));
    return r.canvas.toDataURL('image/jpeg', 0.88);
  })();
  pics.set(key, p);
  return p;
}
async function fillPics(el = root) {
  for (const im of el.querySelectorAll('img[data-pic]')) {
    const k = im.dataset.pic;
    pic(k).then(u => { if (im.dataset.pic === k) im.src = u; });
  }
}

// ---------- entry points ----------
export async function playView(view, parts) {
  root = view;
  const [src, id] = parts;
  if (!src) return chooser(view);
  view.innerHTML = '<p class="progress">Opening the case file ...</p>';
  try {
    if (!G || G.src !== src || G.id !== id) { pics.clear(); G = await loadGame(src, id); tab = 'table'; ask = { s: '', k: '' }; }
  } catch (e) { view.innerHTML = `<div class="panel empty">${esc(e.message)} <a href="#/play">Choose another case</a>.</div>`; return; }
  draw();
}

async function chooser(view) {
  view.innerHTML = '<p class="progress">Loading cases ...</p>';
  let lib = [];
  try { lib = (await fetch('cases/index.json', { cache: 'no-cache' }).then(r => r.json())).cases.filter(x => x.data); } catch { /* offline */ }
  const mine = await store.listCases();
  const row = (title, by, href, note) => `<li><a class="btn small" href="${href}">Play</a> <strong>${esc(title)}</strong> <span class="muted small">${esc(by)}${note ? ' · ' + esc(note) : ''}</span></li>`;
  view.innerHTML = `<h1>Play a case</h1>
  <div class="panel folder" data-tab="Choose a case">
    <h3>Case files</h3><ul class="playlist">${lib.map(x => row(x.title, 'by ' + x.author, `#/play/lib/${x.slug}`, x.difficulty)).join('') || '<li class="muted">None available.</li>'}</ul>
    <h3>My cases</h3><ul class="playlist">${mine.map(c => row(c.title || 'Untitled case', c.author ? 'by ' + c.author : '', `#/play/my/${c.id}`, `${c.cards.length} Case cards`)).join('') || '<li class="muted">No cases of your own yet.</li>'}</ul>
  </div>
  ${HOWTO}`;
}

const HOWTO = `<div class="panel howto"><h2>Playing without printing</h2>
  <p>This replaces every printed part of a case: the briefing, Case cards, Search cards, Response cards, Mystery cards, the Chisel grid and the epilogue. You still use the game box for the board, detective boards and pawns, action cubes, scratch, leverage and Solve tokens, the day marker and the crime scene marker.</p>
  <h3>What you need</h3>
  <ul>
    <li><strong>One device for the Chisel.</strong> An iPad works best: cards are big enough to pass around the table. A phone works too.</li>
    <li><strong>A stand-in for each suspect.</strong> Any spare standee or token with a sticky note.</li>
    <li><strong>Investigation sheets</strong> or paper for the detectives.</li>
  </ul>
  <h3>How a turn works</h3>
  <ol>
    <li><strong>Asking a question.</strong> A detective names a suspect and a Case card. The Chisel opens <em>Ask</em>, picks the suspect and the card, chooses one of the responses and taps <em>Show</em>. Only that response fills the screen. Hand the device to the detective; they tap <em>Done</em> when finished.</li>
    <li><strong>Looking at a card.</strong> If a response says "look at Case card K", the detective taps the button under the response to see the card in private.</li>
    <li><strong>Challenges.</strong> After showing a response, tap <em>Challenged</em> if the detective challenges it. The device shows the right result to the detective.</li>
    <li><strong>Searching.</strong> A detective names a location number or a suspect. The Chisel opens <em>Search</em>, picks it and taps <em>Show</em>. Flips, taken cards, Mystery cards and archiving happen automatically.</li>
    <li><strong>The table.</strong> <em>Table</em> shows every Case card: face up, or face down with its letter. Leave it open in the middle of the table between turns.</li>
    <li><strong>The end.</strong> When the game ends, open <em>End</em>, collect the final guesses, then reveal the solution and read the epilogue.</li>
  </ol>
  <h3>Sleuth mode: no Chisel</h3>
  <p>For solo or cooperative play. The device answers for the suspects, following the game's official Sleuth rules.</p>
  <ol>
    <li><strong>Question:</strong> pick a suspect and a face-up Case card, tap <em>Ask</em>. Each question has one fixed answer, which may be a lie.</li>
    <li><strong>Challenge</strong> an answer you doubt. If it was a lie you get the most useful response and 1 leverage over that suspect. If it was true you gain 1 Stress; at 3 Stress the Final Guess marker moves one day up. A challenged question can't be asked again.</li>
    <li><strong>Leverage:</strong> spend it before asking to see the answer and whether it was the most useful one.</li>
    <li><strong>Search</strong> works as in Classic mode. Searches are always truthful.</li>
    <li><strong>Notebook</strong> keeps everything you have read. <strong>Guess</strong> checks your final guess. Up to two overtimes, then the case goes cold.</li>
    <li>With several players, pass the device to the active player each day.</li>
  </ol>
  <h3>Tips</h3>
  <ul>
    <li>The game saves on this device as you play. You can close the page and come back.</li>
    <li>On iPad, tap Share, then "Add to Home Screen" for a full-screen app.</li>
    <li>Turn on Guided Access (Settings, Accessibility) if you don't want detectives leaving the shown card.</li>
    <li>Head-to-head mode is not supported.</li>
  </ul></div>`;

// ---------- drawing ----------
const TABS = [['table', 'Table'], ['ask', 'Ask'], ['search', 'Search'], ['chisel', 'Chisel'], ['end', 'End']];
const STABS = [['table', 'Table'], ['ask', 'Question'], ['search', 'Search'], ['notes', 'Notebook'], ['guess', 'Guess']];
const sleuth = () => G.st.mode === 'sleuth';
function draw() {
  const c = G.c;
  if (G.st.stage === 'setup') return drawSetup();
  const tabs = sleuth() ? STABS : TABS;
  if (!tabs.some(([k]) => k === tab)) tab = 'table';
  root.innerHTML = `<div class="play">
    <div class="playbar"><strong class="pt">${esc(c.title)}</strong> <span class="modetag">${sleuth() ? 'Sleuth mode' : 'With a Chisel'}</span>
      <nav class="ptabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-pact="tab" data-t="${k}">${l}</button>`).join('')}</nav></div>
    ${sleuth() ? sleuthStrip() : ''}
    <div class="pbody">${({ table: tableTab, ask: sleuth() ? sleuthAskTab : askTab, search: searchTab, chisel: chiselTab, end: endTab, notes: notesTab, guess: guessTab })[tab]()}</div>
  </div>`;
  fillPics();
}
function sleuthStrip() {
  const c = G.c;
  const lev = Object.entries(G.st.leverage).filter(([, n]) => n > 0);
  return `<div class="sstrip"><span><strong>Stress</strong> ${[0, 1, 2].map(i => `<i class="dot${i < G.st.stress ? ' on' : ''}"></i>`).join('')}</span>
    ${G.st.daysLost ? `<span>Final Guess marker moved up <strong>${G.st.daysLost}</strong> day${G.st.daysLost > 1 ? 's' : ''}</span>` : ''}
    <span><strong>Leverage</strong> ${lev.length ? lev.map(([id, n]) => `${esc(cardName(c, c.cards.find(k => k.id === id)))} x${n}`).join(', ') : 'none'}</span></div>`;
}

function drawSetup() {
  const c = G.c;
  const b = c.briefing;
  root.innerHTML = `<div class="play">
    <div class="playbar"><strong class="pt">${esc(c.title)}</strong><a class="btn small ghost" href="#/play">Other cases</a></div>
    <div class="pbody">
      <div class="panel"><h2>Before you start</h2>
        <ul>
          <li>Set up the board, detective boards, pawns and tokens from the game box as usual.</li>
          <li>You need a stand-in standee for each suspect who goes on the board.</li>
          <li>This device belongs to the Chisel. Read the briefing aloud, or pass the device around.</li>
          <li>Follow the setup in brackets as you read: markers and standees go on the board. Case cards are flipped for you.</li>
        </ul>
        <p class="small"><a href="#/play">How playing without printing works</a></p>
      </div>
      <article class="paper briefing-read">
        <div class="bhead">CASE: ${esc(c.title)}${c.caseId ? ` <span class="cid">${esc(c.caseId)}</span>` : ''}</div>
        <div class="bkind">Detective briefing</div>
        ${para(b.body)}
        <div class="bbox solve"><h3>Solving the case</h3>${para(b.solving)}
          ${b.locations?.length ? `<ul>${b.locations.filter(x => x.loc || x.name).map(x => `<li><strong>${esc(x.name || locName(x.loc))}${x.loc ? ` (${x.loc})` : ''}</strong> <em>${esc(x.label || '')}</em></li>`).join('')}</ul>` : ''}</div>
        ${b.special?.trim() ? `<div class="bbox rules"><h3>Special rules</h3>${para(b.special)}</div>` : ''}
      </article>
      <div class="panel modepick"><h2>How are you playing?</h2>
        <div class="modes">
          <button class="modebtn" data-pact="start" data-mode="chisel"><strong>With a Chisel</strong><span>One player is the Chisel and holds this device. They choose which answer each suspect gives. Classic mode, 2 or more players.</span></button>
          <button class="modebtn" data-pact="start" data-mode="sleuth"><strong>Sleuth mode, no Chisel</strong><span>The device answers for the suspects. Solo or cooperative, passing the device around. Spoiler-free until the end.</span></button>
        </div>
        <details class="focus"><summary><strong>Sleuth mode setup</strong></summary><ul>
          <li>Day marker on Day 12, Final Guess marker on the Final Guess space.</li>
          <li>Detective board with the Sleuth side up: 4 action cubes, leverage markers, and 3 Stress markers grey side up.</li>
          <li>You won't need Scratch, Bribe-a-Snitch or Solve tokens, Knowledge markers or Evidence Removed cards.</li>
          <li>Only four actions: Move, Question, Search Location and Search Suspect.</li>
          <li>Read the briefing above and follow it. Ignore special rules about Solve tokens, bribes or the Chisel.</li>
          <li>Start your detective at any police station.</li>
        </ul></details>
      </div>
      ${G.st.log.length ? `<p class="small muted" style="text-align:center">A game is already in progress. <button class="btn small ghost" data-pact="resume">Resume it</button></p>` : ''}
    </div></div>`;
}

function cardTile(k, i) {
  const up = isUp(k.id);
  const over = G.st.over[k.id];
  const key = up ? (over ? `mys:${over}` : `case:${k.id}`) : `back:${LETTERS[i]}`;
  return `<figure class="ptile${up ? ' up' : ''}">
    <button class="pimg" data-pact="${up ? 'view' : 'noop'}" data-pic-key="${key}" aria-label="${up ? 'Show ' + esc(cardName(G.c, k)) : 'Case card ' + LETTERS[i] + ', face down'}"><img alt="" data-pic="${key}"></button>
    <figcaption>${LETTERS[i]}${up ? ' · ' + esc(over ? (G.c.mystery.find(m => m.id === over)?.title || 'Mystery') : cardName(G.c, k)) : ''}</figcaption>
  </figure>`;
}
function tableTab() {
  const c = G.c;
  const mys = G.st.mystery.filter(id => !Object.values(G.st.over).includes(id)).map(id => c.mystery.find(m => m.id === id)).filter(Boolean);
  const searched = G.st.searched.map(id => c.search.find(s => s.id === id)).filter(Boolean);
  return `<p class="hint">Shown to everyone. Tap a face-up card to enlarge it.</p>
    <div class="pgrid">${c.cards.map(cardTile).join('')}</div>
    ${mys.length ? `<h3>Mystery cards</h3><div class="pgrid">${mys.map(m => `<figure class="ptile up"><button class="pimg" data-pact="view" data-pic-key="mys:${m.id}"><img alt="" data-pic="mys:${m.id}"></button><figcaption>Mystery ${mysteryIndex(m.id) + 1} · ${esc(m.title)}</figcaption></figure>`).join('')}</div>` : ''}
    ${searched.length ? `<h3>Searched and archived</h3><div class="chips">${searched.map(s => `<span class="chip">${esc(s.kind === 'location' ? `(${s.loc}) ${locName(s.loc)}` : searchTitle(c, s))}</span>`).join('')}</div>` : ''}
    <div class="btns"><button class="btn small ghost" data-pact="briefing">Read the briefing again</button></div>`;
}

function askTab() {
  const c = G.c;
  const sus = suspects(c).filter(s => isUp(s.id));
  if (!sus.length) return '<div class="panel empty">No suspects are face up yet.</div>';
  if (!sus.some(s => s.id === ask.s)) ask.s = '';
  const s = c.cards.find(k => k.id === ask.s);
  let html = `<p class="hint">Chisel only. Pick who is being asked, then what about.</p>
    <span class="lbl">Suspect</span><div class="chips big">${sus.map(x => `<button class="chip${x.id === ask.s ? ' on' : ''}" data-pact="asks" data-id="${x.id}">${esc(cardName(c, x))}</button>`).join('')}</div>`;
  if (!s) return html;
  const asked = c.cards.filter(k => isUp(k.id));
  html += `<span class="lbl">About</span><div class="chips big">${asked.map(k => `<button class="chip${k.id === ask.k ? ' on' : ''}" data-pact="askk" data-id="${k.id}">${letterOf(c, k.id)} · ${esc(G.st.over[k.id] ? (c.mystery.find(m => m.id === G.st.over[k.id])?.title || cardName(c, k)) : cardName(c, k))}</button>`).join('')}</div>`;
  if (!ask.k) return html;
  const list = orderedCell(cellResponses(c, s.id, ask.k));
  html += `<div class="resps">${list.length ? list.map(r => `<div class="presp ${r.kind === 'useful' ? 'useful' : 'lie'}">
      <div class="pk">${r.kind === 'useful' ? 'Most useful' : 'Lie or misdirection'}</div>
      <div class="ptxt">${esc(r.text)}${r.look ? ` <strong class="plook">${esc(lookLine(c, r.look))}</strong>` : ''}</div>
      <button class="btn" data-pact="show" data-r="${r.id}">Show</button></div>`).join('')
    : '<div class="panel empty">No response written for this question. Improvise, or the suspect has nothing to say.</div>'}</div>`;
  return html;
}

function searchTab() {
  const c = G.c;
  const sus = suspects(c).filter(s => isUp(s.id));
  return `<p class="hint">Chisel only. Pick what the detective searches, then tap Show.</p>
    <span class="lbl">A suspect</span>
    <div class="chips big">${sus.map(s => `<button class="chip" data-pact="searchsus" data-id="${s.id}">${esc(cardName(c, s))}</button>`).join('') || '<span class="muted">No suspects face up.</span>'}</div>
    <span class="lbl">A location</span>
    <div class="row"><select id="pLoc">${LOCATIONS.map(l => `<option value="${l.n}">${l.n} · ${esc(l.names.join(' / '))}</option>`).join('')}</select>
    <div class="fit"><button class="btn" data-pact="searchloc">Search</button></div></div>`;
}

function chiselTab() {
  const c = G.c;
  const k = id => cardName(c, c.cards.find(x => x.id === id));
  return `<p class="hint">Chisel only: spoilers.</p>
    <details class="focus"><summary><strong>Solution</strong></summary><p>${esc(k(c.solution.suspect) || '-')}, ${esc(k(c.solution.weapon) || '-')}, ${esc(c.solution.motives.join(', ') || '-')}</p></details>
    ${c.notes ? `<details class="focus"><summary><strong>Notes for the Chisel</strong></summary>${para(c.notes)}</details>` : ''}
    ${c.alternates.length ? `<details class="focus"><summary><strong>Alternate guesses to steer toward</strong></summary><ul>${c.alternates.map(a => `<li>${esc(k(a.suspect) || '?')}, ${esc(k(a.weapon) || '?')}: ${esc(a.note || (a.motives || []).join(', '))}</li>`).join('')}</ul></details>` : ''}
    <details class="focus"><summary><strong>Hidden cards and where they are found</strong></summary><ul>${c.cards.filter(x => !isUp(x.id)).map(x => {
      const s = c.search.find(y => y.target === x.id);
      return `<li>${letterOf(c, x.id)} · ${esc(cardName(c, x))}: ${s ? esc(s.kind === 'location' ? `search (${s.loc})` : 'search ' + searchTitle(c, s)) : 'see custom Search cards'}</li>`;
    }).join('') || '<li>Every Case card is face up.</li>'}</ul></details>
    <details class="focus"><summary><strong>Corrections</strong></summary><p class="small">Flip a Case card by hand if something went wrong.</p>
      <div class="chips">${c.cards.map((x, i) => `<button class="chip${isUp(x.id) ? ' on' : ''}" data-pact="flip" data-id="${x.id}">${LETTERS[i]} ${isUp(x.id) ? 'face up' : 'face down'}</button>`).join('')}</div></details>
    <h3>Game log</h3><ul class="plog">${G.st.log.map(l => `<li><span class="muted small">${new Date(l.t).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}</span> ${esc(l.text)}</li>`).join('') || '<li class="muted">Nothing yet.</li>'}</ul>
    <div class="btns"><button class="btn small ghost" data-pact="reset">Start this case over</button></div>`;
}

function endTab() {
  const c = G.c;
  const k = id => cardName(c, c.cards.find(x => x.id === id));
  if (!G.st.ended) return `<div class="panel"><h2>Final guesses</h2>
    <p>Each detective writes down the guilty suspect, the weapon and the motive, and reveals them together.</p>
    <p>${esc(c.briefing.solving || '')}</p>
    <div class="btns"><button class="btn big" data-pact="reveal">Reveal the solution</button></div></div>`;
  return `<div class="panel solution"><h2>Solution</h2>
      <dl><dt>Suspect</dt><dd>${esc(k(c.solution.suspect) || '-')}</dd><dt>Weapon</dt><dd>${esc(k(c.solution.weapon) || '-')}</dd><dt>Motive</dt><dd>${esc(c.solution.motives.join(', ') || '-')}</dd></dl></div>
    <article class="paper epilogue-read"><div class="bkind">Epilogue</div>${para(c.epilogue)}</article>
    <div class="btns" style="justify-content:center"><a class="btn ghost" href="#/files">Back to the case files</a></div>`;
}

// ---------- show screen (for the detective) ----------
function overlay(html, opts = {}) {
  let o = $('#pshow');
  if (!o) { o = document.createElement('div'); o.id = 'pshow'; document.body.appendChild(o); }
  o.innerHTML = `<div class="pshow-in">${html}<div class="btns" style="justify-content:center">${opts.buttons || ''}<button class="btn big" data-pact="close">Done</button></div></div>`;
  o.className = 'on';
  document.body.classList.add('noscroll');
  fillPics(o);
  o.onclick = e => { const b = e.target.closest('[data-pact]'); if (b) act(b); };
}
function closeOverlay() {
  const o = $('#pshow');
  if (o) o.className = '';
  document.body.classList.remove('noscroll');
}
function noteRead(title, text) { G.st.read.unshift({ t: Date.now(), title, text }); save(); }
function showResponse(r, banner = '') {
  const c = G.c;
  const s = c.cards.find(k => k.id === ask.s), about = c.cards.find(k => k.id === ask.k);
  const look = r.look ? lookLine(c, r.look) : '';
  overlay(`${banner ? `<div class="pbanner">${banner}</div>` : ''}
    <div class="pwho">${esc(cardName(c, s))}, asked about ${esc(cardName(c, about))}</div>
    <div class="pcard-text">${esc(r.text)}</div>
    ${look ? `<div class="btns" style="justify-content:center"><button class="btn red" data-pact="look" data-look="${esc(r.look)}">${esc(look)}</button></div>` : ''}`);
}

// ---------- actions ----------
function act(el) {
  const c = G?.c;
  const a = el.dataset.pact;
  switch (a) {
    case 'tab': tab = el.dataset.t; draw(); window.scrollTo(0, 0); break;
    case 'start': G.st.stage = 'play'; G.st.mode = el.dataset.mode || 'chisel'; log(`Investigation started (${sleuth() ? 'Sleuth mode' : 'with a Chisel'}).`); save(); tab = 'table'; draw(); window.scrollTo(0, 0); break;
    case 'resume': G.st.stage = 'play'; save(); draw(); break;
    case 'briefing': G.st.stage = 'setup'; draw(); window.scrollTo(0, 0); break;
    case 'view': overlay(`<img class="pbig" alt="" data-pic="${el.dataset.picKey}">`); break;
    case 'asks': ask = { s: el.dataset.id, k: '' }; draw(); break;
    case 'askk': ask.k = el.dataset.id; draw(); setTimeout(() => $('.resps')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); break;
    case 'show': {
      const r = cellResponses(c, ask.s, ask.k).find(x => x.id === el.dataset.r);
      G.lastShown = { r, s: ask.s, k: ask.k };
      log(`${cardName(c, c.cards.find(k => k.id === ask.s))} on ${letterOf(c, ask.k)}: ${r.kind === 'useful' ? 'most useful' : 'lie'} shown.`);
      showResponse(r);
      const o = $('#pshow .btns:last-child');
      o.insertAdjacentHTML('afterbegin', '<button class="btn ghost" data-pact="challenge">Challenged</button>');
      break;
    }
    case 'challenge': {
      const { r, s, k } = G.lastShown;
      if (r.kind === 'useful') {
        overlay(`<div class="pbanner bad">Challenge failed</div><div class="pcard-text small">That was the most useful response. The Chisel gains leverage over this detective.</div>`);
        log(`Challenge on ${letterOf(c, k)} failed: the Chisel gains leverage.`);
      } else {
        const u = cellResponses(c, s, k).find(x => x.kind === 'useful');
        if (u) showResponse(u, 'Challenge succeeded: the most useful response');
        else overlay('<div class="pbanner">Challenge succeeded</div><div class="pcard-text small">This suspect has no most useful response written for this question.</div>');
        log(`Challenge on ${letterOf(c, k)} succeeded.`);
      }
      break;
    }
    case 'look': {
      const v = el.dataset.look;
      const key = v.startsWith('M:') ? `mys:${v.slice(2)}` : `case:${v}`;
      overlay(`<div class="pbanner">Look, but keep it to yourself</div><img class="pbig" alt="" data-pic="${key}">`);
      break;
    }
    case 'close': closeOverlay(); draw(); break;
    case 'sask': sleuthAsk(el.dataset.lev === '1'); break;
    case 'schallenge': sleuthChallenge(); break;
    case 'guess': makeGuess(); break;
    case 'searchsus': doSearch(c.search.find(s => s.kind === 'suspect' && s.suspect === el.dataset.id), cardName(c, c.cards.find(k => k.id === el.dataset.id))); break;
    case 'searchloc': { const n = Number($('#pLoc').value); doSearch(c.search.find(s => s.kind === 'location' && Number(s.loc) === n), `(${n}) ${locName(n)}`); break; }
    case 'flip': {
      const id = el.dataset.id;
      G.st.up = isUp(id) ? G.st.up.filter(x => x !== id) : [...G.st.up, id];
      log(`Case card ${letterOf(c, id)} flipped by hand.`); save(); draw(); break;
    }
    case 'reveal':
      if (!confirm('Reveal the solution to everyone?')) break;
      G.st.ended = true; log('Solution revealed.'); save(); draw(); break;
    case 'reset':
      if (!confirm('Start this case over? The current game will be lost.')) break;
      G.st = freshState(c); save(); tab = 'table'; draw(); break;
    default: break;
  }
}

// ---------- Sleuth mode ----------
const cellKey = () => `${ask.s}|${ask.k}`;
function sleuthAskTab() {
  const c = G.c;
  const sus = suspects(c).filter(s => isUp(s.id));
  if (!sus.length) return '<div class="panel empty">No suspects are face up yet.</div>';
  if (!sus.some(s => s.id === ask.s)) ask.s = '';
  let html = `<p class="hint">Question action: pick a suspect, then a face-up Case card. The suspect answers; you decide whether to challenge.</p>
    <span class="lbl">Suspect</span><div class="chips big">${sus.map(x => `<button class="chip${x.id === ask.s ? ' on' : ''}" data-pact="asks" data-id="${x.id}">${esc(cardName(c, x))}</button>`).join('')}</div>`;
  if (!ask.s) return html;
  html += `<span class="lbl">About</span><div class="chips big">${c.cards.filter(k => isUp(k.id)).map(k => `<button class="chip${k.id === ask.k ? ' on' : ''}${G.st.challenged.includes(`${ask.s}|${k.id}`) ? ' done' : ''}" data-pact="askk" data-id="${k.id}">${letterOf(c, k.id)} · ${esc(G.st.over[k.id] ? (c.mystery.find(m => m.id === G.st.over[k.id])?.title || cardName(c, k)) : cardName(c, k))}</button>`).join('')}</div>`;
  if (!ask.k) return html;
  if (G.st.challenged.includes(cellKey())) return html + '<div class="panel empty resps">You already challenged this question, so you cannot ask it again.</div>';
  const lev = G.st.leverage[ask.s] || 0;
  return html + `<div class="btns resps"><button class="btn big" data-pact="sask">Ask</button>${lev ? '<button class="btn big ghost" data-pact="sask" data-lev="1">Spend leverage and ask</button>' : ''}</div>
    ${lev ? '<p class="hint">Spending leverage shows the answer and then whether it was the most useful one, with no Stress and no new leverage.</p>' : ''}`;
}
function sleuthAsk(useLeverage) {
  const c = G.c;
  const s = c.cards.find(k => k.id === ask.s), about = c.cards.find(k => k.id === ask.k);
  const list = cellResponses(c, ask.s, ask.k);
  const r = sleuthResponse(list);
  const title = `${cardName(c, s)} on ${letterOf(c, ask.k)} · ${cardName(c, about)}`;
  if (!r) { overlay(`<div class="pwho">${esc(title)}</div><div class="pcard-text small">${esc(cardName(c, s))} has nothing to say about that.</div>`); noteRead(title, 'Nothing to say.'); log(`Asked ${title}: nothing to say.`); return; }
  G.lastShown = { r, s: ask.s, k: ask.k };
  const look = r.look ? lookLine(c, r.look) : '';
  noteRead(title, r.text + (look ? ` [${look}]` : ''));
  if (useLeverage) {
    G.st.leverage[ask.s] = Math.max(0, (G.st.leverage[ask.s] || 0) - 1);
    const u = list.find(x => x.kind === 'useful');
    const truth = r.kind === 'useful' ? 'That was the most useful response.' : 'That was a lie or misdirection.';
    if (r.kind !== 'useful' && u) noteRead(title + ' (leverage)', u.text);
    log(`Spent leverage on ${title}.`);
    save();
    overlay(`<div class="pwho">${esc(title)}</div><div class="pcard-text">${esc(r.text)}</div>
      <div class="pbanner">Leverage: ${esc(truth)}</div>
      ${r.kind !== 'useful' && u ? `<div class="pcard-text">${esc(u.text)}</div>` : ''}
      ${look ? `<div class="btns" style="justify-content:center"><button class="btn red" data-pact="look" data-look="${esc(r.look)}">${esc(look)}</button></div>` : ''}`);
    return;
  }
  log(`Asked ${title}.`);
  showResponse(r);
  $('#pshow .btns:last-child').insertAdjacentHTML('afterbegin', '<button class="btn ghost" data-pact="schallenge">Challenge</button>');
}
function sleuthChallenge() {
  const c = G.c;
  const { r, s, k } = G.lastShown;
  const key = `${s}|${k}`;
  if (!G.st.challenged.includes(key)) G.st.challenged.push(key);
  const sus = cardName(c, c.cards.find(x => x.id === s));
  const title = `${sus} on ${letterOf(c, k)} (challenge)`;
  if (r.kind !== 'useful') {
    G.st.leverage[s] = (G.st.leverage[s] || 0) + 1;
    const u = cellResponses(c, s, k).find(x => x.kind === 'useful');
    if (u) noteRead(title, u.text);
    log(`Challenged ${sus} on ${letterOf(c, k)}: success, gained leverage.`);
    save();
    if (u) showResponse(u, `Challenge succeeded. Gain 1 leverage over ${sus}`);
    else overlay(`<div class="pbanner">Challenge succeeded. Gain 1 leverage over ${esc(sus)}</div>`);
    return;
  }
  G.st.stress += 1;
  let extra = '';
  if (G.st.stress >= 3) { G.st.stress = 0; G.st.daysLost += 1; extra = '<div class="pbanner bad">Third Stress: move the Final Guess marker one space up the Day track. Your Stress resets.</div>'; }
  noteRead(title, 'Challenge failed: that was the most useful response.');
  log(`Challenged ${sus} on ${letterOf(c, k)}: failed, gained 1 Stress.`);
  save();
  overlay(`<div class="pbanner bad">Challenge failed</div><div class="pcard-text small">${esc(sus)} was telling you the most useful response. Gain 1 Stress.</div>${extra}`);
}
function notesTab() {
  const c = G.c;
  return `<p class="hint">Everything you have read, newest first. The physical Investigation sheet is still the place for your deductions.</p>
    <ul class="pread">${G.st.read.map(x => `<li><div class="pk">${esc(x.title)}</div><div class="ptxt">${esc(x.text)}</div></li>`).join('') || '<li class="muted">Nothing read yet.</li>'}</ul>
    <details class="focus"><summary><strong>Corrections</strong></summary><p class="small">Flip a Case card by hand only if a card instruction was missed.</p>
      <div class="chips">${c.cards.map((x, i) => isUp(x.id) ? `<span class="chip on">${LETTERS[i]} face up</span>` : `<button class="chip" data-pact="flip" data-id="${x.id}">${LETTERS[i]} flip</button>`).join('')}</div></details>
    <div class="btns"><button class="btn small ghost" data-pact="briefing">Read the briefing again</button><button class="btn small ghost" data-pact="reset">Start this case over</button></div>`;
}
const RATINGS = ['Hard Sleuth', 'Wisehead', 'Palooka'];
function guessTab() {
  const c = G.c;
  const k = id => cardName(c, c.cards.find(x => x.id === id));
  if (G.st.outcome) {
    const solved = G.st.outcome === 'solved';
    return `<div class="panel solution"><h2>${solved ? 'Case closed' : 'The case goes cold'}</h2>
      <p>${solved ? `Solved on guess ${G.st.guesses.length}. Your rating: <strong>${RATINGS[G.st.guesses.length - 1]}</strong>.` : 'Three wrong guesses. Your rating: <strong>A Sap, Rube, \'n Boob</strong>.'}</p>
      <dl><dt>Suspect</dt><dd>${esc(k(c.solution.suspect) || '-')}</dd><dt>Weapon</dt><dd>${esc(k(c.solution.weapon) || '-')}</dd><dt>Motive</dt><dd>${esc(c.solution.motives.join(', ') || '-')}</dd></dl></div>
      <article class="paper epilogue-read"><div class="bkind">Epilogue</div>${para(c.epilogue)}</article>
      <div class="btns" style="justify-content:center"><a class="btn ghost" href="#/files">Back to the case files</a></div>`;
  }
  const n = G.st.guesses.length;
  const sus = c.cards.filter(x => x.type === 'suspect' && isUp(x.id));
  const ev = c.cards.filter(x => x.type === 'evidence' && isUp(x.id));
  return `<div class="panel"><h2>${n ? `Overtime ${n}` : 'Final guess'}</h2>
    <p>${n ? 'Your last guess was wrong. Place the Day marker on day 3 and return the Final Guess marker to its space: you have three more days. Guess again when the Day marker reaches it.' : 'Make your guess when the Day marker reaches the Final Guess marker.'} ${n ? `Guess ${n + 1} of 3.` : ''}</p>
    ${G.st.guesses.length ? `<ul class="small muted">${G.st.guesses.map((g, i) => `<li>Guess ${i + 1}: ${esc(k(g.s))}, ${esc(k(g.w))}, ${esc(g.m)}. Wrong.</li>`).join('')}</ul>` : ''}
    <div class="row">
      <label class="f"><span>Suspect</span><select id="gS">${sus.map(x => `<option value="${x.id}">${esc(cardName(c, x))}</option>`).join('')}</select></label>
      <label class="f"><span>Weapon</span><select id="gW">${ev.map(x => `<option value="${x.id}">${letterOf(c, x.id)} · ${esc(cardName(c, x))}</option>`).join('')}</select></label>
      <label class="f"><span>Motive</span><select id="gM">${MOTIVES.map(m => `<option>${esc(m)}</option>`).join('')}</select></label>
    </div>
    <div class="btns"><button class="btn big" data-pact="guess" ${sus.length && ev.length ? '' : 'disabled'}>Make the guess</button></div>
    <p class="hint">You will only learn whether the whole guess is right, not which part is wrong.</p></div>`;
}
function makeGuess() {
  const c = G.c;
  const g = { s: $('#gS').value, w: $('#gW').value, m: $('#gM').value };
  if (!confirm('Lock in this guess?')) return;
  G.st.guesses.push(g);
  const right = g.s === c.solution.suspect && g.w === c.solution.weapon && c.solution.motives.includes(g.m);
  if (right) G.st.outcome = 'solved';
  else if (G.st.guesses.length >= 3) G.st.outcome = 'cold';
  log(`Guess ${G.st.guesses.length}: ${right ? 'correct' : 'wrong'}.`);
  save();
  if (!right && !G.st.outcome) overlay('<div class="pbanner bad">Not quite</div><div class="pcard-text small">The Captain shakes his head. Something in your guess is wrong. Place the Day marker on day 3 and keep digging.</div>');
  draw();
}

function doSearch(s, label) {
  const c = G.c;
  if (!s) {
    overlay(`<div class="pwho">Search: ${esc(label)}</div><div class="pcard-text small">You search carefully, but there is nothing of interest here.</div>`);
    log(`Searched ${label}: nothing.`);
    noteRead(`Search: ${label}`, 'Nothing of interest.');
    return;
  }
  if (s.archive && G.st.searched.includes(s.id)) {
    overlay(`<div class="pwho">Search: ${esc(label)}</div><div class="pcard-text small">This has already been searched and archived. There is nothing more to find.</div>`);
    return;
  }
  const effects = applySearch(s);
  log(`Searched ${label}${effects.length ? ': ' + effects.join(' ') : '.'}`);
  noteRead(`Search: ${label}`, s.text + (searchInstruction(G.c, s) ? ` [${searchInstruction(G.c, s)}]` : ''));
  overlay(`<img class="pbig search" alt="" data-pic="search:${s.id}">${effects.length ? `<div class="peffects">${effects.map(e => `<div>${esc(e)}</div>`).join('')}</div>` : ''}`);
}

// Apply a Search card's result. Returns plain sentences describing what changed.
function applySearch(s) {
  const c = G.c, out = [];
  const flip = id => { if (id && !isUp(id)) { G.st.up.push(id); out.push(`Case card ${letterOf(c, id)} is now face up.`); } };
  const reveal = id => { if (id && !G.st.mystery.includes(id)) { G.st.mystery.push(id); out.push(`Mystery card ${mysteryIndex(id) + 1} is revealed.`); } };
  if (['take', 'flip', 'place'].includes(s.action)) {
    flip(s.target);
    if (s.action === 'place') out.push(`Place ${cardName(c, c.cards.find(k => k.id === s.target))}'s standee at (${s.place}).`);
  } else if (s.action === 'mystery') reveal(s.target);
  else if (s.action === 'custom') {
    const t = searchInstruction(c, s).toUpperCase();
    for (const m of t.matchAll(/(?:FLIP|TAKE)\s+CASE\s+CARD\s+([A-L])\b/g)) flip(c.cards[LETTERS.indexOf(m[1])]?.id);
    for (const m of t.matchAll(/MYSTERY\s+CARD\s+(\d+)(?:\s+OVER\s+CASE\s+CARD\s+([A-L]))?/g)) {
      const mys = c.mystery[Number(m[1]) - 1];
      if (!mys) continue;
      reveal(mys.id);
      if (m[2]) { const k = c.cards[LETTERS.indexOf(m[2])]; if (k) { G.st.over[k.id] = mys.id; out.push(`Mystery card ${m[1]} now covers Case card ${m[2]}.`); } }
    }
    for (const m of t.matchAll(/PLACE\s+([A-Z .'"-]+?)\s+AT\s+\((\d+)\)/g)) if (!/CRIME SCENE|MYSTERY/.test(m[1])) out.push(`Place ${m[1].toLowerCase().replace(/\b\w/g, x => x.toUpperCase())}'s standee at (${m[2]}).`);
  }
  if (s.archive) G.st.searched.push(s.id);
  save();
  return out;
}

document.addEventListener('click', e => {
  if (!root || !root.contains(e.target)) return;
  const el = e.target.closest('[data-pact]');
  if (el && !el.disabled) { e.preventDefault(); act(el); }
});

export function resetPlayCache() { G = null; pics.clear(); }
export { CARD_TYPES };
