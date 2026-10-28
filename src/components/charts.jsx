import { useEffect, useMemo, useRef, useState } from 'react';
import { diffDays, fmtShort } from '../lib/dates.js';

// Hand-rolled SVG charts: one axis each (never dual-axis), thin marks, recessive grid, hover tooltip, legend for ≥2 series,
// and a table view for every chart (colour is never the only carrier of identity).

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(lo, hi, n = 4) {
  const span = hi - lo || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

const Legend = ({ items }) => items.length < 2 ? null : (
  <div className="legend" style={{ marginBottom: 6 }}>
    {items.map((it) => (
      <span key={it.name}><i className="dot" style={{ background: it.color, borderRadius: it.line ? 1 : 3, height: it.line ? 3 : 9 }} />{it.name}</span>
    ))}
  </div>
);

function TableView({ cols, rows }) {
  return (
    <div className="scroll-x" style={{ marginTop: 8 }}>
      <table className="t">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'n' : ''}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/**
 * Line chart over dates.
 * series: [{ name, color, points:[{d, v}], dashed?, dots? }]
 * band: {lo, hi, label}  refs: [{y, label, color}]  flags: ['YYYY-MM-DD', …] (days to mark with a vertical stripe)
 */
export function LineChart({ title, series, xDomain, yDomain, yFmt = (v) => v, height = 150, band, refs = [], flags = [], flagLabel = '', note }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const m = { l: 40, r: 10, t: 8, b: 22 };
  const w = W - m.l - m.r, h = height - m.t - m.b;
  const all = series.flatMap((s) => s.points);
  const d0 = xDomain?.[0] ?? all.map((p) => p.d).sort()[0];
  const d1 = xDomain?.[1] ?? all.map((p) => p.d).sort().slice(-1)[0];
  const span = Math.max(1, diffDays(d1, d0));
  const vals = all.map((p) => p.v).concat(band ? [band.lo, band.hi] : [], refs.map((r) => r.y));
  const lo = yDomain?.[0] ?? Math.min(...vals), hi = yDomain?.[1] ?? Math.max(...vals);
  const pad = (hi - lo) * 0.08 || 1;
  const yl = yDomain ? lo : lo - pad, yh = yDomain ? hi : hi + pad;
  const X = (d) => m.l + (diffDays(d, d0) / span) * w;
  const Y = (v) => m.t + h - ((v - yl) / (yh - yl)) * h;
  const ticks = niceTicks(yl, yh, 3);
  const dates = useMemo(() => [...new Set(all.map((p) => p.d))].sort(), [series]); // eslint-disable-line
  const xt = useMemo(() => { const n = W < 480 ? 4 : 7; return Array.from({ length: n }, (_, i) => { const dd = Math.round((i / (n - 1)) * span); return dd; }); }, [W, span]);
  const addDays = (s, k) => { const [y, mo, da] = s.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, da + k)).toISOString().slice(0, 10); };

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = null;
    for (const d of dates) if (best === null || Math.abs(X(d) - px) < Math.abs(X(best) - px)) best = d;
    setHover(best);
  };
  const path = (pts) => pts.slice().sort((a, b) => (a.d < b.d ? -1 : 1)).map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  const tipX = hover ? X(hover) : 0;

  return (
    <div>
      {title && <div className="spread" style={{ marginBottom: 4 }}><h3>{title}</h3><button className="btn sm ghost" onClick={() => setTable(!table)}>{table ? 'Chart' : 'Table'}</button></div>}
      <Legend items={series.map((s) => ({ name: s.name, color: s.color, line: true }))} />
      {table ? (
        <TableView cols={['Date', ...series.map((s) => s.name)]} rows={dates.map((d) => [fmtShort(d), ...series.map((s) => { const p = s.points.find((q) => q.d === d); return p ? yFmt(p.v) : '–'; })])} />
      ) : (
        <div className="chart" ref={ref}>
          <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={title} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            <g className="grid">{ticks.map((t) => <line key={t} x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} />)}</g>
            {band && <rect x={m.l} width={w} y={Y(band.hi)} height={Math.max(0, Y(band.lo) - Y(band.hi))} fill="var(--accent)" opacity="0.09" />}
            {flags.map((d) => <rect key={d} x={X(d) - Math.max(3, w / span / 2)} width={Math.max(6, w / span)} y={m.t} height={h} fill="var(--crit)" opacity="0.13" />)}
            {refs.map((r) => (
              <g key={r.y}><line x1={m.l} x2={W - m.r} y1={Y(r.y)} y2={Y(r.y)} stroke={r.color || 'var(--crit)'} strokeDasharray="4 3" strokeWidth="1" />
                <text x={W - m.r} y={Y(r.y) - 3} textAnchor="end">{r.label}</text></g>
            ))}
            <g className="axis"><line x1={m.l} x2={W - m.r} y1={m.t + h} y2={m.t + h} /></g>
            {ticks.filter((t) => Y(t) < m.t + h - 9).map((t) => <text key={t} x={m.l - 6} y={Y(t) + 3.5} textAnchor="end">{yFmt(t)}</text>)}
            {xt.map((dd, i) => <text key={i} x={m.l + (dd / span) * w} y={height - 5} textAnchor={i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle'}>{fmtShort(addDays(d0, dd))}</text>)}
            {series.map((s) => (
              <g key={s.name}>
                <path d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />
                {(s.dots ?? s.points.length < 40) && s.points.map((p) => <circle key={p.d} cx={X(p.d)} cy={Y(p.v)} r="2.6" fill={s.color} stroke="var(--surface)" strokeWidth="1.5" />)}
              </g>
            ))}
            {hover && <line x1={tipX} x2={tipX} y1={m.t} y2={m.t + h} stroke="var(--ink-2)" strokeWidth="1" opacity="0.5" />}
            {hover && series.map((s) => { const p = s.points.find((q) => q.d === hover); return p ? <circle key={s.name} cx={X(hover)} cy={Y(p.v)} r="4.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" /> : null; })}
            <rect x={m.l} y={m.t} width={w} height={h} fill="transparent" />
          </svg>
          {hover && (
            <div className="tip" style={{ left: Math.min(Math.max(0, tipX - 60), W - 150), top: 0 }}>
              <b>{fmtShort(hover)}{flags.includes(hover) && flagLabel ? ` · ${flagLabel}` : ''}</b>
              {series.map((s) => { const p = s.points.find((q) => q.d === hover); return p ? <div className="tr" key={s.name}><span><i className="dot" style={{ background: s.color }} /> {s.name}</span><span className="num">{yFmt(p.v)}</span></div> : null; })}
            </div>
          )}
        </div>
      )}
      {note && <p className="small muted" style={{ marginTop: 4 }}>{note}</p>}
    </div>
  );
}

/**
 * Stacked bar chart with optional marker series (plan).
 * cats: [{key,label}]  stacks: [{name,color,values}]  marks: {name,color,values}
 */
export function BarChart({ title, cats, stacks, marks, height = 190, yFmt = (v) => v, unit = '', note }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const m = { l: 36, r: 8, t: 8, b: 26 };
  const w = W - m.l - m.r, h = height - m.t - m.b;
  const totals = cats.map((_, i) => stacks.reduce((a, s) => a + (s.values[i] || 0), 0));
  const hi = Math.max(1, ...totals, ...(marks ? marks.values.map((v) => v || 0) : [0])) * 1.1;
  const ticks = niceTicks(0, hi, 3);
  const bw = w / cats.length;
  const Y = (v) => m.t + h - (v / hi) * h;
  const every = Math.ceil(cats.length / Math.max(2, Math.floor(w / 56)));
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W - m.l;
    const i = Math.floor(px / bw);
    setHover(i >= 0 && i < cats.length ? i : null);
  };
  const items = [...stacks.map((s) => ({ name: s.name, color: s.color })), ...(marks ? [{ name: marks.name, color: marks.color, line: true }] : [])];
  return (
    <div>
      {title && <div className="spread" style={{ marginBottom: 4 }}><h3>{title}</h3><button className="btn sm ghost" onClick={() => setTable(!table)}>{table ? 'Chart' : 'Table'}</button></div>}
      <Legend items={items} />
      {table ? (
        <TableView cols={['Week', ...stacks.map((s) => s.name), 'Total', ...(marks ? [marks.name] : [])]}
          rows={cats.map((c, i) => [c.label, ...stacks.map((s) => (s.values[i] ? yFmt(s.values[i]) : '–')), totals[i] ? yFmt(totals[i]) : '–', ...(marks ? [marks.values[i] != null ? yFmt(marks.values[i]) : '–'] : [])])} />
      ) : (
        <div className="chart" ref={ref}>
          <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={title} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            <g className="grid">{ticks.map((t) => <line key={t} x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} />)}</g>
            {ticks.map((t) => <text key={t} x={m.l - 6} y={Y(t) + 3.5} textAnchor="end">{yFmt(t)}</text>)}
            {cats.map((c, i) => {
              let acc = 0;
              const x = m.l + i * bw + bw * 0.16, bwid = bw * 0.68;
              return (
                <g key={c.key} opacity={hover === null || hover === i ? 1 : 0.55}>
                  {stacks.map((s) => {
                    const v = s.values[i] || 0; if (!v) return null;
                    const y0 = Y(acc), y1 = Y(acc + v); acc += v;
                    return <rect key={s.name} x={x} y={y1} width={bwid} height={Math.max(0, y0 - y1)} fill={s.color} stroke="var(--surface)" strokeWidth="1.5" rx="2" />;
                  })}
                  {i % every === 0 && <text x={x + bwid / 2} y={height - 8} textAnchor="middle">{c.label}</text>}
                </g>
              );
            })}
            {marks && marks.values.map((v, i) => v != null && (
              <line key={i} x1={m.l + i * bw + bw * 0.1} x2={m.l + (i + 1) * bw - bw * 0.1} y1={Y(v)} y2={Y(v)} stroke={marks.color} strokeWidth="2.5" strokeLinecap="round" />
            ))}
            <g className="axis"><line x1={m.l} x2={W - m.r} y1={m.t + h} y2={m.t + h} /></g>
            <rect x={m.l} y={m.t} width={w} height={h} fill="transparent" />
          </svg>
          {hover !== null && (
            <div className="tip" style={{ left: Math.min(Math.max(0, m.l + hover * bw - 50), W - 160), top: 0 }}>
              <b>Week of {cats[hover].label}</b>
              {stacks.map((s) => s.values[hover] ? <div className="tr" key={s.name}><span><i className="dot" style={{ background: s.color }} /> {s.name}</span><span className="num">{yFmt(s.values[hover])}{unit}</span></div> : null)}
              {marks && marks.values[hover] != null && <div className="tr"><span><i className="dot" style={{ background: marks.color, height: 3 }} /> {marks.name}</span><span className="num">{yFmt(marks.values[hover])}{unit}</span></div>}
            </div>
          )}
        </div>
      )}
      {note && <p className="small muted" style={{ marginTop: 4 }}>{note}</p>}
    </div>
  );
}
