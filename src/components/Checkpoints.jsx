import { useState } from 'react';
import { LineChart } from './charts.jsx';
import { secToHMS, secToPace, CHECKPOINT_METRICS, ATHLETE, PREDICTIONS } from '../lib/config.js';
import { progressionSeries } from '../lib/zones.js';
import { diffDays, fmtShort } from '../lib/dates.js';

const FMT = { pace100: (v) => `${secToPace(v)}`, num: (v) => Math.round(v), time: (v) => secToHMS(v), pace: (v) => secToPace(v) };

function resultSummary(cp, r) {
  if (!r) return '–';
  const f = cp.fields.map((x) => (r[x.key] !== undefined && r[x.key] !== '' ? `${x.label.split(' (')[0]}: ${r[x.key]}` : null)).filter(Boolean);
  return f.length ? f.join(' · ') : '–';
}

export default function Checkpoints({ plan, today, results, setResults, recal }) {
  const [edit, setEdit] = useState(null);
  const [draft, setDraft] = useState({});
  const series = progressionSeries(results);
  const open = (cp) => { setEdit(cp.id); setDraft(results[cp.id] || {}); };
  const save = () => { setResults({ ...results, [edit]: { ...draft } }); setEdit(null); };
  const status = (cp) => (results[cp.id] ? 'Logged' : today > cp.date ? 'Overdue' : today === cp.date ? 'Today' : diffDays(cp.date, today) <= 7 ? 'This week' : 'Upcoming');
  const baseDate = '2026-10-28';
  const baselines = { css: null, ftp: ATHLETE.bikeFtp, t5k: PREDICTIONS['5K'], pace15: PREDICTIONS.HM / 21.0975, mpHr: null };
  const baseNote = { css: 'No reliable baseline – pool history is inconsistent', ftp: 'Garmin FTP from Aug 2025 (stale)', t5k: 'Garmin 5K prediction, 28 Oct 2026', pace15: 'Garmin half-marathon prediction pace', mpHr: 'First measurement at Checkpoint 5' };
  const p = recal.paces;
  return (
    <section className="card">
      <div className="card-h"><h2>Fitness checkpoints</h2><span className="small muted">Log each test; paces, FTP and swim CSS recalibrate the rest of the plan automatically.</span></div>
      <div className="scroll-x">
        <table className="t">
          <thead><tr><th>#</th><th>Date</th><th>Test</th><th>Status</th><th>Result</th><th /></tr></thead>
          <tbody>
            {plan.checkpoints.map((cp) => (
              <tr key={cp.id}>
                <td className="num">{cp.id}</td><td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtShort(cp.date)}</td>
                <td><b>{cp.name}</b><br /><span className="small muted">{cp.summary}</span></td>
                <td><span className="pill">{status(cp)}</span></td>
                <td className="small">{resultSummary(cp, results[cp.id])}</td>
                <td><button className="btn sm" style={{ whiteSpace: 'nowrap' }} onClick={() => open(cp)}>{results[cp.id] ? 'Edit' : 'Log result'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (() => {
        const cp = plan.checkpoints.find((c) => c.id === edit);
        return (
          <div className="card" style={{ marginTop: 14, background: 'var(--surface-2)' }}>
            <h3 style={{ marginBottom: 10 }}>Checkpoint {cp.id} result</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
              {cp.fields.map((f) => (
                <label className="f" key={f.key}>{f.label}
                  <input type="text" inputMode={f.type === 'number' ? 'decimal' : 'text'} placeholder={f.ph || ''} value={draft[f.key] ?? ''} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                </label>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={save}>Save result</button><button className="btn" onClick={() => setEdit(null)}>Cancel</button></div>
          </div>
        );
      })()}
      <div className="grid g-2" style={{ marginTop: 18 }}>
        <div>
          <h3 style={{ marginBottom: 8 }}>Current training paces</h3>
          <table className="t"><tbody>
            {[['Easy (Z2)', `${secToPace(p.easyLo)}–${secToPace(p.easyHi)} /km`], ['Marathon', `${secToPace(p.mp)} /km`], ['Half-marathon (predicted)', `${secToPace(p.hmp)} /km`], ['Half-marathon goal (sub-1:40)', `${secToPace(p.goalHM)} /km`], ['Threshold', `${secToPace(p.thr)} /km`], ['10K', `${secToPace(p.ten)} /km`], ['5K', `${secToPace(p.five)} /km`],
              ['Bike FTP', `${recal.cfg.ftp} W${recal.cfg.ftpTested ? '' : ' (stale, Aug 2025)'}`], ['Swim CSS', `${secToPace(recal.cfg.swimCss)} /100 m${recal.source.css ? '' : ' (provisional)'}`]].map(([k, v]) => <tr key={k}><td>{k}</td><td className="n">{v}</td></tr>)}
          </tbody></table>
          {recal.notes.length > 0 && <ul className="small ink2" style={{ paddingLeft: 18 }}>{recal.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </div>
        <div className="stack">
          <h3>Progression</h3>
          {CHECKPOINT_METRICS.map((m) => {
            const pts = series[m.key].map((x) => ({ d: plan.checkpoints.find((c) => c.id === x.cp).date, v: x.v }));
            const base = baselines[m.key];
            const all = base != null ? [{ d: baseDate, v: base }, ...pts] : pts;
            return (
              <div key={m.key}>
                {all.length >= 2 ? (
                  <LineChart title={`${m.label}${m.unit ? ` (${m.unit})` : ''}`} series={[{ name: m.label, color: 'var(--s-run)', points: all, dots: true }]} yFmt={FMT[m.fmt]} height={120} note={baseNote[m.key] ? `Starts from: ${baseNote[m.key]}. ${m.lower ? 'Lower is better.' : 'Higher is better.'}` : undefined} />
                ) : (
                  <div className="small"><b>{m.label}</b> <span className="muted">— {base != null ? `baseline ${FMT[m.fmt](base)}${m.unit ? ' ' + m.unit : ''} (${baseNote[m.key]})` : baseNote[m.key]}; chart appears after Checkpoint {m.cp}.</span></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
