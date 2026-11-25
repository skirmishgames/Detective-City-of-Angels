// Design checks based on the Case Design Guide's rules of thumb.
import { LOCATIONS, DISTRICTS } from './data/locations.js';
import {
  LETTERS, suspects, cellResponses, allResponses, assignCodes, cardName, letterOf, locRefs, wordCount,
  searchInstruction, locLabel, MAX_CASE_CARDS, MAX_MYSTERY,
} from './model.js';

export function districtsUsed(c) {
  const spots = placeNumbers(c);
  const fixed = new Set(), border = [];
  for (const n of spots) {
    const d = LOCATIONS[n - 1]?.districts || [];
    if (d.length === 1) fixed.add(d[0]); else if (d.length) border.push(d);
  }
  // A border spot needs no extra district if it touches one already in use.
  for (const d of border) if (!d.some(x => fixed.has(x))) fixed.add(d.includes('Central L.A.') ? 'Central L.A.' : d[0]);
  return DISTRICTS.filter(d => fixed.has(d));
}

export function placeNumbers(c) {
  const set = new Set();
  c.places.forEach(p => p.loc && set.add(Number(p.loc)));
  c.search.forEach(s => s.kind === 'location' && s.loc && set.add(Number(s.loc)));
  return [...set].filter(n => n >= 1 && n <= 100);
}

// Every place each location number is mentioned, by source.
export function mentions(c) {
  const m = new Map();
  const add = (n, src) => { if (!m.has(n)) m.set(n, []); m.get(n).push(src); };
  locRefs(c.briefing.body).forEach(n => add(n, 'briefing'));
  (c.briefing.locations || []).forEach(x => x.loc && add(Number(x.loc), 'briefing'));
  c.cards.forEach(k => locRefs(k.text).forEach(n => add(n, `case card ${letterOf(c, k.id)}`)));
  c.mystery.forEach((x, i) => locRefs(x.text).forEach(n => add(n, `mystery card ${i + 1}`)));
  const { codes } = assignCodes(c);
  allResponses(c).forEach(({ r }) => locRefs(r.text).forEach(n => add(n, `response ${codes.get(r.id)}`)));
  c.search.forEach(s => {
    const where = s.kind === 'location' ? `search (${s.loc})` : `search of ${cardName(c, c.cards.find(k => k.id === s.suspect))}`;
    locRefs(s.text + ' ' + searchInstruction(c, s)).forEach(n => add(n, where));
  });
  return m;
}

