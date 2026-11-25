// Case data model, letters, response codes and text helpers.
import { LOCATIONS } from './data/locations.js';

export const LETTERS = 'ABCDEFGHIJKL'.split('');
export const MAX_CASE_CARDS = 12;
export const MAX_MYSTERY = 6;
export const SLOTS = ['a', 'b', 'c', 'd', 'w', 'x', 'y', 'z'];

export const CARD_TYPES = {
  victim: { label: 'Victim', frame: 'notebook', role: 'The victim' },
  crime: { label: 'Crime', frame: 'tag', role: '' },
  suspect: { label: 'Suspect', frame: 'notebook', role: '' },
  evidence: { label: 'Evidence', frame: 'tag', role: '' },
  info: { label: 'Information', frame: 'info', role: '' },
};

export const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export function newCase(title = 'Untitled case') {
  return {
    id: uid('case'),
    schema: 1,
    created: Date.now(),
    updated: Date.now(),
    title,
    caseId: '',
    author: '',
    difficulty: '',
    outline: '',
    notes: '',
    solution: { suspect: '', weapon: '', motives: [] },
    alternates: [],
    questions: [],
    places: [],
    cards: [],
    responses: {},
    search: [],
    mystery: [],
    briefing: {
      body: '',
      solving: 'You must identify the guilty SUSPECT, the murder WEAPON, and the suspect\'s MOTIVE.',
      locations: [],
      special: '',
      fontSize: 0,
    },
    epilogue: '',
    settings: { newCardPerSuspect: true, portraits: true },
  };
}

export function newCard(type = 'suspect') {
  return {
    id: uid('card'), type, name: '', role: CARD_TYPES[type]?.role || '', text: '',
    frame: '', faceUp: false, foundAt: '', weapon: false,
    image: { src: '', zoom: 1, x: 0, y: 0 },
  };
}

export function newSearch(kind = 'location') {
  return {
    id: uid('srch'), kind, loc: '', suspect: '', title: '', text: '',
    action: 'none', target: '', place: '', instruction: '', archive: false,
    image: { src: '', zoom: 1, x: 0, y: 0 },
  };
}

export function newMystery() {
  return { id: uid('mys'), title: '', text: '', replaces: '', image: { src: '', zoom: 1, x: 0, y: 0 } };
}

export function newResponse(kind = 'lie') {
  return { id: uid('r'), kind, text: '', look: '' };
}

// Older saves get any new fields here.
export function migrate(c) {
  const base = newCase();
  for (const k of Object.keys(base)) if (c[k] === undefined) c[k] = base[k];
  c.briefing = { ...base.briefing, ...c.briefing };
  c.settings = { ...base.settings, ...c.settings };
  c.solution = { ...base.solution, ...c.solution };
  for (const card of c.cards) { card.image = { src: '', zoom: 1, x: 0, y: 0, ...card.image }; }
  for (const s of c.search) { s.image = { src: '', zoom: 1, x: 0, y: 0, ...s.image }; }
  for (const m of c.mystery) { m.image = { src: '', zoom: 1, x: 0, y: 0, ...m.image }; }
  return c;
}

export const letterOf = (c, cardId) => {
  const i = c.cards.findIndex(k => k.id === cardId);
  return i < 0 ? '?' : LETTERS[i];
};
export const cardByLetter = (c, L) => c.cards[LETTERS.indexOf(L)];
export const suspects = c => c.cards.filter(k => k.type === 'suspect');
export const cardName = (c, card) => card ? (card.name || `${CARD_TYPES[card.type]?.label || 'Card'} ${letterOf(c, card.id)}`) : '';
export const cardLabel = (c, card) => card ? `${letterOf(c, card.id)} · ${cardName(c, card)}` : '';
export const frameOf = card => card.frame || CARD_TYPES[card.type]?.frame || 'notebook';

export function locName(n) {
  const l = LOCATIONS[Number(n) - 1];
  return l ? l.names[0] : '';
}
export const locLabel = n => n ? `${locName(n)} (${n})` : '';

export function cellResponses(c, suspectId, cardId) {
  return c.responses?.[suspectId]?.[cardId] || [];
}
export function setCell(c, suspectId, cardId, list) {
  c.responses[suspectId] = c.responses[suspectId] || {};
  c.responses[suspectId][cardId] = list;
}

