import { diffDays, fmtShort, parse } from '../lib/dates.js';

// The whole season on one strip: phases as bands, races as flags, checkpoints as diamonds, today as a line.
const SHORT = { mazeikiai: 'Mažeikiai 10K', kaunas: 'Kaunas HM', riga: 'Riga HM', trakai: 'Trakai tri', fall: 'Marathon' };

export default function Ribbon({ plan, date }) {
  const W = 1000, H = 132, L = 8, R = 8;
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
        {phases.map((p, i) => {
          const x0 = X(p.start), x1 = X(p.end), cur = date >= p.start && date <= p.end;
          return (
            <g key={p.id}>
              <rect x={x0} y={46} width={Math.max(2, x1 - x0 - 2)} height={30} rx="6" fill={cur ? 'var(--accent)' : 'var(--info-bg)'} stroke={cur ? 'none' : 'var(--line)'} />
              <text x={x0 + 8} y={65} className={cur ? '' : ''} style={{ fill: cur ? 'var(--accent-ink)' : 'var(--ink-2)', fontWeight: 600 }}>
                {x1 - x0 > 90 ? p.short : x1 - x0 > 50 ? p.short.slice(0, 7) : ''}
              </text>
            </g>
          );
        })}
        {months.map((m) => (<g key={m}><line x1={X(m)} x2={X(m)} y1={80} y2={86} stroke="var(--axis)" /><text x={X(m)} y={98} textAnchor="middle">{parse(m).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</text></g>))}
        {plan.races.filter((r) => r.date >= d0).map((r, i) => {
          const x = X(r.date), up = i % 2 ? 6 : 24;
          return (
            <g key={r.id}>
              <line x1={x} x2={x} y1={up + 6} y2={46} stroke="var(--s-race)" strokeWidth="1.5" />
              <path d={`M${x},${up} l${x > W - 120 ? -10 : 10},4 l${x > W - 120 ? 10 : -10},4 z`} fill="var(--s-race)" />
              <text x={x > W - 120 ? x - 4 : x + 13} y={up + 9} textAnchor={x > W - 120 ? 'end' : 'start'} className="strong">{SHORT[r.id]}</text>
            </g>
          );
        })}
        {plan.checkpoints.map((c) => {
          const x = X(c.date);
          return (
            <g key={c.id}>
              <rect x={x - 6} y={104} width="12" height="12" transform={`rotate(45 ${x} 110)`} fill="var(--s-checkpoint)" stroke="var(--surface)" strokeWidth="1.5" />
              <text x={x} y={128} textAnchor="middle">T{c.id}</text>
            </g>
          );
        })}
        {date >= d0 && date <= d1 && <g><line x1={X(date)} x2={X(date)} y1={38} y2={86} stroke="var(--ink)" strokeWidth="2" /><circle cx={X(date)} cy={38} r="4" fill="var(--ink)" /><text x={X(date)} y={30} textAnchor="middle" className="strong">{fmtShort(date)}</text></g>}
      </svg>
    </div>
  );
}
