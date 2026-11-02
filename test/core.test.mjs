import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../core.js';

const near = (a, b, e = 0.05) => assert.ok(Math.abs(a - b) < e, `${a} ~ ${b}`);
const state = (over = {}) => ({ ...c.emptyState(), ...over });

test('Epley stemmer med håndregning', () => {
  near(c.epley(100, 4), 113.33);     // 100 * (1 + 4/30)
  near(c.epley(85, 6), 102);         // 85 * 1.2
  assert.equal(c.epley(100, 1), 100);
  assert.equal(c.epley(100, 13), null);
  assert.equal(c.epley(0, 5), null);
});

test('ISO-uker, inkludert årsskiftet', () => {
  assert.equal(c.weekNo('2026-11-02'), 45);
  assert.equal(c.weekNo('2026-01-01'), 1);
  assert.equal(c.weekNo('2021-01-03'), 53);
  assert.equal(c.weekNo('2024-12-30'), 1);
  assert.equal(c.monday('2026-11-08'), '2026-11-02');
  assert.equal(c.monday('2026-11-02'), '2026-11-02');
});

test('pull-up måles på total last, med kroppsvekt fra riktig dato', () => {
  const st = state();
  st.settings.bodyweight = [{ date: '2026-01-01', kg: 80 }, { date: '2026-11-10', kg: 90 }];
  const s = c.newSession({ date: '2026-11-02', type: 'styrke', exercises: [{ name: 'Pull-up', sets: [{ reps: 6 }, { reps: 6, kg: 10 }, { reps: 4, kg: 20 }] }] });
  st.sessions.push(s);
  const r = c.exerciseSeries(st, 'Pull-up');
  assert.equal(r.metric, 'e1rm');
  near(r.points[0].value, 113.33);   // beste sett: (80+20) * (1+4/30), ikke (80+10) * 1.2 = 108
  assert.equal(r.points[0].set.kg, 20);
});

test('uten kroppsvekt faller pull-up tilbake til ekstra vekt', () => {
  const st = state();
  st.sessions.push(c.newSession({ date: '2026-11-02', exercises: [{ name: 'Pull-up', sets: [{ reps: 6, kg: 10 }, { reps: 4, kg: 20 }] }] }));
  const r = c.exerciseSeries(st, 'Pull-up');
  assert.equal(r.metric, 'kg');
  assert.equal(r.points[0].value, 20);
});

test('hengtid gir tidsserie', () => {
  const st = state();
  st.sessions.push(c.newSession({ date: '2026-11-02', exercises: [{ name: 'Fingerheng', sets: [{ sec: 7 }, { sec: 10 }] }] }));
  const r = c.exerciseSeries(st, 'Fingerheng');
  assert.equal(r.metric, 'sec');
  assert.equal(r.points[0].value, 10);
});

test('sammenslåing beholder endringer fra begge sider', () => {
  const base = state();
  const a = c.newSession({ id: 'a', date: '2026-11-01', updatedAt: '2026-11-01T10:00:00Z' });
  const b = c.newSession({ id: 'b', date: '2026-11-02', updatedAt: '2026-11-02T10:00:00Z' });
  const phone = { ...base, sessions: [a, { ...b, note: 'gammel' , updatedAt: '2026-11-02T09:00:00Z' }] };
  const repo = { ...base, sessions: [{ ...a, deleted: true, updatedAt: '2026-11-03T10:00:00Z' }, b, c.newSession({ id: 'c', date: '2026-11-03', updatedAt: '2026-11-03T11:00:00Z' })] };
  const m = c.merge(phone, repo);
  assert.equal(m.sessions.length, 3);
  assert.equal(m.sessions.find(s => s.id === 'a').deleted, true);
  assert.equal(m.sessions.find(s => s.id === 'b').note, '');
  assert.deepEqual(c.merge(phone, repo).sessions, c.merge(repo, phone).sessions);
  assert.equal(c.live(m.sessions).length, 2);
});

test('innstillinger: nyeste vinner', () => {
  const a = state(), b = state();
  a.settings = { ...a.settings, updatedAt: '2026-11-01T00:00:00Z', bodyweight: [{ date: '2026-11-01', kg: 80 }] };
  b.settings = { ...b.settings, updatedAt: '2026-11-02T00:00:00Z', bodyweight: [{ date: '2026-11-02', kg: 81 }] };
  assert.equal(c.merge(a, b).settings.bodyweight[0].kg, 81);
  assert.equal(c.merge(b, a).settings.bodyweight[0].kg, 81);
});

test('kryptering tur-retur, og feil passord avvises', async () => {
  const salt = c.newSalt();
  const key = await c.deriveKey('riktig æøå', salt, 1000);
  const env = await c.sealWith(key, salt, 1000, { hei: 'blåbær' });
  assert.ok(c.isEnvelope(env));
  assert.ok(!env.ct.includes('blåbær'));
  assert.deepEqual(await c.openWith(key, env), { hei: 'blåbær' });
  const wrong = await c.deriveKey('feil', salt, 1000);
  await assert.rejects(() => c.openWith(wrong, env));
});

test('ukeoversikt, rekke og oppsummering', () => {
  const st = state();
  for (const [date, type, duration] of [['2026-11-02', 'styrke', 60], ['2026-11-01', 'buldring', 120], ['2026-10-20', 'cardio', 30], ['2026-10-05', 'annet', 30]])
    st.sessions.push(c.newSession({ date, type, duration }));
  const w = c.sessionsByWeek(st, 3, '2026-11-02');
  assert.deepEqual(w.map(x => x.total), [1, 1, 1]);
  assert.equal(w[1].byType.buldring, 1);
  assert.equal(c.weekStreak(st, '2026-11-02'), 3);   // uke 45, 44 og 43
  const sum = c.summary(st, '2026-11-02');
  assert.equal(sum.thisWeek, 1);
  assert.equal(sum.perWeek, 0.75);
  assert.equal(sum.hours28, 3.5);
  assert.equal(c.weekStreak(st, '2026-11-16'), 0);
});

test('buldring telles riktig og slettede økter teller ikke', () => {
  const st = state();
  st.sessions.push(c.newSession({ date: '2026-11-02', problems: [{ grade: 'Gul', tries: 1, top: true }, { grade: 'Gul', tries: 3, top: true }, { grade: 'Blå', tries: 2, top: false }] }));
  st.sessions.push(c.newSession({ date: '2026-11-02', deleted: true, problems: [{ grade: 'Gul', tries: 1, top: true }] }));
  assert.deepEqual(c.problemStats(st.sessions[0]), { problems: 3, tops: 2, flashes: 1, tries: 6 });
  const w = c.topsByWeek(st, 1, '2026-11-02');
  assert.equal(w[0].byGrade['Gul'], 2);
  assert.equal(w[0].tried, 3);
});

test('CSV har én rad per sett med total last', () => {
  const st = state();
  st.settings.bodyweight = [{ date: '2026-01-01', kg: 80 }];
  st.sessions.push(c.newSession({ date: '2026-11-02', type: 'styrke', note: 'hei, du', exercises: [{ name: 'Pull-up', sets: [{ reps: 4, kg: 20 }] }] }));
  const t = c.toCsv(st);
  const row = t['sett.csv'].trim().split('\n')[1];
  assert.ok(row.endsWith('Pull-up,1,4,20,,100,113.3'), row);
  assert.ok(t['okter.csv'].includes('"hei, du"'));
});
