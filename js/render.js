// Canvas renderers for every printed component. Sizes are print pixels.
import { imageURL } from './store.js';
import {
  LETTERS, frameOf, cardByLetter, assignCodes, searchInstruction, searchTitle, lookLine, CARD_TYPES, locName,
} from './model.js';

export const SIZES = {
  case: { w: 750, h: 1165, mmW: 57.15, mmH: 88.9 },      // 2.25 x 3.5 in
  response: { w: 900, h: 900, mmW: 76.2, mmH: 76.2 },     // 3 x 3 in
  search: { w: 560, h: 846, mmW: 44.96, mmH: 68.07 },     // 1.77 x 2.68 in
  briefing: { w: 1700, h: 2200, mmW: 215.9, mmH: 279.4 }, // letter page at 200 dpi
};
const K = SIZES.case.w / 1015; // kit artwork was measured at 1015 px wide

const ASSET = 'assets/kit/';
export const kitArt = key => `${ASSET}art/${key}.webp`;
export const kitThumb = key => `${ASSET}thumbs/${key}.webp`;

const FONT = {
  type: '"Courier Prime", "Courier New", monospace',
  marker: '"Permanent Marker", "Comic Sans MS", cursive',
  hand: '"Caveat", "Segoe Print", cursive',
  stamp: '"Oswald", "Arial Narrow", sans-serif',
  elite: '"Special Elite", "Courier New", monospace',
};
const RED = '#b3241f';
const INK = '#1f1b16';

export async function fontsReady() {
  const list = [
    `400 20px ${FONT.type}`, `700 20px ${FONT.type}`, `italic 400 20px ${FONT.type}`,
    `400 20px ${FONT.marker}`, `700 20px ${FONT.hand}`, `600 20px ${FONT.stamp}`, `400 20px ${FONT.elite}`,
  ];
  try { await Promise.all(list.map(f => document.fonts.load(f))); } catch { /* fall back to system fonts */ }
}

// ---------- images ----------
const imgCache = new Map();
export function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (!imgCache.has(url)) {
    imgCache.set(url, new Promise(res => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = url;
    }));
  }
  return imgCache.get(url);
}
export async function resolveSrc(src, c) {
  if (!src) return null;
  if (src.startsWith('kit:')) return kitArt(src.slice(4));
  if (src.startsWith('img:')) return imageURL(src.slice(4));
  if (src.startsWith('card:') && c) {
    const card = c.cards.find(k => k.id === src.slice(5));
    return card?.image?.src && !card.image.src.startsWith('card:') ? resolveSrc(card.image.src, c) : null;
  }
  return null;
}
async function loadSrc(src, c) { return loadImage(await resolveSrc(src, c)); }

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

// Draw an image to cover a box, with user zoom (>=1) and pan (-1..1).
function cover(ctx, im, x, y, w, h, opt = {}) {
  if (!im) return;
  const zoom = Math.max(0.5, Number(opt.zoom) || 1);
  const s = Math.max(w / im.width, h / im.height) * zoom;
  const dw = im.width * s, dh = im.height * s;
  const px = Math.max(-1, Math.min(1, Number(opt.x) || 0));
  const py = Math.max(-1, Math.min(1, Number(opt.y) || 0));
  const dx = x + (w - dw) / 2 + px * Math.abs(w - dw) / 2;
  const dy = y + (h - dh) / 2 + py * Math.abs(h - dh) / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(im, dx, dy, dw, dh);
  ctx.restore();
}

