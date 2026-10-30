// Quarter 1 focus. The app shows only 16 Nov 2026 – 16 Feb 2027 (foundation + 10K block) until you unlock the rest.
// The generator still builds the whole season underneath so paces, tests and later quarters stay consistent.

import { addDays, diffDays, fmtDow, fmtShort, range } from './dates.js';
import { activityTss } from './garmin.js';
import { whyFor } from './evidence.js';

export const Q1 = { id: 'q1', name: 'Quarter 1 · Foundation to 10K', start: '2026-11-16', end: '2027-02-16', unlockOn: '2027-02-17' };
export const LATER = [
  { name: 'Quarter 2 · Half-marathon build', dates: '17 Feb to 16 May', goal: 'Kaunas HM (25 Apr) and Riga HM (16 May), sub-1:40', unlock: 'Unlocks after the Mažeikiai 10K' },
  { name: 'Quarter 3 · Triathlon', dates: '17 May to 27 Jun', goal: 'Trakai sprint triathlon (27 Jun)', unlock: 'Unlocks after Riga' },
  { name: 'Quarter 4 · Warsaw Marathon', dates: '28 Jun to 26 Sep', goal: 'Warsaw Marathon, new PB', unlock: 'Unlocks after Trakai' },
];

export const isUnlocked = (settings, today) => !!settings.unlockAll || today >= Q1.unlockOn;

/** Cut the full season plan down to Quarter 1. Races and checkpoints after the cutoff disappear from every view. */
export function truncatePlan(plan, end = Q1.end) {
  const days = {};
  for (const [d, v] of Object.entries(plan.days)) if (d <= end) days[d] = v;
  return {
    ...plan, days, end,
    phases: plan.phases.filter((p) => p.id <= 2).map((p) => ({ ...p, end: p.end > end ? end : p.end })),
    races: plan.races.filter((r) => r.date <= end), checkpoints: plan.checkpoints.filter((c) => c.date <= end), locked: true,
  };
}

// ── Cycle by cycle coach briefs. The plan runs in 10-day cycles from 16 Nov; every line below is built from the sessions
// actually planned in the cycle, so a brief can never disagree with the calendar. ────────────────────────────────────────
export const CYCLE_LEN = 10;
export const CYCLE_COUNT = Math.ceil((diffDays(Q1.end, Q1.start) + 1) / CYCLE_LEN);
export const cycleIndex = (date) => Math.max(0, Math.floor(diffDays(date, Q1.start) / CYCLE_LEN));
export const cycleStart = (i) => addDays(Q1.start, i * CYCLE_LEN);
export const cycleEnd = (i) => { const e = addDays(cycleStart(i), CYCLE_LEN - 1); return e > Q1.end ? Q1.end : e; };

const WATCH = {
  speed: 'Running the easy days faster because the speed day felt good.',
  vo2: 'Starting the first rep too fast. The last rep pays for it.',
  threshold: 'Turning threshold into a race. It should feel comfortably hard, not maximal.',
  tempo: 'Drifting above the target pace on the first rep. Hold it back early.',
  hills: 'Sprinting the first hill. Keep it a strong, even effort.',
  taper: 'Adding workouts to feel less nervous. Rest is the training now.',
  easy_run: 'Doing too much because the legs feel good. Easy means easy.',
};
const KEY_NAME = (t) => t.replace(/^(Speed|VO₂max|Threshold|Tempo|10K pace|Sharpener|Hills|Cruise|Fartlek|Intervals)\b.*$/, '$1');

