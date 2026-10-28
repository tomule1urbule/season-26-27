// Season plan generator. Pure functions, no DOM – runs in Node (see scripts/selftest.mjs) and in the browser.
//
// generatePlan() walks every day from the programme start to the fall marathon and asks the phase
// template for that weekday's sessions, then applies date-anchored overrides (races, checkpoints,
// the day before them, the day after a race, family days).
//
// Microcycles: by default a week is 7 days (slot = weekday). A "10-day block" re-spaces the same
// sessions over 10 days with three extra active-recovery days, which lowers load density by ~30 %
// when fatigue or life demands are high (see tenDay in generatePlan).

import { addDays, diffDays, dow, mondayOf, range } from './dates.js';
import {
  SEASON, ATHLETE, HR_ZONES, TSS_PER_HOUR, makePaces, secToPace, buildPhases, buildRaces, buildCheckpoints,
  DEFAULT_FALL_MARATHON,
} from './config.js';

const Z2 = `${HR_ZONES[1].lo}–${HR_ZONES[1].hi}`;
const SEQ10 = [0, 1, 2, 'F', 3, 4, 5, 'F', 6, 'F']; // slot order inside a 10-day block ('F' = flex recovery day)
export const FAMILY_DAYS = { '2026-12-24': 'Kūčios – family day', '2026-12-25': 'Christmas – family day' };

const mk = (o) => {
  const minutes = Math.round(o.minutes || 0);
  return {
    warmup: '', main: '', cooldown: '', target: '', notes: '', kind: 'easy', intensity: 'rec', ...o, minutes,
    tss: o.tss ?? Math.round((minutes / 60) * (TSS_PER_HOUR[o.intensity || 'rec'] ?? 0)),
  };
};

const S = (r, d, what, rest) => ({ r, d, what, rest });

