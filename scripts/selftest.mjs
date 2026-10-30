// Sanity checks for the plan generator and adaptive engine. Run: npm test
import { generatePlan, weeklySummary, cycleSummary, dayTotals } from '../src/lib/plan.js';
import { classify, adaptSession, applyTrim, RULES } from '../src/lib/adapt.js';
import { recalibrate } from '../src/lib/zones.js';
import { addDays, dow, mondayOf, range, diffDays } from '../src/lib/dates.js';
import { metricsForDate, levelHistory } from '../src/lib/garmin.js';
import { weeklyReview, applyReview } from '../src/lib/coach.js';
import { suggestLoad, resolveSession, LIB, liftsFromLog, DB_CAP_KG } from '../src/lib/strength.js';
import { WHY, REFS } from '../src/lib/evidence.js';
import { intensityMix, isHardSession } from '../src/lib/plan.js';
import { truncatePlan, CYCLE_COUNT, cycleBrief, Q1, quarterProgress, isUnlocked } from '../src/lib/quarter.js';
import { sessionBrief } from '../src/lib/brief.js';
import { readFileSync } from 'node:fs';

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.error('FAIL:', msg); } };
const plan = generatePlan();
const g = JSON.parse(readFileSync(new URL('../public/data/garmin.json', import.meta.url)));

// 1. Every day from season start to the fall marathon has at least one session
const all = range(plan.start, plan.end);
ok(all.every((d) => plan.days[d]?.sessions.length), 'every day has a session');
console.log(`days: ${all.length}, sessions: ${all.reduce((a, d) => a + plan.days[d].sessions.length, 0)}`);

// 2. Races & checkpoints on the right dates, with the right group
for (const r of plan.races.filter((r) => r.id !== 'larnaka')) ok(plan.days[r.date].sessions[0].group === 'race', `race on ${r.date}`);
for (const c of plan.checkpoints) ok(plan.days[c.date].sessions[0].group === 'checkpoint', `checkpoint ${c.id} on ${c.date}`);
ok(plan.days['2026-12-28'].sessions.length === 1 && plan.days['2026-12-29'].sessions[0].sport === 'bike' && plan.days['2026-12-29'].sessions.length === 1, 'CP1: swim test on the 28th, bike test alone on the 29th');
const multi = Object.keys(plan.days).filter((d) => plan.days[d].sessions.filter((s) => s.group !== 'rest').length > 1);
ok(multi.length === 0, 'never more than one session a day: ' + multi.slice(0, 5).join(', '));
console.log('checkpoints:', plan.checkpoints.map((c) => `${c.id}:${c.date}(${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][dow(c.date)]})`).join(' '));

// 3. Day before a race/checkpoint carries no key/long/test/strength
for (const e of [...plan.races, ...plan.checkpoints]) {
  const prev = plan.days[addDays(e.date, -1)];
  if (!prev) continue;
  ok(prev.sessions.every((s) => !['key', 'long', 'test'].includes(s.kind) && s.group !== 'strength'), `eve of ${e.date} is easy: ${prev.sessions.map((s) => s.title).join(' | ')}`);
}

// 4. The plan runs in 10-day cycles. Every complete cycle has at least 2 rest/recovery days and at most 8 sessions
const cyc = cycleSummary(plan);
const full = cyc.filter((c) => c.complete);
ok(full.every((c) => c.restDays >= 2), 'cycles with fewer than 2 rest days: ' + full.filter((c) => c.restDays < 2).map((c) => c.start).join(', '));
console.log('cycles:', cyc.length, '| hours per cycle (first 8):', cyc.slice(0, 8).map((w) => (w.minutes / 60).toFixed(1)).join(' '), '| peak', Math.max(...cyc.map((w) => w.minutes / 60)).toFixed(1));
console.log('run km per cycle peak:', Math.max(...cyc.map((w) => w.runKm)).toFixed(0));

// 5. Cycle-over-cycle run volume jumps (>30 %) – informational
const jumps = cyc.slice(1).map((w, i) => ({ w: w.start, up: cyc[i].runKm ? (w.runKm - cyc[i].runKm) / cyc[i].runKm : 0 })).filter((x) => x.up > 0.3);
console.log('run-km jumps >30 %:', jumps.map((j) => `${j.w} +${Math.round(j.up * 100)}%`).join(', ') || 'none');

