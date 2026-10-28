import { useRef, useState } from 'react';
import { addDays, fmtShort } from '../lib/dates.js';
import { DEFAULT_FALL_MARATHON, LOCAL_KEYS } from '../lib/config.js';
import { RULES } from '../lib/adapt.js';

export default function Settings({ settings, setSettings, data, restore, garmin, plan }) {
  const fileRef = useRef(null);
  const [from, setFrom] = useState(plan.start);
  const [blocks, setBlocks] = useState(1);
  const [msg, setMsg] = useState('');
  const exportAll = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'season-26-27-backup.json'; a.click();
  };
  const importAll = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { restore(JSON.parse(await f.text())); setMsg('Backup restored.'); } catch { setMsg('That file is not a valid backup.'); }
    e.target.value = '';
  };
  return (
    <div className="stack">
      <section className="card">
        <h2 style={{ marginBottom: 12 }}>Season settings</h2>
        <div className="grid g-2">
          <label className="f">Fall marathon date
            <input type="date" value={settings.fallMarathon} onChange={(e) => e.target.value && setSettings({ ...settings, fallMarathon: e.target.value })} />
            <span className="small muted">Currently an assumption ({fmtShort(DEFAULT_FALL_MARATHON)}). Phase 5 and Checkpoint 5 (six weeks before) move with it.</span></label>
          <label className="f" style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'start', gap: 10 }}>
            <input type="checkbox" checked={settings.lifeLoadHigh} onChange={(e) => setSettings({ ...settings, lifeLoadHigh: e.target.checked })} />
            <span>High life load right now (new baby, work crunch, travel). The microcycle advisor will suggest a 10-day block.</span></label>
        </div>
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 6 }}>10-day blocks</h2>
        <p className="small ink2" style={{ marginBottom: 10 }}>A 10-day block keeps the same sessions but adds three easy recovery days (mobility, easy spin, walk), cutting load density by about 30%. Races and checkpoints stay on their dates.</p>
        <div className="row">
          <label className="f">Start<input type="date" value={from} min={plan.start} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="f">Blocks<select value={blocks} onChange={(e) => setBlocks(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} × 10 days</option>)}</select></label>
          <button className="btn primary" style={{ alignSelf: 'end' }} onClick={() => setSettings({ ...settings, tenDay: [...settings.tenDay, { from, blocks }] })}>Add block</button>
        </div>
        <div className="stack" style={{ marginTop: 10 }}>
          {settings.tenDay.length === 0 && <span className="small muted">No 10-day blocks planned.</span>}
          {settings.tenDay.map((t, i) => (
            <div key={i} className="spread"><span>{fmtShort(t.from)} → {fmtShort(addDays(t.from, t.blocks * 10 - 1))} ({t.blocks * 10} days)</span><button className="btn sm" onClick={() => setSettings({ ...settings, tenDay: settings.tenDay.filter((_, j) => j !== i) })}>Remove</button></div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 8 }}>Adaptive rules in force</h2>
        <table className="t"><tbody>
          <tr><td><b>Green</b></td><td>Readiness above {RULES.greenReadiness}, HRV balanced, sleep above {RULES.greenSleep}, load ratio up to {RULES.cautionAcwr} → session as planned</td></tr>
          <tr><td><b>Yellow</b></td><td>Readiness {RULES.redReadiness}–{RULES.greenReadiness}, HRV low, sleep {RULES.redSleep}–{RULES.greenSleep}, or load ratio {RULES.cautionAcwr}–{RULES.redAcwr} → keep volume, hard sessions become steady Z2, strength lighter, checkpoints deferred up to 48 h</td></tr>
          <tr><td><b>Red</b></td><td>Readiness below {RULES.redReadiness}, HRV unbalanced/poor, sleep below {RULES.redSleep}, or load ratio above {RULES.redAcwr} → Recovery Protocol (rest, 30′ Z1 spin or 20′ mobility). Races are never cancelled automatically</td></tr>
          <tr><td><b>Overreach</b></td><td>Load ratio above {RULES.redAcwr} or acute load above Garmin’s optimal range → next 7 days trimmed {RULES.trimMild * 100}% ({RULES.trimStrong * 100}% above {RULES.trimStrongAcwr})</td></tr>
        </tbody></table>
        <p className="small muted" style={{ marginTop: 8 }}>Anything that is neither clearly green nor red (for example readiness 80 but sleep 70) is treated as yellow. Edit the thresholds in <code>src/lib/adapt.js</code>.</p>
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 8 }}>Garmin data</h2>
        <p className="small ink2">{garmin?.data ? <>Snapshot from <b>{garmin.data.meta.asOf.replace('T', ' ')}</b>. {garmin.data.activities.length} activities, {garmin.data.hrv.length} nights of HRV, {garmin.data.load.length} days of load.</> : 'No snapshot found at data/garmin.json.'}</p>
        <p className="small muted" style={{ marginTop: 6 }}>To refresh: ask Claude to “refresh the Garmin data” (it rewrites <code>public/data/garmin.json</code>), or write the same schema from your own script (see README). Until then use Quick entry on the Today tab.</p>
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 8 }}>Your data</h2>
        <p className="small ink2">Log entries, checkpoint results and settings live in this browser only.</p>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={exportAll}>Download backup</button>
          <button className="btn" onClick={() => fileRef.current.click()}>Restore from backup</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importAll} />
          <button className="btn" onClick={() => { if (window.confirm('Delete all log entries, checkpoint results and settings from this browser?')) { Object.values(LOCAL_KEYS).forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } }); window.location.reload(); } }}>Erase everything</button>
        </div>
        {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
      </section>
    </div>
  );
}