// Order inside a cell: most useful first, then the lies in the order written.
export function orderedCell(list) {
  return [...list.filter(r => r.kind === 'useful'), ...list.filter(r => r.kind !== 'useful')];
}

// Assign response codes (1a ... 1z, 2a ...) in Chisel grid order.
// Returns { codes: Map(responseId -> code), cards: [{ num, suspectId, slots: [{slot, response, suspectId, cardId}] }] }
export function assignCodes(c) {
  const codes = new Map();
  const cards = [];
  let cur = null;
  const open = suspectId => { cur = { num: cards.length + 1, suspectId, slots: [] }; cards.push(cur); };
  for (const s of suspects(c)) {
    if (c.settings.newCardPerSuspect || !cur) cur = null;
    for (const col of c.cards) {
      for (const r of orderedCell(cellResponses(c, s.id, col.id))) {
        if (!cur || cur.slots.length === 8) open(s.id);
        const slot = SLOTS[cur.slots.length];
        cur.slots.push({ slot, response: r, suspectId: s.id, cardId: col.id });
        codes.set(r.id, `${cur.num}${slot}`);
      }
    }
  }
  return { codes, cards };
}

export function allResponses(c) {
  const out = [];
  for (const s of suspects(c)) for (const col of c.cards) for (const r of cellResponses(c, s.id, col.id)) out.push({ r, suspectId: s.id, cardId: col.id });
  return out;
}

// Instruction line printed in red at the bottom of a Search card.
export function searchInstruction(c, s) {
  if (s.action === 'custom') return s.instruction || '';
  if (!s.target) return '';
  if (s.action === 'mystery') {
    const i = c.mystery.findIndex(m => m.id === s.target);
    return i < 0 ? '' : `REVEAL MYSTERY CARD ${i + 1}`;
  }
  const card = c.cards.find(k => k.id === s.target);
  if (!card) return '';
  const L = letterOf(c, card.id);
  const nm = card.name || 'the suspect';
  const first = nm.replace(/"[^"]*"/g, '').trim().split(/\s+/).at(-1) || nm;
  switch (s.action) {
    case 'take': return `TAKE CASE CARD ${L}`;
    case 'flip': return `FLIP CASE CARD ${L}`;
    case 'place': return `FLIP CASE CARD ${L} AND PLACE ${nm.toUpperCase()} AT (${s.place || '?'}). YOU MAY ASK ${first.toUpperCase()} 1 FREE QUESTION.`;
    default: return '';
  }
}

export function searchTitle(c, s) {
  if (s.title) return s.title;
  if (s.kind === 'suspect') { const k = c.cards.find(x => x.id === s.suspect); return k ? k.name || 'Suspect' : 'Suspect'; }
  return s.loc ? String(s.loc) : '';
}

// look holds a Case card id, or "M:" + a Mystery card id.
export function lookLine(c, look) {
  if (!look) return '';
  if (look.startsWith('M:')) {
    const i = c.mystery.findIndex(m => m.id === look.slice(2));
    return i < 0 ? '' : `LOOK AT MYSTERY CARD ${i + 1}`;
  }
  const i = c.cards.findIndex(k => k.id === look);
  return i < 0 ? '' : `LOOK AT CASE CARD ${LETTERS[i]}`;
}

// Location references written as (NN) in any text.
export function locRefs(text) {
  const out = [];
  if (!text) return out;
  for (const m of String(text).matchAll(/\((\d{1,3})\)/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 100) out.push(n);
  }
  return out;
}

export function words(text) {
  return (String(text || '').match(/[A-Za-z0-9'']+/g) || []).length;
}

export function wordCount(c) {
  let n = words(c.briefing.body) + words(c.briefing.special) + words(c.epilogue);
  for (const k of c.cards) n += words(k.text);
  for (const s of c.search) n += words(s.text);
  for (const m of c.mystery) n += words(m.text);
  for (const { r } of allResponses(c)) n += words(r.text);
  return n;
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
export function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
  o[ks.at(-1)] = val;
}

// The response a suspect gives in Sleuth mode (no Chisel): the one the author marked,
// otherwise the first lie, otherwise the most useful response.
export function sleuthResponse(list) {
  return list.find(r => r.sleuth) || list.find(r => r.kind !== 'useful') || list.find(r => r.kind === 'useful') || null;
}