// ── Session builders (closed over paces + thresholds so checkpoints can recalibrate them) ─────────
export function makeBuilders(P, cfg) {
  const pc = secToPace;
  const css = cfg.swimCss;
  const w = (lo, hi) => `${Math.round(cfg.ftp * lo)}–${Math.round(cfg.ftp * hi)} W`;
  const ftpNote = cfg.ftpTested ? '' : ' (FTP 236 W is from Aug 2025 – treat watts as provisional until Checkpoint 1)';

  const easyTarget = `HR ${Z2} bpm (Z2) · ${pc(P.easyLo)}–${pc(P.easyHi)} /km · conversational`;
  const fuel = (min) => {
    const gels = Math.max(1, Math.floor((min - 15) / 40));
    return `Fuel: 1 SiS BETA FUEL gel (40 g carbs) every ~40′ ≈ 60 g/h, first one at 30–40′ (about ${gels} gel${gels > 1 ? 's' : ''}). Use the exact products and timing planned for race day.`;
  };

  const B = {
    rest: (note = 'Full rest. Walk, eat well, sleep.') => mk({ group: 'rest', sport: 'rest', kind: 'rest', title: 'Rest day', main: note, intensity: 'rest', minutes: 0 }),
    recovery: (title, minutes, main) => mk({ group: 'rest', sport: 'rest', kind: 'recovery', title, minutes, intensity: 'rec', main, target: 'RPE 1–2 · HR below 125' }),
    mobility: (minutes = 20) => mk({ group: 'rest', sport: 'rest', kind: 'recovery', title: `Mobility & core · ${minutes}′`, minutes, intensity: 'rec',
      main: 'Hips, hamstrings, calves, thoracic spine; finish with dead bug 2×10, bird-dog 2×10, side plank 2×30″.', target: 'RPE 1–2' }),

    easyRun: (km, o = {}) => mk({
      group: 'run', sport: 'run', kind: 'easy', intensity: 'z2', km, minutes: km * 6.1 + (o.strides ? 3 : 0),
      title: o.title || `Easy run · ${km} km`, target: easyTarget,
      warmup: 'First 10′ very easy – walk breaks are fine.',
      main: `${km} km at conversational effort.${o.strides ? ` Finish with ${o.strides}×20″ relaxed strides (walk back recovery).` : ''}${o.note ? ' ' + o.note : ''}`,
      cooldown: '5′ walk + 5′ calf/hip mobility.',
    }),
    runWalk: (km) => mk({ group: 'run', sport: 'run', kind: 'easy', intensity: 'rec', km, minutes: km * 6.8, title: `Run/walk · ${km} km`,
      target: `HR below ${HR_ZONES[1].hi} · RPE 2–3`, warmup: '5′ brisk walk.', main: `${km} km as 4′ easy jog / 1′ walk. First run back after the marathon – stop if anything pinches.`, cooldown: '5′ walk.' }),
    longRun: (km, o = {}) => {
      const parts = [];
      if (o.mp) parts.push(`${o.mp} km at marathon pace (${pc(P.mp)}/km)`);
      if (o.hmp) parts.push(`${o.hmp} km at half-marathon pace (${pc(o.hmpPace ?? P.hmp)}/km)`);
      if (o.steady) parts.push(`${o.steady} km progressive to ${pc(o.steadyPace ?? P.hmp + 12)}/km`);
      const minutes = km * (o.mp || o.hmp ? 5.8 : o.steady ? 5.9 : 6.05);
      return mk({
        group: 'run', sport: 'run', kind: 'long', intensity: parts.length ? 'steady' : 'z2', km, minutes,
        title: o.title || `Long run · ${km} km${parts.length ? ' with pace work' : ''}`,
        target: parts.length ? `Easy parts HR ${Z2} · quality parts as listed` : easyTarget,
        warmup: 'First 3 km very easy.',
        main: parts.length ? `${km - (o.mp || 0) - (o.hmp || 0) - (o.steady || 0)} km easy + ${parts.join(' + ')}. ${o.layout || ''}`.trim() : `${km} km steady and relaxed.${o.note ? ' ' + o.note : ''}`,
        cooldown: '5′ walk, then eat within 30′.',
        notes: km >= 16 ? fuel(minutes) : '',
      });
    },
    keyRun: (o) => mk({
      group: 'run', sport: 'run', kind: 'key', intensity: o.intensity || 'vo2', km: o.totalKm, minutes: o.totalKm * 5.7,
      title: o.title, target: o.target, main: o.main,
      warmup: o.warm || '15′ easy jog, drills (A-skips, high knees, leg swings), 3×20″ strides.',
      cooldown: o.cool || '10′ easy jog + 5′ walk.', notes: o.notes || '',
    }),

    swim: (title, segs, o = {}) => {
      const total = segs.reduce((a, s) => a + s.r * s.d, 0);
      const f = (s) => `${s.r > 1 ? s.r + '×' : ''}${s.d} m ${s.what}${s.rest ? ` (${s.rest}″ rest)` : ''}`;
      return mk({
        group: 'swim', sport: 'swim', kind: o.kind || 'easy', intensity: o.intensity || 'z2', meters: total, minutes: total * 0.046 + 6,
        title: `${title} · ${total} m`, target: o.target || `RPE 4–5 · ${o.cssNote || 'form over speed – stop a drill when technique fades'}`,
        warmup: f(segs[0]), main: segs.slice(1, -1).map(f).join('  →  '), cooldown: f(segs[segs.length - 1]), notes: o.notes || '',
      });
    },

    bike: (minutes, type, o = {}) => {
      const t = {
        rec: ['Recovery spin', 'rec', 'Flat, light gear, 90+ rpm.', `RPE 1–2 · below ${Math.round(cfg.ftp * 0.55)} W`],
        z2: ['Endurance ride', 'z2', 'Steady aerobic ride, smooth pedalling, cadence 85–95 rpm.', `RPE 3–4 · ${w(0.56, 0.75)} · HR ≈125–145 (provisional)`],
        cad: ['Cadence ride', 'z2', 'Z2 with 6×(2′ at 100–110 rpm / 2′ at 85–90 rpm). Keep hips quiet, no bouncing.', `RPE 3–4 · ${w(0.56, 0.75)}`],
        ss: ['Sweet-spot ride', 'steady', o.main || '3×10′ at sweet spot, 4′ easy between.', `RPE 6–7 · ${w(0.88, 0.94)}`],
        thr: ['Threshold ride', 'thr', o.main || '3×8′ at threshold, 5′ easy between.', `RPE 7–8 · ${w(0.95, 1.0)}`],
        open: ['Race-effort openers', 'steady', o.main || '3×3′ at race effort with 3′ easy; stay smooth.', `RPE 6–7 · ${w(0.85, 0.95)}`],
      }[type];
      return mk({
        group: 'bike', sport: 'bike', kind: ['z2', 'rec', 'cad', 'open'].includes(type) ? 'easy' : 'key', intensity: t[1], minutes,
        title: `${o.title || t[0]} · ${minutes}′`, target: t[3] + (type === 'ss' || type === 'thr' ? ftpNote : ''),
        warmup: type === 'rec' || type === 'z2' ? '5′ easy build.' : '10′ easy + 3×30″ spin-ups.',
        main: t[2], cooldown: '5′ easy spin, then stretch hip flexors.',
        notes: 'Indoor setup: gravel bike on the stand with SPD pedals, fan on, bottle in reach. Knee over pedal axle at 3 o’clock; if the saddle feels too low/high, change by 2–3 mm at a time.',
      });
    },

    brick: (o) => mk({
      group: 'brick', sport: 'brick', kind: 'key', intensity: o.intensity || 'steady', minutes: o.bikeMin + o.runMin + 4, km: o.runKm,
      title: `Brick · ${o.bikeMin}′ bike + ${o.runMin}′ run`, target: o.target,
      warmup: '10′ easy on the bike before the main block.',
      main: `Bike: ${o.bike}  →  T2 in under 2′ (shoes, helmet off, go)  →  Run: ${o.run}`,
      cooldown: '5′ easy walk. Expect “jelly legs” for the first 3–5′ of the run; cadence up, short quick steps.', notes: o.notes || '',
    }),

    strength: (which, level = 'build', o = {}) => {
      const sets = level === 'light' ? 2 : level === 'taper' ? 2 : 3;
      const rir = level === 'build' ? '2 reps in reserve' : '3 reps in reserve';
      const A = [
        `Bulgarian split squat ${sets}×8–10 per leg`, `Single-leg Romanian deadlift ${sets}×8–10 per leg`,
        `Incline DB press ${sets + 1}×8–12`, `One-arm DB row ${sets + 1}×8–12 per side`, `Rear-delt fly ${sets}×12–15`,
        `DB biceps curl ${sets}×10–12`, `Side plank ${sets}×30–45″ per side`, `Single-leg calf raise ${sets}×12–15`,
      ];
      const Bx = [
        `Goblet squat (3″ lowering) ${sets}×8–10`, `Hip thrust on bench ${sets}×10–12`, `Flat DB bench press ${sets + 1}×8–12`,
        `Chest-supported DB row on incline bench ${sets}×10–12`, `Lying DB pullover ${sets}×10–12`, `Lateral raise ${sets}×12–15`,
        `Overhead triceps extension ${sets}×10–12`, `Seated calf raise ${sets}×12–15`,
      ];
      let list = which === 'A' ? A : Bx;
      if (level === 'light') list = list.filter((x) => !/squat|deadlift|thrust|calf/i.test(x)); // post-marathon: legs rest
      if (o.plyo) list = [...list, 'Pogo hops 3×20, single-leg hops 3×8 per leg (quick, springy ground contact)'];
      return mk({
        group: 'strength', sport: 'strength', kind: 'strength', intensity: 'str', minutes: level === 'light' ? 25 : level === 'taper' ? 25 : 38,
        title: `Strength ${which}${level === 'light' ? ' (upper body only)' : level === 'taper' ? ' (short)' : ''}`,
        target: `${rir} · rest 60–90″ · tempo 2-0-2`,
        warmup: '5′ easy bike/jog + band pull-aparts, scap push-ups, bodyweight split squats.',
        main: list.join('  ·  '),
        cooldown: '3–5′ stretching.',
        notes: 'Progression: when all sets hit the top of the rep range with clean form, add 2–4 kg per dumbbell. The adjustable dumbbells top out at 25 kg each – past that, slow the lowering to 3–4″, add a 1″ pause, or go unilateral.',
      });
    },
  };

  // ── swim set library ──
  const easyWarm = S(4, 50, 'easy free/back mix', 15);
  const tech = {
    catchup: (n) => [easyWarm, S(6, 50, 'catch-up drill (pause hands in front, rotate hips fully)', 15), S(4, 50, 'kick with board, long legs', 20), S(n, 100, 'smooth freestyle – count strokes per 25 m, keep it at ≤16', 20), S(1, 100, 'easy', 0)],
    elbow: (n) => [easyWarm, S(6, 50, 'fingertip-drag drill (high elbow recovery)', 15), S(4, 50, 'single-arm drill, 3 left / 3 right', 15), S(n, 100, 'freestyle with early vertical forearm', 20), S(1, 100, 'easy', 0)],
    breathe: (n) => [easyWarm, S(6, 50, 'bilateral breathing every 3rd stroke', 15), S(4, 50, 'kick on side, one goggle in the water', 20), S(n, 100, 'freestyle, relaxed exhale under water', 20), S(1, 100, 'easy', 0)],
  };
  const endu = (continuous, reps = 1) => [S(1, 200, 'easy mix', 0), S(4, 50, 'drill/swim by 25', 15), S(reps, continuous, 'continuous freestyle, RPE 5, no wall rests', reps > 1 ? 45 : 0), S(1, 100, 'easy', 0)];
  const cssSet = (n, d) => [S(1, 200, 'easy', 0), S(4, 50, 'build', 15), S(n, d, `at CSS pace (${pc(css)}/100 m)`, 20), S(1, 100, 'easy', 0)];

  B.swimTech = (variant, n) => B.swim('Swim technique', tech[variant](n), { cssNote: 'form over speed' });
  B.swimEndu = (continuous, reps) => B.swim('Swim endurance', endu(continuous, reps), { kind: 'key', intensity: 'steady' });
  B.swimCss = (n, d) => B.swim('Swim CSS set', cssSet(n, d), { kind: 'key', intensity: 'tempo', cssNote: `CSS ${pc(css)}/100 m` });
  B.openWater = (minutes, main, note) => mk({
    group: 'swim', sport: 'swim', kind: 'key', intensity: 'steady', minutes, title: `Open-water swim · ${minutes}′`,
    target: 'RPE 4–6 · calm breathing is the goal, not pace',
    warmup: 'Wade in, splash the face and neck, 2′ of slow exhaling bubbles before swimming.',
    main, cooldown: 'Easy 3′, exit slowly, warm layers on immediately.',
    notes: note || 'Safety: swim with a buddy or at a supervised beach, bright cap, tow float. Wetsuit for any water below ~16 °C. If you panic, roll on your back, float, breathe, signal – then decide.',
  });
  B.fuel = fuel;
  B.pc = pc;
  return B;
}