export function cycleBrief(plan, i) {
  const a = cycleStart(i), b = cycleEnd(i);
  const days = range(a, b).filter((d) => plan.days[d]);
  const ss = days.flatMap((d) => plan.days[d].sessions);
  const runs = ss.filter((s) => s.sport === 'run' && s.group !== 'rest');
  const keys = ss.filter((s) => s.sport === 'run' && s.kind === 'key');
  const longs = ss.filter((s) => s.kind === 'long');
  const swims = ss.filter((s) => s.sport === 'swim' && s.group !== 'rest');
  const lifts = ss.filter((s) => s.group === 'strength');
  const race = plan.races.find((r) => r.date >= a && r.date <= b);
  const cps = plan.checkpoints.filter((c) => c.date >= a && c.date <= b);
  const family = days.some((d) => plan.days[d].tag === 'family');
  const km = Math.round(runs.reduce((t, s) => t + (s.km || 0), 0));
  const k0 = keys[0];
  const title = race ? 'Race cycle' : cps.length ? `Checkpoint ${cps[0].id}` : family ? 'Christmas rhythm' : i === 0 ? 'Land softly' : k0 ? KEY_NAME(k0.title) : 'Aerobic base';
  const parts = [`${km} km over ${runs.length} runs`];
  if (k0) parts.push(`key run ${k0.title.toLowerCase().startsWith('hm') ? k0.title : k0.title}`);
  if (longs[0]) parts.push(`long run ${longs[0].km} km on ${fmtDow(longs[0].date)} ${fmtShort(longs[0].date)}`);
  const ev = [...cps.map((c) => `${c.name} on ${fmtDow(c.date)} ${fmtShort(c.date)}`), ...(race ? [`${race.name} on ${fmtDow(race.date)} ${fmtShort(race.date)}`] : [])];
  const mission = i === 0 ? `Recover from Larnaka. No hard efforts: walks, one easy swim, the first light strength session and a short run/walk. ${ev.join('. ')}`.trim()
    : `${ev.length ? ev.join('. ') + '. ' : ''}${parts.join(', ')}.`;
  const why = (k0 && whyFor(k0.why)?.use) || (i === 0
    ? 'Running economy and stride mechanics are impaired after a marathon (Kyröläinen 2000), so the plan uses walking, run/walk and swimming.'
    : (cps.length ? 'Tests replace guessing: your swim pace, bike FTP and 5K time re-scale every later session.' : whyFor('easy_run')?.use) || '');
  const win = [
    ...(k0 ? [`Key run done as written: ${k0.title}`] : []),
    ...(longs[0] ? [`Long run ${longs[0].km} km, relaxed`] : []),
    ...(i === 0 ? [] : [`${swims.length} swims and ${lifts.length} strength ${lifts.length === 1 ? 'session' : 'sessions'}, logged`]),
    ...(i === 0 ? ['Sleep 7.5 h or more on most nights', 'No pain that lasts beyond 2 days'] : ['Easy days stay easy']),
    ...(ev.length ? ['Event executed as planned: ' + ev.join(', ')] : []),
  ];
  const watch = race ? 'Going out too fast. The first 3 km at target pace or slightly slower.'
    : cps.length ? 'Testing while ill or after a bad night: defer 48 hours, that is allowed.'
    : family ? 'Eating and sleeping off-pattern before the tests. The long run is moved to the next free day.'
    : i === 0 ? 'Sharp or one-sided pain, or soreness for more than five days: that means see a physio, not push on.'
    : WATCH[k0?.why] || WATCH.easy_run;
  return { title, mission, why, win, watch, km, nRuns: runs.length, hasTest: cps.length > 0, hasRace: !!race, key: k0?.title || null };
}

// ── Progress against the plan ───────────────────────────────────────────────────────────────────
const SPORT = { run: ['run'], bike: ['bike'], swim: ['swim'], strength: ['strength'], brick: ['bike', 'run'], checkpoint: [], race: ['run'] };
const sportOf = (s) => (s.group === 'checkpoint' || s.group === 'race' ? s.sport : s.group);

/** Which planned sessions of a cycle were done: matched by sport against Garmin activities (and your log) in that cycle. */
export function cycleCompletion(plan, g, log, weekIdx) {
  const a = cycleStart(weekIdx), b = cycleEnd(weekIdx);
  const planned = range(a, b).flatMap((d) => (plan.days[d]?.sessions || []).filter((s) => s.group !== 'rest'));
  const acts = (g?.activities || []).filter((x) => x.d >= a && x.d <= b);
  const have = { run: acts.filter((x) => x.s === 'run').length, bike: acts.filter((x) => x.s === 'bike').length, swim: acts.filter((x) => x.s === 'swim').length, strength: acts.filter((x) => x.s === 'strength').length };
  const logged = { run: 0, bike: 0, swim: 0, strength: 0 };
  for (const e of log.filter((l) => l.date >= a && l.date <= b && l.status !== 'skipped')) { const s = planned.find((p) => p.id === e.sessionId); const sp = s && sportOf(s); if (sp in logged) logged[sp]++; }
  for (const k of Object.keys(have)) have[k] = Math.max(have[k], logged[k]);
  const need = { run: 0, bike: 0, swim: 0, strength: 0 };
  for (const s of planned) for (const k of (s.group === 'brick' ? ['bike'] : SPORT[sportOf(s)] || [sportOf(s)])) if (k in need) need[k]++;
  let done = 0, total = 0;
  for (const k of Object.keys(need)) { total += need[k]; done += Math.min(need[k], have[k]); }
  return { week: weekIdx, start: a, planned: planned.length, total, done, pct: total ? done / total : null, actualKm: acts.filter((x) => x.s === 'run').reduce((t, x) => t + (x.km || 0), 0) };
}

