// Strength module: exercise library, block prescriptions and load progression.
//
// Starting loads are the ones recorded on your Garmin on 22 Oct (Strength A) and 15 Oct (Strength B), the same
// loads you used from 30 Sep. The load shown for any exercise is recomputed from the last set you log, using an
// Epley estimate of your one-rep max and the rep range / reps-in-reserve of the current block.
// Epley is a rough estimator (best under ~10 reps), so the app caps single-session jumps at +15 %.

export const DB_CAP_KG = 25; // adjustable dumbbells top out at 25 kg each

export const LIB = {
  bss:      { name: 'Bulgarian split squat', group: 'lower', icon: 'split', side: true, base: { kg: 10, reps: 10 }, cap: 25, unit: 'kg per hand',
              cue: 'Rear foot on a bench, torso tall, front shin near vertical. Lower for 3 seconds, drive up through the whole front foot.' },
  slrdl:    { name: 'Single-leg Romanian deadlift', group: 'lower', icon: 'hinge', side: true, base: { kg: 10, reps: 10 }, cap: 25, unit: 'kg per hand',
              cue: 'Hips back, back leg long behind you, hips level. Soft knee, feel the hamstring load, stand tall at the top.' },
  goblet:   { name: 'Goblet squat', group: 'lower', icon: 'squat', base: { kg: 16, reps: 10 }, cap: 25, unit: 'kg, one dumbbell',
              cue: 'Dumbbell at the chest, elbows inside the knees. Lower for 3 seconds to full depth, keep heels down.' },
  hipThrust:{ name: 'Hip thrust', group: 'lower', icon: 'bridge', base: { kg: 18, reps: 11 }, cap: 50, unit: 'kg total',
              cue: 'Upper back on a bench, dumbbell across the hips, chin tucked. Drive hips up until the torso is flat, squeeze for one second.' },
  incline:  { name: 'Incline dumbbell bench press', group: 'upper', icon: 'press', base: { kg: 16, reps: 11 }, cap: 25, unit: 'kg per hand',
              cue: 'Bench at 30°, wrists over elbows. Lower to the chest line and press without flaring the elbows.' },
  bench:    { name: 'Flat dumbbell bench press', group: 'upper', icon: 'press', base: { kg: 20, reps: 9 }, cap: 25, unit: 'kg per hand',
              cue: 'Shoulder blades pinched back, feet planted. Lower for 2 seconds, press up and slightly in.' },
  row:      { name: 'One-arm dumbbell row', group: 'upper', icon: 'row', side: true, base: { kg: 20, reps: 11 }, cap: 25, unit: 'kg, one hand',
              cue: 'Hand and knee on a bench, flat back. Pull the elbow to the hip, pause one second, lower under control.' },
  pullover: { name: 'Lying dumbbell pullover', group: 'upper', icon: 'pullover', base: { kg: 14, reps: 11 }, cap: 25, unit: 'kg, one dumbbell',
              cue: 'Both hands on one dumbbell, arms nearly straight. Take it behind the head until the lats stretch, bring it back over the chest.' },
  lateral:  { name: 'Dumbbell lateral raise', group: 'upper', icon: 'raise', base: { kg: 6, reps: 12 }, cap: 12, unit: 'kg per hand',
              cue: 'Soft elbows, lift to shoulder height only, lower for 2 seconds. Do not swing.' },
  triceps:  { name: 'Seated overhead triceps extension', group: 'upper', icon: 'extension', base: { kg: 18, reps: 11 }, cap: 25, unit: 'kg, one dumbbell',
              cue: 'Elbows close to the ears, lower behind the head, extend fully.' },
  curl:     { name: 'Dumbbell biceps curl', group: 'upper', icon: 'curl', base: { kg: 9, reps: 11 }, cap: 16, unit: 'kg per hand',
              cue: 'Elbows pinned to the sides, no body swing, 2-second lowering.' },
  sidePlank:{ name: 'Side plank', group: 'trunk', icon: 'plank', side: true, timed: true, base: { kg: 0, reps: 40 }, cap: 0, unit: 'seconds',
              cue: 'Elbow under the shoulder, body in a straight line, hips lifted. Breathe normally.' },
  calfSL:   { name: 'Single-leg standing calf raise', group: 'trunk', icon: 'calf', side: true, base: { kg: 22, reps: 12 }, cap: 25, unit: 'kg, one dumbbell',
              cue: 'Hold a dumbbell on the working side, fingertips on a wall. Rise slowly, pause at the top, lower for 3 seconds.' },
  calfSeat: { name: 'Seated calf raise', group: 'trunk', icon: 'calf', base: { kg: 24, reps: 12 }, cap: 50, unit: 'kg total',
              cue: 'Dumbbells on the knees, pad under the toes. Full stretch at the bottom, pause at the top.' },
};

