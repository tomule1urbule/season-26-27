// Adaptive coaching engine – turns Garmin readings into a decision for a planned session.
//
// Rules (from the brief):
//   GREEN   readiness > 75 AND HRV balanced AND sleep > 80            → do the session as planned
//   YELLOW  readiness 50–74, or HRV slightly low                      → keep volume, drop intensity
//   RED     readiness < 50, HRV unbalanced/poor, sleep < 60,
//           or acute:chronic load ratio > 1.4                         → Recovery Protocol
//   OVERREACH  ACWR above safe range → trim the next 7 days by 15–20 %
// Anything that is neither clearly red nor green (e.g. readiness 80 but sleep 70) is treated as yellow.
// Hard thresholds are exported so the UI can show the rule table.


export const RULES = {
  greenReadiness: 75, redReadiness: 50, greenSleep: 80, redSleep: 60, redAcwr: 1.4, cautionAcwr: 1.3,
  trimMild: 0.15, trimStrong: 0.2, trimStrongAcwr: 1.5,
};

const HRV_RED = ['UNBALANCED', 'POOR'];
const HRV_YELLOW = ['LOW'];

/** metrics: { readiness?, hrvStatus?, hrvLast?, hrvWeekly?, sleepScore?, acwr?, acute?, optimalMax? } */
export function classify(m, opts = {}) {
  if (!m) return { level: 'unknown', reasons: ['No Garmin data for this day.'], trim: 0, confidence: 'none' };
  const reasons = [];
  const red = [];
  const yellow = [];
  const have = (v) => v !== undefined && v !== null && !Number.isNaN(v);

  if (have(m.readiness)) {
    if (m.readiness < RULES.redReadiness) red.push(`Training readiness ${m.readiness} (< ${RULES.redReadiness})`);
    else if (m.readiness <= RULES.greenReadiness) yellow.push(`Training readiness ${m.readiness} (50–75 = moderate)`);
  }
  if (m.hrvStatus) {
    if (HRV_RED.includes(m.hrvStatus)) red.push(`HRV status ${m.hrvStatus.toLowerCase()}`);
    else if (HRV_YELLOW.includes(m.hrvStatus)) yellow.push('HRV status low');
  }
  if (have(m.hrvLast) && have(m.hrvWeekly) && m.hrvStatus === 'BALANCED' && m.hrvLast < 0.8 * m.hrvWeekly) {
    yellow.push(`Last night’s HRV ${m.hrvLast} ms is >20 % below your 7-day average (${m.hrvWeekly} ms)`);
  }
  if (have(m.sleepScore)) {
    if (m.sleepScore < RULES.redSleep) red.push(`Sleep score ${m.sleepScore} (< ${RULES.redSleep})`);
    else if (m.sleepScore <= RULES.greenSleep) yellow.push(`Sleep score ${m.sleepScore} (60–80)`);
  }
  if (have(m.acwr)) {
    if (m.acwr > RULES.redAcwr) red.push(`Acute:chronic load ${m.acwr.toFixed(2)} (> ${RULES.redAcwr})`);
    else if (m.acwr > RULES.cautionAcwr) yellow.push(`Acute:chronic load ${m.acwr.toFixed(2)} is rising (> ${RULES.cautionAcwr})`);
  }

  let trim = 0;
  if (have(m.acwr) && m.acwr > RULES.trimStrongAcwr) trim = RULES.trimStrong;
  else if (have(m.acwr) && m.acwr > RULES.redAcwr) trim = RULES.trimMild;
  if (have(m.acute) && have(m.optimalMax) && m.acute > m.optimalMax) trim = Math.max(trim, RULES.trimMild);

  const complete = (have(m.readiness) || opts.readinessOptional) && m.hrvStatus && have(m.sleepScore);
  const green = complete && !red.length && !yellow.length;
  let level = red.length ? 'red' : green ? 'green' : 'yellow';
  if (!complete && !red.length && !yellow.length) { level = 'yellow'; yellow.push('Some Garmin readings are missing, so “green” cannot be confirmed.'); }
  reasons.push(...(red.length ? red : yellow));
  if (level === 'green') reasons.push(`Readiness ${m.readiness}, HRV ${m.hrvStatus.toLowerCase()}, sleep ${m.sleepScore}`);
  return { level, reasons, trim, confidence: complete ? 'full' : 'partial' };
}

const isHard = (s) => ['key', 'long', 'test'].includes(s.kind) || ['vo2', 'thr', 'tempo', 'steady'].includes(s.intensity);

const scale = (s, f) => ({ ...s, minutes: Math.round(s.minutes * f), tss: Math.round(s.tss * f), km: s.km ? Math.round(s.km * f * 10) / 10 : s.km, meters: s.meters ? Math.round((s.meters * f) / 50) * 50 : s.meters });

/** Apply the weekly trim to a future session. Races, tests and rest are never trimmed. */
export function applyTrim(s, trim) {
  if (!trim || ['rest', 'race', 'checkpoint'].includes(s.group)) return s;
  return { ...scale(s, 1 - trim), trimmed: Math.round(trim * 100) };
}