// ── Phase templates ──────────────────────────────────────────────────────────────────────────────
// Each returns the sessions for a template slot (0 Mon … 6 Sun). `wk` = Monday-based week index inside the phase.

const clampIdx = (arr, i) => arr[Math.max(0, Math.min(arr.length - 1, i))];

function phase1(slot, { wk, B }) {
  const runs = [[0, 0, 0], [5, 6, 9], [6, 7, 11], [7, 8, 13], [5, 6, 10], [8, 9, 13], [6, 5, 0]]; // [Mon, Wed, long] km (wk5: long run moves to Sat 26 Dec because Mon 28 Dec is Checkpoint 1)
  const [m, wd, su] = clampIdx(runs, wk);
  const swimN = [0, 2, 3, 3, 2, 3, 2][Math.min(wk, 6)];
  const variants = ['catchup', 'elbow', 'breathe'];
  const bikeMin = [30, 35, 40, 45, 35, 50, 40][Math.min(wk, 6)];
  const down = wk === 4;
  if (wk === 0) { // week after Larnaka
    return {
      0: [B.rest('Full rest. Walk, hydrate, eat. Soreness is normal for 3–5 days.')],
      1: [B.recovery('Easy walk · 30′', 30, 'Flat walk. Loosen calves and quads.'), B.strength('A', 'light')],
      2: [B.swim('Swim recovery', [S(4, 50, 'easy', 20), S(4, 50, 'kick with board', 20), S(4, 50, 'easy back/free', 15), S(1, 100, 'easy', 0)], { cssNote: 'loosen the legs' })],
      3: [B.bike(30, 'rec'), B.strength('B', 'light')],
      4: [B.rest()],
      5: [B.recovery('Walk · 40′', 40, 'Easy walk, ideally outdoors.')],
      6: [B.runWalk(4)],
    }[slot];
  }
  return {
    0: [B.easyRun(m), B.strength('A', 'build')],
    1: [B.swimTech(variants[(wk - 1) % 3], swimN)],
    2: [B.easyRun(wd, { strides: wk >= 2 ? 6 : 4 })],
    3: [wk >= 3 ? B.swimEndu(wk >= 5 ? 600 : 400) : B.swimTech('elbow', swimN), B.strength('B', 'build')],
    4: [down || wk === 6 ? B.rest() : B.bike(bikeMin, wk === 2 ? 'cad' : 'z2')],
    5: [wk === 5 ? B.longRun(su) : B.rest()],
    6: [wk === 5 || wk === 6 ? B.rest() : B.longRun(su)],
  }[slot];
}

function phase2(slot, { wk, B, P }) {
  const pc = B.pc;
  // [Mon, Wed(key total km), Fri, Sun]
  const V = [[0, 0, 6, 12], [8, 9, 7, 13], [9, 10, 7, 15], [9, 10, 8, 16], [7, 8, 6, 12], [9, 10, 8, 15], [8, 8, 6, 10], [4, 0, 0, 0]];
  const [m, k, f, su] = clampIdx(V, wk);
  const key = {
    1: B.keyRun({ title: 'Speed: 6×400 m', totalKm: 9, target: `400s at ~${pc(P.five - 8)}/km (RPE 8) · 200 m jog between`, main: '6×400 m fast but relaxed, 200 m jog. Quick feet, tall posture, finish each rep feeling you could do 2 more.' }),
    2: B.keyRun({ title: 'VO₂max: 5×800 m', totalKm: 10, target: `800s at ${pc(P.five)}/km (5K pace) · 400 m jog`, main: '5×800 m at 5K pace with 400 m jog. Reps 4–5 should feel hard but controlled; keep splits even.' }),
    3: B.keyRun({ title: 'VO₂max: 5×1000 m', totalKm: 11, target: `1000s at ${pc(P.five)}–${pc(P.five + 3)}/km · 2′ jog`, main: '5×1000 m at 5K pace with 2′ easy jog.' }),
    4: B.keyRun({ title: 'Threshold: 3×8′', totalKm: 9, intensity: 'thr', target: `${pc(P.thr)}/km (≈ HR ${HR_ZONES[3].lo}–${HR_ZONES[3].hi}) · 2′ jog`, main: '3×8′ at threshold (comfortably hard), 2′ easy jog. Down week – stop early if breathing gets ragged.' }),
    5: B.keyRun({ title: '10K pace: 4×1600 m', totalKm: 11, intensity: 'thr', target: `${pc(P.ten)}/km (10K race pace) · 90″ jog`, main: '4×1600 m at goal 10K pace, 90″ jog. This is the dress rehearsal for race-day rhythm.' }),
    6: B.keyRun({ title: 'Sharpener: 5×600 m', totalKm: 8, target: `${pc(P.five - 3)}/km · 400 m jog`, main: '5×600 m at 5K pace, 400 m jog, then 4×200 m quick. Leave feeling fresh, not tired.' }),
  }[wk];
  const longs = {
    1: B.longRun(13), 2: B.longRun(15, { steady: 3, steadyPace: P.hmp + 15 }), 3: B.longRun(16, { steady: 4, steadyPace: P.hmp + 5 }),
    4: B.longRun(12), 5: B.longRun(15, { hmp: 3, layout: 'Final 3 km at half-marathon pace.' }), 6: B.longRun(10, { note: 'Add 4×20″ strides at the end.' }),
  };
  const bikeByWk = { 0: null, 1: B.bike(45, 'cad'), 2: B.bike(50, 'cad'), 3: B.bike(60, 'ss', { main: '3×8′ sweet spot, 4′ easy between.' }), 4: B.bike(45, 'z2'), 5: B.bike(60, 'ss', { main: '3×10′ sweet spot, 4′ easy between.' }), 6: B.bike(40, 'rec') };
  const lvl = wk === 6 ? 'taper' : 'build';
  const variants = ['catchup', 'elbow', 'breathe'];
  return {
    0: [m ? B.easyRun(m, { strides: 4 }) : B.rest(), ...(wk >= 1 ? [B.strength('A', lvl, { plyo: true })] : [])],
    1: [B.swimTech(variants[wk % 3], 3 + (wk > 2 ? 1 : 0)), ...(bikeByWk[wk] ? [bikeByWk[wk]] : [])],
    2: [wk === 0 ? B.rest() : wk === 7 ? B.rest() : key],
    3: [B.swimEndu(wk >= 5 ? 800 : wk >= 3 ? 600 : 400), B.strength('B', lvl)],
    4: [f ? B.easyRun(f, { strides: 6, title: `Easy run + strides · ${f} km` }) : B.rest()],
    5: [B.rest()],
    6: [wk === 0 ? B.longRun(12) : wk === 7 ? B.rest() : longs[wk]],
  }[slot];
}

