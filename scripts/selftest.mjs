// Sanity checks for the plan generator and adaptive engine. Run: npm test
import { generatePlan, weeklySummary, dayTotals } from '../src/lib/plan.js';
import { classify, adaptSession, applyTrim, RULES } from '../src/lib/adapt.js';
import { recalibrate } from '../src/lib/zones.js';
import { addDays, dow, mondayOf, range, diffDays } from '../src/lib/dates.js';
import { metricsForDate, levelHistory } from '../src/lib/garmin.js';
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
ok(plan.days['2026-12-28'].sessions.length === 2, 'CP1 has swim + bike');
console.log('checkpoints:', plan.checkpoints.map((c) => `${c.id}:${c.date}(${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][dow(c.date)]})`).join(' '));

// 3. Day before a race/checkpoint carries no key/long/test/strength
for (const e of [...plan.races, ...plan.checkpoints]) {
  const prev = plan.days[addDays(e.date, -1)];
  if (!prev) continue;
  ok(prev.sessions.every((s) => !['key', 'long', 'test'].includes(s.kind) && s.group !== 'strength'), `eve of ${e.date} is easy: ${prev.sessions.map((s) => s.title).join(' | ')}`);
}

// 4. At least one full rest day in every complete calendar week (Mon–Sun) – list weeks that fail
const weeks = weeklySummary(plan);
const noRest = weeks.filter((w) => w.restDays < 1 && diffDays(w.week, plan.start) >= 0 && diffDays(plan.end, addDays(w.week, 6)) >= 0);
ok(noRest.length === 0, 'weeks without a rest day: ' + noRest.map((w) => w.week).join(', '));
console.log('weekly hours (first 8, then peak):', weeks.slice(0, 8).map((w) => (w.minutes / 60).toFixed(1)).join(' '), '| peak', Math.max(...weeks.map((w) => w.minutes / 60)).toFixed(1));
console.log('weekly run km peak:', Math.max(...weeks.map((w) => w.runKm)).toFixed(0));

// 5. Week-over-week run volume jumps (>25 % up) – informational
const jumps = weeks.slice(1).map((w, i) => ({ w: w.week, up: weeks[i].runKm ? (w.runKm - weeks[i].runKm) / weeks[i].runKm : 0 })).filter((x) => x.up > 0.3);
console.log('run-km jumps >30 %:', jumps.map((j) => `${j.w} +${Math.round(j.up * 100)}%`).join(', ') || 'none');

// 6. Swim count per week (non-transition weeks)
const swims = weeks.map((w) => w.bySport.swim > 0).filter(Boolean).length;
console.log(`weeks with swimming: ${swims}/${weeks.length}`);

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

const key = plan.days['2027-01-13'].sessions[0]; // Wed VO2 intervals
ok(key.kind === 'key', 'Jan 13 is a key session: ' + key.title);
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
const p10 = generatePlan({ tenDay: [{ from: '2027-03-01', blocks: 1 }] });
const blk = range('2027-03-01', '2027-03-10').map((d) => p10.days[d].sessions.map((s) => s.sport).join('+'));
console.log('10-day block:', blk.join(' | '));
ok(range('2027-03-01', '2027-03-10').every((d) => p10.days[d].microcycle === 10), '10-day flag set');

// 10. Recalibration
const rc = recalibrate({ 2: { t5k: '21:00' } });
ok(rc.paces.five < plan.paces.five, '5K 21:00 speeds up paces');
const pr = generatePlan({ paces: rc.paces, cfg: rc.cfg });
ok(pr.days['2027-01-13'].sessions[0].target !== plan.days['2027-01-13'].sessions[0].target, 'plan re-targets after recalibration');

// 11. Fall marathon date change
const p2 = generatePlan({ fallMarathon: '2027-10-03' });
ok(p2.days['2027-10-03'].sessions[0].group === 'race', 'fall race moves');
ok(p2.checkpoints[4].date === '2027-08-22', 'CP5 six weeks before: ' + p2.checkpoints[4].date);
const tss = weeks.map((w) => Math.round(w.tss));
console.log('weekly est. TSS min/median/max:', Math.min(...tss), tss.sort((a, b) => a - b)[Math.floor(tss.length / 2)], Math.max(...tss));

console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
