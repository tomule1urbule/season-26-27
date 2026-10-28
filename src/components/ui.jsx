import { useEffect } from 'react';
import { fmtDow, fmtShort } from '../lib/dates.js';
import { StrengthPanel, WhyPanel, useLifts } from './Strength.jsx';
import { resolveSession, exLine } from '../lib/strength.js';
import { sessionBrief } from '../lib/brief.js';

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
  if (s.group === 'strength') return 'Strength';
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
  const lifts = useLifts();
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
        <KV k="Main" v={eff.exercises ? <ul className="exl">{resolveSession(eff, lifts).exercises.map((e) => <li key={e.id}>{exLine(e)}</li>)}</ul> : eff.main} />
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

const KIND = { easy: 'Easy', key: 'Key session', long: 'Long', test: 'Checkpoint', race: 'Race', strength: 'Strength', recovery: 'Recovery', rest: 'Rest' };
const sumMin = (t) => [...(t || '').matchAll(/(\d+)\s*[′']/g)].reduce((a, m) => a + Number(m[1]), 0);
const dur = (m) => (m >= 90 ? `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}` : null);

/** The big navy session board used on the Today tab (and in day popups). */
function Brief({ s, open }) {
  const b = sessionBrief(s);
  if (!b) return null;
  const col = (t, items) => items?.length ? <div><h4>{t}</h4><ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null;
  return (
    <details className="brief" open={open}>
      <summary><span>Coach brief</span><em>how it should feel, before, during, after</em></summary>
      <p className="feel"><b>How it should feel.</b> {b.feel}</p>
      <div className="bcols">{col('Before', b.before)}{col('During', b.during)}{col('After', b.after)}</div>
      {b.wrong?.length > 0 && <div className="bwrong"><h4>If it goes wrong</h4><ul>{b.wrong.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
    </details>
  );
}

export function SessionBoard({ s, result, onLog, minor, done, children }) {
  const eff = result?.session || s;
  const changed = result && ['modified', 'recovery', 'deferred'].includes(result.status);
  const warm = sumMin(eff.warmup), cool = sumMin(eff.cooldown), main = (eff.minutes || 0) - warm - cool;
  const struct = warm > 0 && cool > 0 && main >= 5 && eff.group !== 'rest' && !eff.exercises;
  const rest = eff.group === 'rest';
  const step = (k, v, extra, cls = '') => v ? (<div className={`step ${cls}`}><dt>{k}{extra ? <b>{extra}</b> : null}</dt><dd>{v}</dd></div>) : null;
  return (
    <article className={`board ${minor ? 'minor' : ''}`} style={{ '--sc': gc(eff.group) }}>
      <div className="kicker">
        <span className="tag"><i />{GROUPS[eff.group] || 'Session'}</span>
        {(KIND[eff.kind] || eff.kind) !== GROUPS[eff.group] && <span className="tag">{KIND[eff.kind] || eff.kind}</span>}
        {changed && <span className="tag warn">{result.status === 'recovery' ? 'Replaced' : result.status === 'deferred' ? 'Deferred' : 'Adjusted for today'}</span>}
        {done && <span className="tag good">Done</span>}
        {eff.trimmed && <span className="tag warn">−{eff.trimmed}% load trim</span>}
      </div>
      <h3>{eff.title}</h3>
      {!rest && (eff.minutes > 0 || eff.km > 0 || eff.meters > 0) && (
        <div className="stats">
          {eff.minutes > 0 && <div className="stat"><b>{dur(eff.minutes) || <>{eff.minutes}<em>min</em></>}</b><span>duration</span></div>}
          {eff.km > 0 && <div className="stat"><b>{Math.round(eff.km * 10) / 10}<em>km</em></b><span>distance</span></div>}
          {eff.meters > 0 && <div className="stat"><b>{eff.meters}<em>m</em></b><span>in the water</span></div>}
          {eff.tss > 0 && <div className="stat"><b>{eff.tss}<em>TSS</em></b><span>est. load</span></div>}
        </div>
      )}
      {struct && (
        <div className="struct" aria-label={`Structure: ${warm} min warm-up, ${main} min main, ${cool} min cool-down`}>
          <div className="bar3"><i style={{ flex: warm }} /><i className="core" style={{ flex: main }} /><i style={{ flex: cool }} /></div>
        </div>
      )}
      <dl className="steps" style={{ margin: struct ? undefined : '14px 0 0' }}>
        {step('Target', eff.target, null, 'target')}
        {step('Warm-up', eff.warmup, struct ? `${warm}′` : null)}
        {!eff.exercises && step('Main', eff.main, struct ? `${main}′` : null)}
        {eff.exercises && <div className="step lifts-step"><dd><StrengthPanel s={eff} /></dd></div>}
        {step('Cool-down', eff.cooldown, struct ? `${cool}′` : null)}
        {step('Notes', eff.notes)}
      </dl>
      {!rest && <Brief s={eff} open={!minor} />}
      {eff.why && <WhyPanel id={eff.why} />}
      {result?.options && (
        <div className="opts"><div className="small" style={{ color: 'var(--board-mute)' }}>Pick one:</div>
          {result.options.map((o, i) => <div className="opt" key={i}><b>{o.title}</b>{o.main ? <span style={{ color: 'var(--board-mute)' }}> — {o.main}</span> : null}</div>)}
        </div>
      )}
      {changed && result.original && (
        <details className="orig"><summary>Original plan: {result.original.title}</summary>
          <dl className="steps">{step('Target', result.original.target)}{step('Main', result.original.main)}</dl></details>
      )}
      {(onLog && !rest) || children ? <div className="board-foot">{onLog && !rest && <button className="btn" onClick={() => onLog(s)}>Log this session</button>}{children}</div> : null}
    </article>
  );
}

export function Sparkline({ values }) {
  const v = (values || []).filter((x) => x != null);
  if (v.length < 3) return <svg aria-hidden="true" />;
  const lo = Math.min(...v), hi = Math.max(...v), W = 84, H = 28, pad = 3;
  const pts = v.map((y, i) => [pad + (i / (v.length - 1)) * (W - 2 * pad), H - pad - ((y - lo) / (hi - lo || 1)) * (H - 2 * pad)]);
  const last = pts[pts.length - 1];
  return (<svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('')} /><circle cx={last[0]} cy={last[1]} r="2.6" /></svg>);
}

export function Ring({ value, size = 112, children }) {
  const r = 46, C = 2 * Math.PI * r, v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 112 112" aria-hidden="true"><circle className="trk" cx="56" cy="56" r={r} fill="none" strokeWidth="11" /><circle className="val" cx="56" cy="56" r={r} fill="none" strokeWidth="11" strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} /></svg>
      <div className="mid">{children}</div>
    </div>
  );
}

const I = (d) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
export const TAB_ICONS = {
  today: I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  quarter: I(<><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>),
  progress: I(<><path d="M4 19V5M4 19h16" /><path d="M8 15l4-5 3 3 4-6" /></>),
  log: I(<><path d="M6 3.5h9l3 3V20.5H6z" /><path d="M9 11h6M9 15h6" /></>),
  settings: I(<><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>),
};

export const DayTitle = ({ d }) => <>{fmtDow(d)} {fmtShort(d)}</>;