// 6. Swim count per week (non-transition weeks)
const evDates = [...plan.races, ...plan.checkpoints].map((e) => e.date);
const calm = cyc.filter((c) => c.complete && !evDates.some((e) => e >= c.start && e <= c.end));
const swims = calm.filter((w) => w.bySport.swim > 0).length;
console.log(`calm cycles with swimming: ${swims}/${calm.length}`);
ok(swims === calm.length, 'every cycle without a race or test has a swim');

// 7. Adaptive rules
const cases = [
  [{ readiness: 80, hrvStatus: 'BALANCED', sleepScore: 85, acwr: 1.0 }, 'green'],
  [{ readiness: 56, hrvStatus: 'BALANCED', sleepScore: 85, acwr: 1.09 }, 'yellow'],
  [{ readiness: 80, hrvStatus: 'BALANCED', sleepScore: 70, acwr: 1.0 }, 'yellow'],
  [{ readiness: 80, hrvStatus: 'LOW', sleepScore: 85, acwr: 1.0 }, 'yellow'],
  [{ readiness: 45, hrvStatus: 'BALANCED', sleepScore: 85, acwr: 1.0 }, 'red'],
  [{ readiness: 80, hrvStatus: 'UNBALANCED', sleepScore: 85, acwr: 1.0 }, 'red'],
  [{ readiness: 80, hrvStatus: 'BALANCED', sleepScore: 55, acwr: 1.0 }, 'red'],
  [{ readiness: 80, hrvStatus: 'BALANCED', sleepScore: 85, acwr: 1.45 }, 'red'],
  [{ readiness: 80, hrvStatus: 'BALANCED', sleepScore: 85, acwr: 1.35 }, 'yellow'],
  [null, 'unknown'],
];
for (const [m, want] of cases) ok(classify(m).level === want, `classify ${JSON.stringify(m)} → ${classify(m).level}, wanted ${want}`);
ok(classify({ readiness: 80, hrvStatus: 'BALANCED', sleepScore: 85, acwr: 1.45 }).trim === RULES.trimMild, 'trim 15 % at ACWR 1.45');
ok(classify({ readiness: 80, hrvStatus: 'BALANCED', sleepScore: 85, acwr: 1.6 }).trim === RULES.trimStrong, 'trim 20 % at ACWR 1.6');

const keyDate = all.find((d) => d >= '2027-01-11' && plan.days[d].sessions[0].kind === 'key' && plan.days[d].sessions[0].sport === 'run');
const key = plan.days[keyDate].sessions[0]; // first key run after 11 Jan
ok(key.kind === 'key', 'a January key run exists: ' + key.title);
const y = adaptSession(key, classify(cases[1][0]), cases[1][0]);
ok(y.status === 'modified' && y.session.intensity === 'z2' && y.session.minutes === key.minutes, 'yellow converts key run to Z2 with the same duration');
const r = adaptSession(key, classify(cases[4][0]), cases[4][0]);
ok(r.status === 'recovery' && r.options.length === 3, 'red → recovery protocol');
const cp = plan.days['2027-01-25'].sessions[0];
ok(adaptSession(cp, classify(cases[1][0]), cases[1][0]).status === 'deferred', 'yellow defers a checkpoint');
const race = plan.days['2027-05-16'].sessions[0];
ok(adaptSession(race, classify(cases[4][0]), cases[4][0]).status === 'info', 'red never cancels a race');
const trimmed = applyTrim(key, 0.15);
ok(trimmed.minutes < key.minutes && trimmed.trimmed === 15, 'trim scales a session');
ok(applyTrim(race, 0.2) === race, 'trim never touches a race');

// 8. Garmin snapshot → today's decision is yellow (readiness 56)
const m = metricsForDate(g, '2026-10-28');
ok(classify(m).level === 'yellow', 'live snapshot is yellow: ' + JSON.stringify(classify(m)));
const hist = levelHistory(g);
const redDays = hist.filter((h) => h.level === 'red').map((h) => h.d);
console.log('history red days (ACWR>1.4 using unrounded atl/ctl):', redDays.join(', ') || 'none');