export function runChecks(c, extra = {}) {
  const out = [];
  const add = (level, step, text) => out.push({ level, step, text });
  const sus = suspects(c);

  // Case cards
  if (!c.cards.length) add('error', 'cards', 'No Case cards yet. Start with the victim (or crime) and your suspects.');
  if (c.cards.length > MAX_CASE_CARDS) add('error', 'cards', `${c.cards.length} Case cards. A case can have at most 12.`);
  if (sus.length > 5) add('warn', 'cards', `${sus.length} suspects. The guide recommends no more than 5.`);
  if (c.cards.length && !c.cards.some(k => k.type === 'victim' || k.type === 'crime')) add('warn', 'cards', 'No victim or crime card. Case card A is usually the victim or the crime.');
  c.cards.forEach((k, i) => { if (!k.name && k.type !== 'info') add('warn', 'cards', `Case card ${LETTERS[i]} has no name.`); });
  if (c.mystery.length > MAX_MYSTERY) add('error', 'mystery', `${c.mystery.length} Mystery cards. The kit has backs for 6.`);

  // Solution
  const sol = c.solution;
  const guilty = c.cards.find(k => k.id === sol.suspect);
  const weapon = c.cards.find(k => k.id === sol.weapon);
  if (!guilty || !weapon || !sol.motives.length) add('warn', 'story', 'The solution is incomplete: pick the guilty suspect, the weapon and at least one motive.');
  const weapons = c.cards.filter(k => k.type === 'evidence' && k.weapon);
  if (weapons.length < 2 && c.cards.some(k => k.type === 'evidence')) add('warn', 'cards', `Only ${weapons.length} possible weapon${weapons.length === 1 ? '' : 's'}. Include at least two so the weapon is not given away once every card is seen.`);
  if (weapon && weapon.faceUp) add('warn', 'cards', `The murder weapon (${letterOf(c, weapon.id)}) starts face up. That makes an early solve possible.`);
  if (!c.alternates.length && c.cards.length > 3) add('info', 'story', 'No alternate guesses listed. Writing them first gives the Chisel better lies to choose from.');

  // Responses
  let missing = 0, doubles = 0, empty = 0;
  for (const s of sus) for (const k of c.cards) {
    const list = cellResponses(c, s.id, k.id);
    const u = list.filter(r => r.kind === 'useful').length;
    if (!list.length) missing++;
    else if (u === 0) add('error', 'responses', `${cardName(c, s)} has lies about ${letterOf(c, k.id)} but no most useful response.`);
    if (u > 1) doubles++;
    empty += list.filter(r => !r.text.trim()).length;
  }
  if (doubles) add('error', 'responses', `${doubles} question${doubles > 1 ? 's have' : ' has'} more than one most useful response. Each suspect gets exactly one per question.`);
  if (missing) add('warn', 'responses', `${missing} of ${sus.length * c.cards.length} questions have no responses yet.`);
  if (empty) add('warn', 'responses', `${empty} response${empty > 1 ? 's are' : ' is'} empty.`);
  const total = allResponses(c).length, est = c.cards.length * sus.length * 2;
  if (sus.length && c.cards.length) add('info', 'responses', `${total} responses written. Rough target from the guide: ${est} (Case cards x suspects x 2).`);
  if (guilty && weapon) {
    const u = cellResponses(c, guilty.id, weapon.id).find(r => r.kind === 'useful');
    if (u && /\b(i|I)\s+(killed|murdered|did it)\b/.test(u.text)) add('warn', 'responses', `${cardName(c, guilty)}'s most useful answer about the weapon reads like a confession. The guilty suspect should never directly implicate themselves.`);
  }

  // Locations and search cards
  const m = mentions(c);
  const searchLocs = new Set(c.search.filter(s => s.kind === 'location' && s.loc).map(s => Number(s.loc)));
  for (const [n] of m) if (!searchLocs.has(n)) add('warn', 'search', `${locLabel(n)} is mentioned but has no Search card. Red herrings need one too.`);
  for (const s of sus) if (!c.search.some(x => x.kind === 'suspect' && x.suspect === s.id)) add('info', 'search', `${cardName(c, s)} has no Search card.`);
  const dups = c.search.filter(s => s.kind === 'location' && s.loc).map(s => s.loc).filter((v, i, a) => a.indexOf(v) !== i);
  if (dups.length) add('warn', 'search', `More than one Search card for location ${[...new Set(dups)].join(', ')}.`);

  // Hidden cards and choke points
  for (const k of c.cards) {
    if (k.faceUp) continue;
    const L = letterOf(c, k.id);
    const revealers = c.search.filter(s => ['take', 'flip', 'place'].includes(s.action) && s.target === k.id);
    const textual = c.search.filter(s => s.action === 'custom' && new RegExp(`\\b(CARD|\\()\\s*${L}\\b`, 'i').test(s.instruction));
    const all = [...revealers, ...textual];
    if (!all.length) { add('error', 'search', `Hidden Case card ${L} (${cardName(c, k)}) is never revealed by a Search card.`); continue; }
    if (all.length === 1) {
      const s = all[0];
      if (s.kind === 'location' && s.loc) {
        const src = (m.get(Number(s.loc)) || []).filter(x => !x.startsWith(`search (${s.loc})`));
        const inBrief = src.includes('briefing');
        if (!inBrief && src.length <= 1) add('warn', 'search', `Choke point: Case card ${L} is only found at ${locLabel(s.loc)}, and only ${src.length ? src[0] : 'nothing'} points there. Give detectives a second way to learn about it.`);
        if (inBrief && weapon && weapon.id === k.id) add('warn', 'search', `The murder weapon is found at ${locLabel(s.loc)}, which is in the briefing. Detectives could find it on day one.`);
      }
    }
  }

  // Districts
  const ds = districtsUsed(c);
  if (ds.length > 4) add('warn', 'city', `The case uses ${ds.length} districts (${ds.join(', ')}). Keep it to 4 at most.`);
  if (ds.length && !ds.includes('Central L.A.')) add('info', 'city', 'Central L.A. is not used. The guide suggests one of your districts be Central L.A.');

  // Briefing
  const flips = [...(c.briefing.body || '').matchAll(/flip\s+case\s+card\s+([A-L])/gi)].map(x => x[1].toUpperCase());
  for (const L of flips) { const k = c.cards[LETTERS.indexOf(L)]; if (k && !k.faceUp) add('warn', 'briefing', `The briefing flips Case card ${L}, but it is not marked face up at the start.`); }
  c.cards.forEach((k, i) => { if (k.faceUp && c.briefing.body && !flips.includes(LETTERS[i])) add('info', 'briefing', `Case card ${LETTERS[i]} starts face up but the briefing never says "flip Case card ${LETTERS[i]}".`); });
  if (!c.briefing.body.trim()) add('info', 'briefing', 'The briefing is empty. Write it last, after the responses and epilogue.');
  if (!c.epilogue.trim()) add('info', 'epilogue', 'No epilogue yet.');

  // Overflow from rendered previews
  for (const msg of extra.overflow || []) add('warn', msg.step, msg.text);

  const wc = wordCount(c);
  add(wc > 5500 ? 'warn' : 'info', 'story', `${wc.toLocaleString()} words in total. Published cases run from about 2,000 to 5,300.`);
  return out;
}
