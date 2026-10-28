// Weekly coach review: reads the last 7 days of Garmin data, the plan and your log, and decides whether the next
// 7 days progress as written, hold back, or deload.
//
// The signals and the thresholds below are coaching heuristics built on the monitoring literature (see evidence.js):
//   * HRV: a 7-day average compared with the preceding baseline, not a single morning (Plews 2013; Düking 2021)
//   * Load ratio (acute:chronic) is a prompt, not a predictor (Impellizzeri 2020)
//   * Volume: avoid sudden jumps, no fixed 10 % rule (Nielsen 2014)
// Every signal is returned with its number and a plain-language reason so you can overrule it.

import { addDays, diffDays, range } from './dates.js';
import { classify } from './adapt.js';
import { applyTrim } from './adapt.js';
import { metricsForDate } from './garmin.js';
import { HR_ZONES } from './config.js';

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : null; };
const pct = (x) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
const SOFT = 0.2; // largest increase over what you actually ran last week

export const REVIEW_RULES = {
  deloadScore: 4, holdScore: 2, deloadFactor: 0.8, holdFactor: 0.9,
  hrvDrop: 0.95, hrvBigDrop: 0.9, sleepLow: 70, sleepBad: 60, sleepHours: 6.5, acwrWarn: 1.3, acwrHigh: 1.4,
  rpeHigh: 8, complianceGood: 0.85, complianceLow: 0.6, minHrvDays: 4,
};

const runKm = (g, from, to) => (g?.activities || []).filter((a) => a.s === 'run' && a.d >= from && a.d <= to).reduce((s, a) => s + (a.km || 0), 0);
const plannedKm = (plan, from, to) => range(from, to).reduce((s, d) => s + (plan.days[d]?.sessions || []).reduce((t, x) => t + (x.sport === 'run' || x.sport === 'brick' ? x.km || 0 : 0), 0), 0);

/** Easy-run efficiency: metres per minute per heartbeat-per-minute, for runs at or below the Z2 ceiling. */
function efficiency(g, from, to) {
  const rs = (g?.activities || []).filter((a) => a.s === 'run' && a.d >= from && a.d <= to && a.hr && a.hr <= HR_ZONES[1].hi && a.km >= 4 && a.min > 0);
  if (rs.length < 2) return null;
  return mean(rs.map((a) => ((a.km * 1000) / a.min) / a.hr));
}

