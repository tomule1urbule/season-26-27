import { useMemo } from 'react';
import { BarChart } from './charts.jsx';
import Checkpoints from './Checkpoints.jsx';
import { LoadHrv } from './Analytics.jsx';
import { LIB } from '../lib/strength.js';
import { weeklySummary } from '../lib/plan.js';
import { weeklyActuals } from '../lib/garmin.js';
import { BASELINE, WEEKS, achievements, nowStats, quarterProgress, weekStart } from '../lib/quarter.js';
import { addDays, fmtShort, mondayOf, range } from '../lib/dates.js';

const mmss = (s) => (s == null ? '–' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const SPORTS = { run: 'var(--s-run)', bike: 'var(--s-bike)', swim: 'var(--s-swim)', strength: 'var(--s-strength)' };

function Tile({ label, start, now, fmt = (v) => v, better = 'up', unit = '' }) {
  const d = now != null && start != null ? now - start : null;
  const good = d == null || Math.abs(d) < 1e-9 ? null : better === 'up' ? d > 0 : d < 0;
  return (
    <div className="ptile">
      <span className="pl">{label}</span>
      <b>{now != null ? fmt(now) : '–'}<em>{unit}</em></b>
      <span className={`pd ${good === null ? '' : good ? 'up' : 'down'}`}>{good === null ? `Start ${fmt(start)}${unit}` : `${good ? '▲' : '▼'} ${typeof d === 'number' && fmt === mmss ? mmss(Math.abs(d)) : Math.abs(Math.round(d * 10) / 10)}${fmt === mmss ? '' : unit} since 28 Oct`}</span>
    </div>
  );
}

function Heat({ g, today, facts }) {
  const start = addDays(mondayOf(today), -15 * 7);
  const weeks = Array.from({ length: 16 }, (_, i) => addDays(start, i * 7));
  const byDay = {};
  for (const a of g?.activities || []) if (a.d >= start) byDay[a.d] = (byDay[a.d] || 0) + (a.s === 'walk' ? 0 : a.min);
  const lvl = (m) => (!m ? 0 : m < 35 ? 1 : m < 65 ? 2 : m < 110 ? 3 : 4);
  const wkMin = weeks.map((w) => range(w, addDays(w, 6)).reduce((t, d) => t + (byDay[d] || 0), 0));
  const active = range(start, today).filter((d) => byDay[d]).length;
  return (
    <section className="card">
      <div className="card-h"><h2>Your consistency</h2><span className="sec-note">{active} training days in the last 16 weeks</span></div>
      <div className="heatwrap"><div className="heat" role="img" aria-label="Training days over the last 16 weeks">
        <div className="hd">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => <span key={x}>{x}</span>)}</div>
        {weeks.map((w, wi) => (
          <div className="hr" key={w}>
            <span className="hw">{fmtShort(w)}</span>
            {range(w, addDays(w, 6)).map((d) => <i key={d} className={`l${d > today ? 'f' : lvl(byDay[d])}`} title={`${fmtShort(d)}: ${Math.round(byDay[d] || 0)} min`} />)}
            <span className="hm">{Math.round(wkMin[wi] / 60 * 10) / 10} h</span>
          </div>
        ))}
      </div>
      {facts && <div className="hfacts"><div><b>{facts.longest}<em> km</em></b><span>longest run, last 90 days</span></div><div><b>{facts.peak}<em> km</em></b><span>biggest week, last 12</span></div><div><b>{facts.weeks60}</b><span>weeks of 55 km or more</span></div></div>}</div>
      <div className="legend" style={{ marginTop: 8 }}><span className="muted">Less</span>{[0, 1, 2, 3, 4].map((l) => <i key={l} className={`hi l${l}`} />)}<span className="muted">More (excluding walks)</span></div>
    </section>
  );
}

