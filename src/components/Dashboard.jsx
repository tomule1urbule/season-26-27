import { useMemo, useState } from 'react';
import Ribbon from './Ribbon.jsx';
import { SessionCard, LEVEL, chipLabel, gc } from './ui.jsx';
import { adaptSession, applyTrim, microcycleAdvice, RULES } from '../lib/adapt.js';
import { addDays, diffDays, fmtLong, fmtShort, fmtDow, mondayOf } from '../lib/dates.js';
import { nextEvent, phaseOn, sessionsOn } from '../lib/plan.js';

function Banner({ decision, headline, manual }) {
  const L = LEVEL[decision.level];
  return (
    <div className={`banner ${L.cls}`} role="status">
      <div className="ic" aria-hidden="true">{L.icon}</div>
      <h3>{L.label}{headline ? ` — ${headline}` : ''}</h3>
      <div>
        <ul>{decision.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        {decision.trim > 0 && <p className="small" style={{ marginTop: 6 }}><b>Overreach warning:</b> next 7 days are trimmed by {Math.round(decision.trim * 100)}%.</p>}
        {manual && <p className="small muted" style={{ marginTop: 4 }}>Using the numbers you typed in for this day.</p>}
      </div>
    </div>
  );
}

function GarminWidget({ metrics, garmin, scenario, date }) {
  const m = metrics || {};
  const asOf = garmin?.meta?.asOf;
  const age = asOf ? diffDays(date, asOf.slice(0, 10)) : null;
  const rl = m.readiness;
  const acwr = m.acwr;
  const tone = (v, lo, hi) => (v == null ? '' : v >= hi ? 'st-good' : v >= lo ? 'st-warn' : 'st-crit');
  return (
    <section className="card">
      <div className="card-h">
        <h2>Garmin readings</h2>
        <span className="pill">{scenario !== 'live' ? `Demo: ${scenario}` : asOf ? `Snapshot ${fmtShort(asOf.slice(0, 10))} ${asOf.slice(11, 16)}` : 'No snapshot loaded'}</span>
      </div>
      {!metrics && <div className="empty small">No Garmin readings for {fmtShort(date)}. {age > 0 ? `The snapshot is ${age} day${age > 1 ? 's' : ''} old – ask Claude to refresh it, or type this morning’s numbers into Quick entry.` : ''}</div>}
      {metrics && (
        <div className="tiles">
          <div className="tile"><div className="k">Training readiness</div><div className={`v num ${tone(rl, 50, 75)}`}>{rl ?? '–'}</div><div className="s">{m.readinessFeedback ? m.readinessFeedback.replace(/_/g, ' ').toLowerCase() : rl != null ? (rl > 75 ? 'high' : rl >= 50 ? 'moderate' : 'low') : ''}</div><div className="bar"><i style={{ width: `${rl ?? 0}%` }} /></div></div>
          <div className="tile"><div className="k">HRV status</div><div className={`v ${m.hrvStatus === 'BALANCED' ? 'st-good' : m.hrvStatus === 'LOW' ? 'st-warn' : m.hrvStatus ? 'st-crit' : ''}`} style={{ fontSize: 20, paddingTop: 4 }}>{m.hrvStatus ? m.hrvStatus.toLowerCase() : '–'}</div><div className="s num">{m.hrvLast ? `last night ${m.hrvLast} ms` : ''}{m.hrvWeekly ? ` · 7-day ${m.hrvWeekly}` : ''}</div></div>
          <div className="tile"><div className="k">Sleep score</div><div className={`v num ${tone(m.sleepScore, 60, 80)}`}>{m.sleepScore ?? '–'}</div><div className="s num">{m.sleepHours ? `${m.sleepHours} h` : ''}{m.rhr ? ` · RHR ${m.rhr}` : ''}</div></div>
          <div className="tile"><div className="k">Load ratio (7d ÷ 28d)</div><div className={`v num ${acwr == null ? '' : acwr > RULES.redAcwr ? 'st-crit' : acwr > RULES.cautionAcwr ? 'st-warn' : 'st-good'}`}>{acwr != null ? acwr.toFixed(2) : '–'}</div><div className="s num">{m.acute ? `acute ${m.acute} · chronic ${m.chronic}` : `red above ${RULES.redAcwr}`}</div></div>
        </div>
      )}
      {metrics && m.recoveryHours != null && <p className="small muted" style={{ marginTop: 10 }}>Garmin recovery time left: {m.recoveryHours} h.</p>}
    </section>
  );
}

function QuickEntry({ date, manual, setManual }) {
  const cur = manual[date] || {};
  const set = (k, v) => setManual({ ...manual, [date]: { ...cur, [k]: v } });
  const clear = () => { const n = { ...manual }; delete n[date]; setManual(n); };
  return (
    <section className="card">
      <div className="card-h"><h2>Quick entry</h2>{manual[date] && <button className="btn sm ghost" onClick={clear}>Clear</button>}</div>
      <p className="small ink2" style={{ marginBottom: 10 }}>No sync today? Type what your watch shows this morning. These override Garmin data for {fmtShort(date)} only.</p>
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

function Progress({ plan, date }) {
  const ph = phaseOn(plan, date);
  const ev = nextEvent(plan, date);
  const pct = ph ? Math.min(100, Math.max(0, (diffDays(date, ph.start) / Math.max(1, diffDays(ph.end, ph.start))) * 100)) : 0;
  const left = ph ? Math.max(0, diffDays(ph.end, date)) : 0;
  const days = (e) => diffDays(e.date, date);
  return (
    <section className="card">
      <div className="card-h"><h2>{ph ? ph.name : 'Season 26/27'}</h2>{ph && <span className="pill num">{Math.round(pct)}%</span>}</div>
      {ph && <>
        <div className="bar" style={{ height: 8 }}><i style={{ width: `${pct}%` }} /></div>
        <p className="small ink2" style={{ marginTop: 8 }}>{fmtShort(ph.start)} → {fmtShort(ph.end)} · {left} days left. {ph.focus}</p>
      </>}
      <div className="stack" style={{ marginTop: 14 }}>
        {ev.nextRace && <div className="spread"><span><b>{ev.nextRace.name}</b><br /><span className="small muted">{ev.nextRace.goal}</span></span><span className="num" style={{ fontSize: 22, fontWeight: 650 }}>{days(ev.nextRace)}<span className="small muted"> d</span></span></div>}
        {ev.nextCheckpoint && <div className="spread"><span><b>{ev.nextCheckpoint.name}</b><br /><span className="small muted">{fmtShort(ev.nextCheckpoint.date)}</span></span><span className="num" style={{ fontSize: 22, fontWeight: 650 }}>{days(ev.nextCheckpoint)}<span className="small muted"> d</span></span></div>}
      </div>
    </section>
  );
}

function Advisor({ advice, settings, setSettings, date, plan }) {
  const active = settings.tenDay.some((t) => date >= t.from && date < addDays(t.from, t.blocks * 10));
  const nextMon = (() => { const m = addDays(mondayOf(date), 7); return m < plan.start ? plan.start : m; })();
  return (
    <section className="card">
      <div className="card-h"><h2>Microcycle</h2><span className="pill">{active ? '10-day block active' : '7-day weeks'}</span></div>
      <p className="small ink2">{advice.recommend === 10 ? `Fatigue or life load is high (${advice.reasons.join('; ')}). A 10-day block adds three easy recovery days per block so the same sessions are spread over more days.` : advice.thin ? 'Not enough Garmin days in the last week to judge fatigue, so standard 7-day weeks stay. Sync Garmin or tick “high life load” in Settings.' : 'Recovery looks fine, so keep standard 7-day weeks. The advisor re-checks the last 7 days of Garmin data every time you open the app.'}</p>
      <div className="row" style={{ marginTop: 10 }}>
        {advice.recommend === 10 && !active && <button className="btn primary sm" onClick={() => setSettings({ ...settings, tenDay: [...settings.tenDay, { from: nextMon, blocks: 1 }] })}>Plan one 10-day block from {fmtShort(nextMon)}</button>}
        {settings.tenDay.length > 0 && <button className="btn sm" onClick={() => setSettings({ ...settings, tenDay: [] })}>Back to 7-day weeks</button>}
      </div>
    </section>
  );
}

export default function Dashboard({ plan, date, decision, metrics, garmin, scenario, manual, setManual, settings, setSettings, history, goLog, openDay }) {
  const sessions = sessionsOn(plan, date);
  const ph = phaseOn(plan, date);
  const results = useMemo(() => sessions.map((s) => adaptSession(s, decision, metrics)), [sessions, decision, metrics]);
  const head = results.find((r) => r.session.group !== 'rest') || results[0];
  const advice = useMemo(() => microcycleAdvice(history.filter((h) => h.d <= date && diffDays(date, h.d) < 7), settings.lifeLoadHigh), [history, settings.lifeLoadHigh, date]);
  const upcoming = [1, 2, 3, 4, 5, 6, 7].map((k) => addDays(date, k));
  const larnaka = plan.races.find((r) => r.id === 'larnaka');
  return (
    <div className="stack">
      <section className="card"><div className="card-h"><h2>Season at a glance</h2><span className="small muted">Flags are races, diamonds are fitness checkpoints</span></div><Ribbon plan={plan} date={date} /></section>
      <div className="grid g-dash">
        <div className="stack">
          <section className="card">
            <div className="card-h"><div><h2>{fmtLong(date)}</h2><span className="small muted">{ph ? ph.name : ''}{plan.days[date] ? ` · week ${plan.days[date].wk + 1} of phase` : ''}{plan.days[date]?.microcycle === 10 ? ' · 10-day block' : ''}</span></div></div>
            {sessions.length > 0 && <Banner decision={decision} headline={head?.headline} manual={metrics?.manual} />}
            <div style={{ marginTop: sessions.length ? 14 : 0 }}>
              {sessions.length === 0 && (
                <div className="empty">
                  {date < plan.start
                    ? <>Your Season 26/27 programme starts <b>Monday {fmtShort(plan.start)}</b>, the day after Larnaka. Until then your current Garmin schedule covers the taper and race ({diffDays(larnaka.date, date)} days to go). Use the date control in the header to preview any day of the programme.</>
                    : 'No sessions are planned for this date.'}
                </div>
              )}
              {results.map((r, i) => <SessionCard key={sessions[i].id} s={sessions[i]} result={r} onLog={goLog} />)}
            </div>
          </section>
        </div>
        <div className="stack">
          <GarminWidget metrics={metrics} garmin={garmin} scenario={scenario} date={date} />
          <Progress plan={plan} date={date} />
          <Advisor advice={advice} settings={settings} setSettings={setSettings} date={date} plan={plan} />
          <QuickEntry date={date} manual={manual} setManual={setManual} />
        </div>
      </div>
      <section className="card">
            <div className="card-h"><h2>Next 7 days</h2>{decision.trim > 0 && <span className="pill" style={{ background: 'var(--warn-bg)' }}>trimmed {Math.round(decision.trim * 100)}%</span>}</div>
            {upcoming.every((d) => !sessionsOn(plan, d).length) && <div className="empty small">Nothing from this programme is scheduled in the next 7 days. Your Garmin calendar covers the taper and race until {fmtShort(plan.start)}.</div>}
            <div className="stack" style={{ marginTop: 0 }}>
              {upcoming.filter((d) => sessionsOn(plan, d).length).map((d) => {
                const ss = sessionsOn(plan, d).map((s) => applyTrim(s, decision.trim));
                return (
                  <button key={d} className="btn ghost" style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 10, textAlign: 'left', width: '100%', padding: '4px 6px' }} onClick={() => openDay(d)}>
                    <span className="small muted">{fmtDow(d)} {fmtShort(d)}</span>
                    <span className="row" style={{ gap: 6 }}>{ss.length ? ss.map((s) => <span key={s.id} className="chip" style={{ '--sc': gc(s.group) }}>{chipLabel(s)}{s.trimmed ? ` −${s.trimmed}%` : ''}</span>) : <span className="muted small">–</span>}</span>
                  </button>
                );
              })}
            </div>
          </section>

    </div>
  );
}
