// Recalibration from checkpoint results. Pure functions; the UI feeds in the logged results.
import { PREDICTIONS, ATHLETE, hmsToSec, makePaces, LT_SPEED_MPS } from './config.js';

const num = (v) => (v === '' || v == null ? NaN : Number(v));

export function recalibrate(results = {}) {
  const notes = [];
  const pred = { ...PREDICTIONS };
  let lt = 1000 / LT_SPEED_MPS;
  const cfg = { ftp: ATHLETE.bikeFtp, ftpTested: false, swimCss: ATHLETE.swimCssSecPer100 };
  const out = { paces: null, cfg, notes, source: {} };

  const r1 = results[1];
  if (r1) {
    const t400 = hmsToSec(r1.t400), t200 = hmsToSec(r1.t200);
    if (t400 > t200 && t200 > 0) { cfg.swimCss = Math.round((t400 - t200) / 2); notes.push(`Swim CSS set to ${cfg.swimCss} s/100 m from the 400/200 test.`); out.source.css = true; }
    const ftp = num(r1.ftp);
    if (ftp > 100) { cfg.ftp = Math.round(ftp); cfg.ftpTested = true; notes.push(`Bike FTP set to ${cfg.ftp} W.`); out.source.ftp = true; }
  }
  const r2 = results[2];
  if (r2) {
    const t5 = hmsToSec(r2.t5k);
    if (t5 > 600) {
      // Scale Garmin's own predictions by the 5K change: keeps Garmin's judgement of your endurance profile.
      const f = t5 / PREDICTIONS['5K'];
      for (const k of Object.keys(pred)) pred[k] = Math.round(PREDICTIONS[k] * f);
      pred['5K'] = Math.round(t5);
      // Threshold ≈ pace you could hold for ~1 hour, from the 5K via Riegel (exponent 1.06).
      const d1h = 5 * Math.pow(3600 / t5, 1 / 1.06);
      lt = 3600 / d1h;
      notes.push(`5K ${r2.t5k} re-scales all run paces (threshold now ${Math.floor(lt / 60)}:${String(Math.round(lt % 60)).padStart(2, '0')}/km).`);
      out.source.fiveK = true;
    }
  }
  out.pred = pred;
  out.paces = makePaces(pred, lt);
  const r3 = results[3];
  if (r3) {
    const t15 = hmsToSec(r3.t15k);
    if (t15 > 1800) { out.paces.hmp = t15 / 15; notes.push(`Half-marathon pace now ${Math.floor(out.paces.hmp / 60)}:${String(Math.round(out.paces.hmp % 60)).padStart(2, '0')}/km from the 15K simulation.`); out.source.hmp = true; }
  }
  const r5 = results[5];
  if (r5) {
    const mp = hmsToSec(r5.mpPace);
    if (mp > 200) { out.paces.mp = mp; notes.push(`Marathon pace now ${r5.mpPace}/km from the 28K session.`); out.source.mp = true; }
  }
  return out;
}

/** Metrics used for the progression charts. Baselines come from Garmin on 2026-10-28. */
export function progressionSeries(results = {}) {
  const pts = (key, f) => Object.entries(results).map(([id, r]) => f(Number(id), r)).filter(Boolean).sort((a, b) => a.cp - b.cp);
  return {
    css: pts('css', (cp, r) => { const a = hmsToSec(r.t400), b = hmsToSec(r.t200); return cp === 1 && a > b && b > 0 ? { cp, v: (a - b) / 2 } : null; }),
    ftp: pts('ftp', (cp, r) => (cp === 1 && num(r.ftp) > 100 ? { cp, v: num(r.ftp) } : null)),
    t5k: pts('t5k', (cp, r) => (cp === 2 && hmsToSec(r.t5k) > 600 ? { cp, v: hmsToSec(r.t5k) } : null)),
    pace15: pts('pace15', (cp, r) => (cp === 3 && hmsToSec(r.t15k) > 1800 ? { cp, v: hmsToSec(r.t15k) / 15 } : null)),
    mpHr: pts('mpHr', (cp, r) => (cp === 5 && num(r.avgHr) > 80 ? { cp, v: num(r.avgHr) } : null)),
  };
}
