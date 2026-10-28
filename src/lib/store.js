import { useEffect, useState } from 'react';

// localStorage wrapper that never throws (private windows, blocked storage) and falls back to memory.
const mem = {};
export const readJSON = (key, fallback) => {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : (mem[key] ?? fallback); } catch { return mem[key] ?? fallback; }
};
export const writeJSON = (key, value) => {
  mem[key] = value;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable – memory copy only */ }
};
export function useStored(key, fallback) {
  const [v, setV] = useState(() => readJSON(key, fallback));
  useEffect(() => { writeJSON(key, v); }, [key, v]);
  return [v, setV];
}
