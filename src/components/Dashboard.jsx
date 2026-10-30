import { useMemo } from 'react';
import Ribbon from './Ribbon.jsx';
import { SessionBoard, Ring, Sparkline, LEVEL, chipLabel, gc } from './ui.jsx';
import { adaptSession, applyTrim, microcycleAdvice, RULES } from '../lib/adapt.js';
import { applyReview } from '../lib/coach.js';
import { addDays, diffDays, fmtLong, fmtShort, fmtDow, mondayOf } from '../lib/dates.js';
import { nextEvent, phaseOn, sessionsOn } from '../lib/plan.js';
import { Q1, quarterProgress, isDone, cycleCompletion } from '../lib/quarter.js';

const upTo = (arr, date, n) => (arr || []).filter((x) => x.d <= date).slice(-n);

function Readiness({ decision, headline, metrics, garmin, scenario, date, trim }) {
  const m = metrics || {};
  const L = LEVEL[decision.level] || LEVEL.unknown;
  const live = scenario === 'live' && garmin;
  const asOf = garmin?.meta?.asOf;
  const age = asOf ? diffDays(date, asOf.slice(0, 10)) : null;
  const tone = (v, lo, hi) => (v == null ? '' : v >= hi ? 'st-good' : v >= lo ? 'st-warn' : 'st-crit');
  const acwr = m.acwr;
  const hrv = live ? upTo(garmin.hrv, date, 14).map((x) => x.last) : [];
  const slp = live ? upTo(garmin.sleep, date, 14).map((x) => x.score) : [];
  const ld = live ? upTo(garmin.load, date, 14).map((x) => (x.ctl ? x.atl / x.ctl : null)) : [];
  const source = scenario !== 'live' ? `Demo readings (${scenario})` : m.manual ? 'Using the numbers you typed in' : asOf ? `Garmin snapshot ${fmtShort(asOf.slice(0, 10))}, ${asOf.slice(11, 16)}` : 'No Garmin snapshot loaded';
  return (
    <section className="card ready" aria-label="Readiness">
      <div className="ready-top">
        <Ring value={m.readiness}><b>{m.readiness ?? '–'}</b><span>readiness</span></Ring>
        <div>
          <div className={`state-word ${L.cls || 'unknown'}`}>{decision.level === 'unknown' ? 'No readings yet' : L.label}</div>
          <p className="state-sub">{headline ? headline.charAt(0).toUpperCase() + headline.slice(1) : 'Type this morning’s numbers below, or sync Garmin.'}</p>
        </div>
      </div>
      {decision.reasons?.length > 0 && <ul className="reasons">{decision.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
      {trim > 0 && <div className="trim-note"><b>Overreach warning:</b> the next 7 days are trimmed by {Math.round(trim * 100)}%.</div>}
      {metrics ? (
        <div className="metrics">
          <div className="metric"><div><div className="k">Overnight HRV</div><div className="s num">{m.hrvStatus ? m.hrvStatus.toLowerCase() : '–'}{m.hrvWeekly ? ` · 7-day ${m.hrvWeekly} ms` : ''}</div></div><div className={`v ${m.hrvStatus === 'BALANCED' ? 'st-good' : m.hrvStatus === 'LOW' ? 'st-warn' : m.hrvStatus ? 'st-crit' : ''}`}>{m.hrvLast ?? '–'}</div><Sparkline values={hrv} /></div>
          <div className="metric"><div><div className="k">Sleep score</div><div className="s num">{m.sleepHours ? `${m.sleepHours} h` : ''}{m.rhr ? ` · resting HR ${m.rhr}` : ''}</div></div><div className={`v ${tone(m.sleepScore, 60, 80)}`}>{m.sleepScore ?? '–'}</div><Sparkline values={slp} /></div>
          <div className="metric"><div><div className="k">Load ratio (7d ÷ 28d)</div><div className="s num">{m.acute ? `acute ${m.acute} · chronic ${m.chronic}` : `red above ${RULES.redAcwr}`}</div></div><div className={`v ${acwr == null ? '' : acwr > RULES.redAcwr ? 'st-crit' : acwr > RULES.cautionAcwr ? 'st-warn' : 'st-good'}`}>{acwr != null ? acwr.toFixed(2) : '–'}</div><Sparkline values={ld} /></div>
        </div>
      ) : (
        <div className="empty small">No Garmin readings for {fmtShort(date)}. {age > 0 ? `The snapshot is ${age} day${age > 1 ? 's' : ''} old.` : ''} Ask Claude to refresh it, or use Quick entry below.</div>
      )}
      <div className="src">{source}{m.recoveryHours != null ? ` · recovery time left ${m.recoveryHours} h` : ''}</div>
    </section>
  );
}

function CoachCard({ review }) {
  const tone = { progress: 'good', hold: 'warn', deload: 'bad' }[review.action];
  const shown = review.signals.filter((x) => x.state !== 'none' || review.signals.length < 4);
  return (
    <section className={`card coach ${tone}`} aria-label="Weekly coach review">
      <div className="card-h"><h2>Weekly coach review</h2><span className="sec-note">Last 7 days, {fmtShort(review.from)} to {fmtShort(review.to)}</span></div>
      <div className="coach-top">
        <div className={`verdict ${tone}`}><b>{review.label}</b><span>{review.factor < 1 ? `${Math.round((1 - review.factor) * 100)}% less volume for the next 7 days` : 'next 7 days as written'}</span></div>
        <div className="coach-why">{review.reasons.map((r, i) => <p key={i}>{r}</p>)}</div>
      </div>
      <div className="sig">
        {shown.map((x) => (
          <div key={x.label} className={`sg ${x.state}`} title={x.note}>
            <span className="sk">{x.label}</span><b>{x.value}</b><span className="sn">{x.note}</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>These signals use Garmin data up to the snapshot date plus your log. Each rule and the papers behind it are on the Settings tab under “Method and evidence”.</p>
    </section>
  );
}

function QuickEntry({ date, manual, setManual }) {
  const cur = manual[date] || {};
  const set = (k, v) => setManual({ ...manual, [date]: { ...cur, [k]: v } });
  const clear = () => { const n = { ...manual }; delete n[date]; setManual(n); };
  return (
    <section className="card adjust">
      <div className="card-h"><h2>Quick entry</h2>{manual[date] && <button className="btn sm ghost" onClick={clear}>Clear</button>}</div>
      <p className="hint">No sync today? Type what your watch shows this morning. These override Garmin data for {fmtShort(date)} only.</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
        <label className="f">Readiness<input type="number" min="0" max="100" value={cur.readiness ?? ''} onChange={(e) => set('readiness', e.target.value)} /></label>
        <label className="f">Sleep score<input type="number" min="0" max="100" value={cur.sleepScore ?? ''} onChange={(e) => set('sleepScore', e.target.value)} /></label>
        <label className="f">HRV status
          <select value={cur.hrvStatus ?? ''} onChange={(e) => set('hrvStatus', e.target.value)}>
            <option value="">–</option><option value="BALANCED">Balanced</option><option value="LOW">Low</option><option value="UNBALANCED">Unbalanced</option><option value="POOR">Poor</option>
          </select></label>
        <label className="f">Load ratio (optional)<input type="number" step="0.01" min="0" max="3" value={cur.acwr ?? ''} onChange={(e) => set('acwr', e.target.value)} /></label>
      </div>
    </section>
  );
}

function Hero({ prog, plan, g, log, date, setTab }) {
  const wk = prog.cycles[prog.cur];
  const c = prog.started ? cycleCompletion(plan, g, log, prog.cur) : null;
  return (
    <section className="qstrip">
      <Ring value={prog.pct * 100} size={96}><b>{prog.started ? prog.dayN : 0}</b><span>of {prog.total}</span></Ring>
      <div className="qs-t">
        <span className="qs-k">{Q1.name}</span>
        <h2>{prog.started ? `Cycle ${prog.cur + 1} of 10: ${wk.title}` : `Day one is in ${prog.daysToStart} days`}</h2>
        <p>{prog.started ? wk.mission : 'Monday 16 Nov starts the programme, the day after Larnaka. Until then your Garmin schedule covers the taper and the race. Take a look at what Quarter 1 holds.'}</p>
        <div className="row"><button className="btn sm" onClick={() => setTab('quarter')}>Open Quarter 1</button>{prog.streak > 0 && <span className="pill good">{prog.streak}-cycle streak</span>}</div>
      </div>
      {c && c.total > 0 && (
        <div className="qs-w"><Ring value={(c.done / c.total) * 100} size={78}><b>{c.done}/{c.total}</b></Ring><span>this cycle</span></div>
      )}
    </section>
  );
}

export default function Dashboard({ plan, date, decision, metrics, garmin, scenario, manual, setManual, settings, setSettings, history, review, log, setTab, goLog, openDay, step, backToToday, isPreview }) {
  const sessions = useMemo(() => sessionsOn(plan, date).map((x) => applyReview(x, review)), [plan, date, review]);
  const ph = phaseOn(plan, date);
  const results = useMemo(() => sessions.map((s) => adaptSession(s, decision, metrics)), [sessions, decision, metrics]);
  const head = results.find((r) => r.session.group !== 'rest') || results[0];
  const week = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => addDays(date, k)).filter((d) => d <= plan.end);
  const larnaka = plan.races.find((r) => r.id === 'larnaka');
  const ev = nextEvent(plan, date);
  const days = (e) => diffDays(e.date, date);
  const g = garmin;
  const prog = useMemo(() => quarterProgress(plan, g, log, date), [plan, g, log, date]);
  const past = date > plan.end;
  return (
    <div className="stack">
      <div className="daybar">
        <div>
          <div className="when"><h1>{fmtLong(date)}</h1></div>
          <p className="sub">{ph ? ph.name : ''}{plan.days[date]?.microcycle === 10 ? ' · 10-day block' : ''}</p>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="stepper"><button className="btn sm icon" onClick={() => step(-1)} aria-label="Previous day">‹</button><button className="btn sm icon" onClick={() => step(1)} aria-label="Next day">›</button></div>
            {isPreview && <button className="btn sm" onClick={backToToday}>Back to today</button>}
            {isPreview && <span className="pill" style={{ background: 'var(--warn-bg)' }}>Previewing another day</span>}
          </div>
        </div>
        <div className="countdowns">
          {ev.nextRace && <div className="cd"><div className="n" style={{ background: 'var(--s-race)' }}>{days(ev.nextRace)}<small>days</small></div><div className="t">{ev.nextRace.name}<span>{ev.nextRace.goal || fmtShort(ev.nextRace.date)}</span></div></div>}
          {ev.nextCheckpoint && <div className="cd"><div className="n" style={{ background: 'var(--s-checkpoint)', color: '#1b1300' }}>{days(ev.nextCheckpoint)}<small>days</small></div><div className="t">{ev.nextCheckpoint.name.replace(/^Checkpoint (\d): /, 'Test $1 · ')}<span>{fmtShort(ev.nextCheckpoint.date)}</span></div></div>}
        </div>
      </div>

      <Hero prog={prog} plan={plan} g={g} log={log} date={date} setTab={setTab} />

      <div className="grid g-today">
        <div className="board-col">
          {sessions.length === 0 && (
            <div className="board empty-day">
              <h3>{past ? 'Beyond Quarter 1' : date < plan.start ? 'Taper and race week' : 'Nothing planned'}</h3>
              <p className="rest-note">{past ? 'Quarter 1 ends with the Mažeikiai 10K on 16 Feb. The next quarter unlocks on 17 Feb, or earlier if you switch it on in Settings.'
                : date < plan.start ? <>Your Season 26/27 programme starts <b>Monday {fmtShort(plan.start)}</b>, the day after Larnaka ({diffDays(larnaka.date, date)} days to go). Until then your Garmin schedule covers the taper and race. Use the arrows to step into the programme.</>
                : 'No sessions are planned for this date.'}</p>
            </div>
          )}
          {results.map((r, i) => <SessionBoard key={sessions[i].id} s={sessions[i]} result={r} onLog={goLog} minor={i > 0} done={isDone(g, log, sessions[i])} />)}
        </div>
        <Readiness decision={decision} headline={head?.headline} metrics={metrics} garmin={garmin} scenario={scenario} date={date} trim={decision.trim} />
      </div>

      {week.length > 0 && (
        <section className="card">
          <div className="card-h"><h2>The next 10 days</h2><span className="sec-note">Tap a day for the full session{decision.trim > 0 ? ` · volume trimmed ${Math.round(decision.trim * 100)}%` : ''}</span></div>
          <div className="wk">
            {week.map((d, i) => {
              const ss = sessionsOn(plan, d).map((s) => applyTrim(applyReview(s, review), i === 0 ? 0 : decision.trim));
              return (
                <button key={d} className={`wk-day ${i === 0 ? 'today' : ''}`} onClick={() => openDay(d)} aria-label={`${fmtLong(d)}: ${ss.map(chipLabel).join(', ') || 'nothing planned'}`}>
                  <span className="d"><span>{i === 0 ? (isPreview ? fmtDow(d) : 'Today') : fmtDow(d)}</span><b>{d.slice(8).replace(/^0/, '')}</b></span>
                  {ss.map((s) => <span key={s.id} className={`blk ${s.group === 'rest' ? 'rest' : ''} ${s.group === 'checkpoint' ? 'ck' : ''} ${isDone(g, log, s) ? 'done' : ''}`} style={{ '--sc': gc(s.group) }}>{chipLabel(s)}{s.minutes > 0 && s.group !== 'rest' ? <small>{s.minutes >= 90 ? `${Math.floor(s.minutes / 60)}h${String(s.minutes % 60).padStart(2, '0')}` : `${s.minutes} min`}{s.trimmed ? ` · −${s.trimmed}%` : ''}</small> : null}</span>)}
                  {ss.length === 0 && <span className="none">{d < plan.start ? 'Garmin plan' : 'Nothing planned'}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {prog.started && <CoachCard review={review} />}

      <details className="card fold">
        <summary><h2>More tools</h2><span className="sec-note">Season timeline, quick entry</span></summary>
        <div className="stack" style={{ marginTop: 14 }}>
          <Ribbon plan={plan} date={date} />
          <div className="grid g-2">
            <QuickEntry date={date} manual={manual} setManual={setManual} />
          </div>
        </div>
      </details>
    </div>
  );
}
