import { useMemo } from 'react';
import { BarChart, LineChart } from './charts.jsx';
import Checkpoints from './Checkpoints.jsx';
import { activityTss, weeklyActuals } from '../lib/garmin.js';
import { weeklySummary } from '../lib/plan.js';
import { addDays, diffDays, fmtShort, mondayOf } from '../lib/dates.js';

const SPORT_COLORS = { run: 'var(--s-run)', bike: 'var(--s-bike)', swim: 'var(--s-swim)', strength: 'var(--s-strength)' };
const h1 = (m) => Math.round((m / 60) * 10) / 10;

function Compliance({ plan, garmin, date }) {
  const g = garmin?.data;
  const asOf = g?.meta?.asOf?.slice(0, 10);
  const { cats, actual, planned, rows } = useMemo(() => {
    const planWeeks = Object.fromEntries(weeklySummary(plan).map((w) => [w.week, w]));
    const act = weeklyActuals(g, mondayOf);
    const mon = mondayOf(date);
    const cats = [];
    for (let i = -11; i <= 12; i++) { const w = addDays(mon, i * 7); cats.push({ key: w, label: fmtShort(w) }); }
    const hasAct = (w) => asOf && w <= asOf;
    const actual = Object.fromEntries(Object.keys(SPORT_COLORS).map((s) => [s, cats.map((c) => (hasAct(c.key) && act[c.key] ? h1(act[c.key].bySport[s]) : 0))]));
    const actualTss = cats.map((c) => (hasAct(c.key) && act[c.key] ? Math.round(act[c.key].tss) : 0));
    const planned = cats.map((c) => (planWeeks[c.key] ? h1(planWeeks[c.key].minutes) : null));
    const plannedTss = cats.map((c) => (planWeeks[c.key] ? Math.round(planWeeks[c.key].tss) : null));
    const rows = cats.filter((c, i) => planWeeks[c.key] && addDays(c.key, 6) <= (asOf || '0000') && act[c.key]).map((c) => {
      const p = planWeeks[c.key], a = act[c.key];
      return { week: c.key, pMin: p.minutes, aMin: a.minutes, pKm: p.runKm, aKm: a.runKm, pTss: p.tss, aTss: a.tss };
    });
    return { cats, actual: { hours: actual, tss: actualTss }, planned: { hours: planned, tss: plannedTss }, rows };
  }, [plan, g, date, asOf]);
  const stacks = Object.keys(SPORT_COLORS).map((s) => ({ name: s[0].toUpperCase() + s.slice(1), color: SPORT_COLORS[s], values: actual.hours[s] }));
  return (
    <section className="card">
      <div className="card-h"><h2>Planned vs actual</h2><span className="small muted">Actual comes from Garmin activities up to {asOf ? fmtShort(asOf) : '–'}; the plan starts {fmtShort(plan.start)}.</span></div>
      <div className="grid g-2">
        <BarChart title="Weekly volume (hours)" cats={cats} stacks={stacks} marks={{ name: 'Planned', color: 'var(--ink)', values: planned.hours }} yFmt={(v) => (Math.round(v * 10) / 10)} unit=" h" />
        <BarChart title="Weekly intensity (est. TSS)" cats={cats} stacks={[{ name: 'Actual (HR-based)', color: 'var(--s-run)', values: actual.tss }]} marks={{ name: 'Planned', color: 'var(--ink)', values: planned.tss }} yFmt={(v) => Math.round(v)} />
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>Actual TSS is estimated from average heart rate (threshold {172} bpm, resting 45), so it is a trend gauge rather than a power-based score. Strength counts as 30 TSS per hour.</p>
      <div className="scroll-x" style={{ marginTop: 10 }}>
        {rows.length === 0 ? <div className="empty small">Compliance appears here as soon as a planned week has finished and Garmin has synced it. The first planned week is {fmtShort(plan.start)}.</div> : (
          <table className="t">
            <thead><tr><th>Week</th><th>Planned h</th><th>Actual h</th><th>Compliance</th><th>Run km (plan / actual)</th><th>TSS (plan / actual)</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.week}><td>{fmtShort(r.week)}</td><td className="n">{h1(r.pMin)}</td><td className="n">{h1(r.aMin)}</td><td className="n">{Math.round((r.aMin / r.pMin) * 100)}%</td><td className="n">{Math.round(r.pKm)} / {Math.round(r.aKm)}</td><td className="n">{Math.round(r.pTss)} / {Math.round(r.aTss)}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function LoadHrv({ garmin }) {
  const g = garmin?.data;
  if (!g) return <section className="card"><h2>HRV vs workload</h2><div className="empty" style={{ marginTop: 10 }}>No Garmin snapshot loaded.</div></section>;
  const d0 = g.hrv[0].d, d1 = g.hrv[g.hrv.length - 1].d;
  const load = g.load.filter((l) => l.d >= d0);
  const acwr = load.map((l) => ({ d: l.d, v: Math.round((l.atl / l.ctl) * 100) / 100 }));
  const flags = acwr.filter((p) => p.v > 1.4).map((p) => p.d);
  const hrvOn = (d) => g.hrv.find((x) => x.d === d);
  const flagRows = flags.map((d) => { const next = [1, 2].map((k) => hrvOn(addDays(d, k))).filter(Boolean); return { d, ratio: acwr.find((a) => a.d === d).v, hrv: hrvOn(d)?.last, next: next.map((x) => x.last) }; });
  return (
    <section className="card">
      <div className="card-h"><h2>HRV vs workload</h2><span className="small muted">{fmtShort(d0)} – {fmtShort(d1)} · red stripes mark days the load ratio exceeded 1.4</span></div>
      <div className="stack">
        <LineChart title="Training load (Garmin)" xDomain={[d0, d1]} flags={flags} flagLabel="ratio > 1.4" series={[{ name: 'Acute (7-day)', color: 'var(--s-bike)', points: load.map((l) => ({ d: l.d, v: l.atl })) }, { name: 'Chronic (28-day)', color: 'var(--s-run)', points: load.map((l) => ({ d: l.d, v: l.ctl })) }]} height={150} />
        <LineChart title="Acute ÷ chronic load ratio" xDomain={[d0, d1]} flags={flags} flagLabel="ratio > 1.4" yDomain={[0.6, 1.6]} yFmt={(v) => (Math.round(v * 100) / 100).toFixed(2)} band={{ lo: 0.8, hi: 1.4 }} refs={[{ y: 1.4, label: 'red above 1.4' }]} series={[{ name: 'Load ratio', color: 'var(--s-strength)', points: acwr }]} height={130} note="Garmin shows this ratio rounded down (1.48 appears as 1.4); the chart uses the unrounded value." />
        <LineChart title="Overnight HRV (ms)" xDomain={[d0, d1]} flags={flags} flagLabel="ratio > 1.4" series={[{ name: 'Last night', color: 'var(--s-swim)', points: g.hrv.map((x) => ({ d: x.d, v: x.last })) }, { name: '7-day average', color: 'var(--ink)', dashed: true, dots: false, points: g.hrv.map((x) => ({ d: x.d, v: x.weekly })) }]} height={150} />
      </div>
      {flagRows.length > 0 && (
        <p className="small ink2" style={{ marginTop: 10 }}>
          {flagRows.map((r) => `${fmtShort(r.d)}: ratio ${r.ratio.toFixed(2)}, HRV that night ${r.hrv ?? '–'} ms, next two nights ${r.next.join(' / ') || '–'} ms`).join(' · ')}.
          {' '}HRV stayed in the balanced range, so the load spike was absorbed – the engine would still have turned those days red (rule: ratio &gt; 1.4) and trimmed the following week 15%.
        </p>
      )}
    </section>
  );
}

export default function Analytics({ plan, garmin, date, today, results, setResults, recal }) {
  return (
    <div className="stack">
      <Compliance plan={plan} garmin={garmin} date={date} />
      <LoadHrv garmin={garmin} />
      <Checkpoints plan={plan} today={today} results={results} setResults={setResults} recal={recal} />
    </div>
  );
}
