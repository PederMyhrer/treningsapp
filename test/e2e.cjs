// Kjører hele flyten i ekte Chromium mot en lokal kopi og en falsk GitHub.
// Bruk: node test/e2e.cjs <mappe for skjermbilder>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process'), os = require('os');
const assert = require('assert');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || os.tmpdir();
const PW = 'test-passord-æøå';

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'trening-'));
for (const f of ['index.html', 'style.css', 'app.js', 'core.js', 'package.json', 'manifest.webmanifest', 'icon.svg', 'icon-180.png']) fs.copyFileSync(path.join(ROOT, f), path.join(work, f));
fs.cpSync(path.join(ROOT, 'fonts'), path.join(work, 'fonts'), { recursive: true });
fs.cpSync(path.join(ROOT, 'tools'), path.join(work, 'tools'), { recursive: true });
const cli = (...a) => execFileSync('node', ['tools/trening.mjs', ...a], { cwd: work, env: { ...process.env, TRENING_PW: PW } }).toString();

const T = new Date().toLocaleDateString('sv-SE');
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('sv-SE'); };
cli('nytt');
cli('kroppsvekt', '--kg', '80', '--dato', ago(70));
cli('test', '--navn', 'Maks heng 20 mm', '--verdi', '28', '--enhet', 'kg', '--dato', ago(56));
cli('test', '--navn', 'Maks heng 20 mm', '--verdi', '31', '--enhet', 'kg', '--dato', ago(21));
for (let w = 9; w >= 1; w--) {
  const d = ago(w * 7 + 1), e = ago(w * 7 - 1);
  cli('okt', '--type', 'buldring', '--plan', 'Prosjekt', '--dato', d, '--sted', 'Hallen');
  for (let i = 0; i < 6; i++) cli('problem', '--farge', ['Grønn', 'Blå', 'Gul'][i % 3], '--forsok', String(1 + i % 3), ...(i % 3 === 2 && w > 4 ? [] : ['--toppet']), '--dato', d);
  cli('slutt', '--minutter', '120', '--rpe', '8', '--fingre', String(1 + w % 3), '--dato', d);
  cli('morgen', '--fingre', String(w % 2), '--dato', d);
  cli('okt', '--type', 'styrke', '--plan', 'Trekk', '--dato', e);
  cli('sett', '--ovelse', 'Pull-up', '--reps', '4', '--kg', String(10 + (9 - w) * 2), '--antall', '3', '--dato', e);
  cli('slutt', '--minutter', '50', '--rpe', '7', '--dato', e);
  if (w % 2) { cli('okt', '--type', 'cardio', '--dato', ago(w * 7 - 3)); cli('cardio', '--km', '6', '--minutter', '35', '--dato', ago(w * 7 - 3)); }
}
cli('okt', '--type', 'styrke', '--plan', 'Overkropp styrke', '--dato', T);
cli('sett', '--ovelse', 'Pull-up', '--reps', '6', '--antall', '2', '--dato', T);
cli('sett', '--ovelse', 'Pull-up', '--reps', '6', '--kg', '10', '--dato', T);
cli('sett', '--ovelse', 'Pull-up', '--reps', '4', '--kg', '20', '--dato', T);

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => {
  const p = path.join(work, decodeURIComponent(q.url.split('?')[0].replace(/\/$/, '/index.html')));
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'text/plain' }); fs.createReadStream(p).pipe(r);
});

