// Quarter 1 focus. The app shows only 16 Nov 2026 – 16 Feb 2027 (foundation + 10K block) until you unlock the rest.
// The generator still builds the whole season underneath so paces, tests and later quarters stay consistent.

import { addDays, diffDays, mondayOf, range } from './dates.js';
import { activityTss } from './garmin.js';

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

// ── Week by week coach briefs (Mondays from 16 Nov) ─────────────────────────────────────────────
export const WEEKS = [
  { title: 'Land softly', mission: 'Recover from Larnaka. No hard efforts at all.',
    why: 'Running economy and stride mechanics are impaired after a marathon (Kyröläinen 2000), so the plan uses walking, run/walk and swimming.',
    win: ['Sleep 7.5 h or more on most nights', 'Every run is a run/walk and ends feeling good', 'No pain that lasts beyond 2 days'],
    watch: 'Sharp or one-sided pain. Soreness for more than five days. Both mean see a physio, not push on.' },
  { title: 'First easy miles', mission: 'Three short easy runs, the swim comes back, the lifts start.',
    why: 'Easy running is where most of the adaptation comes from (Seiler 2010). The strength base block starts so the heavy block in January sits on tendons that are ready.',
    win: ['Three easy runs, none above 150 bpm', 'One swim: feel the water again', 'Both strength sessions, logged'],
    watch: 'Doing too much because the legs feel good. Fresh legs after rest are a trap.' },
  { title: 'Build the habit', mission: 'The weekly shape is set: Mon run, Tue swim, Wed run and lifts, Thu swim and lifts, Fri run, Sun long.',
    why: 'Consistency beats single heroic weeks. Strides begin: 20-second relaxed accelerations to keep speed alive at almost no fatigue cost.',
    win: ['All sessions in the week done', 'Long run 11 km, relaxed', 'Strength loads logged for the first time'],
    watch: 'Strength on Wednesday evening: six hours after the run, not straight after it (Robineau 2016).' },
  { title: 'Aerobic base grows', mission: 'About 28 km of easy running, the longest run yet, swim endurance begins.',
    why: 'Volume rises, intensity stays low, and the plan keeps weekly jumps under 30% (Nielsen 2014).',
    win: ['28 km of running with every heart rate under 150', '400 m continuous swim', 'Long run 13 km with no stiffness the next day'],
    watch: 'Heart rate creeping up at the same pace across the week. That is the early fatigue signal.' },
  { title: 'Absorb', mission: 'A lighter week on purpose.',
    why: 'Adaptation happens during recovery. A down week after three build weeks is standard practice, although direct trial evidence for the exact pattern is thin.',
    win: ['You feel hungry for next week', 'Sleep stays above 80', 'Strength continues, one set fewer'],
    watch: 'Adding "just a bit extra". The point of the week is to arrive at the next one fresher.' },
  { title: 'Christmas rhythm', mission: 'Keep training around family time. 24 and 25 Dec are rest days by design.',
    why: 'Life load affects recovery. The plan places the long run on Saturday 26 Dec, because Monday 28 Dec is Checkpoint 1.',
    win: ['Long run done on Saturday 26 Dec', 'Two full rest days enjoyed without guilt', 'Swim and strength done on schedule'],
    watch: 'Eating and sleeping off-pattern before the tests on Monday 28 Dec.' },
  { title: 'Checkpoint 1', mission: 'Monday 28 Dec: swim CSS test and the bike FTP test. Everything else this week is easy.',
    why: 'Tests replace guessing: your swim pace and bike FTP are recalculated from them and every later session adapts.',
    win: ['Swim 400 m and 200 m time trials', 'Bike 20-minute test (if a power source is available)', 'Results entered on the Progress tab'],
    watch: 'Testing while ill or after a bad night: defer 48 hours, that is allowed.' },
  { title: 'Speed arrives', mission: '6×400 m on Wednesday. Heavy strength block starts. Hard day count rises to two.',
    why: 'Fast repetitions with long recoveries train speed and economy at low fatigue cost (Barnes and Kilding 2015). Heavy lifting (5–7 reps) improves running economy (Rønnestad and Mujika 2014).',
    win: ['400s run at even pace', 'Heavy lifts: 3 sets of 5–7 with 2 reps left', 'Easy days stay easy'],
    watch: 'Running the easy days faster because the speed day felt good.' },
  { title: 'VO₂max', mission: '5×800 m at 5K pace. This is the first real quality week.',
    why: 'Repetitions of about 3 minutes at 5K pace with equal recovery spend the most time near maximal oxygen uptake (Buchheit and Laursen 2013).',
    win: ['5×800 m within 3 seconds of each other', 'Long run 15 km with 3 km progressive', 'Heart rate recovers between reps'],
    watch: 'Starting the first rep too fast. Rep 5 pays for it.' },
  { title: 'Longer reps', mission: '5×1000 m, the biggest speed session of the quarter. The long run is only a 5 km shakeout because Checkpoint 2 is on Monday.',
    why: 'Longer reps at 5K pace extend time near VO₂max and build the strength to hold pace.',
    win: ['5×1000 m on pace', 'Strength loads up from last week', 'Sunday shakeout stays relaxed so Monday’s test is fresh'],
    watch: 'Stacking fatigue: if the review says hold, trust it.' },
  { title: 'Checkpoint 2', mission: 'Monday 25 Jan: 5K time trial. A threshold session replaces the hard Wednesday. Easier week.',
    why: 'The 5K time trial sets your 10K target and re-scales every pace in the rest of the programme.',
    win: ['5K time trial with even splits', 'Result entered on the Progress tab', 'Threshold 3×8 minutes controlled'],
    watch: 'Using the 5K as a race. It is a measurement; run the pace you can hold evenly.' },
  { title: '10K pace', mission: '4×1600 m at goal 10K pace. The dress rehearsal for race rhythm.',
    why: 'Training at goal pace builds specificity: the movement, the breathing and the feel of the target effort.',
    win: ['4×1600 m at target, last rep equal to the first', 'Long run 15 km with 3 km at half-marathon pace', 'Sleep above 80 most nights'],
    watch: 'Chasing a faster pace than the Checkpoint 2 result supports.' },
  { title: 'Sharpen', mission: 'Volume drops, intensity stays: 5×600 m, a short long run, lifts at maintenance.',
    why: 'Tapering for about two weeks with volume cut and intensity kept is the best-supported way to arrive fresh (Bosquet 2007).',
    win: ['5×600 m crisp', 'Long run 10 km easy', 'You feel restless; that is the right sign'],
    watch: 'Adding workouts to feel less nervous. Do not.' },
  { title: 'Race week', mission: 'Monday easy run, Tuesday 16 Feb: Mažeikiai Bėga 10K.',
    why: 'Intensity is kept in short strides only; the legs should be fresh and slightly impatient.',
    win: ['Gentle shakeout and 4 strides on Monday', 'Pre-race routine as rehearsed', 'Race executed with a controlled first 3 km'],
    watch: 'Going out too fast. The first 3 km at target pace or slightly slower.' },
];

