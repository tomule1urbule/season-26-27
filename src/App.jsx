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
import { todayStr } from './lib/dates.js';
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
  const date = preview || realToday;

  useEffect(() => { loadGarmin().then((r) => setGarmin({ loading: false, ...r })); }, []);
  useEffect(() => { if (theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const recal = useMemo(() => recalibrate(cpResults), [cpResults]);
  const plan = useMemo(() => generatePlan({ fallMarathon: settings.fallMarathon, tenDay: settings.tenDay, paces: recal.paces, cfg: recal.cfg }), [settings.fallMarathon, settings.tenDay, recal]);
  const metrics = useMemo(() => (scenario === 'live' ? metricsForDate(garmin.data, date, manual[date]) : SCENARIOS[scenario]), [garmin.data, date, manual, scenario]);
  const decision = useMemo(() => classify(metrics), [metrics]);
  const history = useMemo(() => levelHistory(garmin.data), [garmin.data]);

  const backup = { settings, cpResults, log, manual };
  const restore = (b) => { if (b.settings) setSettings(b.settings); if (b.cpResults) setCpResults(b.cpResults); if (b.log) setLog(b.log); if (b.manual) setManual(b.manual); };
  const goLog = (s) => { setDraft(s); setTab('log'); };
  const openDay = (d) => { setPreview(d === realToday ? '' : d); setTab('today'); window.scrollTo({ top: 0 }); };

  return (
    <>
      <header className="header">
        <div className="header-in">
          <div className="brand">Season 26/27<small>Adaptive endurance coach</small></div>
          <nav className="tabs" role="tablist" aria-label="Sections">
            {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className="tab" onClick={() => setTab(k)}>{l}</button>)}
          </nav>
          <div className="ctrls">
            <label className="small muted" title="Preview any day of the programme">Date <input type="date" value={date} onChange={(e) => setPreview(e.target.value === realToday ? '' : e.target.value)} /></label>
            <label className="small muted" title="Try the adaptive rules with sample Garmin readings">Garmin <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
              <option value="live">Live data</option><option value="green">Demo: green</option><option value="yellow">Demo: yellow</option><option value="red">Demo: red</option></select></label>
            <button className="btn sm" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')} title="Theme">{theme === 'auto' ? 'Theme: auto' : theme === 'dark' ? 'Dark' : 'Light'}</button>
          </div>
        </div>
      </header>
      <main className="main">
        {tab === 'today' && <Dashboard plan={plan} date={date} decision={decision} metrics={metrics} garmin={garmin.data} scenario={scenario} manual={manual} setManual={setManual} settings={settings} setSettings={setSettings} history={history} goLog={goLog} openDay={openDay} />}
        {tab === 'calendar' && <Calendar plan={plan} today={date} log={log} onJump={openDay} />}
        {tab === 'analytics' && <Analytics plan={plan} garmin={garmin} date={date} today={date} results={cpResults} setResults={setCpResults} recal={recal} />}
        {tab === 'log' && <LogView key={draft?.id || 'x'} plan={plan} garmin={garmin} log={log} setLog={setLog} date={date} draftSession={draft} clearDraft={() => setDraft(null)} />}
        {tab === 'settings' && <Settings settings={settings} setSettings={setSettings} data={backup} restore={restore} garmin={garmin} plan={plan} />}
      </main>
    </>
  );
}