let sha = 1, puts = 0, conflicts = 0;
const dataFile = path.join(work, 'data.json');
async function fakeGitHub(route) {
  const q = route.request();
  const head = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Content-Type': 'application/json' };
  if (q.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: head });
  if (q.method() === 'GET') return route.fulfill({ status: 200, headers: head, body: JSON.stringify({ sha: 'v' + sha, content: Buffer.from(fs.readFileSync(dataFile)).toString('base64') }) });
  const b = JSON.parse(q.postData());
  if (b.sha !== 'v' + sha) { conflicts++; return route.fulfill({ status: 409, headers: head, body: '{}' }); }
  fs.writeFileSync(dataFile, Buffer.from(b.content, 'base64'));
  sha++; puts++;
  route.fulfill({ status: 200, headers: head, body: JSON.stringify({ content: { sha: 'v' + sha } }) });
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, colorScheme: 'light', timezoneId: 'Europe/Oslo' });
  await ctx.route('https://api.github.com/**', fakeGitHub);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/404|409/.test(m.text())) errors.push(m.text()); });
  const noOverflow = async name => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horisontal scroll: ' + name);

  // Feil passord, så riktig: data kryptert av skriptet åpnes i nettleseren
  await p.goto(url);
  await p.fill('#lock-pw', 'feil'); await p.click('#lock-go');
  await p.waitForFunction(() => document.querySelector('#lock-msg').textContent.includes('Feil passord'));
  await p.fill('#lock-pw', PW); await p.click('#lock-go');
  await p.waitForSelector('.days');
  await p.waitForSelector('.dc.is-today .marks .ic');
  await noOverflow('kalender');
  await p.screenshot({ path: path.join(OUT, '1-kalender.png'), fullPage: true });

  // Ukestripen viser én uke, og måneden åpnes og lukkes
  assert.equal(await p.locator('.dc').count(), 7);
  await p.tap('.grab');
  assert.ok(await p.locator('.dc').count() >= 28);
  await p.screenshot({ path: path.join(OUT, '2-maned.png'), fullPage: true });
  await p.tap('.dc.is-sel');
  assert.equal(await p.locator('.dc').count(), 7);

  // Fører sett rett på dagen: ett trykk åpner, verdiene er fylt ut, komma virker
  await p.waitForSelector('.sess .set');
  assert.equal(await p.locator('.set:not(.ghost)').count(), 4);
  await p.tap('.set.ghost');
  await p.waitForSelector('.comp');
  assert.equal(await p.locator('[data-d=kg]').inputValue(), '20');
  await p.locator('[data-d=reps]').fill('3');
  await p.locator('[data-d=kg]').fill('22,5');
  await p.tap('[data-act=save-set]');
  assert.equal(await p.locator('.set:not(.ghost)').count(), 5);
  await p.tap('[data-act=save-set]');   // Samme sett igjen er ett trykk
  assert.equal(await p.locator('.set:not(.ghost)').count(), 6);
  assert.equal(await p.locator('.set:not(.ghost)').nth(5).textContent(), '3×22,5');
  await p.tap('[data-act=bump][data-k=kg][data-n="1"]');
  assert.equal(await p.locator('[data-d=kg]').inputValue(), '25');
  await p.locator('.set:not(.ghost)').nth(5).tap();
  await p.tap('[data-act=del-set]');
  assert.equal(await p.locator('.set:not(.ghost)').count(), 5);
  await p.screenshot({ path: path.join(OUT, '3-okt.png'), fullPage: true });
  await noOverflow('føring');
  await p.tap('[data-act=ex-close]');
  await p.tap('[data-act=finish]');
  await p.tap('[data-act=num][data-field=rpe][data-v="8"]');
  await p.waitForSelector('.fin-t em >> text=RPE 8');
  await p.screenshot({ path: path.join(OUT, '3b-etter.png'), fullPage: true });
  await p.tap('[data-act=finish]');

  // Oversikt
  await p.tap('[data-tab=oversikt]');
  await p.waitForSelector('#ch-ex svg');
  await noOverflow('oversikt');
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(OUT, '4-oversikt.png'), fullPage: true });
  await p.locator('#ch-ex svg').tap();
  await p.waitForFunction(() => !document.querySelector('#tip').hidden);
  // Kontrollregning: (80 + 20) * (1 + 4/30) = 113,33 slår (80 + 22,5) * (1 + 3/30) = 112,75
  assert.equal(await p.locator('#tb-ex tbody tr').first().locator('td').nth(1).textContent(), '113,3');

  // Mer: token og synk
  await p.tap('[data-tab=mer]');
  await noOverflow('mer');
  await p.locator('.opt[data-key=sync] summary').tap();
  await p.screenshot({ path: path.join(OUT, '5-mer.png'), fullPage: true });
  await p.fill('#token', 'github_pat_fake'); await p.tap('#f-token button');
  await p.waitForFunction(() => document.querySelector('#sync')?.textContent === 'Synket');
  assert.ok(puts >= 1, 'appen skal ha sendt lokale endringer');
  const seen = JSON.parse(cli('json'));
  assert.ok(seen.sessions.some(s => (s.exercises || []).some(e => e.sets.some(x => x.kg === 22.5))), 'skriptet leser data kryptert av nettleseren');

  // Konflikt: skriptet (Claude) legger inn en økt mens appen fører en annen
  await p.tap('[data-tab=logg]');
  await p.tap('[data-act=pick]');
  await p.tap('[data-act=create][data-v=buldring]');
  await p.waitForSelector('.grades');
  cli('okt', '--type', 'cardio', '--plan', 'Fra Claude', '--dato', T);
  sha++;   // Filen er endret utenfor appen
  await p.tap('.grades button[aria-label=Gul]');
  await p.tap('[data-act=bump][data-k=tries][data-n="1"]');
  await p.tap('[data-act=save-prob][data-v="1"]');
  await p.tap('[data-act=save-prob][data-v="0"]');
  await p.screenshot({ path: path.join(OUT, '6-buldring.png'), fullPage: true });
  await p.waitForFunction(() => document.querySelector('#sync')?.textContent === 'Synket');
  await p.waitForTimeout(2200);
  await p.waitForFunction(() => document.querySelector('#sync')?.textContent === 'Synket');
  assert.ok(conflicts >= 1, 'konflikten skal ha skjedd');
  const after = JSON.parse(cli('json'));
  assert.ok(after.sessions.some(s => s.plan === 'Fra Claude'), 'økten fra skriptet overlever');
  assert.ok(after.sessions.some(s => (s.problems || []).some(x => x.grade === 'Gul' && x.tries === 2 && x.top && s.date === T)), 'økten fra appen overlever');
  await p.waitForSelector('.sess-t >> text=Fra Claude');
  await noOverflow('buldring');

  // Rediger detaljer, slett og angre
  const cardio = p.locator('.sess', { hasText: 'Fra Claude' });
  await cardio.locator('[data-act=details]').tap();
  await p.waitForSelector('.pop-box');
  await p.screenshot({ path: path.join(OUT, '6b-detaljer.png') });
  await p.tap('[data-act=del]');
  await p.tap('#toast-undo');
  await p.waitForSelector('.sess-t >> text=Fra Claude');

  // Husket passord: ny lasting krever ikke innlogging
  await p.reload();
  await p.waitForSelector('.days');

  // En tom økt forsvinner når du går videre, og en tom dag viser typevalg direkte
  await p.tap('[data-act=pick]'); await p.tap('[data-act=create][data-v=annet]');
  const n = await p.locator('.sess').count();
  await p.tap('[data-tab=mer]'); await p.tap('[data-tab=logg]');
  assert.equal(await p.locator('.sess').count(), n - 1);
  await p.tap('[data-act=shift][data-n="1"]');
  await p.waitForSelector('.pick-row');
  await p.screenshot({ path: path.join(OUT, '6c-tom.png') });
  await p.tap('[data-act=today]');

  // Mørk modus
  const dark = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', timezoneId: 'Europe/Oslo' });
  await dark.route('https://api.github.com/**', fakeGitHub);
  const q = await dark.newPage();
  await q.goto(url); await q.fill('#lock-pw', PW); await q.click('#lock-go');
  await q.waitForSelector('.days');
  await q.screenshot({ path: path.join(OUT, '7-kalender-mork.png'), fullPage: true });
  await q.tap?.('[data-tab=oversikt]').catch(() => {});
  await q.click('[data-tab=oversikt]');
  await q.waitForSelector('#ch-ex svg'); await q.waitForTimeout(200);
  await q.screenshot({ path: path.join(OUT, '8-oversikt-mork.png'), fullPage: true });

  assert.deepEqual(errors, []);
  await b.close(); server.close();
  fs.rmSync(work, { recursive: true });
  console.log('E2E OK: puts', puts, 'konflikter', conflicts);
})().catch(e => { console.error(e); process.exit(1); });