export const weekIndex = (date) => Math.floor(diffDays(mondayOf(date), Q1.start) / 7);
export const weekStart = (i) => addDays(Q1.start, i * 7);

// ── Progress against the plan ───────────────────────────────────────────────────────────────────
const SPORT = { run: ['run'], bike: ['bike'], swim: ['swim'], strength: ['strength'], brick: ['bike', 'run'], checkpoint: [], race: ['run'] };
const sportOf = (s) => (s.group === 'checkpoint' || s.group === 'race' ? s.sport : s.group);

/** Which planned sessions of a week were done: matched by sport against Garmin activities (and your log) in that week. */
export function weekCompletion(plan, g, log, weekIdx) {
  const a = weekStart(weekIdx), b = addDays(a, 6);
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
  const cur = Math.max(0, Math.min(WEEKS.length - 1, weekIndex(today)));
  const started = today >= Q1.start;
  const asOf = g?.meta?.asOf?.slice(0, 10);
  const weeks = WEEKS.map((w, i) => {
    const c = weekCompletion(plan, g, log, i);
    const over = addDays(c.start, 6) < today;
    const known = asOf && addDays(c.start, 6) <= asOf;
    return { ...w, i, ...c, state: !started ? 'future' : i === cur ? 'current' : over ? 'past' : 'future', counted: over && known };
  });
  let streak = 0;
  for (let i = cur - 1; i >= 0; i--) { if (weeks[i].counted && weeks[i].pct != null && weeks[i].pct >= 0.8) streak++; else break; }
  return { total, dayN, cur, started, weeks, streak, daysToStart: started ? 0 : diffDays(Q1.start, today), pct: dayN / total };
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
  const done = prog.weeks.filter((w) => w.counted && w.pct >= 0.85).length;
  const heavy = prog.weeks.slice(7, 13).filter((w) => w.counted && w.pct >= 0.8).length;
  const raceLogged = log.some((l) => /Mažeikiai/i.test(l.title || '') && l.status !== 'skipped');
  return [
    { id: 'soft', icon: '1', name: 'Soft landing', how: 'Finish week 1 with 80% of sessions done', earned: !!(prog.weeks[0].counted && prog.weeks[0].pct >= 0.8) },
    { id: 'streak3', icon: '3', name: 'Three solid weeks', how: 'Three weeks in a row at 80% or more', earned: prog.streak >= 3 },
    { id: 'strength', icon: 'S', name: 'First load logged', how: 'Log weights and reps for a strength session', earned: strengthLogs >= 1 },
    { id: 'stronger', icon: '↑', name: 'Stronger', how: 'Log a strength session at a heavier load than the app suggested', earned: liftUp && strengthLogs >= 3 },
    { id: 'swimback', icon: '≈', name: 'Swim is back', how: 'Six swims in the quarter', earned: swims >= 6 },
    { id: 'test1', icon: 'T1', name: 'Test day one', how: 'Enter Checkpoint 1 results', earned: !!cpResults?.[1] },
    { id: 'test2', icon: 'T2', name: 'Test day two', how: 'Enter the 5K time trial', earned: !!cpResults?.[2] },
    { id: 'speed', icon: '⚡', name: 'Speed block', how: 'Four of the six speed weeks at 80% or more', earned: heavy >= 4 },
    { id: 'consistent', icon: '10', name: 'Ten good weeks', how: 'Ten weeks at 85% or more', earned: done >= 10 },
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
