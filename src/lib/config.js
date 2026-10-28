// Central configuration. Everything personal (zones, dates, race goals) lives here.
// Baseline values were pulled from Garmin Connect on 2026-10-28 (Forerunner 970).

export const SEASON = { start: '2026-11-16', name: 'Season 26/27' };

export const ATHLETE = {
  name: 'Tomas',
  weightKg: 84.7,
  maxHR: 190,            // Garmin max HR in use (highest observed in recent data: 193 during a 20′ tempo)
  lthr: 172,             // Garmin lactate-threshold HR
  restHrGarmin: 61,      // ⚠ Garmin zones still use this stale value; real morning RHR is 44–47
  restHrActual: 45,
  vo2max: 51.8,
  bikeFtp: 236,          // ⚠ stale (Aug 2025) – replaced at Checkpoint 1
  swimCssSecPer100: 150, // ⚠ provisional guess (2:30/100 m) – replaced at Checkpoint 1
};

// Heart-rate zones exactly as stored in Garmin (HR-reserve method, Max 190 / LTHR 172).
export const HR_ZONES = [
  { z: 1, lo: 126, hi: 137, name: 'Recovery' },
  { z: 2, lo: 138, hi: 150, name: 'Aerobic' },
  { z: 3, lo: 151, hi: 163, name: 'Tempo' },
  { z: 4, lo: 164, hi: 176, name: 'Threshold' },
  { z: 5, lo: 177, hi: 190, name: 'VO₂max' },
];

// Garmin race predictions on 2026-10-28 (seconds). The app re-derives paces from checkpoint results.
export const PREDICTIONS = { '5K': 1310, '10K': 2754, HM: 6119, M: 13340 };
export const LT_SPEED_MPS = 3.5555;

export const secToPace = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
export const secToHMS = (s) => {
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
};
export const hmsToSec = (str) => {
  if (!str) return NaN;
  const p = String(str).trim().split(':').map(Number);
  if (p.some(Number.isNaN)) return NaN;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0];
};

// Run paces in sec/km (derived from predictions; recalibrated by checkpoints).
export const makePaces = (pred = PREDICTIONS, ltSecKm = 1000 / LT_SPEED_MPS) => ({
  five: pred['5K'] / 5,
  ten: pred['10K'] / 10,
  thr: ltSecKm,
  hmp: pred.HM / 21.0975,
  goalHM: 6000 / 21.0975,   // sub-1:40:00
  mp: pred.M / 42.195,
  easyLo: 360, easyHi: 380, // 6:00–6:20/km, taken from recent Z2 runs (HR 134–139 at ~6:05/km)
});

export const TSS_PER_HOUR = { rest: 0, rec: 25, z2: 45, steady: 60, tempo: 72, thr: 88, vo2: 95, str: 40, race: 105 };

// ── Phases, races, checkpoints ───────────────────────────────────────────────
export const DEFAULT_FALL_MARATHON = '2027-09-26'; // Warsaw Marathon

export const buildPhases = (fallMarathon) => [
  { id: 0, key: 'pre', name: 'Larnaka taper', short: 'Taper', start: '2026-10-28', end: '2026-11-15', color: '#898781',
    focus: 'Your current Garmin plan covers the taper and race. This program starts the day after.' },
  { id: 1, key: 'p1', name: 'Recovery & winter foundation', short: 'Foundation', start: '2026-11-16', end: '2026-12-31', color: '#1baf7a',
    focus: 'Recover from Larnaka, set up the indoor bike, rebuild swim technique, keep dumbbell strength going.' },
  { id: 2, key: 'p2', name: '10K speed & power', short: '10K speed', start: '2027-01-01', end: '2027-02-16', color: '#eb6834',
    race: 'Mažeikiai Bėga 10K', focus: 'VO₂max intervals, leg turnover, core strength. Goal: 10K personal best.' },
  { id: 3, key: 'p3', name: 'Half-marathon PR build', short: 'Half build', start: '2027-02-17', end: '2027-05-16', color: '#2a78d6',
    race: 'Riga Half Marathon', focus: 'Threshold and half-marathon-pace work. Kaunas HM is a long workout; Riga is the A-race.' },
  { id: 4, key: 'p4', name: 'Triathlon transition & open water', short: 'Triathlon', start: '2027-05-17', end: '2027-06-27', color: '#6250d6',
    race: 'Trakai Sprint Triathlon', focus: 'Bricks, open-water sighting and cold-water confidence. Goal: a strong, confident finish.' },
  { id: 5, key: 'p5', name: 'Fall marathon build', short: 'Marathon', start: '2027-06-28', end: fallMarathon, color: '#e34948',
    race: 'Warsaw Marathon', focus: 'Long aerobic runs, fuelling practice, volume management. Goal: beat the Larnaka time.' },
];

