import { useState } from 'react';
import { Ring, chipLabel, gc, hrs } from './ui.jsx';
import Calendar from './Calendar.jsx';
import { Q1, LATER, CYCLE_COUNT, CYCLE_LEN, quarterProgress, isDone, cycleStart } from '../lib/quarter.js';
import { addDays, diffDays, fmtDow, fmtLong, fmtShort, range } from '../lib/dates.js';
import { dayTotals, sessionsOn } from '../lib/plan.js';

const MILESTONES = [
  { d: '2026-11-15', name: 'Larnaka Marathon', note: 'The finish line of the last chapter', kind: 'race' },
  { d: '2026-11-16', name: 'Day 1', note: 'Soft landing', kind: 'start' },
  { d: '2026-12-28', name: 'Checkpoint 1', note: 'Swim pace (28 Dec) and bike FTP (29 Dec)', kind: 'test' },
  { d: '2027-01-25', name: 'Checkpoint 2', note: '5K time trial', kind: 'test' },
  { d: '2027-02-16', name: 'Mažeikiai Bėga 10K', note: 'Quarter 1 finish', kind: 'race' },
];

function Path({ prog }) {
  return (
    <div className="path" role="img" aria-label={`Cycle ${prog.cur + 1} of ${CYCLE_COUNT}`}>
      {prog.cycles.map((w) => (
        <span key={w.i} className={`pdot ${w.state} ${w.counted && w.pct >= 0.8 ? 'good' : ''} ${w.hasTest ? 'test' : ''} ${w.hasRace ? 'race' : ''}`} title={`Cycle ${w.i + 1}: ${w.title}`}>
          <i>{w.i + 1}</i>
        </span>
      ))}
    </div>
  );
}

function Week({ w, plan, g, log, openDay, open, setOpen, today }) {
  const a = cycleStart(w.i), days = range(a, w.end).filter((d) => plan.days[d]);
  const t = days.reduce((x, d) => { const y = dayTotals(plan.days[d]); return { m: x.m + y.minutes, km: x.km + y.km }; }, { m: 0, km: 0 });
  const nSess = days.reduce((n, d) => n + sessionsOn(plan, d).filter((s) => s.group !== 'rest').length, 0);
  const ev = days.flatMap((d) => [...plan.races.filter((r) => r.date === d).map((r) => `${r.name} · ${fmtDow(d)}`), ...plan.checkpoints.filter((c) => c.date === d).map((c) => `Checkpoint ${c.id} · ${fmtDow(d)}`)]);
  const isOpen = open === w.i;
  return (
    <article className={`wcard ${w.state}`} id={`week-${w.i}`}>
      <button className="wcard-h" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : w.i)}>
        <span className="wn"><small>Cycle</small>{w.i + 1}</span>
        <span className="wt">
          <b>{w.title}</b>
          <span>{fmtShort(a)} – {fmtShort(w.end)}{ev.length ? ` · ${ev.join(' · ')}` : ''}</span>
        </span>
        <span className="wnums"><b>{Math.round(t.km)}</b> km<br /><b>{hrs(t.m)}</b></span>
        {w.counted || w.state === 'current' ? <Ring value={w.pct == null ? 0 : w.pct * 100} size={44}><b className="rb">{w.pct == null ? '–' : Math.round(w.pct * 100)}</b></Ring> : <span className="pill">{w.state === 'future' ? 'Ahead' : '–'}</span>}
        <span className="chev" aria-hidden="true">▸</span>
      </button>
      <p className="mission">{w.mission}</p>
      <div className="mini">
        {days.map((d) => (
          <button key={d} className="md" onClick={() => openDay(d)} aria-label={`${fmtLong(d)}: open`}>
            <small>{fmtDow(d)}</small>
            {sessionsOn(plan, d).map((s) => <span key={s.id} className={`mc ${s.group === 'rest' ? 'rest' : ''} ${isDone(g, log, s) ? 'done' : ''}`} style={{ '--sc': gc(s.group) }}>{chipLabel(s)}</span>)}
          </button>
        ))}
      </div>
      {isOpen && (
        <div className="wmore">
          <div><h4>Why this cycle</h4><p>{w.why}</p></div>
          <div><h4>A good cycle looks like</h4><ul>{w.win.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><h4>Watch for</h4><p>{w.watch}</p></div>
          <div className="wstats"><span><b>{nSess}</b> sessions in {days.length} days</span><span><b>{Math.round(t.km)}</b> km running</span><span><b>{hrs(t.m)}</b> training</span></div>
        </div>
      )}
    </article>
  );
}

export default function Quarter({ plan, fullPlan, unlocked, garmin, log, today, openDay }) {
  const g = garmin?.data;
  const prog = quarterProgress(plan, g, log, today);
  const [open, setOpen] = useState(Math.min(prog.cur, CYCLE_COUNT - 1));
  const nextMs = MILESTONES.find((m) => m.d >= today && m.kind !== 'start');
  const left = diffDays(Q1.end, today);
  return (
    <div className="stack">
      <section className="qhero">
        <Ring value={prog.pct * 100} size={132}><b>{prog.started ? prog.dayN : 0}</b><span>of {prog.total} days</span></Ring>
        <div className="qh-t">
          <h2>{Q1.name}</h2>
          <p>{prog.started ? `Cycle ${prog.cur + 1} of ${CYCLE_COUNT}: ${prog.cycles[prog.cur].title}. ${left} days to the 10K.` : `Day 1 is Monday 16 Nov, in ${prog.daysToStart} days. Ten cycles of ten days, five milestones, one race.`}</p>
          <Path prog={prog} />
          <p className="qh-s">Quarter 1 builds the base, brings the swim back, starts the strength block and sharpens speed for the 10K. The next quarters unlock after it.</p>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h2>Milestones</h2></div>
        <ol className="miles">
          {MILESTONES.map((m) => {
            const dd = diffDays(m.d, today);
            return (
              <li key={m.d} className={`${m.kind} ${dd < 0 ? 'past' : m === nextMs ? 'next' : ''}`}>
                <i />
                <b>{m.name}</b>
                <span>{fmtShort(m.d)} · {dd < 0 ? 'done' : dd === 0 ? 'today' : `in ${dd} days`}</span>
                <em>{m.note}</em>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="weeks">
        {prog.cycles.map((w) => <Week key={w.i} w={w} plan={plan} g={g} log={log} openDay={openDay} open={open} setOpen={setOpen} today={today} />)}
      </div>

      {!unlocked && (
        <section className="card locked">
          <div className="card-h"><h2>Coming after Quarter 1</h2></div>
          <div className="lk">
            {LATER.map((q) => (
              <div className="lk-i" key={q.name}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
                <div><b>{q.name}</b><span>{q.dates} · {q.goal}</span><em>{q.unlock}</em></div>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>These open on 17 Feb, or earlier if you switch them on in Settings.</p>
        </section>
      )}
      {unlocked && fullPlan && (
        <section><h2 style={{ margin: '8px 0 12px' }}>Later quarters</h2><Calendar plan={{ ...fullPlan, phases: fullPlan.phases.filter((p) => p.id >= 3) }} today={today} log={log} onJump={openDay} /></section>
      )}
    </div>
  );
}