// 9. 10-day block insertion
const blk = range('2027-03-01', '2027-03-10').map((d) => plan.days[d].sessions.map((s) => s.sport).join('+'));
console.log('10-day cycle:', blk.join(' | '));
ok(all.every((d) => plan.days[d].microcycle === 10), 'every day is on the 10-day rhythm');
const p7 = generatePlan({ microcycle: 7 });
ok(p7.days['2027-03-01'].microcycle === 7, '7-day weeks still available as an option');

// 10. Recalibration
const rc = recalibrate({ 2: { t5k: '21:00' } });
ok(rc.paces.five < plan.paces.five, '5K 21:00 speeds up paces');
const pr = generatePlan({ paces: rc.paces, cfg: rc.cfg });
ok(pr.days[keyDate].sessions[0].target !== plan.days[keyDate].sessions[0].target, 'plan re-targets after recalibration');

// 11. Fall marathon date change
const p2 = generatePlan({ fallMarathon: '2027-10-03' });
ok(p2.days['2027-10-03'].sessions[0].group === 'race', 'fall race moves');
ok(p2.checkpoints[4].date === '2027-08-22', 'CP5 six weeks before: ' + p2.checkpoints[4].date);
const tss = cyc.map((w) => Math.round(w.tss));
console.log('weekly est. TSS min/median/max:', Math.min(...tss), tss.sort((a, b) => a - b)[Math.floor(tss.length / 2)], Math.max(...tss));