export function weeklyReview({ plan, g, log = [], date }) {
  const from = addDays(date, -7), to = addDays(date, -1);
  const win = range(from, to);
  const R = REVIEW_RULES;
  const signals = [];
  let score = 0;
  const add = (label, value, state, note, pts = 0) => { signals.push({ label, value, state, note }); score += pts; };

  // HRV 7-day mean against the preceding baseline
  const hrvAll = (g?.hrv || []).filter((h) => h.d <= to);
  const hrvWin = hrvAll.filter((h) => h.d >= from).map((h) => h.last).filter(Boolean);
  const hrvPrev = hrvAll.filter((h) => h.d < from).slice(-14).map((h) => h.last).filter(Boolean);
  let hrvTrend = null;
  if (hrvWin.length >= R.minHrvDays && hrvPrev.length >= 4) {
    hrvTrend = mean(hrvWin) / mean(hrvPrev);
    const cv = sd(hrvWin) / mean(hrvWin);
    const txt = `7-day average ${Math.round(mean(hrvWin))} ms vs ${Math.round(mean(hrvPrev))} ms before (${pct(hrvTrend - 1)}), day-to-day variation ${Math.round(cv * 100)}%`;
    if (hrvTrend < R.hrvBigDrop) add('HRV trend', pct(hrvTrend - 1), 'bad', txt, 2);
    else if (hrvTrend < R.hrvDrop || (cv > 0.15 && hrvTrend < 1)) add('HRV trend', pct(hrvTrend - 1), 'warn', txt, 1);
    else add('HRV trend', pct(hrvTrend - 1), 'good', txt);
  } else add('HRV trend', 'not enough days', 'none', 'Needs at least 4 nights in the last 7 and 4 before them.');

  // Sleep
  const sl = (g?.sleep || []).filter((x) => x.d >= from && x.d <= to);
  if (sl.length >= 4) {
    const sc = mean(sl.map((x) => x.score).filter((v) => v != null)), hrs = mean(sl.map((x) => x.hours).filter((v) => v != null));
    const txt = `average sleep score ${Math.round(sc)}, ${hrs.toFixed(1)} h a night over ${sl.length} nights`;
    if (sc < R.sleepBad) add('Sleep', `${Math.round(sc)}`, 'bad', txt, 2);
    else if (sc < R.sleepLow || hrs < R.sleepHours) add('Sleep', `${Math.round(sc)}`, 'warn', txt, 1);
    else add('Sleep', `${Math.round(sc)}`, 'good', txt);
  } else add('Sleep', 'not enough nights', 'none', 'Needs at least 4 nights in the last 7.');

  // Resting HR drift (Garmin sleep resting HR)
  const rhrs = sl.map((x) => x.rhr).filter(Boolean);
  const rhrBase = mean((g?.sleep || []).filter((x) => x.d < from).slice(-14).map((x) => x.rhr).filter(Boolean));
  if (rhrs.length >= 4 && rhrBase) {
    const d = mean(rhrs) - rhrBase;
    add('Resting HR', `${d >= 0 ? '+' : ''}${d.toFixed(1)} bpm`, d >= 5 ? 'bad' : d >= 3 ? 'warn' : 'good', `${mean(rhrs).toFixed(1)} bpm this week vs ${rhrBase.toFixed(1)} before`, d >= 5 ? 2 : d >= 3 ? 1 : 0);
  }

  // Load ratio (heuristic)
  const ld = (g?.load || []).filter((l) => l.d <= to).slice(-1)[0];
  const acwr = ld?.ctl ? ld.atl / ld.ctl : null;
  if (acwr != null && diffDays(to, ld.d) <= 3) {
    add('Load ratio', acwr.toFixed(2), acwr > R.acwrHigh ? 'bad' : acwr > R.acwrWarn ? 'warn' : 'good', `acute ${ld.atl} vs chronic ${ld.ctl}. A prompt to look at the week, not a prediction of injury.`, acwr > R.acwrHigh ? 2 : acwr > R.acwrWarn ? 1 : 0);
  }

  // Traffic-light days
  const days = win.map((d) => { const m = metricsForDate(g, d); return m ? classify(m, { readinessOptional: true }).level : null; }).filter(Boolean);
  if (days.length >= 4) {
    const red = days.filter((x) => x === 'red').length, yel = days.filter((x) => x === 'yellow').length;
    add('Traffic-light days', `${red} red · ${yel} yellow`, red >= 2 ? 'bad' : yel + red >= 4 ? 'warn' : 'good', `${days.length} days with data in the last week`, (red >= 2 ? 2 : 0) + (yel + red >= 4 ? 1 : 0));
  }

  // Your own log
  const logs = log.filter((e) => e.date >= from && e.date <= to);
  if (logs.length >= 3) {
    const rpe = mean(logs.map((e) => e.rpe)), mood = mean(logs.map((e) => e.mood));
    add('Your effort and mood', `RPE ${rpe.toFixed(1)} · mood ${mood.toFixed(1)}/4`, rpe >= R.rpeHigh || mood < 1.5 ? 'warn' : 'good', `${logs.length} logged sessions`, (rpe >= R.rpeHigh ? 1 : 0) + (mood < 1.5 ? 1 : 0));
  }

  // Compliance and the next week's size
  const pl = plannedKm(plan, from, to), ac = runKm(g, from, to);
  let compliance = null;
  if (pl >= 10 && (g?.activities || []).some((a) => a.d >= from && a.d <= to)) {
    compliance = ac / pl;
    add('Running done vs planned', `${Math.round(ac)} of ${Math.round(pl)} km`, compliance >= R.complianceGood ? 'good' : compliance >= R.complianceLow ? 'warn' : 'bad',
      compliance >= R.complianceGood ? 'You did what was planned.' : 'Less than planned. The next week is sized from what you actually ran.');
  } else if (ac > 0) add('Running last 7 days', `${Math.round(ac)} km`, 'none', 'No plan to compare yet (the programme starts 16 Nov).');

  // Easy-run efficiency trend (speed at the same heart rate)
  const e1 = efficiency(g, addDays(date, -21), to), e0 = efficiency(g, addDays(date, -42), addDays(date, -22));
  let effTrend = null;
  if (e1 && e0) {
    effTrend = e1 / e0 - 1;
    add('Easy-run efficiency', pct(effTrend), effTrend >= 0.01 ? 'good' : effTrend <= -0.03 ? 'warn' : 'none',
      `speed per heartbeat on easy runs, last 3 weeks vs the 3 before. Heat, hills and tiredness also move it, so it is only a trend.`, effTrend <= -0.03 ? 1 : 0);
  }

  // Decision
  let action = 'progress', factor = 1;
  if (score >= R.deloadScore) { action = 'deload'; factor = R.deloadFactor; }
  else if (score >= R.holdScore) { action = 'hold'; factor = R.holdFactor; }
  const reasons = [];
  // cap the coming week at +20 % on what you actually ran
  const nextPl = plannedKm(plan, date, addDays(date, 6));
  if (compliance != null && compliance < R.complianceGood && ac > 0 && nextPl > ac * (1 + SOFT)) {
    const cap = (ac * (1 + SOFT)) / nextPl;
    if (cap < factor) { factor = Math.round(cap * 100) / 100; reasons.push(`You ran ${Math.round(ac)} km last week against ${Math.round(pl)} planned. The coming week plans ${Math.round(nextPl)} km, so it is capped at +${Math.round(SOFT * 100)}% on what you actually ran.`); if (action === 'progress') action = 'hold'; }
  }
  if (action === 'deload') reasons.unshift(`Score ${score} (deload from ${R.deloadScore}): recovery signals are behind, so the next 7 days lose ${Math.round((1 - factor) * 100)}% of volume. Intensity stays where it is, which is what keeps fitness (Bosquet 2007).`);
  else if (action === 'hold') reasons.unshift(`Score ${score} (hold from ${R.holdScore}): no build this week. Easy and long runs shrink by ${Math.round((1 - factor) * 100)}%, key sessions stay.`);
  else reasons.unshift(score === 0 && signals.some((s) => s.state === 'good') ? 'Everything we can measure is in range, so the plan runs as written and strength loads move up from what you log.' : 'No recovery concerns, so the plan runs as written.');
  const thin = signals.filter((s) => s.state !== 'none').length < 2;
  if (thin) reasons.push('Few readings in this window, so the plan stays as written until more data arrives.');

  return { date, from, to, action, factor, score, signals, reasons, thin, hrvTrend, acwr, compliance, effTrend,
    label: { progress: 'Progress as planned', hold: 'Hold, do not build', deload: 'Deload this week' }[action] };
}

/** Apply a weekly review to one planned session. Hold trims easy and long volume only; deload trims everything except races and tests. */
export function applyReview(s, r) {
  if (!r || r.factor >= 1 || ['rest', 'race', 'checkpoint'].includes(s.group)) return s;
  if (r.action === 'hold' && ['key', 'test'].includes(s.kind)) return s;
  const t = applyTrim(s, 1 - r.factor);
  return s.group === 'strength' ? { ...t, lighter: r.action === 'deload' } : t;
}
