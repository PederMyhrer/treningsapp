// Kjernen i treningsappen: datamodell, kryptering, sammenslåing og beregninger.
// Brukes både av nettsiden (app.js) og av skriptet (tools/trening.mjs).

export const KDF_ITER = 600000;
export const TYPES = {
  buldring: { label: 'Buldring', color: 'var(--t-buldring)' },
  styrke: { label: 'Styrke', color: 'var(--t-styrke)' },
  cardio: { label: 'Cardio', color: 'var(--t-cardio)' },
  annet: { label: 'Annet', color: 'var(--t-annet)' },
};
export const STYLES = ['Overheng', 'Vegg', 'Slab', 'Tak'];
export const CARDIO_KINDS = ['Løping', 'Sykling', 'Ski', 'Gange', 'Annet'];

/* ---------- Datamodell ---------- */

export function emptyState() {
  return {
    app: 'trening', schema: 1, savedAt: new Date().toISOString(),
    settings: {
      updatedAt: '1970-01-01T00:00:00.000Z',
      bodyweight: [],
      grades: [
        { name: 'Grønn', color: '#2E9E5B' },
        { name: 'Blå', color: '#2F6FD6' },
        { name: 'Gul', color: '#E3B505' },
      ],
      exercises: { 'Pull-up': { bw: true }, 'Dips': { bw: true }, 'Chin-up': { bw: true } },
    },
    sessions: [],
    tests: [],
  };
}

export const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function newSession(fields = {}) {
  return {
    id: uid('s'), date: fields.date, type: fields.type || 'annet', place: '', plan: '',
    duration: null, rpe: null, fingers: null, fingersNext: null, note: '',
    exercises: [], problems: [], cardio: null,
    updatedAt: new Date().toISOString(), ...fields,
  };
}

export const live = list => list.filter(x => !x.deleted);
export const sessionsOn = (state, date) => live(state.sessions).filter(s => s.date === date);

/* ---------- Tall og datoer ---------- */

export const parseNum = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
export const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (s, n) => { const d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); };
/** Mandagen i uken datoen tilhører. */
export const monday = s => addDays(s, -((fromIso(s).getDay() + 6) % 7));
/** ISO 8601-ukenummer. */
export function weekNo(s) {
  const thu = fromIso(addDays(monday(s), 3));
  const first = new Date(thu.getFullYear(), 0, 4, 12);
  const firstThu = fromIso(addDays(monday(iso(first)), 3));
  return 1 + Math.round((thu - firstThu) / (7 * 864e5));
}

/* ---------- Kryptering: PBKDF2-SHA256 til AES-256-GCM, samme format som budsjettappen ---------- */

const te = new TextEncoder(), td = new TextDecoder();
const b64e = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export const newSalt = () => b64e(crypto.getRandomValues(new Uint8Array(16)));
export const isEnvelope = x => !!x && x.app === 'trening' && typeof x.ct === 'string' && typeof x.salt === 'string';

export async function deriveKey(pw, salt, iter = KDF_ITER) {
  const base = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64d(salt), iterations: iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function sealWith(key, salt, iter, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))));
  return { app: 'trening', v: 1, kdf: 'PBKDF2-SHA256', iter, salt, iv: b64e(iv), ct: b64e(ct) };
}
export async function openWith(key, env) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(env.iv) }, key, b64d(env.ct));
  return JSON.parse(td.decode(pt));
}

/* ---------- Sammenslåing: nyeste versjon per økt vinner, slettinger beholdes som merker ---------- */

function mergeList(a = [], b = []) {
  const map = new Map();
  for (const x of [...a, ...b]) {
    const cur = map.get(x.id);
    if (!cur || (x.updatedAt || '') > (cur.updatedAt || '')) map.set(x.id, x);
  }
  return [...map.values()].sort((x, y) => (x.date || '').localeCompare(y.date || '') || (x.updatedAt || '').localeCompare(y.updatedAt || ''));
}
export function merge(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    ...a,
    savedAt: (a.savedAt || '') > (b.savedAt || '') ? a.savedAt : b.savedAt,
    settings: (b.settings?.updatedAt || '') > (a.settings?.updatedAt || '') ? b.settings : a.settings,
    sessions: mergeList(a.sessions, b.sessions),
    tests: mergeList(a.tests, b.tests),
  };
}
const byId = list => [...(list || [])].sort((a, b) => a.id.localeCompare(b.id));
const canon = s => JSON.stringify({ settings: s.settings, sessions: byId(s.sessions), tests: byId(s.tests) });
export const sameData = (a, b) => canon(a) === canon(b);

/* ---------- Styrke ---------- */

