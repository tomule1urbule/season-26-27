import { diffDays, fmtShort, parse } from '../lib/dates.js';

// The whole season on one strip: phases as bands, races as flags, checkpoints as diamonds, today as a line.
const SHORT = { mazeikiai: 'Mažeikiai 10K', kaunas: 'Kaunas HM', riga: 'Riga HM', trakai: 'Trakai tri', fall: 'Marathon' };

export default function Ribbon({ plan, date }) {
  const W = 1000, H = 150, L = 8, R = 8;
  const d0 = plan.start, d1 = plan.end;
  const span = diffDays(d1, d0);
  const X = (d) => L + (Math.max(0, Math.min(span, diffDays(d, d0))) / span) * (W - L - R);
  const months = [];
  for (let d = parse(d0); d <= parse(d1); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const s = d.toISOString().slice(0, 10);
    if (s > d0) months.push(s);
  }
  const phases = plan.phases.filter((p) => p.id >= 1);
  return (
    <div className="ribbon-wrap">
      <svg className="ribbon" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Season timeline with phases, races and checkpoints">
        {phases.map((p) => {
          const x0 = X(p.start), x1 = X(p.end), cur = date >= p.start && date <= p.end, past = date > p.end, w = Math.max(2, x1 - x0 - 3);
          const done = cur ? Math.max(0, Math.min(w, X(date) - x0)) : past ? w : 0;
          return (
            <g key={p.id}>
              <rect x={x0} y={52} width={w} height={40} rx="8" fill={p.color} opacity={cur ? 0.2 : 0.1} />
              <rect x={x0} y={52} width={done} height={40} rx="8" fill={p.color} opacity={cur ? 0.42 : 0.3} />
              <rect x={x0} y={52} width={w} height={5} rx="2.5" fill={p.color} />
              <text x={x0 + 10} y={79} className="band-t" style={{ opacity: cur ? 1 : 0.8 }}>{x1 - x0 > 100 ? p.short : x1 - x0 > 56 ? p.short.slice(0, 7) : ''}</text>
            </g>
          );
        })}
        {months.map((m) => (<g key={m}><line x1={X(m)} x2={X(m)} y1={96} y2={102} stroke="var(--axis)" /><text x={X(m)} y={115} textAnchor="middle">{parse(m).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</text></g>))}
        {plan.races.filter((r) => r.date >= d0).map((r, i) => {
          const x = X(r.date), up = i % 2 ? 6 : 28;
          return (
            <g key={r.id}>
              <line x1={x} x2={x} y1={up + 6} y2={52} stroke="var(--s-race)" strokeWidth="1.5" />
              <path d={`M${x},${up} l${x > W - 120 ? -10 : 10},4 l${x > W - 120 ? 10 : -10},4 z`} fill="var(--s-race)" />
              <text x={x > W - 120 ? x - 4 : x + 13} y={up + 9} textAnchor={x > W - 120 ? 'end' : 'start'} className="strong">{SHORT[r.id]}</text>
            </g>
          );
        })}
        {plan.checkpoints.map((c) => {
          const x = X(c.date);
          return (
            <g key={c.id}>
              <rect x={x - 6} y={124} width="12" height="12" transform={`rotate(45 ${x} 130)`} fill="var(--s-checkpoint)" stroke="var(--surface)" strokeWidth="1.5" />
              <text x={x} y={148} textAnchor="middle">T{c.id}</text>
            </g>
          );
        })}
        {date >= d0 && date <= d1 && <g><line x1={X(date)} x2={X(date)} y1={44} y2={96} stroke="var(--ink)" strokeWidth="2.5" /><circle cx={X(date)} cy={44} r="5" fill="var(--ink)" stroke="var(--surface)" strokeWidth="2" /><text x={X(date)} y={36} textAnchor="middle" className="strong">{fmtShort(date)}</text></g>}
      </svg>
    </div>
  );
}