// 12. Evidence-based structure ─────────────────────────────────────────────────────────────────
// 12a. 80/20: hard share of endurance sessions per phase, and at most 3 hard sessions in a normal week
console.log('hard share by minutes:', intensityMix(plan).filter((x) => x.phaseId >= 1).map((m) => `${m.phaseId}:${Math.round(m.hardMinutes / m.minutes * 100)}%`).join(' '));
for (const m of intensityMix(plan).filter((x) => x.phaseId >= 1)) ok(m.share <= 0.40, `phase ${m.phaseId} hard share ${Math.round(m.share * 100)}% is above 40% (fewer, larger sessions per week now, one a day)`);
console.log('hard share by phase:', intensityMix(plan).filter((x) => x.phaseId >= 1).map((m) => `${m.phaseId}:${Math.round(m.share * 100)}%`).join(' '));
const hardPerCycle = cyc.map((c) => ({ start: c.start, n: range(c.start, c.end).reduce((t, d) => t + (plan.days[d]?.sessions || []).filter((s) => isHardSession(s) && s.group !== 'race' && s.group !== 'checkpoint').length, 0) }));
ok(hardPerCycle.every((c) => c.n <= 4), 'more than 4 hard sessions in a 10-day cycle: ' + hardPerCycle.filter((c) => c.n > 4).map((c) => c.start).join(', '));
// 12b. no hard run/long run on consecutive days
const hardRun = (d) => (plan.days[d]?.sessions || []).some((s) => s.sport === 'run' && (s.kind === 'key' || s.kind === 'long' || s.group === 'race'));
const back2back = all.filter((d) => hardRun(d) && hardRun(addDays(d, 1)));
ok(back2back.length === 0, 'hard runs on consecutive days: ' + back2back.join(', '));
// 12c. progression: no week above +35 % of the previous four weeks' maximum (after week 2); informational list of >+25 %
const wk2 = cyc.map((c) => ({ ...c, week: c.start }));
const big = wk2.map((w, i) => { const mx = Math.max(0, ...wk2.slice(Math.max(0, i - 4), i).map((x) => x.runKm)); return { w: w.week, up: mx ? w.runKm / mx - 1 : 0, i }; }).filter((x) => x.i > 2 && x.up > 0.45 && wk2[x.i].complete);
ok(big.length === 0, 'run volume jumps above +45 % of the best of the last four 10-day cycles: ' + big.map((b) => `${b.w} +${Math.round(b.up * 100)}%`).join(', '));
// 12d. Riga taper: non-race running in the last two weeks is 40-75 % below the peak week and the long run is 3 weeks out
const kmNoRace = (from, to) => range(from, to).reduce((a, d) => a + (plan.days[d]?.sessions || []).filter((s) => s.group !== 'race').reduce((t, s) => t + (s.sport === 'run' ? s.km || 0 : 0), 0), 0);
const peak = Math.max(...wk2.filter((w) => w.week >= '2027-02-17' && w.week <= '2027-05-02').map((w) => w.runKm));
const t1 = kmNoRace('2027-04-27', '2027-05-06'), t2 = kmNoRace('2027-05-07', '2027-05-16');
console.log(`Riga taper (10-day windows): peak ${Math.round(peak)} km, 20-11 days out ${Math.round(t1)} km (${Math.round((t1 / peak - 1) * 100)}%), final 10 days ${Math.round(t2)} km (${Math.round((t2 / peak - 1) * 100)}%)`);
ok((t1 + t2) / 2 <= peak * 0.6 && (t1 + t2) / 2 >= peak * 0.25, 'Riga taper averages 40-75 % below peak');
ok(t1 < peak * 0.75, 'two weeks out is already below 75 % of peak');
// 12e. strength: structured, properly named, never the day before a key/long run, upper-only in the return week
const strengthDays = all.filter((d) => plan.days[d].sessions.some((s) => s.group === 'strength'));
for (const d of strengthDays) for (const s of plan.days[d].sessions.filter((x) => x.group === 'strength')) {
  ok(Array.isArray(s.exercises) && s.exercises.length >= 4, 'strength has structured exercises ' + d);
  ok(!/^Strength [AB]$/.test(s.title) && /·/.test(s.title), 'strength has a proper name: ' + s.title);
  ok(s.why && WHY[s.why], 'strength has an evidence entry ' + d);
}
const legDay = strengthDays.filter((d) => plan.days[d].sessions.some((s) => s.strengthDay === 'S' && s.exercises.some((e) => LIB[e.id].group === 'lower')));
ok(legDay.every((d) => !hardRun(addDays(d, 1))), 'heavy leg strength is never the day before a key/long run: ' + legDay.filter((d) => hardRun(addDays(d, 1))).join(', '));
const retDate = strengthDays[0];
const ret = plan.days[retDate].sessions.find((s) => s.group === 'strength');
ok(ret && ret.exercises.every((e) => LIB[e.id].group !== 'lower'), 'return week is upper body and trunk only');
const heavyDate = strengthDays.find((d) => plan.days[d].sessions[0].block === 'heavy');
const heavyA = plan.days[heavyDate].sessions.find((s) => s.group === 'strength');
ok(heavyA.block === 'heavy' && heavyA.exercises.find((e) => e.id === 'bss').reps[1] <= 7, 'January lower body is in the heavy block (5-7 reps)');
// 12f. strength progression from the log
const base = suggestLoad({ id: 'bss', reps: [5, 7], rir: 2 }, undefined);
ok(base.kg > LIB.bss.base.kg, `heavy block asks for more than the 10 kg baseline (got ${base.kg})`);
const up = suggestLoad({ id: 'incline', reps: [8, 12], rir: 2 }, { kg: 16, reps: 12, rir: 1 });
ok(up.kg >= 16 && up.kg <= 19, `top of range with 1 in reserve raises load modestly (got ${up.kg})`);
const capped = suggestLoad({ id: 'row', reps: [6, 10], rir: 2 }, { kg: 25, reps: 12, rir: 0 });
ok(capped.kg === DB_CAP_KG && capped.atCap, 'load stops at the 25 kg dumbbell limit and says so');
const miss = suggestLoad({ id: 'bench', reps: [8, 10], rir: 2 }, { kg: 20, reps: 5, rir: 0 });
ok(miss.kg < 20, 'missing the rep range lowers the next load');
const lf = liftsFromLog([{ date: '2027-01-01', lifts: { bss: { kg: '12', reps: '8' } } }, { date: '2027-01-08', lifts: { bss: { kg: '14', reps: '7', rir: '2' } } }]);
ok(lf.bss.kg === 14 && lf.bss.rir === 2, 'latest logged set wins');
ok(resolveSession(heavyA, lf).exercises.find((e) => e.id === 'bss').last.kg === 14, 'plan reads logged loads');
// 12g. weekly coach review
const gBase = (over = {}) => ({ hrv: range('2026-10-01', '2026-10-28').map((d) => ({ d, last: 90, weekly: 88, status: 'BALANCED' })), sleep: range('2026-10-01', '2026-10-28').map((d) => ({ d, score: 85, hours: 7.5, rhr: 45 })),
  load: [{ d: '2026-10-27', atl: 600, ctl: 600 }], activities: [], ...over });