function phase3(slot, { wk, B, P }) {
  const pc = B.pc;
  // [Mon, Wed, Fri, Sun]
  const V = [[0, 0, 5, 10], [8, 8, 7, 14], [9, 10, 8, 17], [10, 10, 8, 18], [8, 8, 6, 14], [10, 11, 8, 19], [9, 10, 6, 0], [8, 8, 6, 14], [10, 12, 8, 20], [8, 9, 5, 0], [6, 8, 6, 16], [9, 10, 7, 18], [7, 9, 0, 0]];
  const [m, k, f, su] = clampIdx(V, wk);
  const key = {
    1: B.keyRun({ title: 'Hills: 8×60″', totalKm: 9, target: 'Hard uphill effort (RPE 8) · jog down', main: '8×60″ uphill (4–6 % grade), jog down recovery. Strong knee drive, tall posture – builds power for the half.' }),
    2: B.keyRun({ title: 'Tempo: 3×10′', totalKm: 10, intensity: 'thr', target: `${pc(P.thr + 3)}/km (just under threshold)`, main: '3×10′ at threshold-minus, 2′ jog between.' }),
    3: B.keyRun({ title: 'Cruise: 4×1600 m', totalKm: 11, intensity: 'thr', target: `${pc(P.thr)}/km (HR ${HR_ZONES[3].lo}–${HR_ZONES[3].hi}) · 60″ jog`, main: '4×1600 m at threshold pace, 60″ jog.' }),
    4: B.keyRun({ title: 'Fartlek: 8×2′', totalKm: 8, intensity: 'tempo', target: `On: 10K effort (${pc(P.ten)}/km) · off: easy 2′`, main: '8×2′ on / 2′ off. Down week – keep it playful.' }),
    5: B.keyRun({ title: 'HM pace: 3×3 km', totalKm: 13, intensity: 'thr', target: `${pc(P.goalHM)}/km (sub-1:40 goal pace) · 2′ jog`, main: '3×3 km at goal half-marathon pace, 2′ jog. Learn the feel: relaxed shoulders, even splits.' }),
    6: B.keyRun({ title: 'Tempo: 25′', totalKm: 10, intensity: 'tempo', target: `${pc(P.goalHM)}–${pc(P.goalHM + 4)}/km`, main: '25′ continuous at goal half-marathon pace. Easy sharpen before Sunday’s 15K simulation.' }),
    7: B.keyRun({ title: 'Pick-ups: 6×1′', totalKm: 8, intensity: 'tempo', target: `1′ at ${pc(P.ten)}/km · 2′ easy`, main: '6×1′ brisk with 2′ easy. Down week after the checkpoint.' }),
    8: B.keyRun({ title: 'HM pace: 4×2.4 km', totalKm: 16, intensity: 'thr', target: `${pc(P.goalHM)}/km · 90″ jog`, main: '4×2.4 km at goal half-marathon pace. This is the biggest pace session of the block (9.6 km at pace).' }),
    9: B.keyRun({ title: 'Sharpener: 5×1000 m', totalKm: 9, intensity: 'thr', target: `${pc(P.thr)}/km · 90″ jog`, main: '5×1000 m at threshold. Short and sharp – Kaunas is on Sunday.' }),
    10: B.easyRun(8, { strides: 6, title: 'Easy run + strides · 8 km' }),
    11: B.keyRun({ title: 'HM pace: 3×3 km', totalKm: 13, intensity: 'thr', target: `${pc(P.goalHM)}/km · 2′ jog`, main: 'Last big session before Riga: 3×3 km at goal half-marathon pace.' }),
    12: B.keyRun({ title: 'Taper: 4×1000 m', totalKm: 9, intensity: 'tempo', target: `${pc(P.goalHM)}/km · 90″ jog`, main: '4×1000 m at half-marathon pace + 4×200 m quick. Stay fresh.' }),
  }[wk];
  const longs = {
    1: B.longRun(14), 2: B.longRun(17, { steady: 3, steadyPace: P.hmp + 20 }), 3: B.longRun(18, { steady: 4, steadyPace: P.hmp + 10 }),
    4: B.longRun(14), 5: B.longRun(19, { steady: 7, steadyPace: P.goalHM + 10 }), 7: B.longRun(14),
    8: B.longRun(20, { hmp: 10, hmpPace: P.goalHM + 3, layout: 'Layout: 5 easy → 10 km at HM pace → 5 easy. Practice gel timing.' }),
    10: B.longRun(16, { steady: 4, steadyPace: P.hmp + 15 }),
    11: B.longRun(18, { hmp: 8, hmpPace: P.goalHM, layout: 'Layout: 5 easy → 8 km at HM pace → 5 easy.' }),
  };
  const lvl = [4, 7, 10].includes(wk) ? 'light' : wk === 9 || wk === 12 ? 'taper' : 'build';
  const variants = ['catchup', 'elbow', 'breathe'];
  const sw = wk % 2;
  return {
    0: [m ? B.easyRun(m) : B.rest(), ...(wk > 0 && wk < 12 ? [B.strength('A', lvl === 'light' ? 'build' : lvl)] : [])],
    1: [B.swimTech(variants[wk % 3], 3), ...(wk && wk < 9 && wk !== 6 ? [B.bike(wk === 8 ? 40 : 45, 'z2')] : [])],
    2: [wk === 0 ? B.rest() : key],
    3: [sw ? B.swimCss(6, 100) : B.swimEndu(wk > 4 ? 800 : 600), ...(wk && wk < 12 ? [B.strength('B', lvl === 'light' ? 'build' : lvl)] : [])],
    4: [f ? B.easyRun(f, { strides: 6 }) : B.rest()],
    5: [wk === 12 ? B.easyRun(3, { strides: 4, title: 'Pre-race shakeout · 3 km' }) : B.rest()],
    6: [su ? (longs[wk] || B.longRun(su)) : B.rest()],
  }[slot];
}

