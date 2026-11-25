// Browser storage (IndexedDB). Cases are JSON; pictures are Blobs in their own store.
import { migrate, uid } from './model.js?v=202611251503';

const DB = 'dcoa-case-builder';
let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => {
      const d = rq.result;
      d.createObjectStore('cases', { keyPath: 'id' });
      d.createObjectStore('images', { keyPath: 'id' });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
  });
}
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function listCases() {
  const all = await tx('cases', 'readonly', s => req(s.getAll()));
  return (all || []).map(migrate).sort((a, b) => b.updated - a.updated);
}
export async function getCase(id) {
  const c = await tx('cases', 'readonly', s => req(s.get(id)));
  return c ? migrate(c) : null;
}
export async function putCase(c) {
  c.updated = Date.now();
  return tx('cases', 'readwrite', s => req(s.put(JSON.parse(JSON.stringify(c)))));
}
export async function deleteCase(c) {
  const ids = imageIds(c);
  await tx('cases', 'readwrite', s => req(s.delete(c.id)));
  // Remove pictures only this case used.
  const others = await listCases();
  const keep = new Set(others.flatMap(imageIds));
  await tx('images', 'readwrite', s => { for (const id of ids) if (!keep.has(id)) s.delete(id); });
}

export function imageIds(c) {
  const out = [];
  const add = im => { if (im?.src?.startsWith('img:')) out.push(im.src.slice(4)); };
  c.cards.forEach(k => add(k.image));
  c.search.forEach(k => add(k.image));
  c.mystery.forEach(k => add(k.image));
  return out;
}

const urlCache = new Map();
export async function putImage(blob) {
  const id = uid('img');
  await tx('images', 'readwrite', s => req(s.put({ id, blob, type: blob.type })));
  return id;
}
export async function imageURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await tx('images', 'readonly', s => req(s.get(id)));
  if (!rec) return null;
  const u = URL.createObjectURL(rec.blob);
  urlCache.set(id, u);
  return u;
}
async function imageBlob(id) {
  const rec = await tx('images', 'readonly', s => req(s.get(id)));
  return rec?.blob || null;
}

const toDataURL = blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
const fromDataURL = async d => (await fetch(d)).blob();

export async function exportCase(c) {
  const images = {};
  for (const id of new Set(imageIds(c))) {
    const b = await imageBlob(id);
    if (b) images[id] = await toDataURL(b);
  }
  return { app: 'dcoa-case-builder', version: 1, exported: new Date().toISOString(), case: c, images };
}

export async function importCase(data, { asCopy = false } = {}) {
  if (!data || data.app !== 'dcoa-case-builder' || !data.case) throw new Error('This file is not a Case Builder backup.');
  const c = migrate(data.case);
  const map = {};
  for (const [oldId, d] of Object.entries(data.images || {})) {
    map[oldId] = await putImage(await fromDataURL(d));
  }
  const fix = im => { if (im?.src?.startsWith('img:') && map[im.src.slice(4)]) im.src = 'img:' + map[im.src.slice(4)]; };
  c.cards.forEach(k => fix(k.image)); c.search.forEach(k => fix(k.image)); c.mystery.forEach(k => fix(k.image));
  const existing = await getCase(c.id);
  if (existing || asCopy) { c.id = uid('case'); if (existing) c.title += ' (imported)'; }
  await putCase(c);
  return c;
}
