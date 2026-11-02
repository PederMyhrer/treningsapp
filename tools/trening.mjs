#!/usr/bin/env node
// Skript for å lese, føre og eksportere treningsdata uten nettsiden.
// Passord: miljøvariabelen TRENING_PW eller filen .trening-pw (ligger i .gitignore).
// Kjør `node tools/trening.mjs hjelp` for oversikt.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as c from '../core.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data.json');
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });

const HELP = `Bruk: node tools/trening.mjs <kommando> [valg] [--push]

Lese
  vis [--dager 14]                         Økter som tekst
  json                                     Hele datasettet dekryptert
  eksport [--ut eksport]                   CSV-filer for analyse

Føre (bruker siste økt samme dag, eller lager en ny)
  okt --type styrke --plan "..." [--sted X] [--dato ÅÅÅÅ-MM-DD]   Start ny økt
  sett --ovelse "Pull-up" --reps 4 [--kg 20] [--sek 7] [--antall 3]
  problem --farge Gul --forsok 3 [--toppet] [--stil Overheng] [--notat ...]
  cardio --kind Løping --km 5 [--minutter 30] [--puls 145]
  slutt [--minutter 90] [--rpe 8] [--fingre 2] [--notat ...]
  morgen --fingre 1 [--dato ...]           Fingre morgenen etter siste økt
  test --navn "Maks heng 20 mm" --verdi 32 --enhet kg [--notat ...]
  kroppsvekt --kg 78 [--dato ...]
  ovelse --navn "Muscle-up" --kroppsvekt   Marker øvelse som kroppsvektøvelse
  slett --id <økt-id>

--økt-valg: --id <økt-id> eller --dato velger økt. --push henter siste versjon,
fører endringen, committer og pusher data.json.
`;

function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const k = a.slice(2), next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[k] = true;
    else { out[k] = next; i++; }
  }
  return out;
}
function password() {
  if (process.env.TRENING_PW) return process.env.TRENING_PW;
  const f = join(ROOT, '.trening-pw');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  throw new Error('Mangler passord: sett TRENING_PW eller lag filen .trening-pw');
}
async function load() {
  const env = JSON.parse(readFileSync(DATA, 'utf8'));
  const key = await c.deriveKey(password(), env.salt, env.iter);
  try { return { env, key, state: await c.openWith(key, env) }; }
  catch { throw new Error('Feil passord for data.json'); }
}
async function save({ env, key, state }) {
  state.savedAt = new Date().toISOString();
  writeFileSync(DATA, JSON.stringify(await c.sealWith(key, env.salt, env.iter, state)) + '\n');
}
const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: 'pipe' }).toString();
const touch = s => { s.updatedAt = new Date().toISOString(); return s; };
const num = (v, navn) => { const n = c.parseNum(v); if (n === null) throw new Error(`--${navn} må være et tall`); return n; };

function findSession(state, o, type) {
  if (o.id) { const s = state.sessions.find(x => x.id === o.id); if (!s) throw new Error('Fant ikke økten ' + o.id); return s; }
  const date = o.dato || today();
  const hit = c.sessionsOn(state, date).at(-1);
  if (hit) return hit;
  const s = c.newSession({ date, type: type || 'annet' });
  state.sessions.push(s);
  return s;
}
function lastSession(state, o) {
  const list = c.live(state.sessions).filter(s => !o.dato || s.date === o.dato).sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt));
  if (!list.length) throw new Error('Ingen økter å oppdatere');
  return list.at(-1);
}
const describe = (state, s) => {
  const head = `${s.date} ${c.TYPES[s.type]?.label || s.type}${s.place ? ' på ' + s.place : ''} [${s.id}]`;
  const lines = [head];
  if (s.plan) lines.push('  Plan: ' + s.plan);
  for (const e of s.exercises || []) lines.push(`  ${e.name}: ${(e.sets || []).map(c.setText).join(', ')}`);
  for (const p of s.problems || []) lines.push(`  ${p.grade}${p.style ? ' ' + p.style : ''}: ${p.tries} forsøk, ${p.top ? 'toppet' : 'ikke toppet'}${p.note ? ' (' + p.note + ')' : ''}`);
  if (s.cardio) lines.push(`  ${[s.cardio.kind, s.cardio.km && s.cardio.km + ' km', s.cardio.hr && 'puls ' + s.cardio.hr].filter(Boolean).join(', ')}`);
  const end = [s.duration && s.duration + ' min', s.rpe && 'RPE ' + s.rpe, s.fingers != null && 'fingre ' + s.fingers, s.fingersNext != null && 'morgen ' + s.fingersNext].filter(Boolean);
  if (end.length) lines.push('  ' + end.join(', '));
  if (s.note) lines.push('  Notat: ' + s.note);
  return lines.join('\n');
};

