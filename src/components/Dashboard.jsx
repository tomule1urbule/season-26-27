import { useMemo } from 'react';
import Ribbon from './Ribbon.jsx';
import { SessionBoard, Ring, Sparkline, LEVEL, chipLabel, gc } from './ui.jsx';
import { adaptSession, applyTrim, microcycleAdvice, RULES } from '../lib/adapt.js';
import { addDays, diffDays, fmtLong, fmtShort, fmtDow, mondayOf } from '../lib/dates.js';
import { nextEvent, phaseOn, sessionsOn } from '../lib/plan.js';

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

function Advisor({ advice, settings, setSettings, date, plan }) {
  const active = settings.tenDay.some((t) => date >= t.from && date < addDays(t.from, t.blocks * 10));
  const nextMon = (() => { const m = addDays(mondayOf(date), 7); return m < plan.start ? plan.start : m; })();
  return (
    <section className="card adjust">
      <div className="card-h"><h2>Microcycle</h2><span className="pill">{active ? '10-day block active' : '7-day weeks'}</span></div>
      <p className="small ink2">{advice.recommend === 10 ? `Fatigue or life load is high (${advice.reasons.join('; ')}). A 10-day block adds three easy recovery days per block so the same sessions are spread over more days.` : advice.thin ? 'Not enough Garmin days in the last week to judge fatigue, so standard 7-day weeks stay. Sync Garmin or tick “high life load” in Settings.' : 'Recovery looks fine, so keep standard 7-day weeks. The advisor re-checks the last 7 days of Garmin data every time you open the app.'}</p>
      <div className="row" style={{ marginTop: 10 }}>
        {advice.recommend === 10 && !active && <button className="btn primary sm" onClick={() => setSettings({ ...settings, tenDay: [...settings.tenDay, { from: nextMon, blocks: 1 }] })}>Plan one 10-day block from {fmtShort(nextMon)}</button>}
        {settings.tenDay.length > 0 && <button className="btn sm" onClick={() => setSettings({ ...settings, tenDay: [] })}>Back to 7-day weeks</button>}
      </div>
    </section>
  );
}

export default function Dashboard({ plan, date, decision, metrics, garmin, scenario, manual, setManual, settings, setSettings, history, goLog, openDay, step, backToToday, isPreview }) {
  const sessions = sessionsOn(plan, date);
  const ph = phaseOn(plan, date);
  const results = useMemo(() => sessions.map((s) => adaptSession(s, decision, metrics)), [sessions, decision, metrics]);
  const head = results.find((r) => r.session.group !== 'rest') || results[0];
  const advice = useMemo(() => microcycleAdvice(history.filter((h) => h.d <= date && diffDays(date, h.d) < 7), settings.lifeLoadHigh), [history, settings.lifeLoadHigh, date]);
  const week = [0, 1, 2, 3, 4, 5, 6].map((k) => addDays(date, k));
  const larnaka = plan.races.find((r) => r.id === 'larnaka');
  const ev = nextEvent(plan, date);
  const days = (e) => diffDays(e.date, date);
  const wk = plan.days[date]?.wk;
  return (
    <div className="stack">
      <div className="daybar">
        <div>
          <div className="when">
            <h1>{fmtLong(date)}</h1>
          </div>
          <p className="sub">{ph ? ph.name : ''}{wk != null ? ` · week ${wk + 1} of the phase` : ''}{plan.days[date]?.microcycle === 10 ? ' · 10-day block' : ''}</p>
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

      <div className="grid g-today">
        <div className="board-col">
          {sessions.length === 0 && (
            <div className="board empty-day">
              <h3>{date < plan.start ? 'Taper and race week' : 'Nothing planned'}</h3>
              <p className="rest-note">{date < plan.start
                ? <>Your Season 26/27 programme starts <b>Monday {fmtShort(plan.start)}</b>, the day after Larnaka ({diffDays(larnaka.date, date)} days to go). Until then your Garmin schedule covers the taper and race. Use the arrows to step into the programme.</>
                : 'No sessions are planned for this date.'}</p>
            </div>
          )}
          {results.map((r, i) => <SessionBoard key={sessions[i].id} s={sessions[i]} result={r} onLog={goLog} minor={i > 0} />)}
        </div>
        <Readiness decision={decision} headline={head?.headline} metrics={metrics} garmin={garmin} scenario={scenario} date={date} trim={decision.trim} />
      </div>

      <section className="card">
        <div className="card-h"><h2>The week ahead</h2><span className="sec-note">Tap a day for the full session{decision.trim > 0 ? ` · volume trimmed ${Math.round(decision.trim * 100)}%` : ''}</span></div>
        <div className="wk">
          {week.map((d, i) => {
            const ss = sessionsOn(plan, d).map((s) => applyTrim(s, i === 0 ? 0 : decision.trim));
            return (
              <button key={d} className={`wk-day ${i === 0 ? 'today' : ''}`} onClick={() => openDay(d)} aria-label={`${fmtLong(d)}: ${ss.map(chipLabel).join(', ') || 'nothing planned'}`}>
                <span className="d"><span>{i === 0 ? (isPreview ? fmtDow(d) : 'Today') : fmtDow(d)}</span><b>{d.slice(8).replace(/^0/, '')}</b></span>
                {ss.map((s) => <span key={s.id} className={`blk ${s.group === 'rest' ? 'rest' : ''} ${s.group === 'checkpoint' ? 'ck' : ''}`} style={{ '--sc': gc(s.group) }}>{chipLabel(s)}{s.minutes > 0 && s.group !== 'rest' ? <small>{s.minutes >= 90 ? `${Math.floor(s.minutes / 60)}h${String(s.minutes % 60).padStart(2, '0')}` : `${s.minutes} min`}{s.trimmed ? ` · −${s.trimmed}%` : ''}</small> : null}</span>)}
                {ss.length === 0 && <span className="none">{d < plan.start ? 'Garmin plan' : 'Nothing planned'}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card"><div className="card-h"><h2>The season</h2><span className="sec-note">Bands are phases, flags are races, diamonds are fitness tests</span></div><Ribbon plan={plan} date={date} /></section>

      <div className="grid g-2">
        <Advisor advice={advice} settings={settings} setSettings={setSettings} date={date} plan={plan} />
        <QuickEntry date={date} manual={manual} setManual={setManual} />
      </div>
    </div>
  );
}
