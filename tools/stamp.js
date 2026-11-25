// Adds ?v=<timestamp> to the CSS and JS links in index.html so browsers fetch fresh files after a release.
// Module imports inside js/ are not stamped; GitHub Pages serves them with short cache lifetimes.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
const v = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
let html = fs.readFileSync(file, 'utf8');
html = html.replace(/(href|src)="((?:css|js|vendor)\/[^"?]+)(\?v=\d+)?"/g, `$1="$2?v=${v}"`);
fs.writeFileSync(file, html);
console.log('Stamped', v);
