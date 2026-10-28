import { useEffect, useMemo, useState } from 'react';
import { activitiesOn, metricsForDate } from '../lib/garmin.js';
import { fmtLong, fmtShort } from '../lib/dates.js';
import { sessionsOn } from '../lib/plan.js';

const MOODS = ['Drained', 'Flat', 'Okay', 'Good', 'Great'];
const STATUS = { done: 'Done as planned', modified: 'Done, modified', partial: 'Partly done', skipped: 'Skipped' };

function Telemetry({ g, date }) {
  const acts = activitiesOn(g, date);
  const m = metricsForDate(g, date);
  if (!acts.length && !m) return <p className="small muted">No Garmin data for this day yet.</p>;
  return (
    <div className="stack small">
      {acts.map((a, i) => (
        <div key={i}><b>{a.n}</b><br /><span className="ink2 num">{a.km ? `${a.km} km · ` : a.m ? `${a.m} m · ` : ''}{Math.round(a.min)}′{a.hr ? ` · avg HR ${a.hr}` : ''}{a.mx ? ` · max ${a.mx}` : ''}</span></div>
      ))}
      {m && <div className="ink2 num">{[m.readiness != null && `Readiness ${m.readiness}`, m.sleepScore != null && `Sleep ${m.sleepScore}`, m.hrvLast && `HRV ${m.hrvLast} ms (${(m.hrvStatus || '').toLowerCase()})`, m.acwr && `Load ratio ${m.acwr.toFixed(2)}`].filter(Boolean).join(' · ')}</div>}
    </div>
  );
}

export default function LogView({ plan, garmin, log, setLog, date, draftSession, clearDraft }) {
  const g = garmin?.data;
  const [d, setD] = useState(draftSession?.date || date);
  useEffect(() => { if (!draftSession) { setD(date); setF((x) => ({ ...x, sessionId: sessionsOn(plan, date)[0]?.id || '' })); } }, [date]); // eslint-disable-line
  const plannedToday = sessionsOn(plan, d);
  const blank = { sessionId: draftSession?.id || plannedToday[0]?.id || '', status: 'done', rpe: 5, mood: 2, nutrition: '', notes: '' };
  const [f, setF] = useState(blank);
  const sess = plannedToday.find((s) => s.id === f.sessionId);
  const sorted = useMemo(() => [...log].sort((a, b) => (a.date < b.date ? 1 : -1)), [log]);
  const save = () => {
    setLog([...log, { id: `${Date.now()}`, date: d, sessionId: f.sessionId, title: sess?.title || 'Unplanned session', status: f.status, rpe: Number(f.rpe), mood: Number(f.mood), nutrition: f.nutrition, notes: f.notes }]);
    setF({ ...blank, sessionId: plannedToday[0]?.id || '' }); clearDraft?.();
  };
  return (
    <div className="stack">
      <section className="card">
        <div className="card-h"><h2>Log a session</h2><span className="small muted">Your notes sit next to what Garmin recorded.</span></div>
        <div className="grid g-2">
          <div className="stack">
            <label className="f">Date<input type="date" value={d} onChange={(e) => { setD(e.target.value); setF({ ...f, sessionId: sessionsOn(plan, e.target.value)[0]?.id || '' }); }} /></label>
            <label className="f">Session
              <select value={f.sessionId} onChange={(e) => setF({ ...f, sessionId: e.target.value })}>
                {plannedToday.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                <option value="">Unplanned session</option>
              </select></label>
            <label className="f">How did it go?
              <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="f">Effort (RPE) <b className="num" style={{ color: 'var(--ink)' }}>{f.rpe} / 10</b>
              <input className="rpe" type="range" min="1" max="10" value={f.rpe} onChange={(e) => setF({ ...f, rpe: e.target.value })} /></label>
            <label className="f">Mental state: <b style={{ color: 'var(--ink)' }}>{MOODS[f.mood]}</b>
              <input className="rpe" type="range" min="0" max="4" value={f.mood} onChange={(e) => setF({ ...f, mood: e.target.value })} /></label>
          </div>
          <div className="stack">
            <label className="f">Nutrition & fuelling<textarea placeholder="e.g. 2 SiS BETA FUEL gels at 45′ and 90′, 600 ml water, breakfast 2.5 h before" value={f.nutrition} onChange={(e) => setF({ ...f, nutrition: e.target.value })} /></label>
            <label className="f">Notes<textarea placeholder="Legs, breathing, sleep, anything the numbers miss" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
            <div className="card" style={{ background: 'var(--surface-2)' }}><div className="small muted" style={{ marginBottom: 6 }}>Garmin on {fmtShort(d)}</div><Telemetry g={g} date={d} /></div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}><button className="btn primary" onClick={save}>Save entry</button></div>
      </section>
      <section className="card">
        <div className="card-h"><h2>History</h2><span className="small muted">{log.length} {log.length === 1 ? 'entry' : 'entries'} · stored in this browser</span></div>
        {sorted.length === 0 && <div className="empty">Nothing logged yet. Entries you save show your effort and notes beside the Garmin numbers for the same day.</div>}
        <div className="stack">
          {sorted.map((e) => (
            <article key={e.id} className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="spread"><b>{fmtLong(e.date)}</b><span className="row"><span className="pill">{STATUS[e.status]}</span><button className="btn sm ghost" onClick={() => setLog(log.filter((x) => x.id !== e.id))}>Delete</button></span></div>
              <div className="entry" style={{ marginTop: 8 }}>
                <div className="col"><div className="small muted">You</div><p><b>{e.title}</b></p><p className="small ink2 num">RPE {e.rpe}/10 · {MOODS[e.mood]}</p>{e.nutrition && <p className="small">Fuel: {e.nutrition}</p>}{e.notes && <p className="small">{e.notes}</p>}</div>
                <div className="col"><div className="small muted">Garmin</div><Telemetry g={g} date={e.date} /></div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
