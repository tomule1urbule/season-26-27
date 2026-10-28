import { useEffect, useMemo, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Calendar from './components/Calendar.jsx';
import Analytics from './components/Analytics.jsx';
import LogView from './components/LogView.jsx';
import Settings from './components/Settings.jsx';
import { generatePlan } from './lib/plan.js';
import { classify } from './lib/adapt.js';
import { recalibrate } from './lib/zones.js';
import { loadGarmin, metricsForDate, levelHistory } from './lib/garmin.js';
import { DEFAULT_FALL_MARATHON, LOCAL_KEYS } from './lib/config.js';
import { todayStr, addDays } from './lib/dates.js';
import { TAB_ICONS } from './components/ui.jsx';
import { useStored, readJSON } from './lib/store.js';

const SCENARIOS = {
  green: { readiness: 84, hrvStatus: 'BALANCED', hrvLast: 92, hrvWeekly: 88, sleepScore: 88, sleepHours: 8.1, acwr: 1.05, acute: 600, chronic: 570, optimalMax: 931 },
  yellow: { readiness: 62, hrvStatus: 'LOW', hrvLast: 70, hrvWeekly: 86, sleepScore: 72, sleepHours: 6.6, acwr: 1.2, acute: 700, chronic: 583, optimalMax: 931 },
  red: { readiness: 38, hrvStatus: 'UNBALANCED', hrvLast: 55, hrvWeekly: 84, sleepScore: 55, sleepHours: 5.4, acwr: 1.52, acute: 950, chronic: 625, optimalMax: 931 },
};
const TABS = [['today', 'Today'], ['calendar', 'Calendar'], ['analytics', 'Analytics'], ['log', 'Log'], ['settings', 'Settings']];

export default function App() {
  const [tab, setTab] = useState('today');
  const [settings, setSettings] = useStored(LOCAL_KEYS.settings, { fallMarathon: DEFAULT_FALL_MARATHON, lifeLoadHigh: false, tenDay: [] });
  const [cpResults, setCpResults] = useStored(LOCAL_KEYS.cp, {});
  const [log, setLog] = useStored(LOCAL_KEYS.log, []);
  const [manual, setManual] = useStored(LOCAL_KEYS.manual, {});
  const [theme, setTheme] = useStored('s2627.theme', 'auto');
  const [garmin, setGarmin] = useState({ loading: true, data: null });
  const realToday = todayStr();
  const [preview, setPreview] = useState('');
  const [scenario, setScenario] = useState('live');
  const [draft, setDraft] = useState(null);
  const [tools, setTools] = useState(false);
  const date = preview || realToday;

  useEffect(() => { loadGarmin().then((r) => setGarmin({ loading: false, ...r })); }, []);
  useEffect(() => { if (theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const recal = useMemo(() => recalibrate(cpResults), [cpResults]);
  const plan = useMemo(() => generatePlan({ fallMarathon: settings.fallMarathon, tenDay: settings.tenDay, paces: recal.paces, cfg: recal.cfg }), [settings.fallMarathon, settings.tenDay, recal]);
  const metrics = useMemo(() => (scenario === 'live' ? metricsForDate(garmin.data, date, manual[date]) : SCENARIOS[scenario]), [garmin.data, date, manual, scenario]);
  const decision = useMemo(() => classify(metrics), [metrics]);
  useEffect(() => { document.documentElement.style.setProperty('--state', { green: 'var(--good)', yellow: 'var(--warn)', red: 'var(--crit)' }[decision.level] || 'var(--line-2)'); }, [decision.level]);
  useEffect(() => { if (!tools) return; const k = (e) => e.key === 'Escape' && setTools(false); const c = (e) => !e.target.closest?.('.pop-wrap') && setTools(false); window.addEventListener('keydown', k); window.addEventListener('mousedown', c); return () => { window.removeEventListener('keydown', k); window.removeEventListener('mousedown', c); }; }, [tools]);
  const step = (n) => { const d = addDays(date, n); setPreview(d === realToday ? '' : d); };
  const history = useMemo(() => levelHistory(garmin.data), [garmin.data]);

  const backup = { settings, cpResults, log, manual };
  const restore = (b) => { if (b.settings) setSettings(b.settings); if (b.cpResults) setCpResults(b.cpResults); if (b.log) setLog(b.log); if (b.manual) setManual(b.manual); };
  const goLog = (s) => { setDraft(s); setTab('log'); };
  const openDay = (d) => { setPreview(d === realToday ? '' : d); setTab('today'); window.scrollTo({ top: 0 }); };

  return (
    <>
      <header className="header">
        <div className="header-in">
          <div className="brand">
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect x="1.5" y="6.5" width="29" height="19" rx="9.5" fill="none" stroke="currentColor" strokeWidth="2.4" /><rect x="7" y="11" width="18" height="10" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity=".45" /><circle cx="23" cy="16" r="3.2" fill="var(--state)" stroke="var(--surface)" strokeWidth="1.5" /></svg>
            <div>Season 26/27<small>Adaptive endurance coach</small></div>
          </div>
          <nav className="tabs" role="tablist" aria-label="Sections">
            {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className="tab" onClick={() => { setTab(k); window.scrollTo({ top: 0 }); }}>{TAB_ICONS[k]}<span>{l}</span></button>)}
          </nav>
          <div className="pop-wrap">
            <button className="btn sm" aria-expanded={tools} onClick={() => setTools(!tools)}>{preview || scenario !== 'live' ? 'Preview on' : 'Preview'} ▾</button>
            {tools && (
              <div className="pop" role="dialog" aria-label="Preview and display">
                <label className="f">Show a different day<input type="date" value={date} onChange={(e) => setPreview(e.target.value === realToday ? '' : e.target.value)} /></label>
                <label className="f">Garmin readings<select value={scenario} onChange={(e) => setScenario(e.target.value)}>
                  <option value="live">Live snapshot</option><option value="green">Demo: green day</option><option value="yellow">Demo: yellow day</option><option value="red">Demo: red day</option></select></label>
                <div className="f">Theme<div className="seg" role="group">{[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => <button key={k} aria-pressed={theme === k} onClick={() => setTheme(k)}>{l}</button>)}</div></div>
                <p className="small muted">Preview lets you try the adaptive rules on any day of the programme. It never changes your data.</p>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="main">
        {tab === 'today' && <Dashboard plan={plan} date={date} decision={decision} metrics={metrics} garmin={garmin.data} scenario={scenario} manual={manual} setManual={setManual} settings={settings} setSettings={setSettings} history={history} goLog={goLog} openDay={openDay} step={step} backToToday={() => setPreview('')} isPreview={!!preview} />}
        {tab === 'calendar' && <Calendar plan={plan} today={date} log={log} onJump={openDay} />}
        {tab === 'analytics' && <Analytics plan={plan} garmin={garmin} date={date} today={date} results={cpResults} setResults={setCpResults} recal={recal} />}
        {tab === 'log' && <LogView key={draft?.id || 'x'} plan={plan} garmin={garmin} log={log} setLog={setLog} date={date} draftSession={draft} clearDraft={() => setDraft(null)} />}
        {tab === 'settings' && <Settings settings={settings} setSettings={setSettings} data={backup} restore={restore} garmin={garmin} plan={plan} />}
      </main>
    </>
  );
}