ok(weeklyReview({ plan, g: gBase(), log: [], date: '2026-10-28' }).action === 'progress', 'healthy week → progress');
const bad = gBase({ hrv: range('2026-10-01', '2026-10-28').map((d) => ({ d, last: d >= '2026-10-21' ? 70 : 90, weekly: 88, status: 'UNBALANCED' })), sleep: range('2026-10-01', '2026-10-28').map((d) => ({ d, score: d >= '2026-10-21' ? 55 : 85, hours: d >= '2026-10-21' ? 5.5 : 7.5, rhr: d >= '2026-10-21' ? 52 : 45 })) });
const rb = weeklyReview({ plan, g: bad, log: [], date: '2026-10-28' });
ok(rb.action === 'deload' && rb.factor === 0.8, `poor HRV + sleep + RHR → deload (got ${rb.action} ${rb.score})`);
const dl = applyReview(plan.days[keyDate].sessions[0], rb);
ok(dl.minutes < plan.days[keyDate].sessions[0].minutes, 'deload trims a key session');
ok(applyReview(plan.days['2027-02-16'].sessions[0], rb).group === 'race' && applyReview(plan.days['2027-02-16'].sessions[0], rb).minutes === plan.days['2027-02-16'].sessions[0].minutes, 'deload never trims a race');
console.log('review on live snapshot:', weeklyReview({ plan, g, log: [], date: '2026-10-28' }).label);
// 12h. evidence integrity
const used = new Set(); for (const d of all) for (const s of plan.days[d].sessions) if (s.why) used.add(s.why);
for (const id of used) ok(WHY[id], 'missing evidence entry: ' + id);
for (const [id, w] of Object.entries(WHY)) for (const r of w.refs) ok(REFS[r], `${id} cites unknown reference ${r}`);
console.log('evidence ids used:', [...used].sort().join(', '));
const sessionsNoWhy = new Set(); for (const d of all) for (const s of plan.days[d].sessions) if (!s.why && s.group !== 'race' && s.group !== 'rest') sessionsNoWhy.add(s.title.split(' · ')[0]);
console.log('sessions without a rationale:', [...sessionsNoWhy].join(', ') || 'none');

// 13. Quarter 1 focus
const q1 = truncatePlan(plan);
ok(q1.end === '2027-02-16' && Object.keys(q1.days).every((d) => d <= Q1.end), 'Quarter 1 view stops at the 10K');
ok(q1.races.map((r) => r.id).join() === 'larnaka,mazeikiai' || q1.races.map((r) => r.id).join() === 'mazeikiai', 'only the 10K race remains: ' + q1.races.map((r) => r.id));
ok(q1.checkpoints.length === 2, 'two checkpoints in Quarter 1');
ok(CYCLE_COUNT === 10, 'ten 10-day cycles in Quarter 1');
const briefs = Array.from({ length: CYCLE_COUNT }, (_, i) => cycleBrief(q1, i));
ok(briefs.every((b) => b.title && b.mission && b.why && b.win.length >= 2 && b.watch), 'every cycle has a complete brief');
ok(briefs.every((b) => !/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/.test(b.mission + b.watch)), 'cycle briefs do not name weekdays');
console.log(briefs.map((b, i) => `C${i + 1} ${b.title}: ${b.mission}`).join('\n'));
ok(!isUnlocked({}, '2027-02-16') && isUnlocked({}, '2027-02-17') && isUnlocked({ unlockAll: true }, '2026-10-28'), 'later quarters unlock on 17 Feb or by switch');
const qp = quarterProgress(q1, g, [], '2026-10-28');
ok(!qp.started && qp.daysToStart === 19, 'day one is 19 days away on 28 Oct');
let missing = 0; for (const d of range(Q1.start, Q1.end)) for (const s of q1.days[d].sessions) if (s.group !== 'rest' && !sessionBrief(s)) { missing++; console.error('no brief:', s.title); }
ok(missing === 0, 'every Quarter 1 session has a coach brief');

console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