// ---------- rich text ----------
// Supports **bold** and line breaks. Returns laid-out lines.
function tokens(text) {
  const paras = String(text || '').replace(/\r/g, '').split('\n');
  return paras.map(p => {
    const out = [];
    let bold = false, space = true;
    for (const part of p.split(/(\*\*)/)) {
      if (part === '**') { bold = !bold; continue; }
      for (const w of part.split(/(\s+)/)) {
        if (!w) continue;
        if (/^\s+$/.test(w)) { space = true; continue; }
        out.push({ t: w, b: bold, glue: !space && out.length > 0 });
        space = false;
      }
    }
    return out;
  });
}
function setFont(ctx, o, bold) {
  const weight = bold || o.bold ? (o.boldWeight || 700) : (o.weight || 400);
  ctx.font = `${o.italic ? 'italic ' : ''}${weight} ${o.size}px ${o.family}`;
}
function layout(ctx, text, o) {
  const lh = o.size * (o.lh || 1.2);
  const lines = [];
  const widthAt = typeof o.width === 'function' ? o.width : () => o.width;
  for (const para of tokens(text)) {
    let line = [], lw = 0;
    const maxW = () => widthAt(lines.length * lh, (lines.length + 1) * lh);
    if (!para.length) { lines.push({ words: [], w: 0 }); continue; }
    for (const tk of para) {
      setFont(ctx, o, tk.b);
      const ww = ctx.measureText(tk.t).width;
      setFont(ctx, o, false);
      const sp = line.length && !tk.glue ? ctx.measureText(' ').width : 0;
      if (line.length && !tk.glue && lw + sp + ww > maxW()) {
        lines.push({ words: line, w: lw });
        line = []; lw = 0;
      }
      line.push({ ...tk, w: ww, sp: line.length && !tk.glue ? ctx.measureText(' ').width : 0 });
      lw += (line.length > 1 ? line.at(-1).sp : 0) + ww;
    }
    lines.push({ words: line, w: lw });
    if (o.paraGap) lines.push({ words: [], w: 0, gap: true });
  }
  while (lines.length && lines.at(-1).gap) lines.pop();
  const wide = lines.some(l => l.w > widthAt(0, lh) + 1 && l.words.length === 1);
  return { lines, lh, height: lines.length * lh, wide };
}
function fit(ctx, text, o, maxH, max, min) {
  let res;
  for (let s = max; s >= min; s -= 1) {
    res = layout(ctx, text, { ...o, size: s });
    if (res.height <= maxH && !res.wide) return { ...res, size: s, overflow: false };
  }
  return { ...res, size: min, overflow: res.height > maxH };
}
function drawLines(ctx, L, o, x, y, align = 'center', boxW = 0) {
  ctx.textBaseline = 'alphabetic';
  L.lines.forEach((ln, i) => {
    const by = y + i * L.lh + L.lh * 0.8;
    let cx = align === 'center' ? x + (boxW - ln.w) / 2 : align === 'right' ? x + boxW - ln.w : x;
    if (typeof boxW === 'function') { const bw = boxW(i * L.lh); cx = x - bw / 2 + (bw - ln.w) / 2; }
    ln.words.forEach((wd, j) => {
      if (j) cx += wd.sp;
      setFont(ctx, { ...o, size: L.size || o.size }, wd.b);
      ctx.fillText(wd.t, cx, by);
      cx += wd.w;
    });
  });
}

