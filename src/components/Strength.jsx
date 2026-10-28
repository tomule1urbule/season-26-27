import { createContext, useContext } from 'react';
import { LIB, GROUP_LABEL, BLOCKS, resolveSession } from '../lib/strength.js';
import { refList, whyFor, GRADE_LABEL, VERIFY_LABEL } from '../lib/evidence.js';
import { useStored } from '../lib/store.js';
import { fmtShort } from '../lib/dates.js';

export const LiftsContext = createContext({});
export const useLifts = () => useContext(LiftsContext);

// Stick-figure pictograms, one per movement. 24×24, drawn with currentColor.
const P = {
  split: <><circle cx="11" cy="4.2" r="1.7" /><path d="M11 6.5V12M11 12l4.5 2.2V20M11 12l-5 3.5M3 14.5h4M11 8l3 1.5" /></>,
  hinge: <><circle cx="5" cy="8" r="1.7" /><path d="M6.7 9l8 2M14.7 11V20M14.7 11l6.3-2.5M9 10.2v5" /><circle cx="9" cy="16.2" r="1.4" /></>,
  squat: <><circle cx="12" cy="4.2" r="1.7" /><path d="M12 6.5l-1.5 5.5 5.5 1.2-1 6.8M12 8.5l3.5 1" /><circle cx="16.2" cy="9.8" r="1.4" /></>,
  bridge: <><circle cx="4" cy="9.5" r="1.7" /><path d="M2.5 13h4M6 12l8-2 3 4v6M14 10l.2 4" /><path d="M13 8.2h3" strokeWidth="2.6" /></>,
  press: <><circle cx="3.8" cy="12.5" r="1.7" /><path d="M2 16.5h20M5.5 14.5h9l2.5 2M11 14.5V5.5M8.5 5.5h5" /></>,
  row: <><circle cx="7" cy="6.3" r="1.7" /><path d="M8.3 7.8l7 4M15.3 11.8V20M15.3 11.8l4.7 3M10.5 9.8v6M3 12h5.5" /><circle cx="10.5" cy="17" r="1.4" /></>,
  pullover: <><circle cx="4" cy="11.8" r="1.7" /><path d="M2 15.5h20M5.7 13.7h11l3 1.8M7 12.5C9 5 15 4.5 18 9" /><circle cx="18.3" cy="9.6" r="1.3" /></>,
  raise: <><circle cx="12" cy="4.2" r="1.7" /><path d="M12 6.5V15M12 15l-3 6M12 15l3 6M12 8.2L4.5 9.5M12 8.2l7.5 1.3" /><circle cx="3.6" cy="9.7" r="1.3" /><circle cx="20.4" cy="9.7" r="1.3" /></>,
  extension: <><circle cx="11" cy="6" r="1.7" /><path d="M11 8V14.5H17V20M11 8.5l1.5-5.5M12.5 3l-3 .2" /><circle cx="9.4" cy="3.4" r="1.3" /></>,
  curl: <><circle cx="12" cy="4.2" r="1.7" /><path d="M12 6.5V15M12 15l-2.5 6M12 15l2.5 6M12 8.5l-2 3.5M10 12l3-3.5" /><circle cx="13.5" cy="7.8" r="1.3" /></>,
  plank: <><circle cx="20" cy="8" r="1.7" /><path d="M3 19.5l15-9.5M7.5 17V19.5M3 19.5h4.5" /></>,
  calf: <><circle cx="11" cy="4.2" r="1.7" /><path d="M11 6.5V16M11 16l3.2 2.6M11 16l-1 4M5 20.5h14M9 12l-3.5 1" /></>,
};
export const LiftIcon = ({ icon, size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[icon] || P.squat}</svg>
);

const rest = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const repsText = (e, lib) => {
  const r = e.reps[0] === e.reps[1] ? `${e.reps[0]}` : `${e.reps[0]}–${e.reps[1]}`;
  return lib.timed ? `${r} s` : r;
};

