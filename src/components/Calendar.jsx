import { useState } from 'react';
import { Legend, Modal, SessionCard, chipLabel, gc, hrs } from './ui.jsx';
import { addDays, diffDays, dow, fmtDow, fmtLong, fmtShort, mondayOf, range } from '../lib/dates.js';
import { dayTotals } from '../lib/plan.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Cell({ plan, d, today, logged, onOpen }) {
  const day = plan.days[d];
  if (!day) return <div />;
  const past = d < today;
  return (
    <button className={`day ${d === today ? 'today' : ''} ${past ? 'past' : ''}`} onClick={() => onOpen(d)} aria-label={`${fmtLong(d)}: ${day.sessions.map((s) => s.title).join(', ')}`}>
      <span className="dn"><span>{fmtDow(d)} {fmtShort(d)}</span>{logged && <span title="Logged">✓</span>}</span>
      {day.sessions.map((s) => <span key={s.id} className={`chip ${s.group === 'checkpoint' || s.group === 'race' ? 'cp' : ''} ${s.group === 'rest' ? 'rest-chip' : ''}`} style={{ '--sc': gc(s.group) }}>{chipLabel(s)}</span>)}
    </button>
  );
}

function blocksFor(plan, phase, mode) {
  const days = range(phase.start, phase.end).filter((d) => plan.days[d]);
  if (!days.length) return [];
  if (mode === 7) {
    const out = [];
    for (const d of days) {
      const m = mondayOf(d);
      let b = out[out.length - 1];
      if (!b || b.key !== m) { b = { key: m, days: [], pad: 0 }; out.push(b); }
      b.days.push(d);
    }
    out.forEach((b) => { b.pad = dow(b.days[0]); });
    return out;
  }
  const out = [];
  days.forEach((d, i) => { if (i % 10 === 0) out.push({ key: d, days: [], pad: 0 }); out[out.length - 1].days.push(d); });
  return out;
}

export default function Calendar({ plan, today, log, onJump }) {
  const [mode, setMode] = useState(7);
  const phases = plan.phases.filter((p) => p.id >= 1);
  const current = phases.find((p) => today >= p.start && today <= p.end)?.id ?? 1;
  const [open, setOpen] = useState({ [current]: true });
  const [sel, setSel] = useState(null);
  const loggedDays = new Set(log.map((l) => l.date));
  const ev = (d) => [...plan.races.filter((r) => r.date === d).map((r) => `${r.name} (${r.priority}-race)`), ...plan.checkpoints.filter((c) => c.date === d).map((c) => `Checkpoint ${c.id}`)];

  return (
    <div className="stack">
      <section className="card">
        <div className="spread">
          <div><h2>Programme look-ahead</h2><p className="small muted">Expand a phase to see its weeks. Tap a day for the full session.</p></div>
          <div role="group" aria-label="Microcycle view">
            <div className="seg"><button aria-pressed={mode === 7} onClick={() => setMode(7)}>7-day weeks</button><button aria-pressed={mode === 10} onClick={() => setMode(10)}>10-day blocks</button></div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><Legend /></div>
        {mode === 10 && <p className="small ink2" style={{ marginTop: 8 }}>This view groups the same plan into 10-day blocks. To <i>re-space</i> sessions with extra recovery days, plan a 10-day block in Settings or accept the advisor’s suggestion on the Today tab.</p>}
      </section>
      {phases.map((p) => {
        const isOpen = !!open[p.id];
        const days = range(p.start, p.end).filter((d) => plan.days[d]);
        const tot = days.reduce((a, d) => { const t = dayTotals(plan.days[d]); return { m: a.m + t.minutes, km: a.km + t.km }; }, { m: 0, km: 0 });
        const state = today > p.end ? 'Done' : today >= p.start ? 'Current' : 'Upcoming';
        return (
          <section className="card flush" key={p.id}>
            <button className="phase-h" style={{ '--pc': p.color }} aria-expanded={isOpen} onClick={() => setOpen({ ...open, [p.id]: !isOpen })}>
              <span style={{ flex: 1 }}>
                <span className="ttl">Phase {p.id} · {p.name}</span><br />
                <span className="small muted">{fmtShort(p.start)} → {fmtShort(p.end)} · {Math.round(days.length / 7)} weeks · {hrs(tot.m)} planned · {Math.round(tot.km)} km running{p.race ? ` · ${p.race}` : ''}</span>
              </span>
              <span className="pill">{state}</span>
              <span className="chev" aria-hidden="true">▸</span>
            </button>
            {isOpen && (
              <div className="cal-body" style={{ '--pc': p.color }}>
                <p className="focus">{p.focus}</p>
                {mode === 7 && <div className="cal-heads"><span />{<div className="cal-grid c7">{DOW.map((x) => <div key={x} className="cal-head">{x}</div>)}</div>}</div>}
                {blocksFor(plan, p, mode).map((b, bi) => {
                  const t = b.days.reduce((a, d) => { const x = dayTotals(plan.days[d]); return { m: a.m + x.minutes, km: a.km + x.km, tss: a.tss + x.tss }; }, { m: 0, km: 0, tss: 0 });
                  const cols = mode;
                  return (
                    <div key={b.key} className={`block m${mode}`} style={mode === 10 ? { gridTemplateColumns: 'minmax(0,1fr)' } : undefined}>
                      <div className="block-label"><b>{fmtShort(b.days[0])} – {fmtShort(b.days[b.days.length - 1])}</b><span>{hrs(t.m)} · {Math.round(t.km)} km run</span><span>~{Math.round(t.tss)} TSS</span><span className="vol" aria-hidden="true"><i style={{ width: `${Math.min(100, (t.m / 60 / 9) * 100)}%` }} /></span>{b.days.some((d) => plan.days[d].microcycle === 10) && <span className="pill">10-day block</span>}</div>
                      <div className={`cal-grid c${cols}`}>
                        {mode === 7 && Array.from({ length: b.pad }).map((_, i) => <div key={'p' + i} />)}
                        {b.days.map((d) => <Cell key={d} plan={plan} d={d} today={today} logged={loggedDays.has(d)} onOpen={setSel} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      {sel && (
        <Modal onClose={() => setSel(null)} label={fmtLong(sel)}>
          <div className="spread" style={{ marginBottom: 10 }}><h2>{fmtLong(sel)}</h2><button className="btn sm ghost" onClick={() => setSel(null)}>Close</button></div>
          {ev(sel).map((e) => <p key={e} className="pill" style={{ marginBottom: 8, background: 'var(--warn-bg)' }}>{e}</p>)}
          {plan.days[sel]?.sessions.map((s) => <SessionCard key={s.id} s={s} />)}
          <div className="row" style={{ marginTop: 12 }}><button className="btn primary sm" onClick={() => { onJump(sel); setSel(null); }}>Open on Today tab (with Garmin adaptation)</button></div>
        </Modal>
      )}
    </div>
  );
}