export const buildRaces = (fallMarathon) => [
  { id: 'larnaka', date: '2026-11-15', name: 'Larnaka Marathon', dist: '42.2 km', priority: 'A', goal: 'Sub 3:45:00', done: false },
  { id: 'mazeikiai', date: '2027-02-16', name: 'Mažeikiai Bėga', dist: '10 km', priority: 'A', goal: '10K personal best' },
  { id: 'kaunas', date: '2027-04-25', name: 'Kaunas Half Marathon', dist: '21.1 km', priority: 'B', goal: 'Strong execution under load – no time pressure' },
  { id: 'riga', date: '2027-05-16', name: 'Riga Half Marathon', dist: '21.1 km', priority: 'A', goal: 'Sub 1:40:00 PR attempt' },
  { id: 'trakai', date: '2027-06-27', name: 'Trakai Sprint Triathlon', dist: 'Sprint', priority: 'A', goal: 'Strong, confident finish' },
  { id: 'fall', date: fallMarathon, name: 'Warsaw Marathon', dist: '42.2 km', priority: 'A', goal: 'Beat the Larnaka time – new marathon PB' },
];

// Checkpoint definitions. `fields` drive the result form; `metrics` drive the progression charts.
export const buildCheckpoints = (fallMarathon) => {
  const cp5 = (() => { const d = new Date(Date.parse(fallMarathon + 'T00:00:00Z') - 42 * 86400000); return d.toISOString().slice(0, 10); })();
  return [
    { id: 1, date: '2026-12-28', name: 'Swim CSS test + indoor FTP baseline', phase: 1,
      summary: 'AM: swim 400 m + 200 m time trials (critical swim speed, stroke count). PM: indoor bike FTP test.',
      fields: [
        { key: 't400', label: '400 m time', type: 'time', ph: 'm:ss' },
        { key: 't200', label: '200 m time', type: 'time', ph: 'm:ss' },
        { key: 'spl', label: 'Strokes per 25 m (at CSS)', type: 'number' },
        { key: 'ftp', label: 'FTP (W)', type: 'number' },
        { key: 'ftpHr', label: 'Bike LTHR (bpm, if no power)', type: 'number' },
      ] },
    { id: 2, date: '2027-01-25', name: '5K time trial / threshold test', phase: 2,
      summary: 'All-out 5K on a flat route. Sets 10K race pace and threshold pace for the Mažeikiai build.',
      fields: [
        { key: 't5k', label: '5K time', type: 'time', ph: 'm:ss' },
        { key: 'avgHr', label: 'Average HR', type: 'number' },
        { key: 'maxHr', label: 'Max HR', type: 'number' },
      ] },
    { id: 3, date: '2027-04-04', name: '15K race-pace simulation + recovery check', phase: 3,
      summary: '2 km warm-up, 15 km at goal half-marathon pace (sub-1:40 = 4:44/km), 2 km cool-down. Log HRV and readiness the next two mornings.',
      fields: [
        { key: 't15k', label: '15K time (race-pace part)', type: 'time', ph: 'h:mm:ss' },
        { key: 'avgHr', label: 'Average HR', type: 'number' },
        { key: 'readiness48', label: 'Readiness 2 days later', type: 'number' },
        { key: 'hrv48', label: 'HRV (ms) 2 days later', type: 'number' },
      ] },
    { id: 4, date: '2027-06-13', name: 'Mock sprint triathlon', phase: 4,
      summary: 'Race simulation: swim (pool or open water) → T1 → bike → T2 → run. Use race kit and race fuelling.',
      fields: [
        { key: 'swim', label: 'Swim time', type: 'time', ph: 'm:ss' },
        { key: 'bike', label: 'Bike time', type: 'time', ph: 'h:mm:ss' },
        { key: 'run', label: 'Run time', type: 'time', ph: 'm:ss' },
        { key: 'total', label: 'Total (incl. transitions)', type: 'time', ph: 'h:mm:ss' },
      ] },
    { id: 5, date: cp5, name: '28K long run with 12K at marathon pace + fuelling audit', phase: 5,
      summary: '8 km easy, 12 km at goal marathon pace, 8 km easy. Practise race fuelling exactly as planned; log carbs per hour and any GI trouble.',
      fields: [
        { key: 'mpPace', label: 'Marathon-pace segment (min/km)', type: 'time', ph: 'm:ss' },
        { key: 'avgHr', label: 'HR during MP segment', type: 'number' },
        { key: 'carbs', label: 'Carbs per hour (g)', type: 'number' },
        { key: 'gi', label: 'GI trouble? (0 none – 5 severe)', type: 'number' },
      ] },
  ];
};

// Progression charts on the Checkpoints panel.
export const CHECKPOINT_METRICS = [
  { key: 'css', label: 'Swim CSS', unit: '/100 m', lower: true, fmt: 'pace100', cp: 1 },
  { key: 'ftp', label: 'Bike FTP', unit: 'W', lower: false, fmt: 'num', cp: 1 },
  { key: 't5k', label: '5K time trial', unit: '', lower: true, fmt: 'time', cp: 2 },
  { key: 'pace15', label: '15K sim pace', unit: '/km', lower: true, fmt: 'pace', cp: 3 },
  { key: 'mpHr', label: 'HR at marathon pace', unit: 'bpm', lower: true, fmt: 'num', cp: 5 },
];

export const LOCAL_KEYS = {
  log: 's2627.log', cp: 's2627.checkpoints', settings: 's2627.settings', manual: 's2627.manualReadiness',
};
