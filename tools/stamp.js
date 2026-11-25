// Adds ?v=<timestamp> to every CSS and JS reference (index.html and the imports between modules),
// so browsers always load a matching set of files after a release.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const v = new Date().toISOString().replace(/\D/g, '').slice(0, 12);

const html = path.join(root, 'index.html');
fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace(/(href|src)="((?:css|js|vendor)\/[^"?]+)(\?v=\d+)?"/g, `$1="$2?v=${v}"`));

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(path.join(root, 'js')).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(f, 'utf8');
  const out = src.replace(/(\bfrom\s+['"]|\bimport\s*\(\s*['"])(\.{1,2}\/[^'"?]+\.js)(\?v=\d+)?(['"])/g, `$1$2?v=${v}$4`);
  if (out !== src) fs.writeFileSync(f, out);
}
console.log('Stamped', v);
