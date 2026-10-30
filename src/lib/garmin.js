// Garmin data hook.
//
// The app reads one JSON file (public/data/garmin.json, schema documented in README.md). Three ways to keep it fresh:
//   1. Ask Claude (with the Garmin connector) to "refresh Garmin data" – it rewrites the file.
//   2. Run your own sync script that writes the same schema (e.g. from python-garminconnect).
//   3. No sync at all: type this morning’s numbers into the “Quick entry” box – the engine uses them for that day.
// Nothing in the UI depends on how the file was produced.

import { ATHLETE } from './config.js';
import { classify } from './adapt.js';

export async function loadGarmin() {
  try {
    const res = await fetch(`data/garmin.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, error: String(e), data: null };
  }
}

const by = (arr, d) => (arr || []).find((x) => x.d === d);

/** Metrics the engine needs for one calendar date, or null if Garmin has nothing for it. */
export function metricsForDate(g, date, manual) {
  const m = {};
  if (g) {
    const r = g.readiness;
    if (r && r.date === date) Object.assign(m, { readiness: r.score, recoveryHours: r.recoveryHours, readinessLevel: r.level, readinessFeedback: r.feedback });
    const h = by(g.hrv, date); if (h) Object.assign(m, { hrvStatus: h.status, hrvLast: h.last, hrvWeekly: h.weekly });
    const s = by(g.sleep, date); if (s) Object.assign(m, { sleepScore: s.score, sleepHours: s.hours, rhr: s.rhr });
    const l = by(g.load, date);
    if (l) Object.assign(m, { acute: l.atl, chronic: l.ctl, acwr: l.ctl ? l.atl / l.ctl : undefined, optimalMax: g.optimalChronic?.max });
  }
  if (manual) {
    for (const k of ['readiness', 'sleepScore', 'hrvStatus', 'acwr']) if (manual[k] !== '' && manual[k] != null) m[k] = k === 'hrvStatus' ? manual[k] : Number(manual[k]);
    m.manual = true;
  }
  return Object.keys(m).length ? m : null;
}

/** Day-by-day level history (readiness is only known for the latest day, so it is optional here). */
export function levelHistory(g) {
  if (!g) return [];
  return g.load.map((l) => {
    const m = metricsForDate(g, l.d);
    const c = classify(m, { readinessOptional: true });
    return { d: l.d, level: c.level, sleepHours: m?.sleepHours, acwr: m?.acwr, reasons: c.reasons };
  });
}

// Heart-rate based stress score (hrTSS-style): hours × IF² × 100, IF = (avgHR − restHR) / (LTHR − restHR).
export function activityTss(a) {
  if (a.s === 'strength') return Math.round((a.min / 60) * 30);
  if (a.s === 'walk') return Math.round((a.min / 60) * 15);
  const rest = ATHLETE.restHrActual, lthr = ATHLETE.lthr;
  const IF = a.hr ? Math.min(1.1, Math.max(0.4, (a.hr - rest) / (lthr - rest))) : 0.7;
  return Math.round((a.min / 60) * IF * IF * 100);
}

export const activitiesOn = (g, d) => (g?.activities || []).filter((a) => a.d === d);

export function weeklyActuals(g, mondayOf) {
  const out = {};
  for (const a of g?.activities || []) {
    const w = mondayOf(a.d);
    out[w] ||= { week: w, minutes: 0, tss: 0, runKm: 0, bySport: { run: 0, bike: 0, swim: 0, strength: 0 } };
    const grp = a.s === 'walk' ? null : a.s;
    out[w].minutes += a.min; out[w].tss += activityTss(a);
    if (a.s === 'run') out[w].runKm += a.km || 0;
    if (grp && grp in out[w].bySport) out[w].bySport[grp] += a.min;
  }
  return out;
}

/** Actuals per window of `len` days, keyed by each window's start date (used for the 10-day cycles). */
export function windowActuals(g, startOf) {
  const out = {};
  for (const a of g?.activities || []) {
    const w = startOf(a.d); if (!w) continue;
    out[w] ||= { week: w, minutes: 0, tss: 0, runKm: 0, bySport: { run: 0, bike: 0, swim: 0, strength: 0 } };
    const grp = a.s === 'walk' ? null : a.s;
    out[w].minutes += a.min; out[w].tss += activityTss(a);
    if (a.s === 'run') out[w].runKm += a.km || 0;
    if (grp && grp in out[w].bySport) out[w].bySport[grp] += a.min;
  }
  return out;
}
