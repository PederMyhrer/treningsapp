import * as c from './core.js';

const GH = { owner: 'PederMyhrer', repo: 'treningsapp', path: 'data.json', branch: 'main' };
const LS = { vault: 'trening.vault', token: 'trening.token', pw: 'trening.pw', dirty: 'trening.dirty' };
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
const DOW = ['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø'];
const DAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
const I = {
  buldring: '<path d="M3.4 19.5 6.8 9l6-5 7 5.6 1 9.9Z"/><circle class="dot" cx="10.6" cy="10.2" r="1.2"/><circle class="dot" cx="14.6" cy="13.2" r="1.2"/><circle class="dot" cx="9.4" cy="15.4" r="1.2"/>',
  styrke: '<path d="M8.8 9.4 7.9 7c-.6-1.6.5-3 2.1-3h4c1.6 0 2.7 1.4 2.1 3l-.9 2.4"/><path d="M12 8.2c3.9 0 6.6 2.9 6.6 6.3 0 2-.9 3.8-2.3 5-.3.3-.7.5-1.2.5H8.9c-.5 0-.9-.2-1.2-.5a6.6 6.6 0 0 1-2.300-5c0-3.4 2.700-6.300 6.600-6.300Z"/>',
  cardio: '<path d="M3 7.6c.8 1 2.2 1.3 3.4.7l1.4-.7 3.9 3.5c.8.7 1.8 1.2 2.9 1.4l3.4.6c1.5.3 2.4 1.3 2.4 2.7v.7c0 .7-.5 1.2-1.2 1.2H5c-1.1 0-2-.9-2-2Z"/><path d="M3 14.4h7.6c1.1 0 2.2.3 3.1.9l.9.6c.5.3 1.1.5 1.7.5h4.2"/><path d="m10 10 1.4-1.4M12.3 12l1.3-1.4"/>',
  annet: '<path d="m2.8 19 6-9.6 3.6 4.8 2.6-3.2L21.2 19Z"/><path d="m7.2 11.9 1.9 1.2 1.3-1 1.2.9"/><circle cx="17.5" cy="6" r="1.7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M7 7l10 10M17 7 7 17"/>',
  left: '<path d="M14.5 6 8.5 12l6 6"/>', right: '<path d="m9.5 6 6 6-6 6"/>', down: '<path d="m6 9.5 6 6 6-6"/>',
  dots: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
};
const ic = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;
const typeTile = (type, cls = '') => `<span class="tile ${cls}" style="--c:${c.TYPES[type]?.color || c.TYPES.annet.color}">${ic(type)}</span>`;
const holdPath = 'M5.2 15.6C3.5 12.2 5 7.2 9 5.4c3.6-1.7 8.2-.6 10 2.9 1.6 3 .7 6.6-1.9 8.9-2.7 2.4-6.6 3-9.1 1.6-1.2-.6-2.1-1.7-2.8-3.2Z';
const onColor = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return .299 * r + .587 * g + .114 * b > 150 ? '#16201D' : '#FFFFFF'; };
const gradeHold = (color, hollow) => `<svg class="ghold" viewBox="0 0 24 24" aria-hidden="true"><path d="${holdPath}" fill="${hollow ? 'none' : esc(color)}" stroke="${esc(color)}" stroke-width="2"/></svg>`;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const nf = (n, d = 0) => (n ?? 0).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const today = () => c.iso(new Date());
const numv = v => (v === null || v === undefined ? '' : String(v).replace('.', ','));
const cap = s => s[0].toUpperCase() + s.slice(1);
const dateLong = s => { const d = c.fromIso(s); return `${d.getDate()}. ${MONTHS[d.getMonth()]}`; };
const dateShort = s => { const d = c.fromIso(s); return `${d.getDate()}. ${MONTHS[d.getMonth()].slice(0, 3)}`; };
const dayName = s => DAYS[(c.fromIso(s).getDay() + 6) % 7];
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* privat modus */ } };
const lsJSON = k => { try { return JSON.parse(lsGet(k)); } catch { return null; } };

const S = {
  pw: null, key: null, salt: null, iter: c.KDF_ITER, state: null, token: null, sha: null,
  tab: 'logg', month: today().slice(0, 7), sel: today(), expanded: false, pick: false,
  details: null, active: null, draft: {}, adding: null, finish: null, pb: {}, moreOpen: null,
  chartEx: null, chartTest: null, pushTimer: null, pushing: false, undo: null, sync: ['', ''], charts: {},
};
const st = () => S.state;
const byId = id => S.state?.sessions.find(s => s.id === id);
const sidOf = el => byId(el.closest('[data-sid]')?.dataset.sid);

/* ---------- Åpne og låse ---------- */

async function fetchPublic() {
  try {
    const r = await fetch('data.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    const env = await r.json();
    return c.isEnvelope(env) ? env : null;
  } catch { return null; }
}
async function useSalt(salt, iter) {
  if (S.key && S.salt === salt && S.iter === iter) return;
  S.key = await c.deriveKey(S.pw, salt, iter);
  S.salt = salt; S.iter = iter;
}
async function unlock(pw) {
  S.pw = pw;
  const remote = await fetchPublic(), local = lsJSON(LS.vault);
  const first = remote || local;
  if (!first) throw new Error('Fant ikke treningsdataene. Sjekk nettet og prøv igjen.');
  await useSalt(first.salt, first.iter);
  let state;
  try { state = await c.openWith(S.key, first); }
  catch { S.pw = S.key = S.salt = null; throw new Error('Feil passord.'); }
  if (remote && local && local.salt === remote.salt) {
    try { state = c.merge(state, await c.openWith(S.key, local)); } catch { /* lokal kopi er utdatert */ }
  }
  S.state = state;
  const tok = lsJSON(LS.token);
  if (tok) {
    try {
      const key = tok.salt === S.salt ? S.key : await c.deriveKey(pw, tok.salt, tok.iter);
      S.token = (await c.openWith(key, tok)).token;
    } catch { S.token = null; }
  }
  $('#lock').hidden = true;
  $('#app').hidden = false;
  await saveLocal();
  render();
  pull();
}
function lock() {
  lsSet(LS.pw, null);
  location.reload();
}

/* ---------- Lagring og synk ---------- */

function setSync(cls, txt) {
  S.sync = [cls, txt];
  const el = $('#sync');
  if (el) { el.className = 'sync ' + cls; el.textContent = txt; }
}
const syncHtml = () => `<span id="sync" class="sync ${S.sync[0]}" role="status">${esc(S.sync[1])}</span>`;
async function saveLocal() {
  lsSet(LS.vault, JSON.stringify(await c.sealWith(S.key, S.salt, S.iter, st())));
}
async function saveToken() {
  lsSet(LS.token, S.token ? JSON.stringify(await c.sealWith(S.key, S.salt, S.iter, { token: S.token })) : null);
}
/** Kalles etter hver endring. Lagrer kryptert på enheten med en gang og sender til GitHub etter et øyeblikk. */
function changed() {
  st().savedAt = new Date().toISOString();
  lsSet(LS.dirty, '1');
  saveLocal();
  if (!S.token) return setSync('local', 'Ikke synket');
  setSync('', 'Lagrer');
  clearTimeout(S.pushTimer);
  S.pushTimer = setTimeout(push, 1200);
}
const ghUrl = () => `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${GH.path}`;
const ghHead = () => ({ Authorization: 'Bearer ' + S.token, Accept: 'application/vnd.github+json' });
async function ghGet() {
  const r = await fetch(`${ghUrl()}?ref=${GH.branch}&t=${Date.now()}`, { headers: ghHead(), cache: 'no-store' });
  if (r.status === 401 || r.status === 403) throw new Error('token');
  if (r.status === 404) return {};
  if (!r.ok) throw new Error('GitHub svarte ' + r.status);
  const j = await r.json();
  return { sha: j.sha, env: JSON.parse(atob(j.content.replace(/\n/g, ''))) };
}
/** Slår sammen data fra GitHub med det som ligger her. Nyeste versjon per økt vinner. */
async function absorb(env) {
  await useSalt(env.salt, env.iter);
  const remote = await c.openWith(S.key, env);
  const merged = c.merge(st(), remote);
  const news = !c.sameData(merged, st());
  const ahead = !c.sameData(merged, remote);
  S.state = merged;
  await saveLocal();
  if (news && !document.activeElement?.matches?.('input, textarea, select') && $('#sheet').hidden) render();
  return ahead;
}
function syncError(e) {
  if (e.message === 'token') return setSync('err', 'GitHub avviste tokenet. Legg inn nytt under Mer.');
  if (e.name === 'OperationError') return setSync('err', 'Passordet er endret et annet sted. Lås og åpne på nytt.');
  setSync('err', lsGet(LS.dirty) ? 'Lagret på denne enheten, sender når du har nett' : 'Fikk ikke kontakt med GitHub');
}
async function pull() {
  if (S.pushing) return;
  try {
    if (S.token) {
      const g = await ghGet();
      S.sha = g.sha || null;
      const ahead = g.env ? await absorb(g.env) : true;
      if (ahead) return push();
      lsSet(LS.dirty, null);
      setSync('ok', 'Synket');
    } else {
      const env = await fetchPublic();
      if (env) await absorb(env);
      setSync(lsGet(LS.dirty) ? 'local' : '', 'Ikke koblet til GitHub');
    }
  } catch (e) { syncError(e); }
}
async function push() {
  if (!S.token) return;
  if (S.pushing) { S.pushTimer = setTimeout(push, 800); return; }
  S.pushing = true;
  clearTimeout(S.pushTimer);
  try {
    for (let i = 0; i < 4; i++) {
      if (!S.sha) S.sha = (await ghGet()).sha || null;
      const env = await c.sealWith(S.key, S.salt, S.iter, st());
      const body = { message: 'Oppdater data (kryptert)', content: btoa(JSON.stringify(env) + '\n'), branch: GH.branch };
      if (S.sha) body.sha = S.sha;
      const r = await fetch(ghUrl(), { method: 'PUT', headers: { ...ghHead(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 409 || r.status === 422) {
        const g = await ghGet();
        S.sha = g.sha || null;
        if (g.env) await absorb(g.env);
        continue;
      }
      if (r.status === 401 || r.status === 403) throw new Error('token');
      if (!r.ok) throw new Error('GitHub svarte ' + r.status);
      S.sha = (await r.json()).content.sha;
      lsSet(LS.dirty, null);
      setSync('ok', 'Synket');
      return;
    }
    throw new Error('GitHub svarte med konflikt flere ganger');
  } catch (e) { syncError(e); } finally { S.pushing = false; }
}
addEventListener('online', () => { if (S.state) pull(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.state) pull(); });

/* ---------- Tegning ---------- */

function render() {
  $$('.tabs button').forEach(b => b.dataset.tab === S.tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  ({ logg: viewLog, oversikt: viewDashboard, mer: viewMore })[S.tab]();
}
function toast(txt, undo) {
  const t = $('#toast');
  $('#toast-txt').textContent = txt;
  $('#toast-undo').hidden = !undo;
  S.undo = undo || null;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.hidden = true; S.undo = null; }, undo ? 6000 : 2500);
}
const isBlank = s => !s.plan && !s.place && !s.note && !s.exercises.length && !s.problems.length && !(s.cardio && (s.cardio.km || s.cardio.hr)) && s.duration == null && s.rpe == null && s.fingers == null;
function pruneBlank() {
  const before = st().sessions.length;
  st().sessions = st().sessions.filter(s => s.deleted || !isBlank(s) || s.date === S.sel && S.tab === 'logg');
  if (st().sessions.length !== before) changed();
}

/* ---------- Logg: ukestripe, måned og dagen ---------- */

function viewLog() {
  const t = today(), ref = S.expanded ? S.month + '-15' : S.sel;
  const label = `${cap(MONTHS[c.fromIso(ref).getMonth()])} ${S.expanded ? ref.slice(0, 4) : ''}`.trim();
  const list = c.sessionsOn(st(), S.sel);
  const showPick = !list.length || S.pick;
  $('#view').innerHTML = `
    <header class="head">
      <button class="month" data-act="toggle-month" aria-expanded="${S.expanded}">${label}${S.expanded ? '' : `<span>uke ${c.weekNo(S.sel)}</span>`}${ic('down', S.expanded ? 'flip' : '')}</button>
      <div class="head-r">
        ${S.sel !== t ? '<button class="today" data-act="today">I dag</button>' : ''}
        ${syncHtml()}
        <button class="nav" data-act="shift" data-n="-1" aria-label="Forrige">${ic('left')}</button>
        <button class="nav" data-act="shift" data-n="1" aria-label="Neste">${ic('right')}</button>
      </div>
    </header>
    <section class="cal" id="cal">${calendar(t)}<button class="grab" data-act="toggle-month" aria-label="${S.expanded ? 'Skjul måneden' : 'Vis hele måneden'}"><i></i></button></section>
    ${fingerNudge(t)}
    <section class="daypage">
      <h1>${S.sel === t ? 'I dag' : cap(dayName(S.sel))}<span>${dateLong(S.sel)}</span></h1>
      ${list.map(sessionBlock).join('')}
      ${showPick ? typePicker(list.length) : '<button class="more-line" data-act="pick">' + ic('plus') + 'Ny økt</button>'}
    </section>`;
}
function calendar(t) {
  const weeks = [];
  if (S.expanded) {
    const y = +S.month.slice(0, 4), m = +S.month.slice(5), last = c.iso(new Date(y, m, 0, 12));
    for (let w = c.monday(S.month + '-01'); w <= last; w = c.addDays(w, 7)) weeks.push(w);
  } else weeks.push(c.monday(S.sel));
  const cells = weeks.flatMap(w => Array.from({ length: 7 }, (_, i) => {
    const d = c.addDays(w, i), list = c.sessionsOn(st(), d);
    const cls = ['dc', d === t && 'is-today', d === S.sel && 'is-sel', S.expanded && d.slice(0, 7) !== S.month && 'is-out'].filter(Boolean).join(' ');
    const label = `${dateLong(d)}${list.length ? ', ' + list.map(s => c.TYPES[s.type]?.label).join(' og ') : ''}`;
    const marks = [...new Set(list.map(s => s.type))].slice(0, 2);
    return `<button class="${cls}" data-act="day" data-date="${d}" aria-label="${esc(label)}" ${d === S.sel ? 'aria-current="date"' : ''}><b>${c.fromIso(d).getDate()}</b><span class="marks">${marks.map(k => `<span style="color:${c.TYPES[k].color}">${ic(k)}</span>`).join('')}</span></button>`;
  }));
  return `<div class="dow">${DOW.map(x => `<span>${x}</span>`).join('')}</div><div class="days">${cells.join('')}</div>`;
}
function fingerNudge(t) {
  const s = c.live(st().sessions).filter(x => x.date < t && x.date >= c.addDays(t, -2) && x.type === 'buldring' && x.fingersNext == null).at(-1);
  if (!s) return '';
  return `<div class="nudge" data-sid="${s.id}"><p>Fingrene etter buldringen ${dayName(s.date)}?</p>${nums('fingersNext', 0, 10, null)}</div>`;
}
function nums(field, min, max, value) {
  const n = max - min + 1;
  return `<div class="nums" role="group">${Array.from({ length: n }, (_, i) => {
    const v = min + i;
    return `<button data-act="num" data-field="${field}" data-v="${v}" aria-pressed="${value === v}">${v}</button>`;
  }).join('')}</div>`;
}
function typePicker(hasSessions) {
  return `<div class="pick">
    ${hasSessions ? '' : '<p>Hva trener du?</p>'}
    <div class="pick-row">${Object.keys(c.TYPES).map(k => `<button data-act="create" data-v="${k}">${typeTile(k)}<span>${c.TYPES[k].label}</span></button>`).join('')}</div>
  </div>`;
}

/* ---------- Økten ---------- */

function sessionBlock(s) {
  const title = s.plan || c.TYPES[s.type]?.label;
  const meta = s.place;
  return `<article class="sess" data-sid="${s.id}">
    <div class="sess-head">${typeTile(s.type)}<div class="sess-t"><h2>${esc(title)}</h2>${meta ? `<p>${esc(meta)}</p>` : ''}</div><button class="nav" data-act="details" aria-label="Rediger økten">${ic('dots')}</button></div>
    ${s.type === 'buldring' ? partBoulder(s) : ''}
    ${s.type === 'cardio' ? partCardio(s) : partStrength(s)}
    ${partFinish(s)}
  </article>`;
}
function partStrength(s) {
  const adding = S.adding === s.id || (s.type === 'styrke' && !s.exercises.length);
  const names = [...new Set([...c.exerciseNames(st()), ...Object.keys(st().settings.exercises)])].filter(n => !s.exercises.some(e => e.name === n)).slice(0, 8);
  return `<div class="exs">
    ${s.exercises.map((e, i) => exerciseRow(s, e, i)).join('')}
    ${adding ? `<div class="ex-add">
      <div class="sugg">${names.map(n => `<button data-act="add-ex" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <form class="ex-new" data-sid="${s.id}"><input name="n" placeholder="Annen øvelse" aria-label="Navn på øvelse" autocomplete="off"><button aria-label="Legg til øvelse">${ic('plus')}</button></form>
    </div>` : `<button class="more-line" data-act="adding">${ic('plus')}Øvelse</button>`}
  </div>`;
}
function exerciseRow(s, e, i) {
  const active = S.active?.sid === s.id && S.active.i === i;
  const last = active ? c.lastTime(st(), e.name, s.date, s.id) : null;
  return `<div class="ex ${active ? 'on' : ''}">
    <button class="ex-name" data-act="ex" data-i="${i}">${esc(e.name)}</button>
    <div class="sets">
      ${e.sets.map((x, j) => `<button class="set ${active && S.active.j === j ? 'on' : ''}" data-act="pick-set" data-i="${i}" data-j="${j}">${esc(c.setText(x).replace(' × ', '×').replace(' kg', ''))}</button>`).join('')}
      ${active ? '' : `<button class="set ghost" data-act="ex" data-i="${i}" aria-label="Legg til sett på ${esc(e.name)}">${ic('plus')}</button>`}
    </div>
    ${active ? composer(s, e, i, last) : ''}
  </div>`;
}
function stepper(key, label, val) {
  return `<div class="stp"><span>${label}</span><div><button data-act="bump" data-k="${key}" data-n="-1" aria-label="Mindre ${label}">${ic('minus')}</button><input inputmode="decimal" data-d="${key}" value="${numv(val)}" aria-label="${label}" placeholder="0"><button data-act="bump" data-k="${key}" data-n="1" aria-label="Mer ${label}">${ic('plus')}</button></div></div>`;
}
function composer(s, e, i, last) {
  const d = S.draft, timed = e.timed, editing = S.active.j !== null, bw = c.isBodyweight(st(), e.name);
  return `<div class="comp">
    ${last ? `<p class="hint">Sist ${dateShort(last.date)}: ${esc(last.sets.map(x => c.setText(x).replace(' × ', '×').replace(' kg', '')).join(', '))}</p>` : ''}
    <div class="comp-row">
      ${stepper(timed ? 'sec' : 'reps', timed ? 'Sekunder' : 'Reps', timed ? d.sec : d.reps)}
      ${stepper('kg', bw ? 'Ekstra kg' : 'Kg', d.kg)}
      <button class="go" data-act="save-set" data-i="${i}" aria-label="${editing ? 'Lagre settet' : 'Legg til sett'}">${ic('check')}</button>
    </div>
    <div class="comp-foot">
      <button data-act="toggle-timed" data-i="${i}">${timed ? 'Bruk reps' : 'Bruk tid'}</button>
      ${editing ? `<button data-act="del-set" data-i="${i}">Slett settet</button>` : `<button data-act="del-ex" data-i="${i}">Fjern øvelsen</button>`}
      <button data-act="ex-close">Lukk</button>
    </div>
  </div>`;
}
function pb(s) {
  const grades = st().settings.grades;
  if (!S.pb[s.id]) S.pb[s.id] = { grade: s.problems.at(-1)?.grade || grades[0]?.name, tries: 1, style: '', i: null };
  return S.pb[s.id];
}
function partBoulder(s) {
  const grades = st().settings.grades, d = pb(s), p = c.problemStats(s);
  const colorOf = g => grades.find(x => x.name === g)?.color || '#888';
  const editing = d.i !== null;
  return `<div class="boulder">
    ${s.problems.length ? `<p class="tally"><b>${p.tops}</b> av ${p.problems} toppet${p.flashes ? `, ${p.flashes} på første` : ''}</p>
    <div class="toks">${s.problems.map((x, i) => `<button class="tok ${d.i === i ? 'on' : ''}" data-act="pick-prob" data-i="${i}" aria-label="${esc(x.grade)}, ${x.tries} forsøk, ${x.top ? 'toppet' : 'ikke toppet'}">${gradeHold(colorOf(x.grade), !x.top)}<span style="color:${x.top ? onColor(colorOf(x.grade)) : 'var(--ink)'}">${x.tries}</span></button>`).join('')}</div>` : ''}
    <div class="comp">
      <div class="grades">${grades.map(g => `<button data-act="grade" data-v="${esc(g.name)}" aria-pressed="${d.grade === g.name}" aria-label="${esc(g.name)}">${gradeHold(g.color)}<span>${esc(g.name)}</span></button>`).join('')}</div>
      <div class="styles">${c.STYLES.map(v => `<button data-act="style" data-v="${v}" aria-pressed="${d.style === v}">${v}</button>`).join('')}</div>
      <div class="comp-row prob">
        ${stepper('tries', 'Forsøk', d.tries)}
        <button class="go wide" data-act="save-prob" data-v="1">${ic('check')}Toppet</button>
        <button class="go wide alt" data-act="save-prob" data-v="0">Ikke toppet</button>
      </div>
      ${editing ? `<div class="comp-foot"><button data-act="del-prob">Slett problemet</button><button data-act="prob-close">Lukk</button></div>` : ''}
    </div>
  </div>`;
}
function partCardio(s) {
  const d = s.cardio || {};
  return `<div class="cardio">
    <div class="styles">${c.CARDIO_KINDS.map(k => `<button data-act="kind" data-v="${k}" aria-pressed="${d.kind === k}">${k}</button>`).join('')}</div>
    <div class="trio">
      <label>Km<input data-cf="km" inputmode="decimal" value="${numv(d.km)}" placeholder="0"></label>
      <label>Minutter<input data-f="duration" data-num inputmode="numeric" value="${s.duration ?? ''}" placeholder="0"></label>
      <label>Snittpuls<input data-cf="hr" inputmode="numeric" value="${numv(d.hr)}" placeholder="0"></label>
    </div>
  </div>`;
}
function partFinish(s) {
  const open = S.finish === s.id;
  const bits = [s.duration && `${s.duration} min`, s.rpe && `RPE ${s.rpe}`, s.fingers != null && `fingre ${s.fingers}`, s.fingersNext != null && `morgen ${s.fingersNext}`].filter(Boolean);
  return `<div class="fin">
    <button class="fin-t" data-act="finish" aria-expanded="${open}"><span>Etter økten</span><em>${esc(bits.join(', '))}</em>${ic('down', open ? 'flip' : '')}</button>
    ${open ? `<div class="fin-b">
      ${s.type === 'cardio' ? '' : `<label class="inl">Minutter<input data-f="duration" data-num inputmode="numeric" value="${s.duration ?? ''}" placeholder="0"></label>`}
      <div><p class="lbl">Hvor tung, 1 er lett og 10 er maks</p>${nums('rpe', 1, 10, s.rpe)}</div>
      <div><p class="lbl">Fingersmerte nå, 0 er ingen</p>${nums('fingers', 0, 10, s.fingers)}</div>
      <div><p class="lbl">Fingersmerte morgenen etter</p>${nums('fingersNext', 0, 10, s.fingersNext)}</div>
      <textarea data-f="note" rows="2" placeholder="Notat" aria-label="Notat">${esc(s.note)}</textarea>
    </div>` : ''}
  </div>`;
}
function openDetails(s) {
  S.details = s.id;
  const places = [...new Set(c.live(st().sessions).map(x => x.place).filter(Boolean))];
  const sh = $('#sheet');
  sh.hidden = false;
  sh.innerHTML = `<div class="pop-box sheet-in" data-sid="${s.id}">
    <i class="pop-grab"></i>
    <div class="seg" role="group" aria-label="Type økt">${Object.keys(c.TYPES).map(k => `<button data-act="type" data-v="${k}" aria-pressed="${s.type === k}">${typeTile(k, 'sm')}${c.TYPES[k].label}</button>`).join('')}</div>
    <label>Plan<input data-f="plan" value="${esc(s.plan)}" placeholder="Hva skal du gjøre?" autocomplete="off"></label>
    <div class="two">
      <label>Dato<input data-f="date" type="date" value="${s.date}"></label>
      <label>Sted<input data-f="place" value="${esc(s.place)}" list="dl-places" autocomplete="off"></label>
    </div>
    <datalist id="dl-places">${places.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
    <div class="pop-foot"><button class="txt danger" data-act="del">Slett økten</button><button class="btn" data-act="pop-close">Ferdig</button></div>
  </div>`;
}
function closeSheet() {
  $('#sheet').hidden = true;
  S.details = null;
  render();
}
function touch(s) { s.updatedAt = new Date().toISOString(); changed(); }
function openComposer(s, i, j = null) {
  const e = s.exercises[i];
  S.active = { sid: s.id, i, j };
  const src = j !== null ? e.sets[j] : e.sets.at(-1) || c.lastTime(st(), e.name, s.date, s.id)?.sets.at(-1) || {};
  S.draft = { reps: src.reps ?? null, kg: src.kg ?? null, sec: src.sec ?? null };
  e.timed = e.timed || e.sets.some(x => x.sec != null);
  render();
}

/* ---------- Utvikling ---------- */

function viewDashboard() {
  const t = today(), sum = c.summary(st(), t);
  const names = c.exerciseNames(st());
  if (!names.includes(S.chartEx)) S.chartEx = names[0] || null;
  const tests = c.testNames(st());
  if (!tests.includes(S.chartTest)) S.chartTest = tests[0] || null;
  const chips = (list, sel, act) => list.length > 1 ? `<div class="chips">${list.map(n => `<button data-act="${act}" data-v="${esc(n)}" aria-pressed="${n === sel}">${esc(n)}</button>`).join('')}</div>` : '';
  $('#view').innerHTML = `
    <header class="head"><h1 class="page">Utvikling</h1><div class="head-r">${syncHtml()}</div></header>
    <section class="stats">
      <div><b>${sum.thisWeek}</b><span>denne uken</span></div>
      <div><b>${nf(sum.perWeek, 1)}</b><span>økter per uke</span></div>
      <div><b>${nf(sum.hours28, 1)}</b><span>timer, 4 uker</span></div>
      <div><b>${sum.streak}</b><span>uker på rad</span></div>
    </section>
    <section class="panel"><h2>Økter per uke</h2><div class="chart" id="ch-weeks"></div><div id="tb-weeks"></div></section>
    <section class="panel"><h2>Styrke</h2>${chips(names, S.chartEx, 'chart-ex')}<div id="hd-ex"></div><div class="chart" id="ch-ex"></div><div id="tb-ex"></div></section>
    <section class="panel"><h2>Buldring</h2><div id="hd-tops"></div><div class="chart" id="ch-tops"></div><div id="tb-tops"></div></section>
    <section class="panel"><h2>Fingrene</h2><div class="chart" id="ch-fingers"></div><div id="tb-fingers"></div></section>
    <section class="panel"><div class="panel-head"><h2>Faste tester</h2><button class="txt" data-act="new-test">${ic('plus')}Legg til</button></div>${chips(tests, S.chartTest, 'chart-test')}<div class="chart" id="ch-test"></div><div id="tb-test"></div></section>`;
  drawWeeks(t); drawExercise(); drawTops(t); drawFingers(c.fingerSeries(st())); drawTest();
}
const headline = (id, big, small) => { $('#hd-' + id).innerHTML = `<p class="hl"><b>${esc(big)}</b>${esc(small)}</p>`; };
function drawWeeks(t) {
  const rows = c.sessionsByWeek(st(), 12, t);
  if (!rows.some(r => r.total)) return setChart('weeks', '<p class="empty">Ingen økter de siste tolv ukene.</p>');
  const types = Object.keys(c.TYPES).filter(k => rows.some(r => r.byType[k]));
  barChart('weeks', {
    rows: rows.map(r => ({ label: String(c.weekNo(r.week)), segs: types.map(k => ({ color: c.TYPES[k].color, value: r.byType[k] || 0 })),
      tip: `Uke ${c.weekNo(r.week)}: ${r.total} ${r.total === 1 ? 'økt' : 'økter'}${r.minutes ? `, ${nf(r.minutes / 60, 1)} timer` : ''}` })),
    legend: types.map(k => [c.TYPES[k].label, c.TYPES[k].color]),
    table: { head: ['Uke', ...types.map(k => c.TYPES[k].label), 'Minutter'], rows: rows.filter(r => r.total).map(r => [c.weekNo(r.week), ...types.map(k => r.byType[k] || 0), r.minutes]) },
  });
}
function drawExercise() {
  if (!S.chartEx) return setChart('ex', '<p class="empty">Før sett på en økt, så vises utviklingen her.</p>');
  const r = c.exerciseSeries(st(), S.chartEx), bwMissing = c.isBodyweight(st(), S.chartEx) && r.metric !== 'e1rm';
  const fmt = v => nf(v, 1), unit = { e1rm: 'kg', kg: 'kg', sec: 's', reps: 'reps' }[r.metric];
  const lastP = r.points.at(-1), first = r.points[0];
  const delta = r.points.length > 1 && first.value ? Math.round((lastP.value / first.value - 1) * 100) : null;
  const what = { e1rm: 'estimert 1RM', kg: 'tyngste ekstra vekt', sec: 'lengste tid', reps: 'flest reps' }[r.metric];
  headline('ex', `${fmt(lastP.value)} ${unit}`, ` ${what}${delta !== null ? `, ${delta >= 0 ? '+' : ''}${delta} % fra start` : ''}`);
  lineChart('ex', {
    area: true,
    note: bwMissing ? 'Legg inn kroppsvekt under Mer for å få estimert 1RM.' : '',
    series: [{ name: S.chartEx, color: 'var(--t-styrke)', points: r.points.map(p => ({ date: p.date, y: p.value, tip: `${dateShort(p.date)}: ${fmt(p.value)} ${unit}, fra ${c.setText(p.set)}` })) }],
    table: { head: ['Dato', 'Beste', 'Fra sett'], rows: [...r.points].reverse().map(p => [dateShort(p.date), fmt(p.value), c.setText(p.set)]) },
  });
}
function drawTops(t) {
  const rows = c.topsByWeek(st(), 12, t);
  if (!rows.some(r => r.tried)) return setChart('tops', '<p class="empty">Før problemer på en buldreøkt, så vises toppene her.</p>');
  const grades = st().settings.grades;
  const recent = rows.slice(-4), tops = recent.reduce((a, r) => a + Object.values(r.byGrade).reduce((x, y) => x + y, 0), 0), tried = recent.reduce((a, r) => a + r.tried, 0);
  headline('tops', `${tops} av ${tried}`, ' toppet, siste 4 uker');
  barChart('tops', {
    rows: rows.map(r => {
      const n = grades.reduce((a, g) => a + (r.byGrade[g.name] || 0), 0);
      return { label: String(c.weekNo(r.week)), segs: grades.map(g => ({ color: g.color, value: r.byGrade[g.name] || 0 })), tip: `Uke ${c.weekNo(r.week)}: ${n} toppet av ${r.tried}` };
    }),
    legend: grades.map(g => [g.name, g.color]),
    table: { head: ['Uke', ...grades.map(g => g.name), 'Forsøkte'], rows: rows.filter(r => r.tried).map(r => [c.weekNo(r.week), ...grades.map(g => r.byGrade[g.name] || 0), r.tried]) },
  });
}
function drawFingers(list) {
  if (!list.length) return setChart('fingers', '<p class="empty">Gi fingrene en verdi etter økten og morgenen etter, så ser du om belastningen gir en reaksjon.</p>');
  const row = (k, name) => list.filter(x => x[k] !== null).map(x => ({ date: x.date, y: x[k], tip: `${dateShort(x.date)}, ${name}: ${x[k]}` }));
  lineChart('fingers', {
    series: [{ name: 'Rett etter', color: 'var(--t-annet)', points: row('after', 'rett etter') }, { name: 'Morgenen etter', color: 'var(--t-buldring)', points: row('next', 'morgenen etter') }],
    yMin: 0, yMax: 10,
    table: { head: ['Dato', 'Rett etter', 'Morgenen etter'], rows: [...list].reverse().map(x => [dateShort(x.date), x.after ?? '', x.next ?? '']) },
  });
}
function drawTest() {
  if (!S.chartTest) return setChart('test', '<p class="empty">Hallfargene skiftes, så en test du gjentar likt er det sikreste målet. For eksempel maks heng på 20 mm.</p>');
  const list = c.testSeries(st(), S.chartTest), unit = list.at(-1)?.unit || '';
  lineChart('test', {
    area: true,
    note: S.chartTest + (unit ? `, ${unit}` : ''),
    series: [{ name: S.chartTest, color: 'var(--t-cardio)', points: list.map(t => ({ date: t.date, y: c.parseNum(t.value), tip: `${dateShort(t.date)}: ${t.value} ${t.unit || ''}${t.note ? `, ${t.note}` : ''}` })) }],
    table: { head: ['Dato', 'Resultat', 'Notat'], rows: [...list].reverse().map(t => [dateShort(t.date), `${t.value} ${t.unit || ''}`, t.note || '']) },
  });
}

function setChart(id, html) { const el = $('#ch-' + id); if (el) el.innerHTML = html; }
function tableHtml(t) {
  if (!t || !t.rows.length) return '';
  return `<details class="nums-table"><summary>Vis tall</summary><table><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
}
const legendHtml = items => items.length > 1 ? `<div class="legend">${items.map(([n, col]) => `<span><i style="--c:${esc(col)}"></i>${esc(n)}</span>`).join('')}</div>` : '';
function niceTicks(lo, hi, n = 3) {
  const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw);
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out = [];
  for (let v = a; v <= b + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}
const chartWidth = id => Math.max(260, Math.round($('#ch-' + id).clientWidth || 320));

function lineChart(id, { series, table, note, yMin, yMax, area }) {
  const W = chartWidth(id), H = 168, L = 30, R = 8, T = 10, B = 22;
  const pts = series.flatMap(s => s.points);
  if (!pts.length) return setChart(id, '<p class="empty">Ingen målinger ennå.</p>');
  const dates = pts.map(p => +c.fromIso(p.date)), d0 = Math.min(...dates), d1 = Math.max(...dates);
  const ys = pts.map(p => p.y);
  let lo = yMin ?? Math.min(...ys), hi = yMax ?? Math.max(...ys);
  if (yMin === undefined) { const pad = (hi - lo) * .2 || Math.max(1, hi * .05); lo -= pad; hi += pad; }
  const ticks = yMax !== undefined ? [0, 5, 10] : niceTicks(lo, hi);
  lo = ticks[0]; hi = ticks.at(-1);
  const x = d => d1 === d0 ? (L + W - R) / 2 : L + (d - d0) / (d1 - d0) * (W - L - R);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  let svg = ticks.map(t => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="0" y="${y(t) + 4}">${nf(t, 1)}</text>`).join('');
  svg += d1 === d0 ? `<text x="${x(d0)}" y="${H - 4}" text-anchor="middle">${dateShort(c.iso(new Date(d0)))}</text>`
    : [d0, d1].map((d, i) => `<text x="${x(d)}" y="${H - 4}" text-anchor="${i ? 'end' : 'start'}">${dateShort(c.iso(new Date(d)))}</text>`).join('');
  const hits = [];
  series.forEach((s, si) => {
    const p = s.points.map(q => ({ ...q, px: x(+c.fromIso(q.date)), py: y(q.y) }));
    const line = p.map((q, i) => (i ? 'L' : 'M') + q.px.toFixed(1) + ' ' + q.py.toFixed(1)).join('');
    if (p.length > 1) {
      if (area) svg += `<defs><linearGradient id="g-${id}${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${s.color};stop-opacity:.18"/><stop offset="1" style="stop-color:${s.color};stop-opacity:0"/></linearGradient></defs><path d="${line}L${p.at(-1).px} ${H - B}L${p[0].px} ${H - B}Z" fill="url(#g-${id}${si})"/>`;
      svg += `<path d="${line}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    svg += p.map((q, i) => `<circle cx="${q.px}" cy="${q.py}" r="${i === p.length - 1 ? 4.5 : 3}" fill="${s.color}" stroke="var(--bg)" stroke-width="2"/>`).join('');
    hits.push(...p);
  });
  S.charts[id] = { W, hits };
  setChart(id, `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Linjediagram" data-chart="${id}">${svg}</svg>${legendHtml(series.map(s => [s.name, s.color]))}${note ? `<p class="cap">${esc(note)}</p>` : ''}`);
  $('#tb-' + id).innerHTML = tableHtml(table);
}
function barChart(id, { rows, legend, table }) {
  const W = chartWidth(id), H = 132, L = 18, R = 0, T = 8, B = 20;
  const max = Math.max(1, ...rows.map(r => r.segs.reduce((a, s) => a + s.value, 0)));
  const ticks = niceTicks(0, max, 2).filter(Number.isInteger), top = ticks.at(-1);
  const slot = (W - L - R) / rows.length, w = Math.min(14, slot * .55);
  const y = v => T + (top - v) / top * (H - T - B);
  let svg = ticks.map(t => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="0" y="${y(t) + 4}">${t}</text>`).join('');
  const hits = [];
  rows.forEach((r, i) => {
    const bx = L + i * slot + (slot - w) / 2;
    let acc = 0;
    const parts = r.segs.filter(s => s.value);
    parts.forEach((s, j) => {
      const y1 = y(acc), y2 = y(acc + s.value);
      acc += s.value;
      const h = Math.max(2, y1 - y2 - (j < parts.length - 1 ? 2 : 0)), rad = Math.min(4, w / 2, h);
      svg += j === parts.length - 1
        ? `<path d="M${bx} ${y2 + h}V${y2 + rad}Q${bx} ${y2} ${bx + rad} ${y2}H${bx + w - rad}Q${bx + w} ${y2} ${bx + w} ${y2 + rad}V${y2 + h}Z" fill="${esc(s.color)}"/>`
        : `<rect x="${bx}" y="${y1 - h}" width="${w}" height="${h}" fill="${esc(s.color)}"/>`;
    });
    if ((rows.length - 1 - i) % 3 === 0) svg += `<text x="${bx + w / 2}" y="${H - 4}" text-anchor="middle">${esc(r.label)}</text>`;
    hits.push({ px: bx + w / 2, py: y(acc), tip: r.tip });
  });
  S.charts[id] = { W, hits };
  setChart(id, `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Stolpediagram per uke" data-chart="${id}">${svg}</svg>${legendHtml(legend)}`);
  $('#tb-' + id).innerHTML = tableHtml(table);
}
function chartTip(e) {
  const svg = e.target.closest?.('svg[data-chart]'), tip = $('#tip');
  if (!svg) { tip.hidden = true; return; }
  const ch = S.charts[svg.dataset.chart];
  if (!ch) return;
  const box = svg.getBoundingClientRect(), mx = (e.clientX - box.left) / box.width * ch.W;
  const hit = ch.hits.reduce((a, h) => (!a || Math.abs(h.px - mx) < Math.abs(a.px - mx) ? h : a), null);
  if (!hit) return;
  tip.textContent = hit.tip;
  tip.hidden = false;
  const left = box.left + hit.px / ch.W * box.width, top = box.top + hit.py / ch.W * box.width;
  tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, left - tip.offsetWidth / 2)) + 'px';
  tip.style.top = Math.max(8, top - tip.offsetHeight - 10) + 'px';
}
addEventListener('pointermove', e => { if (e.pointerType === 'mouse') chartTip(e); });
addEventListener('pointerdown', chartTip);
let resizeT;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (S.state && S.tab === 'oversikt') render(); }, 200); });