/** The strength session as a card list: pictogram, plain exercise name, sets x reps, load, tick-off dots. */
export function StrengthPanel({ s }) {
  const lifts = useLifts();
  const [done, setDone] = useStored('s2627.setsDone', {});
  const r = resolveSession(s, lifts);
  const blk = BLOCKS[s.block];
  const totalSets = r.exercises.reduce((a, e) => a + e.sets, 0);
  const tick = (id, n) => { const k = `${s.id}:${id}`; setDone({ ...done, [k]: (done[k] || 0) === n + 1 ? n : n + 1 }); };
  const groups = ['lower', 'upper', 'trunk'].map((g) => ({ g, items: r.exercises.filter((e) => LIB[e.id].group === g) })).filter((x) => x.items.length);
  const doneSets = r.exercises.reduce((a, e) => a + Math.min(e.sets, done[`${s.id}:${e.id}`] || 0), 0);
  return (
    <div className="lifts">
      <div className="lifts-top">
        <span><b>{r.exercises.length}</b> exercises</span>
        <span><b>{totalSets}</b> working sets</span>
        <span><b>{doneSets}</b> of {totalSets} done</span>
        <div className="prog" aria-hidden="true"><i style={{ width: `${(doneSets / totalSets) * 100}%` }} /></div>
      </div>
      {groups.map(({ g, items }) => (
        <section key={g} className="lg">
          <h4>{GROUP_LABEL[g]}</h4>
          {items.map((e) => {
            const lib = LIB[e.id];
            const d = Math.min(e.sets, done[`${s.id}:${e.id}`] || 0);
            return (
              <article className="lift" key={e.id}>
                <div className="ico"><LiftIcon icon={lib.icon} /></div>
                <div className="lift-main">
                  <div className="lift-h">
                    <h5>{lib.name}</h5>
                    {!lib.timed && e.kg > 0 && <span className="load"><b>{e.kg}</b> kg<small>{lib.unit.replace(/^kg,? ?/, '')}</small></span>}
                  </div>
                  <div className="lift-dose"><b>{e.sets} × {repsText(e, lib)}</b>{lib.side ? ' each side' : ''}</div>
                  <div className="lift-meta">
                    {!lib.timed && <span title="Reps in reserve: how many more clean reps you could do">{e.rir} in reserve</span>}
                    {e.tempo && <span title="Seconds lowering – pause – lifting">tempo {e.tempo}</span>}
                    <span>rest {rest(e.rest)}</span>
                  </div>
                  <div className="dots" role="group" aria-label={`${lib.name} sets done`}>
                    {Array.from({ length: e.sets }).map((_, i) => <button key={i} className={i < d ? 'on' : ''} aria-pressed={i < d} aria-label={`Set ${i + 1}`} onClick={() => tick(e.id, i)}>{i + 1}</button>)}
                  </div>
                  <details className="cue"><summary>How to do it</summary><p>{lib.cue}</p></details>
                  <p className="lift-src">
                    {e.last ? `Last logged: ${e.last.kg ? `${e.last.kg} kg × ` : ''}${e.last.reps}${lib.timed ? ' s' : ' reps'} on ${fmtShort(e.last.date)}.` : lib.timed ? '' : `Starting point from your Garmin on 22 Oct: ${lib.base.kg} kg × ${lib.base.reps}. If it feels easy, add 2 kg until you have about ${e.rir} reps left. Log the session and the next load follows from it.`}
                    {e.atCap && <b> {e.note}</b>}
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      ))}
      {s.extras?.length > 0 && (
        <section className="lg"><h4>Jumps (after the lifts are done, legs warm)</h4>
          {s.extras.map((x) => <div className="extra" key={x.name}><b>{x.name}</b> {x.detail}</div>)}</section>
      )}
      <p className="lifts-foot"><b>{blk.label} block.</b> {blk.focus} Loads are suggested from your logged sets (Epley estimate, up to +15 % a session). Dumbbells stop at 25 kg each, so once you are there slow the lowering instead.</p>
    </div>
  );
}

/** “Why this session”: the principle, how it applies to you, and the papers behind it. */
export function WhyPanel({ id, extra }) {
  const w = whyFor(id);
  if (!w) return null;
  const refs = refList(w.refs);
  return (
    <details className="why">
      <summary><span>Why this session</span><em>{w.title}</em></summary>
      <p>{w.use}</p>
      <p className="you"><b>For you:</b> {w.you}</p>
      {extra}
      <ul className="refs">
        {refs.map((r) => (
          <li key={r.id}>
            <span className="rc">{r.cite}{r.doi ? <> · doi:{r.doi}</> : null}</span>
            <span className="rf">{r.finding}</span>
            <span className="rb"><i className={`g-${r.grade}`}>{GRADE_LABEL[r.grade]}</i><i className={`v-${r.v}`}>{VERIFY_LABEL[r.v]}</i></span>
          </li>
        ))}
      </ul>
    </details>
  );
}