function phase4(slot, { wk, B, P }) {
  const pc = B.pc;
  const runKm = [[0, 0, 8], [8, 8, 12], [8, 8, 13], [8, 8, 0], [6, 7, 10], [5, 0, 0]];
  const [m, k, su] = clampIdx(runKm, wk);
  const cadMin = [0, 45, 50, 55, 45, 30][wk];
  const brick = {
    1: B.brick({ bikeMin: 45, runMin: 10, runKm: 1.8, bike: '45′ Z2 steady', run: '10′ easy-steady, cadence 180 spm', target: 'Bike Z2 · run RPE 4', notes: 'Goal: learn the transition and leg feel – not speed.' }),
    2: B.brick({ bikeMin: 60, runMin: 15, runKm: 2.8, bike: '3×8′ at sweet spot inside 60′', run: `15′ at ${pc(P.ten + 15)}/km (steady)`, target: 'Bike RPE 6–7 · run RPE 6', notes: 'Eat/drink during the bike like on race day.' }),
    4: B.brick({ bikeMin: 40, runMin: 10, runKm: 2, bike: '10′ Z2, then 3×3′ at race effort, 3′ easy', run: `10′ at ${pc(P.ten + 8)}/km`, target: 'Race-effort openers', notes: 'Keep it crisp; you are sharpening, not building.' }),
  }[wk];
  const ow = [
    null,
    B.openWater(20, 'Entry practice: 4×(5′ swim / 2′ rest) staying within 30 m of shore. Head-up breaststroke is allowed to calm down.'),
    B.openWater(30, 'Sighting: every 8th stroke lift eyes forward ("crocodile eyes"), pick a landmark. 6×(4′ swim / 1′ float).'),
    B.openWater(30, 'Start practice: 3 mass-start sprints of 30″ then settle into rhythm; practice swimming close to others, then 10′ continuous.'),
    B.openWater(25, 'Race-start simulation: 3×(sprint 30″, then 4′ steady), exit and run 100 m up the beach.'),
    B.openWater(15, 'Easy 15′ in race-day venue if allowed; check entry/exit and buoy lines.'),
  ];
  const poolTue = wk === 5 ? B.swimTech('breathe', 2) : wk === 0 ? B.swimTech('catchup', 3) : [B.swimCss(6, 100), B.swimEndu(800), B.swimCss(4, 200), B.swimEndu(1000), B.swimTech('breathe', 3)][wk - 1] || B.swimTech('breathe', 3);
  const lvl = wk === 5 ? 'taper' : wk === 0 ? 'light' : 'build';
  const key = {
    0: B.easyRun(6, { strides: 4 }),
    1: B.keyRun({ title: 'Tempo: 20′', totalKm: 9, intensity: 'tempo', target: `${pc(P.hmp)}–${pc(P.thr)}/km`, main: '20′ steady tempo, then 4×20″ strides.' }),
    2: B.keyRun({ title: 'Intervals: 6×3′', totalKm: 9, intensity: 'thr', target: `${pc(P.ten)}/km · 90″ jog`, main: '6×3′ at 10K effort. Keep cadence high – prepares the run leg of a sprint tri.' }),
    3: B.keyRun({ title: 'Tempo: 2×10′', totalKm: 8, intensity: 'tempo', target: `${pc(P.thr)}/km`, main: '2×10′ threshold, 3′ jog. Short week into the checkpoint.' }),
    4: B.keyRun({ title: 'Sharpener: 5×2′', totalKm: 8, intensity: 'tempo', target: `${pc(P.five)}/km · 2′ jog`, main: '5×2′ at 5K effort with 2′ jog.' }),
    5: B.easyRun(5, { strides: 4, title: 'Pre-race run · 5 km' }),
  }[wk];
  return {
    0: [m ? B.easyRun(m) : B.rest(), ...(wk !== 5 ? [B.strength('A', lvl)] : [])],
    1: [poolTue, ...(cadMin ? [B.bike(cadMin, wk === 3 ? 'ss' : 'cad', { main: wk === 3 ? '2×10′ sweet spot, 5′ easy.' : undefined })] : [])],
    2: [wk === 0 ? B.rest() : key],
    3: [wk === 0 ? B.swimTech('elbow', 3) : ow[wk], ...(wk !== 5 ? [B.strength('B', lvl)] : [])],
    4: [B.rest()],
    5: [wk === 0 ? B.bike(40, 'z2') : wk === 3 ? B.rest() : wk === 5 ? B.bike(20, 'open', { main: '10′ easy, 3×1′ at race effort, 3′ easy. Rack the bike, check tyres and gears.' }) : brick],
    6: [wk === 0 ? B.longRun(8) : wk === 5 ? B.rest() : wk === 3 ? B.rest() : B.longRun(su)],
  }[slot];
}

const P5 = { // weeks-to-marathon → [Mon, Wed, Fri, Sun]
  14: [8, 10, 8, 14], 13: [9, 10, 8, 16], 12: [10, 11, 8, 18], 11: [8, 9, 6, 14], 10: [10, 11, 8, 20], 9: [10, 12, 9, 22],
  8: [11, 12, 9, 24], 7: [9, 10, 7, 16], 6: [11, 12, 9, 28], 5: [9, 10, 7, 18], 4: [11, 13, 9, 30], 3: [10, 12, 8, 24],
  2: [9, 10, 6, 16], 1: [7, 8, 5, 10], 0: [6, 6, 0, 0],
};