export const GROUP_LABEL = { lower: 'Lower body', upper: 'Upper body', trunk: 'Trunk and calves' };

// The two weekly sessions. Order is the order they are done in.
export const SESSIONS = {
  S: { name: 'Full-body strength', short: 'Strength', day: 'Thursday, on its own day: three days before the Sunday long run and never next to a key session',
       ex: (variant) => ['bss', 'slrdl', 'hipThrust', 'calfSL', ...(variant ? ['bench', 'pullover'] : ['incline', 'row']), 'sidePlank'] },
  U: { name: 'Upper body and trunk', short: 'Strength', day: 'Spare day of the 10-day cycle: no leg work, so it never touches the run days around it',
       ex: (variant) => [...(variant ? ['bench', 'pullover'] : ['incline', 'row']), 'lateral', 'triceps', 'curl', 'sidePlank'] },
  A: { name: 'Strength A · Single-leg strength and upper body', short: 'Strength A', day: 'Wednesday evening, at least 6 hours after the key run',
       ex: ['bss', 'slrdl', 'incline', 'row', 'curl', 'sidePlank', 'calfSL'] },
  B: { name: 'Strength B · Hips, squat and shoulders', short: 'Strength B', day: 'Thursday, any time (no running that day)',
       ex: ['goblet', 'hipThrust', 'bench', 'pullover', 'lateral', 'triceps', 'calfSeat'] },
};

// Block prescriptions. Lower/upper/trunk each get sets, reps, reps-in-reserve, tempo (lowering-pause-lifting), rest.
export const BLOCKS = {
  return:   { label: 'Return', lower: null, upper: { sets: 2, reps: [10, 12], rir: 3, tempo: '2-0-2', rest: 60 }, trunk: { sets: 2, reps: [30, 30], rir: 3, tempo: '', rest: 45 },
              focus: 'Upper body and trunk only while the legs recover from the marathon.' },
  anat:     { label: 'Base', lower: { sets: 3, reps: [8, 10], rir: 3, tempo: '3-0-1', rest: 90 }, upper: { sets: 3, reps: [8, 12], rir: 2, tempo: '2-0-2', rest: 75 }, trunk: { sets: 3, reps: [12, 15], rir: 2, tempo: '3-0-1', rest: 60 },
              focus: 'Learn the lifts and build tendon tolerance. Add load when you hit the top of the range.' },
  heavy:    { label: 'Heavy', lower: { sets: 3, reps: [5, 7], rir: 2, tempo: '3-1-1', rest: 120 }, upper: { sets: 3, reps: [6, 10], rir: 2, tempo: '2-0-1', rest: 90 }, trunk: { sets: 3, reps: [8, 12], rir: 2, tempo: '3-1-1', rest: 75 },
              focus: 'Heavy loads, few repetitions, slow lowering. This is what improves running economy.' },
  maintain: { label: 'Maintain', lower: { sets: 2, reps: [5, 6], rir: 2, tempo: '3-1-1', rest: 120 }, upper: { sets: 2, reps: [8, 10], rir: 2, tempo: '2-0-1', rest: 75 }, trunk: { sets: 2, reps: [10, 12], rir: 2, tempo: '3-1-1', rest: 60 },
              focus: 'Keep the load, halve the sets. Strength stays, fatigue stays low.' },
  taper:    { label: 'Taper', lower: { sets: 2, reps: [5, 5], rir: 3, tempo: '2-1-1', rest: 120 }, upper: { sets: 2, reps: [8, 8], rir: 3, tempo: '2-0-1', rest: 60 }, trunk: { sets: 2, reps: [8, 10], rir: 3, tempo: '2-1-1', rest: 60 },
              focus: 'Same loads, fewer sets, finish fresh. No strength the day before a race or test.' },
};