const edits = {
  okt(state, o) {
    if (!c.TYPES[o.type]) throw new Error('--type må være ' + Object.keys(c.TYPES).join(', '));
    const s = c.newSession({ date: o.dato || today(), type: o.type, plan: o.plan || '', place: o.sted || '' });
    state.sessions.push(s);
    return s;
  },
  sett(state, o) {
    if (!o.ovelse) throw new Error('Mangler --ovelse');
    const s = findSession(state, o, 'styrke');
    let e = s.exercises.find(x => x.name === o.ovelse);
    if (!e) { e = { name: o.ovelse, sets: [] }; s.exercises.push(e); }
    const set = {};
    if (o.reps !== undefined) set.reps = num(o.reps, 'reps');
    if (o.kg !== undefined) set.kg = num(o.kg, 'kg');
    if (o.sek !== undefined) set.sec = num(o.sek, 'sek');
    if (set.reps === undefined && set.sec === undefined) throw new Error('Mangler --reps eller --sek');
    for (let i = 0; i < (o.antall ? num(o.antall, 'antall') : 1); i++) e.sets.push({ ...set });
    return touch(s);
  },
  problem(state, o) {
    if (!o.farge) throw new Error('Mangler --farge');
    const s = findSession(state, o, 'buldring');
    s.problems.push({ grade: o.farge, style: o.stil || '', tries: o.forsok ? num(o.forsok, 'forsok') : 1, top: !!o.toppet, note: o.notat || '' });
    return touch(s);
  },
  cardio(state, o) {
    const s = findSession(state, o, 'cardio');
    s.cardio = { kind: o.kind || 'Løping', km: o.km ? num(o.km, 'km') : null, hr: o.puls ? num(o.puls, 'puls') : null };
    if (o.minutter) s.duration = num(o.minutter, 'minutter');
    return touch(s);
  },
  slutt(state, o) {
    const s = o.id ? findSession(state, o) : lastSession(state, o);
    if (o.minutter) s.duration = num(o.minutter, 'minutter');
    if (o.rpe) s.rpe = num(o.rpe, 'rpe');
    if (o.fingre !== undefined) s.fingers = num(o.fingre, 'fingre');
    if (o.notat) s.note = o.notat;
    return touch(s);
  },
  morgen(state, o) {
    const s = o.id ? findSession(state, o) : lastSession(state, o);
    s.fingersNext = num(o.fingre, 'fingre');
    return touch(s);
  },
  test(state, o) {
    if (!o.navn) throw new Error('Mangler --navn');
    state.tests.push({ id: c.uid('t'), date: o.dato || today(), name: o.navn, value: num(o.verdi, 'verdi'), unit: o.enhet || '', note: o.notat || '', updatedAt: new Date().toISOString() });
  },
  kroppsvekt(state, o) {
    const date = o.dato || today(), kg = num(o.kg, 'kg'), list = state.settings.bodyweight;
    const hit = list.find(x => x.date === date);
    if (hit) hit.kg = kg; else list.push({ date, kg });
    state.settings.updatedAt = new Date().toISOString();
  },
  ovelse(state, o) {
    state.settings.exercises[o.navn] = { bw: !!o.kroppsvekt };
    state.settings.updatedAt = new Date().toISOString();
  },
  slett(state, o) {
    const s = state.sessions.find(x => x.id === o.id);
    if (!s) throw new Error('Fant ikke økten');
    s.deleted = true;
    return touch(s);
  },
};

async function main() {
  const o = parse(process.argv.slice(2));
  const cmd = o._[0];
  if (!cmd || cmd === 'hjelp') { console.log(HELP); return; }

  if (cmd === 'nytt') {   // Lager data.json første gang, valgfritt med en JSON-fil med startøkter
    if (existsSync(DATA) && !o.tving) throw new Error('data.json finnes allerede');
    const state = c.emptyState();
    if (o.fra) Object.assign(state, JSON.parse(readFileSync(o.fra, 'utf8')), { settings: state.settings });
    const salt = c.newSalt(), key = await c.deriveKey(password(), salt);
    await save({ env: { salt, iter: c.KDF_ITER }, key, state });
    console.log('Opprettet data.json');
    return;
  }

  if (o.push) git('pull', '--ff-only', '--quiet');
  const vault = await load();
  const { state } = vault;

  if (cmd === 'vis') {
    const from = c.addDays(today(), -(o.dager ? num(o.dager, 'dager') : 14));
    const list = c.live(state.sessions).filter(s => s.date >= from).sort((a, b) => a.date.localeCompare(b.date));
    console.log(list.map(s => describe(state, s)).join('\n\n') || 'Ingen økter i perioden');
    return;
  }
  if (cmd === 'json') { console.log(JSON.stringify(state, null, 2)); return; }
  if (cmd === 'eksport') {
    const dir = join(ROOT, typeof o.ut === 'string' ? o.ut : 'eksport');
    mkdirSync(dir, { recursive: true });
    for (const [name, text] of Object.entries(c.toCsv(state))) writeFileSync(join(dir, name), text);
    console.log('Skrev CSV-filer til ' + dir);
    return;
  }
  if (!edits[cmd]) throw new Error('Ukjent kommando: ' + cmd);

  const s = edits[cmd](state, o);
  await save(vault);
  if (s) console.log(describe(state, s)); else console.log('Lagret');
  if (o.push) {
    git('add', 'data.json');
    git('commit', '-q', '-m', 'Oppdater data (kryptert)');
    git('push', '-q');
    console.log('Pushet');
  }
}
main().catch(e => { console.error('Feil: ' + e.message); process.exit(1); });
