import { useMemo, useState } from 'react';
import { REFS, GRADE_LABEL, VERIFY_LABEL } from '../lib/evidence.js';
import { REVIEW_RULES } from '../lib/coach.js';
import { BLOCKS } from '../lib/strength.js';
import { intensityMix } from '../lib/plan.js';

const pc = (x) => `${Math.round(x * 100)}%`;

export default function Method({ plan }) {
  const mix = useMemo(() => intensityMix(plan), [plan]);
  const [filter, setFilter] = useState('all');
  const refs = Object.entries(REFS).filter(([, r]) => filter === 'all' || r.v === filter);
  return (
    <div className="stack">
      <section className="card">
        <div className="card-h"><h2>How the programme is built</h2></div>
        <div className="method">
          <p><b>Intensity distribution.</b> About 80% of endurance sessions are easy, 20% hard, and never more than four hard sessions in a 10-day cycle (Seiler 2010; Esteve-Lanao 2007; Stöggl and Sperlich 2014). Measured on this plan:</p>
          <table className="t"><thead><tr><th>Phase</th><th>Easy sessions</th><th>Hard sessions</th><th>Hard share</th></tr></thead><tbody>
            {mix.map((m) => { const ph = plan.phases.find((p) => p.id === m.phaseId); return ph && m.phaseId >= 1 ? <tr key={m.phaseId}><td>{ph.name}</td><td className="num">{m.easy}</td><td className="num">{m.hard}</td><td className="num">{pc(m.share)}</td></tr> : null; })}
          </tbody></table>
          <p className="small muted">Hard means VO₂max, threshold, tempo or race-pace work, races and tests. Counted by session, as in the research.</p>
          <p><b>Strength.</b> Heavy lifting (5–7 repetitions, 2 in reserve, slow lowering) improves running economy in trained runners (Rønnestad and Mujika 2014; Blagrove 2018; Berryman 2018). The year is cycled: {Object.values(BLOCKS).map((b) => b.label).join(' → ')}. Loads come from your own logged sets, not from the plan.</p>
          <p><b>Timing.</b> One full-body session every 10-day cycle on its own day (a rest day before, an easy run after), plus an upper-body and trunk session on every other cycle’s spare day, so there is no leg work near the long run. Nothing else is planned on any day, so there is no same-day interference between strength and endurance work (Robineau 2016). The upper-body lifts alternate every week.</p>
          <p><b>Taper.</b> Two weeks, volume down 40–60% in steps, intensity and frequency kept (Bosquet 2007). For Riga the long run is 16 km three weeks out, and the final two weeks run about 40% and 70% below your peak week (race excluded).</p>
          <p><b>Progression.</b> No fixed 10% rule (Nielsen 2014). Build two to three weeks, then ease off. Cycle-to-cycle jumps above about 45% over the best of the previous four 10-day cycles are flagged in the tests.</p>
        </div>
      </section>
      <section className="card">
        <div className="card-h"><h2>How it adapts</h2></div>
        <div className="method">
          <p><b>Every morning</b> (see the rules table above): readiness, HRV status, sleep and load ratio decide green, yellow or red, which changes only today’s session.</p>
          <p><b>Every few days</b> the coach review looks at the previous 7 days of recovery data and the previous 10 days of running, and decides whether the next stretch progresses, holds or deloads. It scores these signals:</p>
          <ul className="small">
            <li>HRV 7-day average against the 14 nights before: {Math.round((1 - REVIEW_RULES.hrvDrop) * 100)}% lower is a warning, {Math.round((1 - REVIEW_RULES.hrvBigDrop) * 100)}% lower is a stop sign (1 and 2 points).</li>
            <li>Sleep score below {REVIEW_RULES.sleepLow} or under {REVIEW_RULES.sleepHours} h a night (1 point); below {REVIEW_RULES.sleepBad} (2 points).</li>
            <li>Resting heart rate 3 bpm above its baseline (1) or 5 bpm (2).</li>
            <li>Load ratio above {REVIEW_RULES.acwrWarn} (1) or {REVIEW_RULES.acwrHigh} (2). This ratio is a prompt, not a predictor (Impellizzeri 2020).</li>
            <li>Two or more red days in the week (2); four or more yellow or red days (1).</li>
            <li>Your own log: average effort of {REVIEW_RULES.rpeHigh}/10 or more, or low mood (1 each).</li>
          </ul>
          <p>Score {REVIEW_RULES.holdScore}–{REVIEW_RULES.deloadScore - 1}: <b>hold</b> (easy and long volume −{Math.round((1 - REVIEW_RULES.holdFactor) * 100)}%, key sessions stay). Score {REVIEW_RULES.deloadScore}+: <b>deload</b> (−{Math.round((1 - REVIEW_RULES.deloadFactor) * 100)}% on everything except races and tests, one fewer set in the gym). Below that the plan runs as written.</p>
          <p>If you ran well under the plan, the coming week is capped at +20% over what you actually ran. HRV-guided training helps manage fatigue but has only small effects on performance in the evidence so far (Düking 2021), so these rules protect recovery and do not promise faster times.</p>
          <p><b>Strength loads</b> follow what you log. The next load is calculated from your last set with the Epley formula, aimed at the middle of the rep range at the block’s reps in reserve, and never more than 15% above the last load.</p>
          <p><b>Fitness tests</b> every 4–8 weeks re-scale paces, FTP and swim pace for the whole programme (Checkpoints tab).</p>
        </div>
      </section>
      <section className="card">
        <div className="card-h"><h2>References</h2>
          <div className="seg" role="group" aria-label="Filter by verification">{[['all', 'All'], ['read', 'Checked'], ['exists', 'Confirmed'], ['memory', 'From memory']].map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div></div>
        <p className="small muted" style={{ marginBottom: 10 }}>“Checked” means the abstract was read while the app was built. “Confirmed” means the paper exists with those authors, journal and year, but its text was not read. “From memory” entries have not been re-checked: look them up before relying on them.</p>
        <ul className="refs full">
          {refs.map(([id, r]) => (
            <li key={id}>
              <span className="rc">{r.cite}{r.doi ? <> · doi:{r.doi}</> : null}</span>
              <span className="rf">{r.finding}</span>
              <span className="rb"><i className={`g-${r.grade}`}>{GRADE_LABEL[r.grade]}</i><i className={`v-${r.v}`}>{VERIFY_LABEL[r.v]}</i></span>
            </li>
          ))}
        </ul>
        <div className="empty small" style={{ marginTop: 12 }}><b>Honest limits.</b> Most trials are short, small and in sub-elite or recreational athletes. The 80/20 split, heavy strength for economy and the two-week taper are well supported. Three-up-one-down build cycles, swim drills, the load ratio and the weekly scoring thresholds are sensible coaching practice with weak or no direct trial evidence. Treat them as defaults you can overrule.</div>
      </section>
    </div>
  );
}
