# Season 26/27 — adaptive endurance coach

A static web app (React + esbuild, no backend) that holds your season plan from the day after Larnaka (16 Nov 2026) to the fall 2027 marathon, adapts each day's session to your Garmin readings, and tracks checkpoints, compliance and subjective notes.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173, rebuilds on save
npm run build    # static site in dist/ – host anywhere (GitHub Pages workflow included)
npm test         # plan + adaptive-rule self-checks
```

Use the **Date** control in the header to preview any day of the programme (it starts 16 Nov), and the **Garmin** control to try the green / yellow / red rules with sample readings.

## Where things live

| File | What it does |
|---|---|
| `src/lib/config.js` | Zones, paces, race list, phase dates, checkpoint definitions. Edit goals here. |
| `src/lib/plan.js` | Generates every day of the plan from phase templates; applies race/checkpoint/eve-of-event overrides; 7- or 10-day microcycles. |
| `src/lib/adapt.js` | The Green/Yellow/Red engine, overreach trim, microcycle advisor. Thresholds are in `RULES`. |
| `src/lib/zones.js` | Recalibrates paces, FTP and swim CSS from logged checkpoint results. |
| `src/lib/garmin.js` | Garmin data hook (below). |
| `public/data/garmin.json` | Garmin snapshot (28 Oct 2026). |

## Garmin hook

The app reads one file, `public/data/garmin.json`. Keep it fresh by asking Claude (with the Garmin connector) to refresh it, or by writing the same schema from your own script. With no sync, type the morning numbers into **Quick entry** on the Today tab.

```jsonc
{
  "meta": { "asOf": "2026-10-28T08:48:14" },
  "readiness": { "date": "2026-10-28", "score": 56, "level": "MODERATE", "feedback": "…", "recoveryHours": 35.5 },
  "hrv":   [{ "d": "2026-10-28", "last": 95, "weekly": 85, "status": "BALANCED" }],   // BALANCED | LOW | UNBALANCED | POOR
  "sleep": [{ "d": "2026-10-28", "score": 85, "hours": 7.03, "rhr": 45, "hrv": 95 }],  // night ending that morning
  "load":  [{ "d": "2026-10-28", "atl": 676, "ctl": 621, "tsb": -55 }],                // acute / chronic load
  "optimalChronic": { "min": 496.8, "max": 931.5 },
  "activities": [{ "d": "2026-10-28", "s": "run", "km": 9.0, "min": 48.4, "hr": 150, "mx": 178, "n": "…" }]  // s: run|bike|swim|strength|walk (swim uses "m" for metres)
}
```

If the snapshot has nothing for the selected day, the engine says so and falls back to Quick entry rather than guessing.

## Notes and assumptions

- Fall marathon date is **assumed 17 Oct 2027** until you set it in Settings; Phase 5 and Checkpoint 5 (six weeks out) move with it.
- Checkpoint 1 uses a 400 m + 200 m swim test (critical swim speed) instead of a 3 km swim.
- Heart-rate zones are Garmin's own. Garmin still uses a resting HR of 61; your real morning value is 44–47, so its zones sit a little low at the bottom.
- Bike FTP (236 W) is from Aug 2025 and swim CSS (2:30/100 m) is a placeholder; both are replaced by Checkpoint 1.
- Log entries, checkpoint results and settings are stored in the browser (`localStorage`). Use Settings → Download backup before switching devices.