export default function Progress({ plan, garmin, log, today, cpResults, setCpResults, recal, lifts }) {
  const g = garmin?.data;
  const prog = useMemo(() => quarterProgress(plan, g, log, today), [plan, g, log, today]);
  const now = useMemo(() => nowStats(g), [g]);
  const badges = useMemo(() => achievements(prog, plan, g, log, cpResults, lifts), [prog, plan, g, log, cpResults, lifts]);
  const earned = badges.filter((b) => b.earned).length;
  const facts = useMemo(() => {
    if (!g) return null;
    const runs = g.activities.filter((a) => a.s === 'run');
    const w = Object.values(weeklyActuals(g, mondayOf)).sort((a, b) => (a.week < b.week ? 1 : -1)).slice(0, 12);
    const peak = Math.max(...w.map((x) => x.runKm));
    const longest = Math.max(...runs.filter((a) => a.d >= addDays(today, -90)).map((a) => a.km || 0));
    const v = g.vo2max;
    return { peak: Math.round(peak), longest, vo2from: v[0], vo2to: v[v.length - 1], weeks60: w.filter((x) => x.runKm >= 55).length };
  }, [g, today]);

  // planned vs actual per Q1 week (hours)
  const chart = useMemo(() => {
    const pw = Object.fromEntries(weeklySummary(plan).map((w) => [w.week, w]));
    const act = weeklyActuals(g, mondayOf);
    const asOf = g?.meta?.asOf?.slice(0, 10);
    const cats = WEEKS.map((w, i) => ({ key: weekStart(i), label: `W${i + 1}` }));
    const h1 = (m) => Math.round((m / 60) * 10) / 10;
    const stacks = Object.keys(SPORTS).map((s) => ({ name: s[0].toUpperCase() + s.slice(1), color: SPORTS[s], values: cats.map((c) => (asOf && c.key <= asOf && act[c.key] ? h1(act[c.key].bySport[s]) : 0)) }));
    return { cats, stacks, planned: cats.map((c) => (pw[c.key] ? h1(pw[c.key].minutes) : null)) };
  }, [plan, g]);

  const key3 = ['bss', 'goblet', 'incline'].map((id) => ({ id, lib: LIB[id], last: lifts[id] }));
  const msg = !prog.started
    ? `Day one is in ${prog.daysToStart} days. You arrive with a ${facts?.longest ?? '–'} km long run and a ${facts?.peak ?? '–'} km peak week behind you. Quarter 1 builds on that.`
    : earned ? `${earned} of ${badges.length} achievements earned. ${prog.streak ? `${prog.streak} solid week${prog.streak > 1 ? 's' : ''} in a row.` : 'The first solid week starts the streak.'}` : 'Every session you do from here counts toward the first achievement.';

  return (
    <div className="stack">
      <section className="phero">
        <p className="pmsg">{msg}</p>
        <div className="ptiles">
          <Tile label="Aerobic fitness (VO₂max)" start={BASELINE.vo2max} now={now?.vo2max} fmt={(v) => v.toFixed(1)} />
          <Tile label="Resting heart rate" start={BASELINE.rhr} now={now?.rhr} better="down" unit=" bpm" />
          <Tile label="HRV, 7-day average" start={BASELINE.hrv} now={now?.hrv != null ? Math.round(now.hrv) : null} unit=" ms" />
          <Tile label="5K predicted" start={BASELINE.p5k} now={now?.p5k} fmt={mmss} better="down" />
          <Tile label="10K predicted" start={BASELINE.p10k} now={now?.p10k} fmt={mmss} better="down" />
        </div>
        <p className="psub">Starting line: Garmin on 28 Oct 2026. These update when the Garmin snapshot is refreshed. {facts && `VO₂max has gone from ${facts.vo2from.v.toFixed(1)} (${fmtShort(facts.vo2from.d)}) to ${facts.vo2to.v.toFixed(1)}.`}</p>
      </section>

      <section className="card">
        <div className="card-h"><h2>Quarter 1 aims</h2></div>
        <div className="aims">
          <div className="aim"><b>10K</b><p>Garmin predicts {mmss(BASELINE.p10k)} today. Checkpoint 2 (25 Jan) sets the race target from your 5K time trial. {cpResults?.[2] ? 'Result entered.' : ''}</p></div>
          <div className="aim"><b>Strength</b><p>Move the lower-body lifts from 10-rep loads to heavy 5–7 rep sets. Your starting loads:</p>
            <ul>{key3.map((k) => <li key={k.id}>{k.lib.name}: <b>{k.last ? `${k.last.kg} kg × ${k.last.reps}` : `${k.lib.base.kg} kg × ${k.lib.base.reps}`}</b>{k.last ? ' (latest log)' : ' (22 Oct)'}</li>)}</ul></div>
          <div className="aim"><b>Swim</b><p>Back in the water from July. Aim: a continuous swim of 600 m by mid-January and a Checkpoint 1 pace to build on.</p></div>
        </div>
      </section>

      <Heat g={g} today={today} facts={facts} />

      <section className="card">
        <div className="card-h"><h2>Quarter 1 volume</h2><span className="sec-note">Bars are what you did (from Garmin), the line is the plan</span></div>
        <BarChart title="Hours per week" cats={chart.cats} stacks={chart.stacks} marks={{ name: 'Planned', color: 'var(--ink)', values: chart.planned }} yFmt={(v) => Math.round(v * 10) / 10} unit=" h" />
      </section>

      <section className="card">
        <div className="card-h"><h2>Achievements</h2><span className="sec-note">{earned} of {badges.length}</span></div>
        <div className="badges">
          {badges.map((b) => (
            <div key={b.id} className={`badge ${b.earned ? 'on' : ''}`}>
              <span className="bi">{b.icon}</span>
              <b>{b.name}</b>
              <span>{b.earned ? 'Earned' : b.how}</span>
            </div>
          ))}
        </div>
      </section>

      <details className="card fold"><summary><h2>Recovery and load</h2><span className="sec-note">HRV, load ratio</span></summary><div style={{ marginTop: 12 }}><LoadHrv garmin={garmin} /></div></details>
      <details className="card fold" open={prog.started && today >= '2026-12-14'}><summary><h2>Fitness tests</h2><span className="sec-note">Checkpoint 1 on 28 Dec, Checkpoint 2 on 25 Jan</span></summary><div style={{ marginTop: 12 }}><Checkpoints plan={plan} today={today} results={cpResults} setResults={setCpResults} recal={recal} /></div></details>
    </div>
  );
}