export function quarterProgress(plan, g, log, today) {
  const dayN = Math.max(0, Math.min(diffDays(Q1.end, Q1.start) + 1, diffDays(today, Q1.start) + 1));
  const total = diffDays(Q1.end, Q1.start) + 1;
  const cur = Math.max(0, Math.min(CYCLE_COUNT - 1, cycleIndex(today)));
  const started = today >= Q1.start;
  const asOf = g?.meta?.asOf?.slice(0, 10);
  const cycles = Array.from({ length: CYCLE_COUNT }, (_, i) => {
    const w = cycleBrief(plan, i);
    const c = cycleCompletion(plan, g, log, i);
    const over = cycleEnd(i) < today;
    const known = asOf && cycleEnd(i) <= asOf;
    return { ...w, i, ...c, end: cycleEnd(i), state: !started ? 'future' : i === cur ? 'current' : over ? 'past' : 'future', counted: over && known };
  });
  let streak = 0;
  for (let i = cur - 1; i >= 0; i--) { if (cycles[i].counted && cycles[i].pct != null && cycles[i].pct >= 0.8) streak++; else break; }
  return { total, dayN, cur, started, cycles, streak, daysToStart: started ? 0 : diffDays(Q1.start, today), pct: dayN / total };
}

// ── Where you start (frozen from the Garmin snapshot of 28 Oct 2026) vs now ─────────────────────
export const BASELINE = { date: '2026-10-28', vo2max: 51.8, rhr: 45, hrv: 85, p5k: 1310, p10k: 2754, phm: 6119, pm: 13340, longestRun: 35, peakWeekKm: 70 };

export function nowStats(g) {
  if (!g) return null;
  const last = (arr) => arr?.[arr.length - 1];
  const hrv = g.hrv.slice(-7).map((x) => x.last).filter(Boolean);
  const sleep = g.sleep.slice(-7);
  return {
    vo2max: last(g.vo2max)?.v ?? g.profile?.vo2max, rhr: last(sleep)?.rhr ?? g.profile?.rhr,
    hrv: hrv.length ? hrv.reduce((a, b) => a + b, 0) / hrv.length : null,
    p5k: g.profile?.predictions?.['5K'], p10k: g.profile?.predictions?.['10K'],
  };
}

// ── Achievements ────────────────────────────────────────────────────────────────────────────────
export function achievements(prog, plan, g, log, cpResults, lifts) {
  const swims = (g?.activities || []).filter((a) => a.s === 'swim' && a.d >= Q1.start && a.d <= Q1.end).length;
  const strengthLogs = log.filter((l) => l.lifts && Object.keys(l.lifts).length).length;
  const liftUp = Object.entries(lifts || {}).some(([, v]) => v.kg > 0 && v.reps > 0);
  const done = prog.cycles.filter((w) => w.counted && w.pct >= 0.85).length;
  const heavy = prog.cycles.slice(4, 9).filter((w) => w.counted && w.pct >= 0.8).length;
  const raceLogged = log.some((l) => /Mažeikiai/i.test(l.title || '') && l.status !== 'skipped');
  return [
    { id: 'soft', icon: '1', name: 'Soft landing', how: 'Finish the first 10 days with 80% of sessions done', earned: !!(prog.cycles[0].counted && prog.cycles[0].pct >= 0.8) },
    { id: 'streak3', icon: '3', name: 'Three solid cycles', how: 'Three 10-day cycles in a row at 80% or more', earned: prog.streak >= 3 },
    { id: 'strength', icon: 'S', name: 'First load logged', how: 'Log weights and reps for a strength session', earned: strengthLogs >= 1 },
    { id: 'stronger', icon: '↑', name: 'Stronger', how: 'Log a strength session at a heavier load than the app suggested', earned: liftUp && strengthLogs >= 3 },
    { id: 'swimback', icon: '≈', name: 'Swim is back', how: 'Six swims in the quarter', earned: swims >= 6 },
    { id: 'test1', icon: 'T1', name: 'Test day one', how: 'Enter Checkpoint 1 results', earned: !!cpResults?.[1] },
    { id: 'test2', icon: 'T2', name: 'Test day two', how: 'Enter the 5K time trial', earned: !!cpResults?.[2] },
    { id: 'speed', icon: '⚡', name: 'Speed block', how: 'Three of the four speed cycles (Dec to Feb) at 80% or more', earned: heavy >= 3 },
    { id: 'consistent', icon: '10', name: 'Seven good cycles', how: 'Seven of the ten cycles at 85% or more', earned: done >= 7 },
    { id: 'race', icon: '10K', name: 'Race done', how: 'Log the Mažeikiai 10K', earned: raceLogged },
  ];
}

/** Was this planned session done? Matches a Garmin activity of the same sport on the day, or a log entry for it. */
export function isDone(g, log, s) {
  if (!s || s.group === 'rest') return false;
  if (log.some((l) => l.sessionId === s.id && l.status !== 'skipped')) return true;
  const sp = s.group === 'brick' ? ['bike', 'run'] : [s.group === 'checkpoint' || s.group === 'race' ? s.sport : s.group];
  return (g?.activities || []).some((a) => a.d === s.date && sp.includes(a.s));
}