/** Epley. Over 12 repetisjoner blir anslaget for usikkert, så de settene telles ikke. */
export function epley(load, reps) {
  if (!(load > 0) || !(reps >= 1) || reps > 12) return null;
  return reps === 1 ? load : load * (1 + reps / 30);
}
export function bodyweightOn(state, date) {
  const list = [...(state.settings.bodyweight || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return null;
  const before = list.filter(x => x.date <= date);
  return (before.length ? before[before.length - 1] : list[0]).kg;
}
export const isBodyweight = (state, name) => !!state.settings.exercises?.[name]?.bw;

export function setLoad(state, name, set, date) {
  const kg = parseNum(set.kg);
  if (isBodyweight(state, name)) {
    const bw = bodyweightOn(state, date);
    return bw === null ? null : bw + (kg || 0);
  }
  return kg;
}
export function exerciseNames(state) {
  const seen = new Map();
  for (const s of live(state.sessions)) for (const e of s.exercises || []) if (e.name) seen.set(e.name, s.date);
  return [...seen.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(x => x[0]);
}
/**
 * Utvikling for én øvelse, ett punkt per økt. Velger det beste målet dataene tåler:
 * e1rm (krever last) -> tyngste ekstra vekt -> lengste tid -> flest repetisjoner.
 */
export function exerciseSeries(state, name) {
  const rows = [];
  for (const s of live(state.sessions)) for (const e of s.exercises || []) {
    if (e.name !== name) continue;
    for (const set of e.sets || []) rows.push({ date: s.date, set, sid: s.id });
  }
  const by = (val, metric, label) => {
    const best = new Map();
    for (const r of rows) {
      const v = val(r);
      if (v === null) continue;
      const cur = best.get(r.date);
      if (!cur || v > cur.value) best.set(r.date, { date: r.date, value: v, set: r.set });
    }
    return { metric, label, points: [...best.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  };
  const e1 = by(r => epley(setLoad(state, name, r.set, r.date), parseNum(r.set.reps)), 'e1rm', 'Estimert 1RM, kg');
  if (e1.points.length) return e1;
  const kg = by(r => { const k = parseNum(r.set.kg); return k > 0 ? k : null; }, 'kg', 'Tyngste ekstra vekt, kg');
  if (kg.points.length) return kg;
  const sec = by(r => { const k = parseNum(r.set.sec); return k > 0 ? k : null; }, 'sec', 'Lengste tid, sekunder');
  if (sec.points.length) return sec;
  return by(r => { const k = parseNum(r.set.reps); return k > 0 ? k : null; }, 'reps', 'Flest repetisjoner');
}
export const setText = set => {
  const kg = parseNum(set.kg), reps = parseNum(set.reps), sec = parseNum(set.sec);
  const amount = sec ? `${sec} s` : `${reps ?? '?'}`;
  return kg ? `${amount} × ${String(kg).replace('.', ',')} kg` : amount;
};
/** Siste gang øvelsen ble gjort før en gitt dato. */
export function lastTime(state, name, beforeDate, excludeId) {
  const list = live(state.sessions).filter(s => s.id !== excludeId && s.date <= beforeDate && (s.exercises || []).some(e => e.name === name && e.sets?.length));
  if (!list.length) return null;
  const s = list.sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return { date: s.date, sets: s.exercises.filter(e => e.name === name).flatMap(e => e.sets) };
}

/* ---------- Buldring ---------- */

export function problemStats(session) {
  const p = session.problems || [];
  const tops = p.filter(x => x.top);
  return { problems: p.length, tops: tops.length, flashes: tops.filter(x => x.tries === 1).length, tries: p.reduce((a, x) => a + (x.tries || 0), 0) };
}
/** Toppet og forsøkt per farge og uke, til grafen. */
export function topsByWeek(state, weeks, today) {
  const start = addDays(monday(today), -7 * (weeks - 1));
  const out = Array.from({ length: weeks }, (_, i) => ({ week: addDays(start, 7 * i), byGrade: {}, tried: 0 }));
  for (const s of live(state.sessions)) {
    if (s.date < start) continue;
    const row = out[Math.floor((fromIso(s.date) - fromIso(start)) / (7 * 864e5))];
    if (!row) continue;
    for (const p of s.problems || []) { row.tried++; if (p.top) row.byGrade[p.grade] = (row.byGrade[p.grade] || 0) + 1; }
  }
  return out;
}

/* ---------- Oversikt ---------- */

export function sessionsByWeek(state, weeks, today) {
  const start = addDays(monday(today), -7 * (weeks - 1));
  const out = Array.from({ length: weeks }, (_, i) => ({ week: addDays(start, 7 * i), byType: {}, total: 0, minutes: 0 }));
  for (const s of live(state.sessions)) {
    if (s.date < start) continue;
    const row = out[Math.floor((fromIso(s.date) - fromIso(start)) / (7 * 864e5))];
    if (!row) continue;
    row.byType[s.type] = (row.byType[s.type] || 0) + 1;
    row.total++;
    row.minutes += s.duration || 0;
  }
  return out;
}
/** Antall sammenhengende uker med minst én økt. Inneværende uke bryter ikke rekken før den er over. */
export function weekStreak(state, today) {
  const weeks = new Set(live(state.sessions).map(s => monday(s.date)));
  let w = monday(today);
  if (!weeks.has(w)) w = addDays(w, -7);
  let n = 0;
  while (weeks.has(w)) { n++; w = addDays(w, -7); }
  return n;
}
export function summary(state, today) {
  const week = monday(today);
  const all = live(state.sessions);
  const inLast = d => all.filter(s => s.date > addDays(today, -d) && s.date <= today);
  const last28 = inLast(28);
  return {
    thisWeek: all.filter(s => s.date >= week && s.date <= addDays(week, 6)).length,
    perWeek: last28.length / 4,
    hours28: last28.reduce((a, s) => a + (s.duration || 0), 0) / 60,
    streak: weekStreak(state, today),
  };
}
export const fingerSeries = state => live(state.sessions)
  .filter(s => s.fingers !== null && s.fingers !== undefined || s.fingersNext !== null && s.fingersNext !== undefined)
  .sort((a, b) => a.date.localeCompare(b.date))
  .map(s => ({ date: s.date, after: s.fingers ?? null, next: s.fingersNext ?? null }));
export const testNames = state => [...new Set(live(state.tests).map(t => t.name))];
export const testSeries = (state, name) => live(state.tests).filter(t => t.name === name)
  .sort((a, b) => a.date.localeCompare(b.date));

export function sessionLine(state, s) {
  const bits = [];
  if ((s.problems || []).length) {
    const p = problemStats(s);
    bits.push(`${p.tops} av ${p.problems} toppet`);
  }
  for (const e of s.exercises || []) {
    if (!e.name) continue;
    const series = e.sets?.length || 0;
    const top = Math.max(0, ...(e.sets || []).map(x => parseNum(x.kg) || 0));
    bits.push(`${e.name} ${series} sett${top ? `, opptil ${String(top).replace('.', ',')} kg` : ''}`);
  }
  if (s.cardio) {
    const c = s.cardio;
    bits.push([c.kind, c.km ? `${String(c.km).replace('.', ',')} km` : ''].filter(Boolean).join(' '));
  }
  if (s.duration) bits.push(`${s.duration} min`);
  return bits.join(', ');
}

/* ---------- Eksport til analyse ---------- */

const csvCell = v => {
  if (v === null || v === undefined) return '';
  const t = String(v);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const csv = (head, rows) => [head.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n') + '\n';

/** Ryddige tabeller med én rad per økt, sett, problem og test. */
export function toCsv(state) {
  const all = live(state.sessions).sort((a, b) => a.date.localeCompare(b.date));
  const sets = [], problems = [];
  for (const s of all) {
    for (const e of s.exercises || []) (e.sets || []).forEach((x, i) => {
      const load = setLoad(state, e.name, x, s.date), reps = parseNum(x.reps), e1 = epley(load, reps);
      sets.push([s.date, s.id, s.type, e.name, i + 1, reps, parseNum(x.kg), parseNum(x.sec), load, e1 === null ? null : +e1.toFixed(1)]);
    });
    for (const p of s.problems || []) problems.push([s.date, s.id, p.grade, p.style, p.tries, p.top ? 1 : 0, p.note]);
  }
  return {
    'okter.csv': csv(['dato', 'okt_id', 'type', 'sted', 'plan', 'minutter', 'rpe', 'fingre_etter', 'fingre_morgen', 'cardio_type', 'cardio_km', 'cardio_puls', 'notat'],
      all.map(s => [s.date, s.id, s.type, s.place, s.plan, s.duration, s.rpe, s.fingers, s.fingersNext, s.cardio?.kind, s.cardio?.km, s.cardio?.hr, s.note])),
    'sett.csv': csv(['dato', 'okt_id', 'type', 'ovelse', 'sett', 'reps', 'ekstra_kg', 'sekunder', 'total_last_kg', 'e1rm_kg'], sets),
    'problemer.csv': csv(['dato', 'okt_id', 'farge', 'stil', 'forsok', 'toppet', 'notat'], problems),
    'tester.csv': csv(['dato', 'test', 'resultat', 'enhet', 'notat'], live(state.tests).map(t => [t.date, t.name, t.value, t.unit, t.note])),
  };
}