function recoveryOptions(s, m, level) {
  const deep = (m?.readiness != null && m.readiness < 35) || (m?.sleepScore != null && m.sleepScore < 50);
  const spin = { group: 'rest', sport: 'rest', kind: 'recovery', intensity: 'rec', title: 'Recovery spin · 30′ (Z1)', minutes: 30, tss: 13, target: 'HR below 125 · RPE 1–2', warmup: '', main: 'Easy indoor spin, high cadence, light gear.', cooldown: '' };
  const mob = { group: 'rest', sport: 'rest', kind: 'recovery', intensity: 'rec', title: 'Mobility & core · 20′', minutes: 20, tss: 5, target: 'RPE 1–2', warmup: '', main: 'Hips, hamstrings, calves, thoracic spine; dead bug and side plank.', cooldown: '' };
  const rest = { group: 'rest', sport: 'rest', kind: 'rest', intensity: 'rest', title: 'Extra rest day', minutes: 0, tss: 0, target: '', warmup: '', main: 'Nothing scheduled. Sleep, food, walk if it feels good.', cooldown: '' };
  const primary = deep ? rest : ['run', 'bike', 'brick'].includes(s.sport) ? spin : ['swim', 'strength'].includes(s.sport) ? mob : rest;
  return { primary, options: [rest, spin, mob] };
}

/**
 * Decide what to do with one planned session.
 * Returns { status, session, original, headline, why[], options? }
 *   status: 'asPlanned' | 'modified' | 'recovery' | 'deferred' | 'info'
 */
export function adaptSession(s, decision, m) {
  const base = { original: s, why: decision.reasons, level: decision.level };
  if (s.group === 'rest') return { ...base, status: 'asPlanned', session: s, headline: 'rest as planned' };
  if (decision.level === 'unknown') return { ...base, status: 'info', session: s, headline: 'run the session as planned and adjust by feel' };
  if (decision.level === 'green') return { ...base, status: 'asPlanned', session: s, headline: 'do it as planned' };

  if (s.group === 'race') {
    return { ...base, status: 'info', session: s, headline: decision.level === 'red'
      ? 'the race stays on, but check how you feel. If you are ill, skipping is a valid call.'
      : 'the race stays on. Keep the warm-up gentle and trust the taper.' };
  }
  if (s.group === 'checkpoint') {
    return { ...base, status: 'deferred', session: s, headline: `${decision.level === 'red' ? 'postpone' : 'defer'} the test by up to 48 h`,
      options: [{ title: 'Easy 30–40′ in Z1–Z2 today, retest in 24–48 h' }, { title: 'Full rest today, retest when readiness is above 75' }] };
  }
  if (decision.level === 'yellow') {
    if (s.group === 'strength') {
      return { ...base, status: 'modified', headline: 'same session, lighter', session: { ...s, title: s.title + ' (−10 % load)', main: s.main, target: 'Stop every set with 3+ reps in reserve · drop the last set of each lift · no plyometrics', tss: Math.round(s.tss * 0.8) } };
    }
    if (isHard(s)) {
      const sport = s.sport === 'brick' ? 'bike' : s.sport;
      const label = { run: 'Steady Z2 run', bike: 'Steady Z2 ride', swim: 'Easy technique swim' }[sport] || 'Steady easy session';
      const conv = { ...s, kind: 'easy', intensity: 'z2', group: s.group === 'brick' ? 'bike' : s.group, title: `${label} · ${s.km ? s.km + ' km' : s.minutes + '′'} (converted)`,
        main: sport === 'swim' ? 'Drills and relaxed swimming only – no intervals or CSS sets.' : `Same duration as planned, held at Z2. Drop every interval, tempo block and pace segment.`,
        target: sport === 'run' ? `HR ${s.target?.includes('HR') ? '138–150' : '138–150'} (Z2) · conversational` : 'RPE 3–4 · Z2', warmup: s.warmup, cooldown: s.cooldown, tss: Math.round((s.minutes / 60) * 45), converted: true };
      return { ...base, status: 'modified', headline: 'keep the volume, drop the intensity', session: conv };
    }
    return { ...base, status: 'modified', headline: 'easy session, keep it easy', session: { ...s, target: s.target + ' · skip strides/surges, cap at top of Z2' } };
  }
  // red
  const { primary, options } = recoveryOptions(s, m, 'red');
  return { ...base, status: 'recovery', headline: 'Recovery Protocol replaces today’s session', session: primary, options };
}

/** Auto-suggest a 7- or 10-day microcycle from recent Garmin days (+ a manual life-load flag). */
export function microcycleAdvice(history, lifeLoadHigh = false) {
  const recent = history.slice(-7);
  if (recent.length < 3 && !lifeLoadHigh) return { recommend: 7, reasons: [], thin: true };
  const bad = recent.filter((d) => d.level === 'red' || d.level === 'yellow').length;
  const red = recent.filter((d) => d.level === 'red').length;
  const reasons = [];
  if (red >= 2) reasons.push(`${red} red days in the last 7`);
  if (bad >= 4) reasons.push(`${bad} of the last ${recent.length} days were yellow or red`);
  const sleeps = recent.map((d) => d.sleepHours).filter((x) => x != null);
  if (sleeps.length >= 5) { const avg = sleeps.reduce((a, b) => a + b, 0) / sleeps.length; if (avg < 6.5) reasons.push(`average sleep ${avg.toFixed(1)} h`); }
  if (lifeLoadHigh) reasons.push('you flagged a high life load');
  return { recommend: reasons.length ? 10 : 7, reasons };
}
