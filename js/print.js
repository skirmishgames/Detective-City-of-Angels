// Printable PDFs (jsPDF). Cards print at actual size with crop marks on shared edges.
import {
  SIZES, renderCaseCard, renderCaseBack, renderMysteryFront, renderMysteryBack,
  renderSearchFront, renderSearchBack, renderResponseCard, renderBriefing, responseCards, fontsReady,
} from './render.js?v=202611261456';
import { LETTERS } from './model.js?v=202611261456';

const PAPER = { letter: [215.9, 279.4], a4: [210, 297] };

function newDoc(paper) {
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: 'mm', format: PAPER[paper] || PAPER.letter, compress: true });
}
const jpg = cv => cv.toDataURL('image/jpeg', 0.9);

// items: [{ front: canvas, back: canvas|null }]
function addSheets(doc, items, size, opt, label, first) {
  const [pw, ph] = PAPER[opt.paper] || PAPER.letter;
  const margin = 7;
  const cw = size.mmW, ch = size.mmH;
  const cols = Math.max(1, Math.floor((pw - 2 * margin) / cw));
  const rows = Math.max(1, Math.floor((ph - 2 * margin) / ch));
  const per = cols * rows;
  const gx = (pw - cols * cw) / 2, gy = (ph - rows * ch) / 2;
  const hasBacks = opt.backs && items.some(i => i.back);
  let pageCount = 0;
  const addPage = () => { if (!first.done) { first.done = true; } else doc.addPage(); pageCount++; };
  for (let p = 0; p * per < items.length; p++) {
    const chunk = items.slice(p * per, p * per + per);
    const n = chunk.length, usedRows = Math.ceil(n / cols);
    addPage();
    chunk.forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      doc.addImage(jpg(it.front), 'JPEG', gx + col * cw, gy + row * ch, cw, ch, undefined, 'FAST');
    });
    marks(doc, gx, gy, cw, ch, cols, usedRows, pw, ph, opt);
    tag(doc, `${label}: fronts, sheet ${p + 1}`, pw, ph);
    if (hasBacks) {
      addPage();
      chunk.forEach((it, i) => {
        if (!it.back) return;
        const col = cols - 1 - (i % cols), row = Math.floor(i / cols); // mirrored for long-edge duplex
        doc.addImage(jpg(it.back), 'JPEG', gx + col * cw, gy + row * ch, cw, ch, undefined, 'FAST');
      });
      marks(doc, gx, gy, cw, ch, cols, usedRows, pw, ph, opt);
      tag(doc, `${label}: backs, sheet ${p + 1} (print on the reverse, flip on long edge)`, pw, ph);
    }
  }
  return pageCount;
}
function marks(doc, gx, gy, cw, ch, cols, rows, pw, ph, opt) {
  if (opt.cropMarks === false) return;
  doc.setDrawColor(90); doc.setLineWidth(0.2);
  const x1 = gx + cols * cw, y1 = gy + rows * ch;
  const len = Math.min(5, gx - 1.5, gy - 1.5);
  if (len <= 0.5) return;
  for (let c = 0; c <= cols; c++) {
    const x = gx + c * cw;
    doc.line(x, gy - 1 - len, x, gy - 1);
    doc.line(x, y1 + 1, x, y1 + 1 + len);
  }
  for (let r = 0; r <= rows; r++) {
    const y = gy + r * ch;
    doc.line(gx - 1 - len, y, gx - 1, y);
    doc.line(x1 + 1, y, x1 + 1 + len, y);
  }
}
function tag(doc, text, pw, ph) {
  doc.setFontSize(6); doc.setTextColor(120);
  doc.text(text, pw / 2, ph - 2, { align: 'center' });
  doc.setTextColor(0);
}

async function caseItems(c, opt) {
  const out = [];
  for (let i = 0; i < c.cards.length; i++) {
    out.push({ front: (await renderCaseCard(c, c.cards[i])).canvas, back: (await renderCaseBack(LETTERS[i])).canvas });
    opt.progress?.(`Case card ${LETTERS[i]}`);
  }
  return out;
}
async function mysteryItems(c, opt) {
  const out = [];
  for (let i = 0; i < c.mystery.length; i++) {
    out.push({ front: (await renderMysteryFront(c, c.mystery[i])).canvas, back: (await renderMysteryBack(i + 1)).canvas });
    opt.progress?.(`Mystery card ${i + 1}`);
  }
  return out;
}
async function searchItems(c, opt) {
  const out = [];
  for (const s of c.search) {
    out.push({ front: (await renderSearchFront(c, s)).canvas, back: (await renderSearchBack(s.archive)).canvas });
    opt.progress?.('Search cards');
  }
  return out;
}
async function responseItems(c, opt) {
  const out = [];
  for (const rc of responseCards(c)) {
    out.push({ front: (await renderResponseCard(c, rc, 'front')).canvas, back: (await renderResponseCard(c, rc, 'back')).canvas });
    opt.progress?.(`Response card ${rc.num}`);
  }
  return out;
}
async function addBriefing(doc, c, opt, first) {
  const [pw, ph] = PAPER[opt.paper] || PAPER.letter;
  const { canvas } = await renderBriefing(c);
  if (first.done) doc.addPage(); else first.done = true;
  const s = Math.min(pw / SIZES.briefing.mmW, ph / SIZES.briefing.mmH);
  const w = SIZES.briefing.mmW * s, h = SIZES.briefing.mmH * s;
  doc.addImage(jpg(canvas), 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h, undefined, 'FAST');
}

export const PARTS = {
  briefing: { label: 'Detective briefing' },
  case: { label: 'Case cards', items: caseItems, size: 'case' },
  mystery: { label: 'Mystery cards', items: mysteryItems, size: 'case' },
  search: { label: 'Search cards', items: searchItems, size: 'search' },
  response: { label: 'Response cards', items: responseItems, size: 'response' },
};

export async function buildPDF(c, parts, opt) {
  await fontsReady();
  const doc = newDoc(opt.paper);
  const first = { done: false };
  for (const key of parts) {
    const P = PARTS[key];
    if (key === 'briefing') { opt.progress?.('Briefing'); await addBriefing(doc, c, opt, first); continue; }
    const items = await P.items(c, opt);
    if (items.length) addSheets(doc, items, SIZES[P.size], opt, P.label, first);
  }
  if (!first.done) throw new Error('Nothing to print yet.');
  const slug = (c.title || 'case').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'case';
  const name = `${slug}-${parts.length === 1 ? parts[0] : 'print-set'}.pdf`;
  doc.save(name);
  return name;
}