/** Build the exercise list for a session letter and block. `deload` removes a set from every exercise. */
export function buildExercises(which, blockKey, { deload = false, variant = 0 } = {}) {
  const blk = BLOCKS[blockKey] || BLOCKS.anat;
  const list = typeof SESSIONS[which].ex === 'function' ? SESSIONS[which].ex(variant) : SESSIONS[which].ex;
  return list.map((id) => {
    const lib = LIB[id];
    const p = blk[lib.group];
    if (!p) return null;
    // Timed core holds use seconds; calves follow the trunk prescription but keep their own rep range in the heavy block.
    const reps = lib.timed ? [40, 45] : lib.icon === 'calf' && blockKey === 'anat' ? [12, 15] : p.reps;
    return { id, sets: Math.max(1, p.sets - (deload ? 1 : 0)), reps, rir: p.rir, tempo: p.tempo, rest: p.rest };
  }).filter(Boolean);
}

export const estMinutes = (exs) => Math.round(8 + exs.reduce((a, e) => a + e.sets * ((e.reps[1] >= 12 ? 40 : 30) / 60 * (LIB[e.id].side ? 2 : 1) + e.rest / 60), 0));

const epley = (kg, reps, rir) => kg * (1 + (reps + rir) / 30);
const roundKg = (x) => Math.round(x);

/**
 * Suggest the load for an exercise from its last logged set.
 * last = { kg, reps, rir?, date? } | undefined. Returns { kg, from: 'logged'|'baseline', atCap, note }.
 */
export function suggestLoad(ex, last) {
  const lib = LIB[ex.id];
  if (lib.timed) return { kg: 0, from: 'baseline', atCap: false, note: '' };
  const src = last && last.kg > 0 ? { ...last, from: 'logged' } : { ...lib.base, rir: 2, from: 'baseline' };
  const rirLast = src.rir ?? 2;
  const e1 = epley(src.kg, src.reps, rirLast);
  const target = Math.round((ex.reps[0] + ex.reps[1]) / 2);
  let kg = e1 / (1 + (target + ex.rir) / 30);
  kg = Math.min(kg, src.kg * 1.15 + 0.5);         // at most ~15 % up per step
  if (src.from === 'logged' && src.reps < ex.reps[0] - 1) kg = Math.min(kg, src.kg * 0.95); // missed the range: drop a little
  kg = Math.max(kg, lib.base.kg * 0.6);
  kg = roundKg(kg);
  const atCap = kg >= lib.cap && lib.cap > 0;
  if (atCap) kg = lib.cap;
  const note = atCap ? `At the ${lib.cap} kg limit: keep the weight, slow the lowering to 4 seconds and add a 1–2 second pause before adding reps.` : '';
  return { kg, from: src.from, atCap, note };
}

/** Attach loads to a session's exercises. lifts = { [exerciseId]: {kg, reps, rir, date} } from the log. */
export function resolveSession(s, lifts = {}) {
  if (!s.exercises) return s;
  const lighter = !!s.lighter;
  const exercises = s.exercises.map((e) => {
    const sug = suggestLoad(e, lifts[e.id]);
    const kg = lighter && sug.kg ? Math.max(1, Math.round(sug.kg * 0.9)) : sug.kg;
    return { ...e, ...sug, kg, sets: lighter ? Math.max(1, e.sets - 1) : e.sets, last: lifts[e.id] || null };
  });
  return { ...s, exercises };
}

/** Plain-text one-liner per exercise, used by lists and exports. */
export const exLine = (e) => {
  const lib = LIB[e.id];
  const reps = e.reps[0] === e.reps[1] ? e.reps[0] : `${e.reps[0]}–${e.reps[1]}`;
  const rep = lib.timed ? `${reps} s` : reps;
  return `${lib.name} ${e.sets} × ${rep}${lib.side ? ' each side' : ''}${e.kg ? ` @ ${e.kg} kg` : ''}`;
};

/** Pull the latest set per exercise out of the log. */
export function liftsFromLog(log = []) {
  const out = {};
  for (const e of [...log].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const [id, v] of Object.entries(e.lifts || {})) if (v && Number(v.kg) >= 0 && Number(v.reps) > 0) out[id] = { kg: Number(v.kg), reps: Number(v.reps), rir: v.rir === '' || v.rir == null ? undefined : Number(v.rir), date: e.date };
  }
  return out;
}
