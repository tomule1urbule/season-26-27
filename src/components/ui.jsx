import { useEffect } from 'react';
import { fmtDow, fmtShort } from '../lib/dates.js';

export const GROUPS = { run: 'Run', bike: 'Bike', swim: 'Swim', strength: 'Strength', brick: 'Brick', rest: 'Rest', checkpoint: 'Checkpoint test', race: 'Race' };
export const gc = (g) => `var(--s-${g || 'rest'})`;

export const LEVEL = {
  green: { icon: '✓', label: 'Green', cls: 'green' },
  yellow: { icon: '!', label: 'Yellow', cls: 'yellow' },
  red: { icon: '✕', label: 'Red', cls: 'red' },
  unknown: { icon: '?', label: 'No data', cls: '' },
};

export const hrs = (min) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;

export function chipLabel(s) {
  if (s.group === 'race') return `RACE · ${s.title.replace(/^.*?· /, '').replace('Half Marathon', 'HM').replace(' Sprint Triathlon', ' tri')}`;
  if (s.group === 'checkpoint') return `TEST ${s.checkpoint}${s.sport === 'swim' ? ' swim' : s.sport === 'bike' ? ' bike' : ''}`;
  if (s.group === 'strength') return `Strength ${s.title.includes('B') ? 'B' : 'A'}`;
  if (s.group === 'swim') return s.meters ? `Swim ${(s.meters / 1000).toFixed(1)}k` : `Swim ${s.minutes}′`;
  if (s.group === 'run') return s.km ? `Run ${Math.round(s.km * 10) / 10} km${s.kind === 'key' ? ' ★' : s.kind === 'long' ? ' L' : ''}` : `Run ${s.minutes}′`;
  if (s.group === 'bike') return `Bike ${s.minutes}′`;
  if (s.group === 'brick') return `Brick ${s.minutes}′`;
  if (s.kind === 'recovery') return s.title.split(' · ')[0];
  return 'Rest';
}

export function Legend() {
  return (
    <div className="legend">
      {['run', 'bike', 'swim', 'strength', 'brick', 'rest', 'checkpoint', 'race'].map((g) => (
        <span key={g}><i className="dot" style={{ background: gc(g) }} />{GROUPS[g]}</span>
      ))}
      <span className="muted">★ key session · L long run</span>
    </div>
  );
}

export function Modal({ onClose, children, label }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

const KV = ({ k, v }) => v ? (<><dt>{k}</dt><dd>{v}</dd></>) : null;

/** One session. `result` (optional) is the adaptive-engine outcome for it. */
export function SessionCard({ s, result, onLog, trim }) {
  const eff = result?.session || s;
  const changed = result && ['modified', 'recovery', 'deferred'].includes(result.status);
  const showOrig = result && result.original && changed;
  return (
    <article className="sess" style={{ '--sc': gc(eff.group) }}>
      <div className="spread">
        <h3>{eff.title}</h3>
        {changed && <span className="pill" style={{ background: 'var(--warn-bg)' }}>{result.status === 'recovery' ? 'Replaced' : result.status === 'deferred' ? 'Deferred' : 'Adjusted'}</span>}
      </div>
      <div className="meta">
        {eff.minutes > 0 && <span className="pill num">{eff.minutes}′</span>}
        {eff.km > 0 && <span className="pill num">{Math.round(eff.km * 10) / 10} km</span>}
        {eff.meters > 0 && <span className="pill num">{eff.meters} m</span>}
        {eff.tss > 0 && <span className="pill num">~{eff.tss} TSS</span>}
        {eff.trimmed && <span className="pill" style={{ background: 'var(--warn-bg)' }}>−{eff.trimmed}% load trim</span>}
        <span className="pill">{{ easy: 'Easy', key: 'Key session', long: 'Long', test: 'Checkpoint', race: 'Race', strength: 'Strength', recovery: 'Recovery', rest: 'Rest' }[eff.kind] || eff.kind}</span>
      </div>
      <dl className="kv">
        <KV k="Target" v={eff.target} />
        <KV k="Warm-up" v={eff.warmup} />
        <KV k="Main" v={eff.main} />
        <KV k="Cool-down" v={eff.cooldown} />
        <KV k="Notes" v={eff.notes} />
      </dl>
      {result?.options && (
        <div className="opts">
          <div className="small muted">Pick one:</div>
          {result.options.map((o, i) => <div className="opt" key={i}><b>{o.title}</b>{o.main ? <span className="ink2"> — {o.main}</span> : null}</div>)}
        </div>
      )}
      {showOrig && (
        <details className="orig">
          <summary>Original plan: {result.original.title}</summary>
          <dl className="kv"><KV k="Target" v={result.original.target} /><KV k="Main" v={result.original.main} /></dl>
        </details>
      )}
      {onLog && eff.group !== 'rest' && <div style={{ marginTop: 12 }}><button className="btn sm" onClick={() => onLog(s)}>Log this session</button></div>}
    </article>
  );
}

export const DayTitle = ({ d }) => <>{fmtDow(d)} {fmtShort(d)}</>;
