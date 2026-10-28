// Date helpers. All dates are plain 'YYYY-MM-DD' strings; maths is done in UTC to dodge DST bugs.
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const fmt = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => fmt(new Date(parse(s).getTime() + n * 86400000));
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000); // a - b
export const dow = (s) => (parse(s).getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
export const mondayOf = (s) => addDays(s, -dow(s));
export const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};
export const fmtShort = (s) => parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const fmtLong = (s) => parse(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const fmtDow = (s) => parse(s).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
export const range = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };
