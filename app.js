import * as c from './core.js';

const GH = { owner: 'PederMyhrer', repo: 'treningsapp', path: 'data.json', branch: 'main' };
const LS = { vault: 'trening.vault', token: 'trening.token', pw: 'trening.pw', dirty: 'trening.dirty' };
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
const DOW = ['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø'];
const DAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
const HOLD = {
  buldring: 'M6 5c3-3 9-3 12 0s4 8 1 12-8 5-12 3-6-7-5-10 2-3 4-5Z',
  styrke: 'M2 9h3V6h3v4h8V6h3v3h3v6h-3v3h-3v-4H8v4H5v-3H2Z',
  cardio: 'M12 20.5S3 15 3 8.7A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 9 2.1C21 15 12 20.5 12 20.5Z',
  annet: 'M12 2.5 21.5 12 12 21.5 2.5 12Z',
};
const CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>';
const ICON = { left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6"/></svg>', right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>', x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>' };

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
const hold = (type, cls = '') => `<svg class="hold ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${c.TYPES[type]?.color || c.TYPES.annet.color}" d="${HOLD[type] || HOLD.annet}"/></svg>`;
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* privat modus */ } };
const lsJSON = k => { try { return JSON.parse(lsGet(k)); } catch { return null; } };

const S = {
  pw: null, key: null, salt: null, iter: c.KDF_ITER, state: null, token: null, sha: null,
  tab: 'kalender', month: today().slice(0, 7), sel: today(), weekMode: false,
  editing: null, chartEx: null, chartTest: null, pushTimer: null, pushing: false, undo: null, sync: ['', ''], charts: {},
};
const st = () => S.state;
const sess = () => S.state?.sessions.find(s => s.id === S.editing);

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
  if (!S.token) return setSync('', 'Lagret på denne enheten');
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
  if (news && !S.editing && $('#sheet').hidden) render();
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
      setSync('', lsGet(LS.dirty) ? 'Lagret på denne enheten' : 'Ikke koblet til GitHub');
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
  ({ kalender: viewCalendar, oversikt: viewDashboard, mer: viewMore })[S.tab]();
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

function viewCalendar() {
  const t = today();
  const nudge = fingerNudge(t);
  const typesUsed = Object.keys(c.TYPES);
  const key = `<div class="key">${typesUsed.map(k => `<span>${hold(k)}${c.TYPES[k].label}</span>`).join('')}</div>`;
  const head = S.weekMode
    ? `<div class="cal-head"><button class="icon-btn" data-act="shift" data-n="-1" aria-label="Forrige uke">${ICON.left}</button><h1>Uke ${c.weekNo(S.sel)}, ${MONTHS[c.fromIso(S.sel).getMonth()]}</h1><button class="icon-btn" data-act="shift" data-n="1" aria-label="Neste uke">${ICON.right}</button></div>`
    : `<div class="cal-head"><button class="icon-btn" data-act="shift" data-n="-1" aria-label="Forrige måned">${ICON.left}</button><h1>${cap(MONTHS[+S.month.slice(5) - 1])} ${S.month.slice(0, 4)}</h1><button class="icon-btn" data-act="shift" data-n="1" aria-label="Neste måned">${ICON.right}</button></div>`;
  const week = S.weekMode
    ? `<div class="agenda">${Array.from({ length: 7 }, (_, i) => agendaDay(c.addDays(c.monday(S.sel), i), t)).join('')}</div>`
    : `<div class="agenda">${agendaDay(S.sel, t)}</div>`;
  $('#view').innerHTML = `
    <div class="topline"><span></span>${syncHtml()}</div>
    <section>
      ${head}
      ${wall(t)}
      ${S.weekMode ? '<button class="btn link backmonth" data-act="month">Vis hele måneden</button>' : key}
    </section>
    ${nudge}
    ${week}
    <button class="fab" data-act="new" data-date="${S.sel}">Ny økt</button>`;
}
function wall(t) {
  const weeks = [];
  if (S.weekMode) weeks.push(c.monday(S.sel));
  else {
    const first = S.month + '-01';
    const y = +S.month.slice(0, 4), m = +S.month.slice(5);
    const last = c.iso(new Date(y, m, 0, 12));
    for (let w = c.monday(first); w <= last; w = c.addDays(w, 7)) weeks.push(w);
  }
  const cells = weeks.map(w => `<span class="wk" aria-hidden="true">${c.weekNo(w)}</span>` + Array.from({ length: 7 }, (_, i) => {
    const d = c.addDays(w, i), list = c.sessionsOn(st(), d);
    const cls = ['day', d === t && 'today', d === S.sel && 'sel', !S.weekMode && d.slice(0, 7) !== S.month && 'out'].filter(Boolean).join(' ');
    const label = `${dateLong(d)}${list.length ? ', ' + list.map(s => c.TYPES[s.type]?.label).join(' og ') : ''}`;
    return `<button class="${cls}" data-act="day" data-date="${d}" aria-label="${esc(label)}"><span class="n">${c.fromIso(d).getDate()}</span><span class="holds">${list.slice(0, 2).map(s => hold(s.type)).join('')}</span></button>`;
  }).join('')).join('');
  return `<div class="wall"><span class="dow"></span>${DOW.map(x => `<span class="dow">${x}</span>`).join('')}${cells}</div>`;
}
function agendaDay(d, t) {
  const list = c.sessionsOn(st(), d);
  const name = d === t ? 'I dag' : cap(dayName(d));
  return `<div class="agenda-day ${d === S.sel ? 'sel' : ''}">
    <div class="agenda-head"><h3>${name} ${dateLong(d)}</h3><button class="add" data-act="new" data-date="${d}" aria-label="Ny økt ${dateLong(d)}">+ Økt</button></div>
    ${list.map(sessionRow).join('') || (S.weekMode ? '' : '<p class="rest">Ingen økter.</p>')}
  </div>`;
}
function sessionRow(s) {
  const title = s.plan || c.TYPES[s.type]?.label;
  return `<button class="sess" data-act="open" data-id="${s.id}">${hold(s.type, 'small')}<span><b>${esc(title)}</b><span class="line">${esc(c.sessionLine(st(), s))}</span></span>${CHEV}</button>`;
}
function fingerNudge(t) {
  const list = c.live(st().sessions).filter(s => s.date < t && s.date >= c.addDays(t, -2) && s.type === 'buldring' && s.fingersNext == null);
  const s = list.at(-1);
  if (!s) return '';
  return `<div class="nudge"><p>Hvordan kjennes fingrene etter buldringen ${dayName(s.date)}?</p>${scale('fingersNext', 0, 10, null, s.id)}</div>`;
}
function scale(field, min, max, value, id) {
  const n = max - min + 1;
  return `<div class="scale" style="--n:${n}" role="group">${Array.from({ length: n }, (_, i) => {
    const v = min + i;
    return `<button data-act="scale" data-field="${field}" data-v="${v}" ${id ? `data-id="${id}"` : ''} aria-pressed="${value === v}">${v}</button>`;
  }).join('')}</div>`;
}

/* ---------- Økt ---------- */

function openSession(id) {
  S.editing = id;
  const sh = $('#sheet');
  sh.className = 'sheet';
  sh.hidden = false;
  sh.scrollTop = 0;
  sheetRender(true);
}
function closeSession() {
  const s = sess();
  const blank = s && !s.plan && !s.place && !s.note && !s.exercises.length && !s.problems.length && !s.cardio && s.duration == null && s.rpe == null && s.fingers == null;
  if (blank) { st().sessions = st().sessions.filter(x => x.id !== s.id); changed(); }
  S.editing = null;
  $('#sheet').hidden = true;
  render();
}
function sheetRender(anim) {
  const s = sess();
  if (!s) return;
  const y = $('#sheet').scrollTop;
  const places = [...new Set(c.live(st().sessions).map(x => x.place).filter(Boolean))];
  const names = [...new Set([...c.exerciseNames(st()), ...Object.keys(st().settings.exercises)])];
  $('#sheet').innerHTML = `<div class="sheet-inner ${anim ? 'sheet-in' : ''}">
    <div class="sheet-head"><h2>${cap(dayName(s.date))} ${dateLong(s.date)}</h2><button class="btn primary" data-act="close">Ferdig</button></div>
    <div class="types" role="group" aria-label="Type økt">${Object.keys(c.TYPES).map(k => `<button class="type" data-act="type" data-v="${k}" aria-pressed="${s.type === k}">${hold(k)}${c.TYPES[k].label}</button>`).join('')}</div>
    <div class="part">
      <label>Plan<input data-f="plan" value="${esc(s.plan)}" placeholder="Hva skal du gjøre?" autocomplete="off"></label>
      <div class="two">
        <label>Dato<input data-f="date" type="date" value="${s.date}"></label>
        <label>Sted<input data-f="place" value="${esc(s.place)}" list="dl-places" autocomplete="off"></label>
      </div>
      <datalist id="dl-places">${places.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
    </div>
    ${s.type === 'buldring' ? partProblems(s) : ''}
    ${s.type === 'cardio' ? partCardio(s) : partExercises(s, names)}
    <div class="part">
      <h3>Etter økten</h3>
      <label>Varighet, minutter<input data-f="duration" data-num inputmode="numeric" value="${s.duration ?? ''}"></label>
      <div><label>Hvor tung var økten? 1 er veldig lett, 10 er maks</label>${scale('rpe', 1, 10, s.rpe)}</div>
      <div><label>Fingersmerte rett etter, 0 er ingen</label>${scale('fingers', 0, 10, s.fingers)}</div>
      <div><label>Fingersmerte morgenen etter</label>${scale('fingersNext', 0, 10, s.fingersNext)}</div>
      <label>Notat<textarea data-f="note">${esc(s.note)}</textarea></label>
    </div>
    <button class="btn danger" data-act="del">Slett økten</button>
  </div>`;
  $('#sheet').scrollTop = y;
}
function partExercises(s, names) {
  return `<div class="part"><h3>Øvelser</h3>
    ${s.exercises.map((e, i) => exerciseCard(s, e, i)).join('')}
    <datalist id="dl-ex">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <button class="btn" data-act="add-ex">Legg til øvelse</button>
  </div>`;
}
function exerciseCard(s, e, i) {
  const last = e.name ? c.lastTime(st(), e.name, s.date, s.id) : null;
  const timed = e.timed || e.sets.some(x => x.sec != null);
  const bw = c.isBodyweight(st(), e.name);
  return `<div class="ex">
    <div class="ex-head"><input data-ex="${i}" data-exf="name" list="dl-ex" value="${esc(e.name)}" placeholder="Øvelse" aria-label="Øvelse" autocomplete="off"><button class="icon-btn" data-act="del-ex" data-i="${i}" aria-label="Fjern øvelse">${ICON.x}</button></div>
    ${last ? `<p class="small muted">Sist ${dateShort(last.date)}: ${esc(last.sets.map(c.setText).join(', '))}</p>` : ''}
    ${e.sets.length ? `<div class="set-head"><span>${timed ? 'Sekunder' : 'Reps'}</span><span>${bw ? 'Ekstra kg' : 'Kg'}</span></div>` : ''}
    ${e.sets.map((x, j) => `<div class="set"><span class="num">${j + 1}</span>
      <input inputmode="decimal" aria-label="${timed ? 'Sekunder' : 'Reps'} sett ${j + 1}" data-ex="${i}" data-set="${j}" data-sf="${timed ? 'sec' : 'reps'}" value="${numv(timed ? x.sec : x.reps)}">
      <input inputmode="decimal" aria-label="Kg sett ${j + 1}" data-ex="${i}" data-set="${j}" data-sf="kg" value="${numv(x.kg)}">
      <button class="icon-btn" data-act="del-set" data-i="${i}" data-j="${j}" aria-label="Fjern sett ${j + 1}">${ICON.x}</button></div>`).join('')}
    <div class="row"><button class="btn" data-act="add-set" data-i="${i}">Legg til sett</button><button class="btn link" data-act="toggle-timed" data-i="${i}">${timed ? 'Bruk reps' : 'Bruk tid'}</button></div>
  </div>`;
}
function partProblems(s) {
  const grades = st().settings.grades;
  const p = c.problemStats(s);
  const colorOf = g => grades.find(x => x.name === g)?.color || '#888';
  return `<div class="part"><h3>Problemer${p.problems ? `, ${p.tops} av ${p.problems} toppet` : ''}</h3>
    <div class="prob-add">${grades.map(g => `<button class="chip" data-act="add-prob" data-v="${esc(g.name)}"><span class="swatch" style="--c:${esc(g.color)}"></span>${esc(g.name)}</button>`).join('')}</div>
    ${s.problems.map((x, i) => `<div class="prob">
      <div class="prob-top">
        <span class="prob-name"><span class="swatch" style="--c:${esc(colorOf(x.grade))}"></span>${esc(x.grade)}</span>
        <span class="step"><button data-act="tries" data-i="${i}" data-n="-1" aria-label="Færre forsøk">−</button><output aria-label="Forsøk">${x.tries}</output><button data-act="tries" data-i="${i}" data-n="1" aria-label="Flere forsøk">+</button></span>
        <button class="chip" data-act="top" data-i="${i}" aria-pressed="${!!x.top}">Toppet</button>
        <button class="icon-btn" data-act="del-prob" data-i="${i}" aria-label="Fjern problem">${ICON.x}</button>
      </div>
      <div class="two">
        <select data-prob="${i}" data-pf="style" aria-label="Stil"><option value="">Stil</option>${c.STYLES.map(v => `<option ${x.style === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <input data-prob="${i}" data-pf="note" value="${esc(x.note)}" placeholder="Notat" aria-label="Notat">
      </div>
    </div>`).join('')}
  </div>`;
}
function partCardio(s) {
  const d = s.cardio || {};
  return `<div class="part"><h3>Cardio</h3>
    <div class="two">
      <label>Type<select data-cf="kind">${c.CARDIO_KINDS.map(k => `<option ${d.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label>Distanse, km<input data-cf="km" inputmode="decimal" value="${numv(d.km)}"></label>
    </div>
    <label>Snittpuls<input data-cf="hr" inputmode="numeric" value="${esc(d.hr)}"></label>
  </div>`;
}
function touch(s) { s.updatedAt = new Date().toISOString(); changed(); }

/* ---------- Oversikt ---------- */

function viewDashboard() {
  const t = today(), sum = c.summary(st(), t);
  const has = c.live(st().sessions).length > 0;
  const names = c.exerciseNames(st());
  if (!names.includes(S.chartEx)) S.chartEx = names[0] || null;
  const tests = c.testNames(st());
  if (!tests.includes(S.chartTest)) S.chartTest = tests[0] || null;
  const fingers = c.fingerSeries(st());
  $('#view').innerHTML = `
    <div class="topline"><h1>Oversikt</h1>${syncHtml()}</div>
    ${has ? `<section class="stats">
      <div class="stat"><b>${sum.thisWeek}</b><span>økter denne uken</span></div>
      <div class="stat"><b>${nf(sum.perWeek, 1)}</b><span>økter per uke, siste 4 uker</span></div>
      <div class="stat"><b>${nf(sum.hours28, 1)}</b><span>timer siste 28 dager</span></div>
      <div class="stat"><b>${sum.streak}</b><span>uker på rad</span></div>
    </section>` : '<p class="empty">Før den første økten fra kalenderen, så fylles oversikten her.</p>'}
    <section class="panel"><h2>Økter per uke</h2><div class="chart" id="ch-weeks"></div><div id="tb-weeks"></div></section>
    <section class="panel">
      <div class="panel-head"><h2>Styrke</h2>${names.length ? `<select id="sel-ex" aria-label="Velg øvelse">${names.map(n => `<option ${n === S.chartEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}</div>
      <div class="chart" id="ch-ex"></div><div id="tb-ex"></div>
    </section>
    <section class="panel"><h2>Buldring, toppet per uke</h2><div class="chart" id="ch-tops"></div><div id="tb-tops"></div></section>
    <section class="panel"><h2>Fingrene</h2><div class="chart" id="ch-fingers"></div><div id="tb-fingers"></div></section>
    <section class="panel">
      <div class="panel-head"><h2>Faste tester</h2><button class="btn" data-act="new-test">Legg til test</button></div>
      ${tests.length > 1 ? `<select id="sel-test" aria-label="Velg test">${tests.map(n => `<option ${n === S.chartTest ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}
      <div class="chart" id="ch-test"></div><div id="tb-test"></div>
    </section>`;
  drawWeeks(t); drawExercise(); drawTops(t); drawFingers(fingers); drawTest();
}
function weekLabel(w) { return String(c.weekNo(w)); }
function drawWeeks(t) {
  const rows = c.sessionsByWeek(st(), 12, t);
  if (!rows.some(r => r.total)) return setChart('weeks', '<p class="empty">Ingen økter de siste tolv ukene.</p>');
  const types = Object.keys(c.TYPES).filter(k => rows.some(r => r.byType[k]));
  barChart('weeks', {
    rows: rows.map(r => ({ label: weekLabel(r.week), segs: types.map(k => ({ color: c.TYPES[k].color, value: r.byType[k] || 0 })),
      tip: `Uke ${c.weekNo(r.week)}: ${r.total} ${r.total === 1 ? 'økt' : 'økter'}${r.minutes ? `, ${nf(r.minutes / 60, 1)} timer` : ''}` })),
    legend: types.map(k => [c.TYPES[k].label, c.TYPES[k].color]),
    table: { head: ['Uke', ...types.map(k => c.TYPES[k].label), 'Minutter'], rows: rows.filter(r => r.total).map(r => [c.weekNo(r.week), ...types.map(k => r.byType[k] || 0), r.minutes]) },
  });
}
function drawExercise() {
  if (!S.chartEx) return setChart('ex', '<p class="empty">Før sett på en økt, så vises utviklingen per øvelse her.</p>');
  const r = c.exerciseSeries(st(), S.chartEx);
  const bwMissing = c.isBodyweight(st(), S.chartEx) && r.metric !== 'e1rm';
  const fmt = v => nf(v, 1);
  const best = r.points.reduce((a, p) => (p.value > a ? p.value : a), 0);
  lineChart('ex', {
    label: r.label + (bwMissing ? '. Legg inn kroppsvekt under Mer for å få estimert 1RM.' : ''),
    series: [{ name: S.chartEx, color: 'var(--t-styrke)', points: r.points.map(p => ({ date: p.date, y: p.value, tip: `${dateShort(p.date)}: ${fmt(p.value)}${r.metric === 'e1rm' ? ` kg, fra ${c.setText(p.set)}` : ''}` })) }],
    table: { head: ['Dato', 'Beste', 'Fra sett'], rows: [...r.points].reverse().map(p => [dateShort(p.date), fmt(p.value), c.setText(p.set)]) },
    note: r.points.length ? `Beste: ${fmt(best)}` : '',
  });
}
function drawTops(t) {
  const rows = c.topsByWeek(st(), 12, t);
  if (!rows.some(r => r.tried)) return setChart('tops', '<p class="empty">Før problemer på en buldreøkt, så vises toppene her.</p>');
  const grades = st().settings.grades;
  barChart('tops', {
    rows: rows.map(r => {
      const tops = grades.reduce((a, g) => a + (r.byGrade[g.name] || 0), 0);
      return { label: weekLabel(r.week), segs: grades.map(g => ({ color: g.color, value: r.byGrade[g.name] || 0 })),
        tip: `Uke ${c.weekNo(r.week)}: ${tops} toppet av ${r.tried} forsøkte problemer` };
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
  if (!S.chartTest) return setChart('test', '<p class="empty">Hallfargene skiftes, så en test du gjentar likt er det sikreste målet. For eksempel maks heng på 20 mm eller et fast problem.</p>');
  const list = c.testSeries(st(), S.chartTest), unit = list.at(-1)?.unit || '';
  lineChart('test', {
    label: S.chartTest + (unit ? `, ${unit}` : ''),
    series: [{ name: S.chartTest, color: 'var(--t-cardio)', points: list.map(t => ({ date: t.date, y: c.parseNum(t.value), tip: `${dateShort(t.date)}: ${t.value} ${t.unit || ''}${t.note ? `, ${t.note}` : ''}` })) }],
    table: { head: ['Dato', 'Resultat', 'Notat'], rows: [...list].reverse().map(t => [dateShort(t.date), `${t.value} ${t.unit || ''}`, t.note || '']) },
  });
}

function setChart(id, html) { const el = $('#ch-' + id); if (el) el.innerHTML = html; }
function tableHtml(t) {
  if (!t || !t.rows.length) return '';
  return `<details><summary>Vis tall</summary><table><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
}
const legendHtml = items => items.length > 1 ? `<div class="legend">${items.map(([n, col]) => `<span><i style="--c:${esc(col)}"></i>${esc(n)}</span>`).join('')}</div>` : '';
function niceTicks(lo, hi, n = 4) {
  const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw) ;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out = [];
  for (let v = a; v <= b + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}
function chartWidth(id) { return Math.max(260, Math.round($('#ch-' + id).clientWidth || 320)); }

function lineChart(id, { series, table, label, note, yMin, yMax }) {
  const W = chartWidth(id), H = 200, L = 34, R = 14, T = 12, B = 24;
  const pts = series.flatMap(s => s.points);
  if (!pts.length) return setChart(id, '<p class="empty">Ingen målinger ennå.</p>');
  const dates = pts.map(p => +c.fromIso(p.date));
  const d0 = Math.min(...dates), d1 = Math.max(...dates);
  const ys = pts.map(p => p.y);
  let lo = yMin ?? Math.min(...ys), hi = yMax ?? Math.max(...ys);
  if (yMin === undefined) { const pad = (hi - lo) * .15 || Math.max(1, hi * .05); lo -= pad; hi += pad; }
  const ticks = yMax !== undefined ? [0, 2, 4, 6, 8, 10] : niceTicks(lo, hi);
  lo = ticks[0]; hi = ticks.at(-1);
  const x = d => d1 === d0 ? (L + W - R) / 2 : L + (d - d0) / (d1 - d0) * (W - L - R);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  let svg = ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${nf(t, 1)}</text>`).join('');
  if (d1 !== d0) svg += [d0, d1].map((d, i) => `<text x="${x(d)}" y="${H - 6}" text-anchor="${i ? 'end' : 'start'}">${dateShort(c.iso(new Date(d)))}</text>`).join('');
  else svg += `<text x="${x(d0)}" y="${H - 6}" text-anchor="middle">${dateShort(c.iso(new Date(d0)))}</text>`;
  const hits = [];
  for (const s of series) {
    const p = s.points.map(q => ({ ...q, px: x(+c.fromIso(q.date)), py: y(q.y) }));
    if (p.length > 1) svg += `<path d="${p.map((q, i) => (i ? 'L' : 'M') + q.px.toFixed(1) + ' ' + q.py.toFixed(1)).join('')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    svg += p.map(q => `<circle cx="${q.px}" cy="${q.py}" r="4.5" fill="${s.color}" stroke="var(--wall)" stroke-width="2"/>`).join('');
    hits.push(...p);
  }
  S.charts[id] = { W, hits };
  setChart(id, `${label ? `<p class="small muted">${esc(label)}</p>` : ''}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label || 'Linjediagram')}" data-chart="${id}">${svg}</svg>${legendHtml(series.map(s => [s.name, s.color]))}${note ? `<p class="small muted">${esc(note)}</p>` : ''}`);
  $('#tb-' + id).innerHTML = tableHtml(table);
}
function barChart(id, { rows, legend, table }) {
  const W = chartWidth(id), H = 170, L = 26, R = 2, T = 10, B = 22;
  const totals = rows.map(r => r.segs.reduce((a, s) => a + s.value, 0));
  const max = Math.max(1, ...totals), ticks = niceTicks(0, max, 3).filter(t => Number.isInteger(t));
  const top = ticks.at(-1), bw = (W - L - R) / rows.length, gap = Math.min(8, bw * .3);
  const y = v => T + (top - v) / top * (H - T - B);
  let svg = ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('');
  const hits = [];
  rows.forEach((r, i) => {
    const bx = L + i * bw + gap / 2, w = bw - gap;
    let acc = 0;
    const parts = r.segs.filter(s => s.value);
    parts.forEach((s, j) => {
      const y1 = y(acc), y2 = y(acc + s.value);
      acc += s.value;
      const h = Math.max(1, y1 - y2 - (j < parts.length - 1 ? 2 : 0));
      const lastSeg = j === parts.length - 1, rad = Math.min(4, w / 2, h);
      svg += lastSeg
        ? `<path d="M${bx} ${y2 + h}V${y2 + rad}Q${bx} ${y2} ${bx + rad} ${y2}H${bx + w - rad}Q${bx + w} ${y2} ${bx + w} ${y2 + rad}V${y2 + h}Z" fill="${esc(s.color)}"/>`
        : `<rect x="${bx}" y="${y1 - h}" width="${w}" height="${h}" fill="${esc(s.color)}"/>`;
    });
    if (i % 2 === (rows.length - 1) % 2) svg += `<text x="${bx + w / 2}" y="${H - 6}" text-anchor="middle">${esc(r.label)}</text>`;
    hits.push({ px: bx + w / 2, py: y(acc), tip: r.tip });
  });
  S.charts[id] = { W, hits };
  setChart(id, `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Stolpediagram per uke" data-chart="${id}">${svg}</svg>${legendHtml(legend)}`);
  $('#tb-' + id).innerHTML = tableHtml(table);
}
function chartTip(e) {
  const svg = e.target.closest?.('svg[data-chart]');
  const tip = $('#tip');
  if (!svg) { tip.hidden = true; return; }
  const ch = S.charts[svg.dataset.chart];
  if (!ch) return;
  const box = svg.getBoundingClientRect();
  const mx = (e.clientX - box.left) / box.width * ch.W;
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

function viewMore() {
  const set = st().settings;
  const bw = [...set.bodyweight].sort((a, b) => b.date.localeCompare(a.date));
  const exNames = [...new Set([...Object.keys(set.exercises), ...c.exerciseNames(st())])];
  $('#view').innerHTML = `
    <div class="topline"><h1>Mer</h1>${syncHtml()}</div>
    <section class="panel">
      <h2>Kroppsvekt</h2>
      <p class="small muted">Brukes til å regne ut styrke på øvelser med kroppsvekt, som pull-ups.${bw.length ? ` Sist ${nf(bw[0].kg, 1)} kg, ${dateShort(bw[0].date)}.` : ''}</p>
      <form class="row" id="f-bw"><input id="bw" inputmode="decimal" placeholder="Kg" aria-label="Kroppsvekt i kg" style="max-width:120px"><button class="btn">Lagre vekt</button></form>
    </section>
    <section class="panel">
      <h2>Øvelser med kroppsvekt</h2>
      <div class="prob-add">${exNames.map(n => `<button class="chip" data-act="bw-ex" data-v="${esc(n)}" aria-pressed="${!!set.exercises[n]?.bw}">${esc(n)}</button>`).join('')}</div>
    </section>
    <section class="panel">
      <h2>Buldrefarger</h2>
      <p class="small muted">I rekkefølge fra lettest til tyngst.</p>
      <div class="set-list">${set.grades.map((g, i) => `<div class="grade"><input type="color" value="${esc(g.color)}" data-grade="${i}" data-gf="color" aria-label="Farge for ${esc(g.name)}"><input value="${esc(g.name)}" data-grade="${i}" data-gf="name" aria-label="Navn"><button class="icon-btn" data-act="del-grade" data-i="${i}" aria-label="Fjern ${esc(g.name)}">${ICON.x}</button></div>`).join('')}</div>
      <button class="btn" data-act="add-grade">Legg til farge</button>
    </section>
    <section class="panel">
      <h2>Synk med GitHub</h2>
      <p class="small muted">${S.token ? 'Endringer sendes til GitHub automatisk.' : 'Uten token lagres endringer bare på denne enheten. Lag et fine-grained token for repoet treningsapp med Contents: Read and write, og lim det inn her.'}</p>
      <form class="row" id="f-token"><input id="token" type="password" autocomplete="off" placeholder="${S.token ? 'Nytt token' : 'github_pat_...'}" aria-label="GitHub-token" style="flex:1;min-width:180px"><button class="btn">Lagre token</button></form>
      <button class="btn" data-act="pull">Hent nå</button>
    </section>
    <section class="panel">
      <h2>Last ned data</h2>
      <div class="row">${['okter', 'sett', 'problemer', 'tester'].map(n => `<button class="btn" data-act="csv" data-v="${n}.csv">${n === 'okter' ? 'Økter' : cap(n)} CSV</button>`).join('')}</div>
      <button class="btn" data-act="backup">Kryptert kopi</button>
    </section>
    <section class="panel">
      <h2>Passord</h2>
      <form class="row" id="f-pw"><input id="pw1" type="password" autocomplete="new-password" placeholder="Nytt passord" aria-label="Nytt passord" style="flex:1;min-width:180px"><button class="btn">Bytt passord</button></form>
      <p class="small muted">Claude trenger det nye passordet for å kunne føre og analysere. Oppdater det i prosjektdokumentet.</p>
      <button class="btn" data-act="lock">Lås og glem passordet</button>
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

function openPicker(date) {
  const sh = $('#sheet');
  sh.className = 'sheet pop';
  sh.hidden = false;
  sh.innerHTML = `<div class="pop-box sheet-in"><h2>Ny økt ${dateLong(date)}</h2><div class="types">${Object.keys(c.TYPES).map(k => `<button class="type" data-act="create" data-v="${k}" data-date="${date}">${hold(k)}${c.TYPES[k].label}</button>`).join('')}</div><button class="btn" data-act="pop-close">Avbryt</button></div>`;
}
function openTestForm() {
  const sh = $('#sheet');
  sh.className = 'sheet pop';
  sh.hidden = false;
  const names = c.testNames(st());
  sh.innerHTML = `<form class="pop-box sheet-in" id="f-test"><h2>Legg til test</h2>
    <label>Test<input id="t-name" list="dl-tests" required value="${esc(S.chartTest || '')}" placeholder="For eksempel maks heng 20 mm" autocomplete="off"></label>
    <datalist id="dl-tests">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="two"><label>Resultat<input id="t-val" inputmode="decimal" required></label><label>Enhet<input id="t-unit" placeholder="kg, s, forsøk" value="${esc(c.testSeries(st(), S.chartTest).at(-1)?.unit || '')}"></label></div>
    <div class="two"><label>Dato<input id="t-date" type="date" value="${today()}" required></label><label>Notat<input id="t-note"></label></div>
    <div class="row"><button class="btn primary">Lagre test</button><button type="button" class="btn" data-act="pop-close">Avbryt</button></div></form>`;
}

/* ---------- Hendelser ---------- */

const acts = {
  shift(el) {
    const n = +el.dataset.n;
    if (S.weekMode) { S.sel = c.addDays(S.sel, 7 * n); S.month = S.sel.slice(0, 7); }
    else {
      const [y, m] = S.month.split('-').map(Number), d = new Date(y, m - 1 + n, 1, 12);
      S.month = c.iso(d).slice(0, 7);
    }
    render();
  },
  day(el) {
    S.sel = el.dataset.date;
    S.month = S.sel.slice(0, 7);
    S.weekMode = true;
    render();
  },
  month() { S.weekMode = false; render(); },
  new(el) { openPicker(el.dataset.date); },
  create(el) {
    const s = c.newSession({ date: el.dataset.date, type: el.dataset.v });
    st().sessions.push(s);
    S.sel = s.date;
    openSession(s.id);
  },
  'pop-close'() { $('#sheet').hidden = true; },
  open(el) { openSession(el.dataset.id); },
  close() { closeSession(); },
  type(el) {
    const s = sess();
    s.type = el.dataset.v;
    if (s.type === 'cardio' && !s.cardio) s.cardio = { kind: 'Løping', km: null, hr: null };
    touch(s); sheetRender();
  },
  scale(el) {
    const s = el.dataset.id ? st().sessions.find(x => x.id === el.dataset.id) : sess();
    const f = el.dataset.field, v = +el.dataset.v;
    s[f] = s[f] === v ? null : v;
    touch(s);
    if (S.editing) sheetRender(); else render();
  },
  'add-ex'() { const s = sess(); s.exercises.push({ name: '', sets: [] }); touch(s); sheetRender(); $$('[data-exf=name]').at(-1)?.focus(); },
  'del-ex'(el) { const s = sess(); s.exercises.splice(+el.dataset.i, 1); touch(s); sheetRender(); },
  'add-set'(el) {
    const s = sess(), e = s.exercises[+el.dataset.i], prev = e.sets.at(-1);
    e.sets.push(prev ? { ...prev } : e.timed ? { sec: null, kg: null } : { reps: null, kg: null });
    touch(s); sheetRender();
    $$(`[data-ex="${el.dataset.i}"][data-set="${e.sets.length - 1}"]`)[0]?.focus();
  },
  'del-set'(el) { const s = sess(); s.exercises[+el.dataset.i].sets.splice(+el.dataset.j, 1); touch(s); sheetRender(); },
  'toggle-timed'(el) {
    const s = sess(), e = s.exercises[+el.dataset.i], timed = !(e.timed || e.sets.some(x => x.sec != null));
    e.timed = timed;
    e.sets.forEach(x => { if (timed) { x.sec = x.reps ?? null; delete x.reps; } else { x.reps = x.sec ?? null; delete x.sec; } });
    touch(s); sheetRender();
  },
  'add-prob'(el) { const s = sess(); s.problems.push({ grade: el.dataset.v, style: '', tries: 1, top: false, note: '' }); touch(s); sheetRender(); },
  tries(el) { const s = sess(), p = s.problems[+el.dataset.i]; p.tries = Math.max(1, p.tries + +el.dataset.n); touch(s); sheetRender(); },
  top(el) { const s = sess(), p = s.problems[+el.dataset.i]; p.top = !p.top; touch(s); sheetRender(); },
  'del-prob'(el) { const s = sess(); s.problems.splice(+el.dataset.i, 1); touch(s); sheetRender(); },
  del() {
    const s = sess();
    s.deleted = true; touch(s);
    S.editing = null;
    $('#sheet').hidden = true;
    render();
    toast('Økten er slettet', () => { s.deleted = false; touch(s); render(); });
  },
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

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    S.tab = tab.dataset.tab;
    if (S.tab === 'kalender') S.weekMode = false;
    scrollTo(0, 0);
    return render();
  }
  const el = e.target.closest('[data-act]');
  if (el) { e.preventDefault(); acts[el.dataset.act]?.(el); return; }
  if (e.target.id === 'sheet' && e.target.classList.contains('pop')) e.target.hidden = true;
});
document.addEventListener('input', e => {
  const t = e.target, s = sess();
  if (t.dataset.grade !== undefined) { st().settings.grades[+t.dataset.grade][t.dataset.gf] = t.value; settingsChanged(); return; }
  if (!s) return;
  if (t.dataset.f) {
    if (t.dataset.f === 'date') { if (!t.value) return; s.date = t.value; S.sel = t.value; S.month = t.value.slice(0, 7); }
    else s[t.dataset.f] = t.dataset.num !== undefined ? c.parseNum(t.value) : t.value;
    touch(s);
  } else if (t.dataset.exf) { s.exercises[+t.dataset.ex].name = t.value; touch(s); }
  else if (t.dataset.sf) { s.exercises[+t.dataset.ex].sets[+t.dataset.set][t.dataset.sf] = c.parseNum(t.value); touch(s); }
  else if (t.dataset.pf) { s.problems[+t.dataset.prob][t.dataset.pf] = t.value; touch(s); }
  else if (t.dataset.cf) { s.cardio = s.cardio || { kind: 'Løping', km: null, hr: null }; s.cardio[t.dataset.cf] = t.dataset.cf === 'kind' ? t.value : c.parseNum(t.value); touch(s); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.exf === 'name' && S.editing) sheetRender();   // Viser «Sist» når øvelsen er valgt
  if (t.dataset.f === 'date' && S.editing) sheetRender();
  if (t.id === 'sel-ex') { S.chartEx = t.value; render(); }
  if (t.id === 'sel-test') { S.chartTest = t.value; render(); }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const id = e.target.id;
  if (id === 'lock-form') {
    const pw = $('#lock-pw').value, msg = $('#lock-msg');
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
    $('#sheet').hidden = true;
    render();
  }
});
$('#toast-undo').addEventListener('click', () => { S.undo?.(); $('#toast').hidden = true; S.undo = null; });

/* ---------- Oppstart ---------- */

(async () => {
  const pw = lsGet(LS.pw);
  if (pw) {
    try { await unlock(pw); return; }
    catch (err) { lsSet(LS.pw, null); $('#lock-msg').textContent = err.message === 'Feil passord.' ? 'Passordet er endret. Skriv det nye.' : err.message; }
  }
  $('#lock-pw').focus();
})();