function phase5(slot, { wk, B, P, wToGo, race }) {
  const pc = B.pc;
  if (wk === 0) { // transition week after the triathlon
    return {
      0: [B.rest('Full rest after the triathlon.')],
      1: [B.swimTech('catchup', 3)],
      2: [B.easyRun(6)],
      3: [B.bike(45, 'z2'), B.strength('B', 'light')],
      4: [B.easyRun(6, { strides: 4 })],
      5: [B.rest()],
      6: [B.longRun(10)],
    }[slot];
  }
  const [m, k, f, su] = P5[Math.max(0, Math.min(14, wToGo))];
  const base = wToGo >= 12;
  const key = ({
    14: B.easyRun(k, { strides: 6, title: `Easy + strides · ${k} km` }),
    13: B.keyRun({ title: 'Fartlek: 8×1′', totalKm: 10, intensity: 'tempo', target: `On: ${pc(P.ten)}/km · off: easy 1′`, main: '8×1′ on / 1′ off. Aerobic power without the strain.' }),
    12: B.keyRun({ title: 'Tempo: 2×15′', totalKm: 11, intensity: 'tempo', target: `${pc(P.hmp + 8)}–${pc(P.hmp + 14)}/km`, main: '2×15′ steady tempo, 3′ jog.' }),
    11: B.keyRun({ title: 'Fartlek: 6×2′', totalKm: 9, intensity: 'tempo', target: `${pc(P.ten)}/km on · 2′ easy`, main: 'Down week: 6×2′ on / 2′ off.' }),
    10: B.keyRun({ title: 'Marathon pace: 3×2 km', totalKm: 11, intensity: 'steady', target: `${pc(P.mp)}/km`, main: '3×2 km at marathon pace, 2′ jog. Learn the rhythm.' }),
    9: B.keyRun({ title: 'Tempo: 3×12′', totalKm: 12, intensity: 'thr', target: `${pc(P.thr + 8)}/km`, main: '3×12′ at tempo, 2′ jog.' }),
    8: B.keyRun({ title: 'Marathon pace: 2×5 km', totalKm: 14, intensity: 'steady', target: `${pc(P.mp)}/km · 3′ jog`, main: '2×5 km at marathon pace.' }),
    7: B.keyRun({ title: 'Fartlek: 6×2′', totalKm: 9, intensity: 'tempo', target: `${pc(P.ten)}/km on · 2′ easy`, main: 'Down week.' }),
    6: B.keyRun({ title: 'Tempo: 4×8′', totalKm: 12, intensity: 'thr', target: `${pc(P.thr + 5)}/km · 90″ jog`, main: '4×8′ at tempo. Last hard Wednesday before the checkpoint long run.' }),
    5: B.keyRun({ title: 'Marathon pace: 3×4 km', totalKm: 14, intensity: 'steady', target: `${pc(P.mp)}/km · 2′ jog`, main: '3×4 km at marathon pace.' }),
    4: B.keyRun({ title: 'Tempo: 3×10′', totalKm: 13, intensity: 'thr', target: `${pc(P.thr + 5)}/km`, main: '3×10′ tempo.' }),
    3: B.keyRun({ title: 'Marathon pace: 2×6 km', totalKm: 14, intensity: 'steady', target: `${pc(P.mp)}/km · 3′ jog`, main: '2×6 km at marathon pace.' }),
    2: B.keyRun({ title: 'Sharpener: 4×1.6 km', totalKm: 10, intensity: 'tempo', target: `${pc(P.mp - 8)}/km`, main: '4×1.6 km slightly faster than marathon pace; taper begins.' }),
    1: B.keyRun({ title: 'Taper: 4×1 km', totalKm: 8, intensity: 'tempo', target: `${pc(P.mp)}/km`, main: '4×1 km at marathon pace, easy jog between.' }),
    0: B.easyRun(6, { title: 'Race-week run + 4×1′ at MP', strides: 0, note: `Include 4×1′ at ${pc(P.mp)}/km.` }),
  })[Math.max(0, Math.min(14, wToGo))];
  const longs = {
    14: B.longRun(su), 13: B.longRun(su), 12: B.longRun(su, { steady: 4, steadyPace: P.mp + 10 }),
    11: B.longRun(su), 10: B.longRun(su, { mp: 5 }), 9: B.longRun(su, { mp: 8 }), 8: B.longRun(su, { mp: 10 }), 7: B.longRun(su),
    5: B.longRun(su, { mp: 6 }), 4: B.longRun(su, { mp: 16, layout: 'Layout: 8 easy → 16 at MP → 6 easy. Peak session – fuel exactly like race day.' }),
    3: B.longRun(su, { mp: 8 }), 2: B.longRun(su, { mp: 4 }), 1: B.longRun(su),
  };
  const lvl = wToGo <= 2 ? 'taper' : [11, 7, 5].includes(wToGo) ? 'light' : 'build';
  const sLvl = lvl === 'light' ? 'build' : lvl;
  return {
    0: [B.easyRun(m), ...(wToGo > 0 ? [B.strength('A', sLvl)] : [])],
    1: [wToGo <= 1 ? B.swimTech('breathe', 2) : (wToGo % 2 ? B.swimTech('elbow', 3) : B.swimEndu(600))],
    2: [key],
    3: [B.bike(wToGo <= 2 ? 30 : 50, 'z2'), ...(wToGo > 0 ? [B.strength('B', sLvl)] : [])],
    4: [f ? B.easyRun(f, { strides: 6 }) : B.rest()],
    5: [wToGo === 0 ? B.easyRun(3, { strides: 4, title: 'Pre-race shakeout · 3 km' }) : B.rest()],
    6: [su ? longs[Math.min(14, wToGo)] || B.longRun(su) : B.rest()],
  }[slot];
}

const PHASE_FN = { p1: phase1, p2: phase2, p3: phase3, p4: phase4, p5: phase5 };