/* ---------- Mer ---------- */

function opt(key, title, value, body) {
  return `<details class="opt" data-key="${key}" ${S.moreOpen === key ? 'open' : ''}><summary><span>${title}</span><em>${esc(value)}</em>${ic('right')}</summary><div class="opt-b">${body}</div></details>`;
}
function viewMore() {
  const set = st().settings;
  const bw = [...set.bodyweight].sort((a, b) => b.date.localeCompare(a.date));
  const exNames = [...new Set([...Object.keys(set.exercises), ...c.exerciseNames(st())])];
  $('#view').innerHTML = `
    <header class="head"><h1 class="page">Mer</h1><div class="head-r">${syncHtml()}</div></header>
    <section class="opts">
      ${opt('bw', 'Kroppsvekt', bw.length ? `${nf(bw[0].kg, 1)} kg` : 'Ikke satt', `
        <p class="cap">Brukes til å regne styrke på pull-ups og andre kroppsvektøvelser.</p>
        <form class="line" id="f-bw"><input id="bw" inputmode="decimal" placeholder="Kg" aria-label="Kroppsvekt i kg"><button class="btn">Lagre vekt</button></form>`)}
      ${opt('ex', 'Kroppsvektøvelser', `${exNames.filter(n => set.exercises[n]?.bw).length}`, `
        <div class="chips wrap">${exNames.map(n => `<button data-act="bw-ex" data-v="${esc(n)}" aria-pressed="${!!set.exercises[n]?.bw}">${esc(n)}</button>`).join('')}</div>`)}
      ${opt('gr', 'Buldrefarger', `${set.grades.length}`, `
        <p class="cap">Fra lettest til tyngst.</p>
        ${set.grades.map((g, i) => `<div class="grade"><input type="color" value="${esc(g.color)}" data-grade="${i}" data-gf="color" aria-label="Farge for ${esc(g.name)}"><input value="${esc(g.name)}" data-grade="${i}" data-gf="name" aria-label="Navn"><button class="nav" data-act="del-grade" data-i="${i}" aria-label="Fjern ${esc(g.name)}">${ic('x')}</button></div>`).join('')}
        <button class="txt" data-act="add-grade">${ic('plus')}Legg til farge</button>`)}
      ${opt('sync', 'Synk med GitHub', S.token ? 'På' : 'Av', `
        <p class="cap">${S.token ? 'Endringer sendes automatisk.' : 'Lag et fine-grained token for repoet treningsapp med Contents: Read and write, og lim det inn her.'}</p>
        <form class="line" id="f-token"><input id="token" type="password" autocomplete="off" placeholder="${S.token ? 'Nytt token' : 'github_pat_...'}" aria-label="GitHub-token"><button class="btn">Lagre</button></form>
        <button class="txt" data-act="pull">Hent nå</button>`)}
      ${opt('dl', 'Last ned data', '', `<div class="chips wrap">${['okter', 'sett', 'problemer', 'tester'].map(n => `<button data-act="csv" data-v="${n}.csv">${n === 'okter' ? 'Økter' : cap(n)} CSV</button>`).join('')}<button data-act="backup">Kryptert kopi</button></div>`)}
      ${opt('pw', 'Passord', '', `
        <form class="line" id="f-pw"><input id="pw1" type="password" autocomplete="new-password" placeholder="Nytt passord" aria-label="Nytt passord"><button class="btn">Bytt</button></form>
        <p class="cap">Claude trenger det nye passordet for å føre og analysere. Oppdater det i prosjektdokumentet.</p>
        <button class="txt danger" data-act="lock">Lås og glem passordet</button>`)}
    </section>`;
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function settingsChanged() { st().settings.updatedAt = new Date().toISOString(); changed(); }
function openTestForm() {
  const sh = $('#sheet');
  sh.hidden = false;
  const names = c.testNames(st());
  sh.innerHTML = `<form class="pop-box sheet-in" id="f-test"><i class="pop-grab"></i><h2>Ny test</h2>
    <label>Test<input id="t-name" list="dl-tests" required value="${esc(S.chartTest || '')}" placeholder="Maks heng 20 mm" autocomplete="off"></label>
    <datalist id="dl-tests">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="two"><label>Resultat<input id="t-val" inputmode="decimal" required></label><label>Enhet<input id="t-unit" placeholder="kg, s" value="${esc(c.testSeries(st(), S.chartTest).at(-1)?.unit || '')}"></label></div>
    <div class="two"><label>Dato<input id="t-date" type="date" value="${today()}" required></label><label>Notat<input id="t-note"></label></div>
    <div class="pop-foot"><button type="button" class="txt" data-act="pop-close">Avbryt</button><button class="btn">Lagre test</button></div></form>`;
}

/* ---------- Hendelser ---------- */

const STEP = { reps: 1, sec: 5, kg: 2.5, tries: 1 };
function selectDay(d) {
  S.sel = d; S.month = d.slice(0, 7); S.pick = false; S.active = null; S.finish = null; S.adding = null;
  pruneBlank();
}
const acts = {
  shift(el) {
    const n = +el.dataset.n;
    if (S.expanded) {
      const [y, m] = S.month.split('-').map(Number);
      S.month = c.iso(new Date(y, m - 1 + n, 1, 12)).slice(0, 7);
    } else selectDay(c.addDays(S.sel, 7 * n));
    render();
  },
  'toggle-month'() { S.expanded = !S.expanded; S.month = S.sel.slice(0, 7); render(); },
  today() { selectDay(today()); S.expanded = false; render(); },
  day(el) { selectDay(el.dataset.date); S.expanded = false; render(); },
  pick() { S.pick = !S.pick; render(); },
  create(el) {
    const type = el.dataset.v;
    const s = c.newSession({ date: S.sel, type, cardio: type === 'cardio' ? { kind: 'Løping', km: null, hr: null } : null });
    st().sessions.push(s);
    S.pick = false; S.active = null;
    changed(); render();
    $(`[data-sid="${s.id}"]`)?.scrollIntoView({ block: 'nearest' });
  },
  details(el) { openDetails(sidOf(el)); },
  'pop-close'() { closeSheet(); },
  type(el) {
    const s = sidOf(el);
    s.type = el.dataset.v;
    if (s.type === 'cardio' && !s.cardio) s.cardio = { kind: 'Løping', km: null, hr: null };
    touch(s); openDetails(s);
  },
  num(el) {
    const s = sidOf(el), f = el.dataset.field, v = +el.dataset.v;
    s[f] = s[f] === v ? null : v;
    touch(s); render();
  },
  finish(el) { const s = sidOf(el); S.finish = S.finish === s.id ? null : s.id; render(); },
  adding(el) { S.adding = sidOf(el).id; S.active = null; render(); },
  'add-ex'(el) { addExercise(sidOf(el), el.dataset.v); },
  ex(el) {
    const s = sidOf(el), i = +el.dataset.i;
    if (S.active?.sid === s.id && S.active.i === i) { S.active = null; return render(); }
    openComposer(s, i);
  },
  'ex-close'() { S.active = null; render(); },
  'pick-set'(el) {
    const s = sidOf(el), i = +el.dataset.i, j = +el.dataset.j;
    if (S.active?.sid === s.id && S.active.i === i && S.active.j === j) return openComposer(s, i);
    openComposer(s, i, j);
  },
  bump(el) {
    const k = el.dataset.k, inp = $(`[data-d="${k}"]`, el.closest('.comp'));
    const cur = c.parseNum(inp.value) || 0, step = STEP[k];
    const v = Math.max(k === 'tries' ? 1 : 0, cur + step * +el.dataset.n);
    inp.value = numv(v);
    if (k === 'tries') pb(sidOf(el)).tries = v; else S.draft[k] = v;
  },
  'save-set'(el) {
    const s = sidOf(el), i = +el.dataset.i, e = s.exercises[i], d = S.draft;
    const set = e.timed ? { sec: d.sec, kg: d.kg || null } : { reps: d.reps, kg: d.kg || null };
    if (!(set.sec > 0 || set.reps > 0)) return toast(e.timed ? 'Skriv inn sekunder' : 'Skriv inn reps');
    if (S.active.j !== null) { e.sets[S.active.j] = set; S.active.j = null; } else e.sets.push(set);
    touch(s); render();
  },
  'del-set'(el) { const s = sidOf(el); s.exercises[+el.dataset.i].sets.splice(S.active.j, 1); S.active.j = null; touch(s); render(); },
  'del-ex'(el) { const s = sidOf(el); s.exercises.splice(+el.dataset.i, 1); S.active = null; touch(s); render(); },
  'toggle-timed'(el) {
    const s = sidOf(el), e = s.exercises[+el.dataset.i], d = S.draft;
    e.timed = !e.timed;
    e.sets.forEach(x => { if (e.timed) { x.sec = x.reps ?? null; delete x.reps; } else { x.reps = x.sec ?? null; delete x.sec; } });
    if (e.timed) d.sec = d.reps; else d.reps = d.sec;
    touch(s); render();
  },
  grade(el) { pb(sidOf(el)).grade = el.dataset.v; render(); },
  style(el) { const d = pb(sidOf(el)); d.style = d.style === el.dataset.v ? '' : el.dataset.v; render(); },
  kind(el) { const s = sidOf(el); s.cardio.kind = el.dataset.v; touch(s); render(); },
  'pick-prob'(el) {
    const s = sidOf(el), d = pb(s), i = +el.dataset.i, p = s.problems[i];
    if (d.i === i) { d.i = null; d.tries = 1; return render(); }
    Object.assign(d, { i, grade: p.grade, tries: p.tries, style: p.style || '' });
    render();
  },
  'prob-close'(el) { const d = pb(sidOf(el)); d.i = null; d.tries = 1; render(); },
  'save-prob'(el) {
    const s = sidOf(el), d = pb(s), row = { grade: d.grade, style: d.style, tries: d.tries, top: el.dataset.v === '1', note: '' };
    if (!d.grade) return toast('Legg til en buldrefarge under Mer');
    if (d.i !== null) s.problems[d.i] = { ...s.problems[d.i], ...row }; else s.problems.push(row);
    d.i = null; d.tries = 1;
    touch(s); render();
  },
  'del-prob'(el) { const s = sidOf(el), d = pb(s); s.problems.splice(d.i, 1); d.i = null; d.tries = 1; touch(s); render(); },
  del(el) {
    const s = sidOf(el);
    s.deleted = true; touch(s);
    closeSheet();
    toast('Økten er slettet', () => { s.deleted = false; touch(s); render(); });
  },
  'chart-ex'(el) { S.chartEx = el.dataset.v; render(); },
  'chart-test'(el) { S.chartTest = el.dataset.v; render(); },
  'new-test'() { openTestForm(); },
  'bw-ex'(el) {
    const ex = st().settings.exercises, n = el.dataset.v;
    ex[n] = { ...ex[n], bw: !ex[n]?.bw };
    settingsChanged(); render();
  },
  'add-grade'() { st().settings.grades.push({ name: 'Ny farge', color: '#888888' }); settingsChanged(); render(); },
  'del-grade'(el) { st().settings.grades.splice(+el.dataset.i, 1); settingsChanged(); render(); },
  pull() { setSync('', 'Henter'); pull(); },
  csv(el) { download(el.dataset.v, c.toCsv(st())[el.dataset.v], 'text/csv;charset=utf-8'); },
  async backup() { download(`trening-${today()}.json`, JSON.stringify(await c.sealWith(S.key, S.salt, S.iter, st())), 'application/json'); },
  lock() { lock(); },
};
function addExercise(s, name) {
  name = name.trim();
  if (!name) return;
  s.exercises.push({ name, sets: [] });
  S.adding = null;
  touch(s);
  openComposer(s, s.exercises.length - 1);
}

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    S.tab = tab.dataset.tab;
    pruneBlank();
    scrollTo(0, 0);
    return render();
  }
  const el = e.target.closest('[data-act]');
  if (el) { e.preventDefault(); acts[el.dataset.act]?.(el); return; }
  if (e.target.id === 'sheet') closeSheet();
});
document.addEventListener('toggle', e => {
  if (e.target.matches?.('.opt')) { if (e.target.open) { S.moreOpen = e.target.dataset.key; $$('.opt').forEach(o => { if (o !== e.target) o.open = false; }); } else if (S.moreOpen === e.target.dataset.key) S.moreOpen = null; }
}, true);
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.grade !== undefined) { st().settings.grades[+t.dataset.grade][t.dataset.gf] = t.value; settingsChanged(); return; }
  if (t.dataset.d) {
    if (t.dataset.d === 'tries') pb(sidOf(t)).tries = Math.max(1, c.parseNum(t.value) || 1); else S.draft[t.dataset.d] = c.parseNum(t.value);
    return;
  }
  const s = t.closest('[data-sid]') && sidOf(t);
  if (!s) return;
  if (t.dataset.f) {
    if (t.dataset.f === 'date') { if (!t.value) return; s.date = t.value; S.sel = t.value; S.month = t.value.slice(0, 7); }
    else s[t.dataset.f] = t.dataset.num !== undefined ? c.parseNum(t.value) : t.value;
    touch(s);
  } else if (t.dataset.cf) { s.cardio = s.cardio || { kind: 'Løping', km: null, hr: null }; s.cardio[t.dataset.cf] = c.parseNum(t.value); touch(s); }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const id = e.target.id;
  if (e.target.classList.contains('ex-new')) return addExercise(byId(e.target.dataset.sid), e.target.elements.n.value);
  if (id === 'lock-form') {
    const pw = $('#lock-pw').value.trim(), msg = $('#lock-msg');
    msg.textContent = '';
    $('#lock-go').disabled = true;
    try {
      await unlock(pw);
      if ($('#lock-remember').checked) lsSet(LS.pw, pw);
    } catch (err) { msg.textContent = err.message; }
    $('#lock-go').disabled = false;
  }
  if (id === 'f-bw') {
    const kg = c.parseNum($('#bw').value);
    if (!(kg > 0)) return;
    const list = st().settings.bodyweight, d = today(), hit = list.find(x => x.date === d);
    if (hit) hit.kg = kg; else list.push({ date: d, kg });
    settingsChanged(); render(); toast('Vekten er lagret');
  }
  if (id === 'f-token') {
    const v = $('#token').value.trim();
    if (!v) return;
    S.token = v; S.sha = null;
    await saveToken();
    render(); setSync('', 'Henter'); pull();
  }
  if (id === 'f-pw') {
    const pw = $('#pw1').value;
    if (pw.length < 4) return toast('Velg et lengre passord');
    S.pw = pw; S.key = null;
    await useSalt(c.newSalt(), c.KDF_ITER);
    if (lsGet(LS.pw)) lsSet(LS.pw, pw);
    await saveToken();
    changed(); render(); toast('Passordet er byttet');
  }
  if (id === 'f-test') {
    const name = $('#t-name').value.trim();
    st().tests.push({ id: c.uid('t'), date: $('#t-date').value, name, value: c.parseNum($('#t-val').value), unit: $('#t-unit').value.trim(), note: $('#t-note').value.trim(), updatedAt: new Date().toISOString() });
    S.chartTest = name;
    changed();
    closeSheet();
  }
});
$('#toast-undo').addEventListener('click', () => { S.undo?.(); $('#toast').hidden = true; S.undo = null; });

/* Dra på kalenderen: til siden bytter uke eller måned, ned og opp åpner og lukker måneden */
let swipe = null;
document.addEventListener('touchstart', e => {
  if (e.target.closest?.('#cal')) swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!swipe) return;
  const dx = e.changedTouches[0].clientX - swipe.x, dy = e.changedTouches[0].clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) acts.shift({ dataset: { n: dx < 0 ? 1 : -1 } });
  else if (dy > 36 && !S.expanded) acts['toggle-month']();
  else if (dy < -36 && S.expanded) acts['toggle-month']();
}, { passive: true });

/* ---------- Oppstart ---------- */

(async () => {
  const pw = lsGet(LS.pw);
  if (pw) {
    try { await unlock(pw); return; }
    catch (err) { lsSet(LS.pw, null); $('#lock-msg').textContent = err.message === 'Feil passord.' ? 'Passordet er endret. Skriv det nye.' : err.message; }
  }
  $('#lock-pw').focus();
})();
