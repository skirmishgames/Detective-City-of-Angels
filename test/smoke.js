// Smoke test: node test/smoke.js [url]  (serve the site first: python3 -m http.server 8765)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'http://localhost:8765/';
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') (/Failed to load resource/.test(m.text()) ? console.warn('warning: ' + m.text()) : errors.push(m.text())); });
  const fail = msg => { console.error('FAIL: ' + msg); process.exitCode = 1; };

  await page.goto(URL + '#/guide');
  await page.waitForSelector('#g-golden, #g-rules');
  await page.goto(URL + '#/files');
  await page.waitForSelector('.libcard');
  const n = await page.$$eval('.libcard', x => x.length);
  if (n < 2) fail(`case files shows ${n} cases`);
  await page.goto(URL + '#/play/lib/fade-out');
  await page.click('[data-pact="start"]');
  await page.click('[data-pact="tab"][data-t="ask"]');
  await page.click('[data-pact="asks"]');
  await page.click('[data-pact="askk"]');
  await page.click('[data-pact="show"]');
  await page.waitForSelector('#pshow.on .pcard-text');
  await page.click('#pshow [data-pact="close"]');
  await page.goto(URL + '#/cases');
  await page.click('[data-act="demo"]');
  await page.waitForSelector('.tile');
  await page.waitForSelector('[data-pv] canvas');

  for (const step of ['story', 'city', 'cards', 'responses', 'search', 'mystery', 'epilogue', 'briefing']) {
    await page.goto(URL + '#/build/' + step);
    await page.waitForTimeout(400);
  }
  await page.goto(URL + '#/build/checks');
  await page.waitForSelector('.checks', { timeout: 20000 });
  const errs = await page.$$eval('.lv.error', x => x.length);
  if (errs) fail(`example case shows ${errs} errors`);

  // A broken case must raise errors.
  await page.evaluate(async () => {
    const { state, ACTIONS } = window.CaseBuilder;
    await ACTIONS.newcase();
    const M = await import('./js/model.js');
    const s = M.newCard('suspect'); s.name = 'Test Suspect';
    const e = M.newCard('evidence'); e.name = 'Knife'; e.weapon = true; e.faceUp = true;
    state.c.cards.push(s, e);
    state.c.solution.weapon = e.id;
    M.setCell(state.c, s.id, e.id, [Object.assign(M.newResponse('lie'), { text: 'Lie only (99)' })]);
  });
  await page.goto(URL + '#/build/story');
  await page.goto(URL + '#/build/checks');
  await page.waitForSelector('.checks', { timeout: 20000 });
  const text = await page.$eval('.checks', x => x.textContent);
  for (const want of ['no most useful response', 'starts face up', 'no Search card', 'never revealed']) {
    if (!text.includes(want)) fail(`checks did not report "${want}"`);
  }

  // PDF of everything for the example case.
  await page.goto(URL + '#/cases');
  await page.waitForSelector('.casecard');
  const open = await page.$$('.casecard [data-act="open"]');
  // Cases are listed newest first: the example is second.
  await open[1].click();
  await page.waitForSelector('.steps');
  await page.goto(URL + '#/print');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('[data-act="pdf"][data-part="all"]')]);
  const file = path.join(out, dl.suggestedFilename());
  await dl.saveAs(file);
  const size = fs.statSync(file).size;
  if (size < 200000) fail(`PDF looks too small (${size} bytes)`);
  console.log(`PDF ${dl.suggestedFilename()} ${(size / 1e6).toFixed(1)} MB`);

  // Backup round trip.
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
  const bfile = path.join(out, bk.suggestedFilename());
  await bk.saveAs(bfile);
  const data = JSON.parse(fs.readFileSync(bfile, 'utf8'));
  if (data.case.cards.length !== 7) fail('backup is missing cards');

  await page.screenshot({ path: path.join(out, 'phone-print.png'), fullPage: true });
  if (errors.length) fail('console errors:\n' + errors.join('\n'));
  await browser.close();
  console.log(process.exitCode ? 'Smoke test FAILED' : 'Smoke test passed');
})();