// ── Race & checkpoint sessions ──────────────────────────────────────────────────────────────────
function raceSession(r, B, P) {
  const pc = B.pc;
  const common = { group: 'race', kind: 'race', intensity: 'race' };
  const defs = {
    mazeikiai: { sport: 'run', minutes: 50, title: 'RACE · Mažeikiai Bėga 10K', target: `Start at ~${pc(P.ten)}/km (Garmin predicts 45:54). Negative-split if the first 5K feels controlled.`,
      warmup: '15′ easy jog, drills, 4 strides, finish warm-up 10′ before the gun.', main: 'Km 1–3 settle at goal pace, 4–7 hold rhythm, last 3 km empty the tank. Goal: new 10K personal best.', cooldown: '10′ easy jog + walk. Eat and drink within 30′.' },
    kaunas: { sport: 'run', minutes: 112, title: 'RACE (B) · Kaunas Half Marathon', target: `Steady ${pc(P.goalHM + 8)}–${pc(P.goalHM + 15)}/km, HR capped at ${HR_ZONES[2].hi} (Z3) for the first 15 km – no time pressure.`,
      warmup: '10′ easy jog + 4 strides.', main: 'Treat it as a paid long workout: practise gel timing (1 gel every 40′), pacing discipline, and aid-station routine. Free to pick it up after km 16 only if it feels easy.', cooldown: 'Walk 10′, recovery drink, easy next 2 days.' },
    riga: { sport: 'run', minutes: 100, title: 'A-RACE · Riga Half Marathon', target: `Goal sub-1:40:00 = ${pc(P.goalHM)}/km. Garmin currently predicts 1:41:59.`,
      warmup: '15′ easy jog, drills, 4 strides.', main: `Km 1–5 at ${pc(P.goalHM + 3)}/km (do not go out faster), km 6–15 lock in ${pc(P.goalHM)}/km, last 6 km run on feel. Gels at 8, 16 and 21′ intervals as rehearsed.`, cooldown: '10′ walk and refuel.' },
    trakai: { sport: 'brick', minutes: 75, title: 'A-RACE · Trakai Sprint Triathlon', target: 'Swim calm and wide of the pack, bike strong but controlled, run by feel. Goal: a strong, confident finish.',
      warmup: 'Rack check, 10′ jog + 5 strides, 5′ in-water warm-up if allowed.', main: 'Swim: sight every 8–10 strokes. T1: wetsuit down to the waist while running. Bike: first 5′ easy, then 85–92 % FTP effort. T2: quick. Run: first km slower than you want, then build.', cooldown: 'Walk, fluids, food.' },
    fall: { sport: 'run', minutes: 220, title: 'A-RACE · Fall marathon', target: `Start at goal marathon pace ${pc(P.mp)}/km (from today’s Garmin prediction – updated after Checkpoint 5).`,
      warmup: '10′ easy jog + 3 strides.', main: `First 10 km 5–8″/km slower than goal, settle to ${pc(P.mp)}/km, race from 32 km. Gels every 30–40′ as rehearsed (Checkpoint 5).`, cooldown: 'Walk 15′, protein + carbs, shower, sleep.' },
  };
  const km = { mazeikiai: 10, kaunas: 21.1, riga: 21.1, trakai: 5, fall: 42.2 }[r.id];
  return mk({ ...common, ...defs[r.id], km, raceId: r.id, notes: `${r.priority}-race · ${r.dist} · Goal: ${r.goal}. Race-day readiness check: if Garmin shows Red because of illness or poor sleep, decide at the start line – the plan never auto-cancels a race.` });
}

function checkpointSessions(cp, B, P, cfg) {
  const pc = B.pc;
  const base = { group: 'checkpoint', kind: 'test', intensity: 'vo2', checkpoint: cp.id };
  if (cp.id === 1) return [
    mk({ ...base, sport: 'swim', title: 'CHECKPOINT 1a · Swim CSS test', minutes: 55, meters: 1400,
      target: 'Two max-effort swims: 400 m then 200 m, 10′ easy between. CSS pace per 100 m = (T400 − T200) ÷ 2.',
      warmup: '400 m easy + 4×50 build + 100 m kick.', main: '400 m time trial → 10′ rest (easy swim 100 m) → 200 m time trial. Count strokes per 25 m on the last 100 of each.',
      cooldown: '200 m easy.', notes: 'Why not 3 km? Your longest recent continuous pool swim is ~1.5 km; a 3 km test after six weeks would measure fatigue, not efficiency. CSS plus stroke count is a better efficiency score. If you can already swim 1,500 m continuously, add 1,000 m steady after the test and log it.' }),
    mk({ ...base, sport: 'bike', title: 'CHECKPOINT 1b · Indoor FTP test', minutes: 70, intensity: 'vo2',
      target: 'FTP = 95 % of the best 20-minute average power. Needs a power source (smart trainer or pedals). If you have none, log the 20′ average HR instead.',
      warmup: '20′ progressive: 5′ easy, 3×1′ at 100 % FTP w/ 1′ easy, 5′ easy, then a 5′ blow-out at ~120 % FTP + 10′ easy.', main: '20′ all-out but evenly paced. Eat 60 g carbs 2 h before; fan on.',
      cooldown: '10′ easy spin.', notes: 'Do the bike at least 6 h after the swim test. If Garmin shows Yellow/Red that morning, the engine defers the test up to 48 h.' }),
  ];
  const defs = {
    2: { sport: 'run', title: 'CHECKPOINT 2 · 5K time trial', minutes: 50, km: 9, target: `All-out even pacing. Start around ${pc(P.five + 4)}/km and hold. Garmin 5K prediction: 21:50.`,
      warmup: '15′ easy, drills, 4 strides, 3′ at 10K pace, 3′ rest.', main: '5 km flat time trial (track or flat loop). Log time, average HR, max HR.', cooldown: '10′ easy.', notes: 'The result re-scales every pace in the programme (see Checkpoints → Recalibrate).' },
    3: { sport: 'run', title: 'CHECKPOINT 3 · 15K race-pace simulation', minutes: 108, km: 19, intensity: 'thr',
      target: `15 km at goal half-marathon pace ${pc(P.goalHM)}/km (sub-1:40). HR should settle ≈ ${HR_ZONES[3].lo - 4}–${HR_ZONES[3].lo + 6}.`,
      warmup: '2 km easy + 4 strides.', main: '15 km even pace at goal HM pace, gels at 8 km (and 13 km). Log avg HR and how the legs felt.', cooldown: '2 km easy jog.',
      notes: 'Recovery check: log readiness and HRV the next two mornings – if still Red/Yellow after 48 h, shave 10 % off the next week.' },
    4: { sport: 'brick', title: 'CHECKPOINT 4 · Mock sprint triathlon', minutes: 90, km: 5,
      target: 'Race simulation, race kit, race fuelling. Swim 750 m, bike ~20 km, run 5 km (confirm Trakai’s real distances and mirror them).',
      warmup: 'As race morning: 10′ jog, 5 strides, 5′ easy swim.', main: 'Swim (open water if ≥ 14 °C, otherwise pool) → T1 → bike at 85–92 % FTP → T2 → run 5 km, first km easy.', cooldown: 'Walk 10′, eat, log splits.' },
    5: { sport: 'run', title: 'CHECKPOINT 5 · 28K long run, 12K at marathon pace', minutes: 160, km: 28, intensity: 'steady',
      target: `8 km easy → 12 km at ${pc(P.mp)}/km → 8 km easy. Fuelling audit: log grams of carbs per hour and any stomach issues.`,
      warmup: '8 km easy (HR Z2).', main: `12 km at marathon pace ${pc(P.mp)}/km. Gels: ${Math.round(160 / 40) - 1} × SiS BETA FUEL (40 g) — one every 40′ from 30′.`, cooldown: '8 km easy, then refuel within 30′.', notes: 'Go/no-go for race pace: if MP segment HR is in Z3 top or the last 4 km fall apart, set race-day goal 3–5″/km slower.' },
  };
  return [mk({ ...base, ...defs[cp.id], notes: defs[cp.id].notes || '' })];
}