// ---------- case cards ----------
export async function renderCaseCard(c, card) {
  const { w, h } = SIZES.case;
  const cv = canvas(w, h), ctx = cv.getContext('2d');
  const frame = frameOf(card);
  const src = card.image?.src || '';
  const isKit = src.startsWith('kit:');
  const [im, fr] = await Promise.all([
    loadSrc(src, c),
    loadImage(`${ASSET}templates/${frame === 'tag' ? 'evidence' : frame === 'info' ? 'info' : 'suspect'}_frame.webp`),
  ]);
  ctx.fillStyle = '#3a3128';
  ctx.fillRect(0, 0, w, h);
  let overflow = false;

  if (frame === 'info') {
    if (fr) ctx.drawImage(fr, 0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, 0);
    ctx.rotate(-0.03);
    ctx.fillStyle = '#26221d';
    const bw = 820 * K, top = 500 * K, maxH = 620 * K;
    const o = { family: FONT.hand, weight: 700, lh: 1.05, width: bw };
    const L = fit(ctx, card.text || card.name, o, maxH, 92 * K, 40 * K);
    overflow = L.overflow;
    const y = top + Math.max(0, (maxH - L.height) / 2);
    drawLines(ctx, L, o, -bw / 2, y, 'center', bw);
    ctx.restore();
    return { canvas: cv, overflow };
  }

  if (im) {
    if (isKit) ctx.drawImage(im, 0, 0, w, h);
    else if (frame === 'notebook') cover(ctx, im, 0, 0, w, 1000 * K, card.image);
    else cover(ctx, im, 0, 0, w, h, card.image);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#5b4b3a'); g.addColorStop(1, '#2a221b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  if (fr) ctx.drawImage(fr, 0, 0, w, h);

  if (frame === 'notebook') {
    ctx.fillStyle = INK;
    const name = (card.name || '').toUpperCase();
    const nameO = { family: FONT.marker, weight: 400 };
    let ns = 66 * K;
    ctx.font = `400 ${ns}px ${FONT.marker}`;
    while (ctx.measureText(name).width > 860 * K && ns > 30 * K) { ns -= 1; ctx.font = `400 ${ns}px ${FONT.marker}`; }
    ctx.fillText(name, 95 * K, 1078 * K);
    const role = (card.role || (card.type === 'victim' ? 'The victim' : '')).toUpperCase();
    if (role) {
      ctx.fillStyle = RED;
      let rs = 46 * K;
      ctx.font = `600 ${rs}px ${FONT.stamp}`;
      while (ctx.measureText(role).width > 840 * K && rs > 22 * K) { rs -= 1; ctx.font = `600 ${rs}px ${FONT.stamp}`; }
      ctx.textAlign = 'right';
      ctx.fillText(role, 950 * K, 1128 * K);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#3b342c';
    const bx = 110 * K, bw = 830 * K, top = 1160 * K, maxH = 370 * K;
    const o = { family: FONT.type, lh: 1.22, width: bw };
    const L = fit(ctx, card.text, o, maxH, 44 * K, 24 * K);
    overflow = L.overflow || ns <= 30 * K;
    drawLines(ctx, L, o, bx, top + Math.max(0, (maxH - L.height) / 2) * 0.6, 'center', bw);
    void nameO;
  } else {
    // tag
    const bx = 195 * K, bw = 715 * K;
    ctx.fillStyle = INK;
    const name = (card.name || '').toUpperCase();
    let ns = 48 * K;
    ctx.font = `700 ${ns}px ${FONT.type}`;
    while (ctx.measureText(name).width > bw && ns > 26 * K) { ns -= 1; ctx.font = `700 ${ns}px ${FONT.type}`; }
    ctx.fillText(name, bx, 1072 * K);
    const found = card.foundAt ? `Found at ${locName(card.foundAt)} (${card.foundAt}).` : '';
    const footH = found ? 50 * K : 0;
    ctx.fillStyle = '#2f2a24';
    const o = { family: FONT.type, lh: 1.2, width: bw };
    const L = fit(ctx, card.text, o, 1340 * K - 1095 * K - footH, 40 * K, 22 * K);
    overflow = L.overflow;
    drawLines(ctx, L, o, bx, 1092 * K, 'left', bw);
    if (found) {
      ctx.fillStyle = '#5a5047';
      ctx.font = `italic 400 ${28 * K}px ${FONT.type}`;
      ctx.fillText(found, bx, 1352 * K);
    }
  }
  return { canvas: cv, overflow };
}

export async function renderCaseBack(letter) {
  const { w, h } = SIZES.case;
  const cv = canvas(w, h), ctx = cv.getContext('2d');
  const im = await loadImage(`${ASSET}backs/case_${letter}.webp`);
  if (im) ctx.drawImage(im, 0, 0, w, h);
  return { canvas: cv };
}

// ---------- mystery cards ----------
let tagCache = null;
async function tagImage() {
  if (tagCache) return tagCache;
  const fr = await loadImage(`${ASSET}templates/evidence_frame.webp`);
  if (!fr) return null;
  const sx = 60 * K, sy = 985 * K, sw = 895 * K, sh = 410 * K;
  const cv = canvas(Math.round(sw), Math.round(sh));
  cv.getContext('2d').drawImage(fr, sx, sy, sw, sh, 0, 0, sw, sh);
  tagCache = cv;
  return cv;
}
export async function renderMysteryFront(c, m) {
  const { w, h } = SIZES.case;
  const cv = canvas(w, h), ctx = cv.getContext('2d');
  const [im, tag] = await Promise.all([loadSrc(m.image?.src, c), tagImage()]);
  if (im) {
    if (m.image.src.startsWith('kit:')) ctx.drawImage(im, 0, 0, w, h); else cover(ctx, im, 0, 0, w, h, m.image);
  } else {
    const g = ctx.createRadialGradient(w / 2, h * 0.3, 40, w / 2, h / 2, h * 0.8);
    g.addColorStop(0, '#8a7350'); g.addColorStop(1, '#2b241c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  const top = im ? h * 0.42 : 40;
  const tx = 30, tw = w - 50, th = h - top - 30;
  if (tag) {
    // Stretch the kit tag: keep the left end (hole and string) and stretch the body.
    const lw = 160;
    ctx.drawImage(tag, 0, 0, lw, tag.height, tx, top, lw * (th / tag.height) > lw * 1.6 ? lw * 1.6 : lw, th);
    const lx = tx + (lw * (th / tag.height) > lw * 1.6 ? lw * 1.6 : lw);
    ctx.drawImage(tag, lw, 0, tag.width - lw, tag.height, lx, top, tx + tw - lx, th);
  }
  const bx = tx + 130, bw = tw - 170;
  ctx.fillStyle = INK;
  let ts = 44;
  const title = (m.title || '').toUpperCase();
  ctx.font = `700 ${ts}px ${FONT.type}`;
  while (ctx.measureText(title).width > bw && ts > 24) { ts -= 1; ctx.font = `700 ${ts}px ${FONT.type}`; }
  ctx.fillText(title, bx, top + 50 + ts * 0.8);
  const o = { family: FONT.type, lh: 1.22, paraGap: true, width: bw };
  const L = fit(ctx, m.text, o, th - 140 - ts, 40, 20);
  drawLines(ctx, L, o, bx, top + 80 + ts, 'left', bw);
  return { canvas: cv, overflow: L.overflow };
}
export async function renderMysteryBack(n) {
  const { w, h } = SIZES.case;
  const cv = canvas(w, h), ctx = cv.getContext('2d');
  const im = await loadImage(`${ASSET}backs/mystery_${Math.min(6, Math.max(1, n))}.webp`);
  if (im) ctx.drawImage(im, 0, 0, w, h);
  return { canvas: cv };
}

// ---------- search cards ----------
export async function renderSearchFront(c, s) {
  const { w, h } = SIZES.search;
  const cv = canvas(w, h), ctx = cv.getContext('2d');
  let src = s.image?.src || '';
  if (src === 'suspect' && s.kind === 'suspect' && s.suspect) src = 'card:' + s.suspect;
  const [bg, im] = await Promise.all([loadImage(`${ASSET}templates/search_front.webp`), loadSrc(src, c)]);
  if (bg) ctx.drawImage(bg, 0, 0, w, h);
  const imgH = 300;
  if (im) {
    const kit = src.startsWith('kit:') || (src.startsWith('card:') && (c.cards.find(k => k.id === src.slice(5))?.image?.src || '').startsWith('kit:'));
    if (kit) {
      // Use the picture part of kit art (above the notebook or tag).
      const sh = im.height * 0.6;
      const scale = Math.max(w / im.width, imgH / sh);
      const dw = im.width * scale, dh = sh * scale;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, imgH); ctx.clip();
      ctx.drawImage(im, 0, 0, im.width, sh, (w - dw) / 2, (imgH - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      const cardImg = src.startsWith('card:') ? c.cards.find(k => k.id === src.slice(5))?.image : s.image;
      cover(ctx, im, 0, 0, w, imgH, cardImg);
    }
  }
  ctx.fillStyle = '#16130f';
  const title = searchTitle(c, s);
  let ts = 40;
  ctx.font = `700 ${ts}px ${FONT.type}`;
  while (ctx.measureText(title).width > w - 60 && ts > 22) { ts -= 1; ctx.font = `700 ${ts}px ${FONT.type}`; }
  ctx.textAlign = 'center';
  ctx.fillText(title, w / 2, imgH + 52);
  ctx.textAlign = 'left';
  const instr = searchInstruction(c, s);
  const stampH = s.archive ? 64 : 0;
  // Body and instruction share the space; the instruction sits right after the body.
  const bx = 38, bw = w - 76, top = imgH + 72, bottom = h - 26 - stampH;
  const o = { family: FONT.type, lh: 1.18, width: bw };
  const oi = { family: FONT.type, lh: 1.12, bold: true, width: bw };
  let L, I, size = 30;
  for (; size >= 15; size--) {
    L = layout(ctx, s.text, { ...o, size });
    I = instr ? layout(ctx, instr, { ...oi, size: size * 0.92 }) : { height: 0, lines: [] };
    if (L.height + I.height + (instr ? size * 0.4 : 0) <= bottom - top && !L.wide) break;
  }
  const overflow = size < 15;
  L.size = Math.max(size, 15);
  ctx.fillStyle = '#2b2520';
  drawLines(ctx, L, o, bx, top, 'center', bw);
  if (instr) {
    I.size = L.size * 0.92;
    ctx.fillStyle = '#8b3a12';
    drawLines(ctx, I, oi, bx, top + L.height + L.size * 0.4, 'center', bw);
  }
  if (s.archive) drawArchiveStamp(ctx, w - 150, h - 58);
  return { canvas: cv, overflow };
}
function drawArchiveStamp(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  ctx.strokeStyle = '#5b2fa6'; ctx.fillStyle = '#5b2fa6';
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.9;
  ctx.strokeRect(-72, -26, 144, 52);
  ctx.font = `600 34px ${FONT.stamp}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ARCHIVE', 0, 2);
  ctx.restore();
}
export async function renderSearchBack(archived) {
  const { w, h } = SIZES.search;
  const cv = canvas(w, h), ctx = cv.getContext('2d');
  const im = await loadImage(`${ASSET}templates/search_back${archived ? '_archived' : ''}.webp`);
  if (im) ctx.drawImage(im, 0, 0, w, h);
  return { canvas: cv };
}

// ---------- response cards ----------
const SIDE_ROT = { a: 0, b: 1, c: 2, d: 3, w: 0, x: 1, y: 2, z: 3 };
export async function renderResponseCard(c, rc, side) {
  const S = SIZES.response.w;
  const cv = canvas(S, S), ctx = cv.getContext('2d');
  const front = side === 'front';
  const bg = await loadImage(`${ASSET}templates/response_${front ? 'front' : 'back'}.webp`);
  if (bg) ctx.drawImage(bg, 0, 0, S, S);
  const letters = front ? ['a', 'b', 'c', 'd'] : ['w', 'x', 'y', 'z'];
  const sus = c.cards.find(k => k.id === rc.suspectId);
  let portrait = null;
  if (c.settings.portraits && sus?.image?.src) portrait = await loadSrc(sus.image.src, c);
  const half = S / 2, boxHalf = 96;
  // Centre box: number and side letters.
  ctx.fillStyle = '#1d1a16';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${rc.num > 9 ? 62 : 74}px ${FONT.type}`;
  ctx.fillText(String(rc.num), half, half + 4);
  letters.forEach(L => {
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(SIDE_ROT[L] * Math.PI / 2);
    ctx.font = `700 30px ${FONT.type}`;
    ctx.fillText(L, 0, -boxHalf + 24);
    ctx.restore();
  });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const overflow = {};
  for (const L of letters) {
    const slot = rc.slots.find(x => x.slot === L);
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(SIDE_ROT[L] * Math.PI / 2);
    if (portrait && slot) drawPortrait(ctx, portrait, sus, -boxHalf - 70);
    if (slot) {
      const r = slot.response;
      const look = lookLine(c, r.look);
      const text = r.text;
      const pad = 26, m = 22;
      const maxDepth = (portrait ? half - boxHalf - 142 : half - boxHalf - 16) - pad;
      const widthAt = (t, b) => S - 2 * (pad + b) - 2 * m;
      const o = { family: FONT.type, lh: 1.16, width: widthAt };
      let res, size;
      for (size = 31; size >= 17; size--) {
        res = layout(ctx, text + (look ? '\n' : ''), { ...o, size });
        let ok = res.height <= maxDepth && !res.wide;
        if (ok && look) {
          ctx.font = `700 ${size * 0.92}px ${FONT.type}`;
          ok = ctx.measureText(look).width <= widthAt(0, res.height);
        }
        if (ok) break;
      }
      overflow[L] = size < 17;
      res.size = Math.max(size, 17);
      ctx.fillStyle = '#231f1a';
      const top = -half + pad;
      res.lines.forEach((ln, i) => {
        const by = top + i * res.lh + res.lh * 0.8;
        let cx = -ln.w / 2;
        ln.words.forEach((wd, j) => {
          if (j) cx += wd.sp;
          setFont(ctx, { ...o, size: res.size }, wd.b);
          ctx.fillText(wd.t, cx, by);
          cx += wd.w;
        });
      });
      if (look) {
        ctx.fillStyle = RED;
        ctx.font = `700 ${res.size * 0.92}px ${FONT.type}`;
        ctx.textAlign = 'center';
        ctx.fillText(look, 0, top + (res.lines.length - 1) * res.lh + res.lh * 0.8);
        ctx.textAlign = 'left';
      }
    }
    ctx.restore();
  }
  return { canvas: cv, overflow };
}
function drawPortrait(ctx, im, card, cy) {
  const rw = 104, rh = 120;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, cy, rw / 2, rh / 2, 0, 0, Math.PI * 2);
  ctx.clip();
  const kit = card.image.src.startsWith('kit:');
  // Kit art: use the face area at the top of the card.
  const sx = 0, sy = 0, sw = im.width, sh = kit ? im.height * 0.58 : im.height;
  const scale = Math.max(rw / sw, rh / sh) * (kit ? 1.55 : (card.image.zoom || 1));
  const dw = sw * scale, dh = sh * scale;
  const ox = kit ? 0 : (card.image.x || 0) * Math.abs(dw - rw) / 2;
  const oy = kit ? dh * 0.18 : (card.image.y || 0) * Math.abs(dh - rh) / 2;
  ctx.drawImage(im, sx, sy, sw, sh, -dw / 2 + ox, cy - dh / 2 + oy, dw, dh);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, cy, rw / 2, rh / 2, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(80,60,40,.45)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}

export function responseCards(c) { return assignCodes(c).cards; }

// ---------- detective briefing ----------
export async function renderBriefing(c) {
  const { w, h } = SIZES.briefing;
  const D = 200; // dpi
  const cv = canvas(w, h), ctx = cv.getContext('2d');
  const bg = await loadImage(`${ASSET}templates/briefing.jpg`);
  if (bg) ctx.drawImage(bg, 0, 0, w, h);
  const b = c.briefing;
  ctx.fillStyle = '#1b1814';
  // Title
  const title = (c.title || '').toUpperCase();
  let ts = 66;
  ctx.font = `700 ${ts}px ${FONT.type}`;
  while (ctx.measureText(title).width > 5.9 * D && ts > 30) { ts -= 1; ctx.font = `700 ${ts}px ${FONT.type}`; }
  ctx.fillText(title, 1.68 * D, 0.84 * D);
  if (c.caseId) {
    ctx.font = `700 30px ${FONT.type}`;
    ctx.textAlign = 'center';
    ctx.fillText(c.caseId, 1.27 * D, 1.28 * D);
    ctx.textAlign = 'left';
  }
  // Body in two columns
  const colW = 3.55 * D;
  const leftH = (7.92 - 2.02) * D, rightH = (7.72 - 2.02) * D;
  const o = { family: FONT.type, lh: 1.24, paraGap: true, width: colW };
  let L, size;
  const maxS = b.fontSize ? Number(b.fontSize) : 32;
  for (size = maxS; size >= 18; size--) {
    L = layout(ctx, b.body, { ...o, size });
    if (splitColumns(L, leftH, rightH)) break;
  }
  L.size = Math.max(size, 18);
  const cols = splitColumns(L, leftH, rightH) || { left: L.lines, right: [] , overflow: true };
  drawLines(ctx, { ...L, lines: cols.left }, o, 0.52 * D, 2.02 * D, 'left', colW);
  drawLines(ctx, { ...L, lines: cols.right }, o, 4.4 * D, 2.02 * D, 'left', colW);
  // Solving the case
  const so = { family: FONT.type, lh: 1.15, bold: true };
  const SL = fit(ctx, b.solving, { ...so, width: 3.35 * D }, 0.64 * D, 32, 18);
  drawLines(ctx, SL, so, 0.62 * D, 8.52 * D, 'left', 3.35 * D);
  // Locations of interest
  const locs = (b.locations || []).filter(x => x.loc || x.name);
  const lineH = Math.min(46, (10.85 - 9.36) * D / Math.max(1, locs.length));
  locs.forEach((x, i) => {
    const y = 9.36 * D + lineH * (i + 0.78);
    const nm = `${x.name || locName(x.loc)}${x.loc ? ` (${x.loc})` : ''}`;
    const lab = (x.label || '').toUpperCase();
    let fs = Math.min(30, lineH * 0.72);
    const measure = () => {
      ctx.font = `700 ${fs}px ${FONT.type}`; const a = ctx.measureText(nm + ' ').width;
      ctx.font = `italic 700 ${fs}px ${FONT.type}`; return a + ctx.measureText(lab).width;
    };
    while (measure() > 3.3 * D && fs > 14) fs -= 1;
    const total = measure();
    let x0 = 0.62 * D + (3.4 * D - total) / 2;
    ctx.font = `700 ${fs}px ${FONT.type}`; ctx.fillText(nm + ' ', x0, y);
    x0 += ctx.measureText(nm + ' ').width;
    ctx.font = `italic 700 ${fs}px ${FONT.type}`; ctx.fillText(lab, x0, y);
  });
  // Special rules
  const ro = { family: FONT.type, lh: 1.2, paraGap: true };
  const RL = fit(ctx, b.special, { ...ro, width: 3.45 * D }, (10.85 - 8.62) * D, 28, 16);
  drawLines(ctx, RL, ro, 4.5 * D, 8.62 * D, 'left', 3.45 * D);
  return { canvas: cv, overflow: cols.overflow || SL.overflow || RL.overflow };
}
function splitColumns(L, leftH, rightH) {
  const perL = Math.floor(leftH / L.lh), perR = Math.floor(rightH / L.lh);
  if (L.lines.length > perL + perR || L.wide) return null;
  let left = L.lines.slice(0, perL), right = L.lines.slice(perL);
  while (right.length && right[0].gap) right.shift();
  return { left, right, overflow: false };
}

export { LETTERS, cardByLetter, CARD_TYPES };