// ── Public API ──────────────────────────────────────────────────────────────────────────────────
export function generatePlan(opts = {}) {
  const fall = opts.fallMarathon || DEFAULT_FALL_MARATHON;
  const cfg = { ftp: ATHLETE.bikeFtp, ftpTested: false, swimCss: ATHLETE.swimCssSecPer100, ...(opts.cfg || {}) };
  const P = opts.paces || makePaces();
  const tenDay = opts.tenDay || []; // [{from:'YYYY-MM-DD', blocks:1..3}]
  const phases = buildPhases(fall);
  const races = buildRaces(fall);
  const checkpoints = buildCheckpoints(fall);
  const B = makeBuilders(P, cfg);
  const raceByDate = Object.fromEntries(races.map((r) => [r.date, r]));
  const cpByDate = Object.fromEntries(checkpoints.map((c) => [c.date, c]));
  const days = {};

  const phaseFor = (d) => phases.find((p) => p.id >= 1 && d >= p.start && d <= p.end);
  const slotFor = (d) => {
    for (const t of tenDay) {
      const p = diffDays(d, t.from);
      if (p >= 0 && p < t.blocks * 10) return { slot: SEQ10[p % 10], pos: p % 10, ten: true };
    }
    return { slot: dow(d), ten: false };
  };

  const last = fall;
  for (const d of range(SEASON.start, last)) {
    const phase = phaseFor(d);
    if (!phase) continue;
    const phaseMon = mondayOf(phase.start);
    const wk = Math.floor(diffDays(mondayOf(d), phaseMon) / 7);
    const wToGo = Math.round(diffDays(mondayOf(fall), mondayOf(d)) / 7);
    const { slot, pos, ten } = slotFor(d);
    let sessions;
    if (slot === 'F') {
      sessions = [[B.mobility(25), B.bike(30, 'rec'), B.recovery('Easy walk · 40′', 40, 'Outdoors if possible.')][[3, 7, 9].indexOf(pos)]];
    } else {
      sessions = PHASE_FN[phase.key](slot, { wk, B, P, cfg, wToGo, date: d }) || [B.rest()];
    }
    sessions = sessions.filter(Boolean);

    // Date-anchored overrides, in priority order
    const race = raceByDate[d];
    const cp = cpByDate[d];
    const tomorrow = addDays(d, 1);
    const yesterday = addDays(d, -1);
    let tag = null;
    if (race) { sessions = [raceSession(race, B, P)]; tag = 'race'; }
    else if (cp) { sessions = checkpointSessions(cp, B, P, cfg); tag = 'checkpoint'; }
    else if (raceByDate[yesterday] && ['mazeikiai', 'kaunas', 'riga', 'trakai', 'fall'].includes(raceByDate[yesterday].id)) {
      sessions = [B.rest('Day after the race: full rest, food, short walk.')]; tag = 'post-race';
    } else if (raceByDate[tomorrow] || cpByDate[tomorrow]) {
      // Day before a race or test: nothing taxing, no leg strength.
      sessions = sessions.filter((s) => s.group !== 'strength' && !(s.kind === 'key' || s.kind === 'long' || s.kind === 'test'))
        .concat(sessions.some((s) => s.sport === 'run' && (s.kind === 'key' || s.kind === 'long')) ? [B.easyRun(5, { strides: 4, title: 'Pre-race shakeout · 5 km' })] : []);
      if (!sessions.length) sessions = [B.rest('Rest before tomorrow’s ' + (raceByDate[tomorrow] ? 'race' : 'test') + '. Hydrate, carb up, sleep.')];
      tag = 'pre-event';
    }
    if (FAMILY_DAYS[d] && !race && !cp) { sessions = [B.rest(FAMILY_DAYS[d] + '. Enjoy it; training resumes tomorrow.')]; tag = 'family'; }

    sessions = sessions.map((s, i) => ({ ...s, id: `${d}#${i}`, date: d, phaseId: phase.id }));
    days[d] = { date: d, phaseId: phase.id, wk, microcycle: ten ? 10 : 7, tag, sessions };
  }
  return { days, phases, races, checkpoints, start: SEASON.start, end: last, cfg, paces: P, tenDay };
}

// ── Aggregations ────────────────────────────────────────────────────────────────────────────────
export const dayTotals = (day) => (day?.sessions || []).reduce((a, s) => ({
  minutes: a.minutes + (s.minutes || 0), tss: a.tss + (s.tss || 0), km: a.km + (s.sport === 'run' || s.sport === 'brick' ? s.km || 0 : 0),
}), { minutes: 0, tss: 0, km: 0 });

export function weeklySummary(plan) {
  const out = {};
  for (const [d, day] of Object.entries(plan.days)) {
    const wk = mondayOf(d);
    out[wk] ||= { week: wk, minutes: 0, tss: 0, runKm: 0, bySport: { run: 0, bike: 0, swim: 0, strength: 0, brick: 0 }, restDays: 0 };
    for (const s of day.sessions) {
      out[wk].minutes += s.minutes; out[wk].tss += s.tss;
      if (s.sport === 'run' || s.sport === 'brick') out[wk].runKm += s.km || 0;
      const g = s.group === 'checkpoint' || s.group === 'race' ? s.sport : s.group;
      if (g in out[wk].bySport) out[wk].bySport[g] += s.minutes;
    }
    if (day.sessions.every((s) => s.group === 'rest' && s.kind === 'rest')) out[wk].restDays += 1;
  }
  return Object.values(out).sort((a, b) => (a.week < b.week ? -1 : 1));
}

export const sessionsOn = (plan, date) => plan.days[date]?.sessions || [];
export const phaseOn = (plan, date) => plan.phases.find((p) => date >= p.start && date <= p.end) || null;
export const nextEvent = (plan, date) => {
  const ev = [
    ...plan.races.map((r) => ({ type: 'race', date: r.date, name: r.name, priority: r.priority, goal: r.goal })),
    ...plan.checkpoints.map((c) => ({ type: 'checkpoint', date: c.date, name: `Checkpoint ${c.id}: ${c.name}` })),
  ].filter((e) => e.date >= date).sort((a, b) => (a.date < b.date ? -1 : 1));
  return { next: ev[0] || null, nextRace: ev.find((e) => e.type === 'race') || null, nextCheckpoint: ev.find((e) => e.type === 'checkpoint') || null };
};
