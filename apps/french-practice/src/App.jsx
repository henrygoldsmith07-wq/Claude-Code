import { useEffect, useState } from 'react';
import ChatArena from './components/ChatArena';
import FeedbackWidget from './components/FeedbackWidget';
import SessionDashboard from './components/SessionDashboard';
import DailyChallenge from './components/DailyChallenge';
import Flashcards from './components/Flashcards';
import DevPanel from './components/DevPanel';
import SettingsModal from './components/SettingsModal';
import HomeDashboard from './components/HomeDashboard';
import Dictation from './components/Dictation';
import PathSetup from './components/PathSetup';
import { getPath, applyActivity } from './lib/path';
import { SCENARIOS } from './lib/data';
import {
  getApiKey, getSettings, setSettings as persistSettings, getStreak, getXp, addXp,
  getActiveSession, setActiveSession, clearActiveSession,
} from './lib/storage';
import { setTelemetrySink } from './lib/groq';
import { Flame, Bolt, Sun, Moon, Gear, Key, ArrowRight, Home, MessageCircle, Clock, Layers, Terminal, Volume } from './components/icons';

const TABS = [
  ['home', Home, 'Home'],
  ['arena', MessageCircle, 'Arena'],
  ['challenge', Clock, 'Quick Fire'],
  ['dictation', Volume, 'Dictée'],
  ['cards', Layers, 'Cards'],
];

export default function App() {
  const [apiKey, setApiKey] = useState(getApiKey);
  const [settings, setSettings] = useState(getSettings);
  const [tab, setTab] = useState('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  // Restore an in-flight conversation (page refresh must not lose a session).
  const [scenario, setScenario] = useState(() => {
    const saved = getActiveSession();
    return (saved && SCENARIOS.find((s) => s.id === saved.scenarioId)) || SCENARIOS[0];
  });
  const [history, setHistory] = useState(() => {
    const saved = getActiveSession();
    return saved && Array.isArray(saved.history) ? saved.history : [];
  });
  const [lastScores, setLastScores] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [streakTick, setStreakTick] = useState(0);
  const [xp, setXp] = useState(getXp);
  const [xpGain, setXpGain] = useState(null); // { amount, id } for the pop animation
  const [path, setPath] = useState(getPath);
  const [pathSetupOpen, setPathSetupOpen] = useState(false);

  useEffect(() => {
    setTelemetrySink((entry) => setTelemetry((t) => [...t.slice(-49), entry]));
    return () => setTelemetrySink(null);
  }, []);

  // Autosave the active conversation on every turn.
  useEffect(() => {
    if (history.length > 0) setActiveSession(scenario.id, history);
    else clearActiveSession();
  }, [scenario.id, history]);

  // theme: null follows the OS; the toggle pins an explicit choice
  const isDark = settings.theme
    ? settings.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const updateSettings = (s) => {
    setSettings(s);
    persistSettings(s);
  };

  const toggleTheme = () =>
    updateSettings({ ...settings, theme: isDark ? 'light' : 'dark' });

  const ready = Boolean(apiKey) || settings.mockMode;
  const streak = getStreak();
  void streakTick;

  const awardXp = (gained) => {
    setXp(addXp(gained));
    setXpGain({ amount: gained, id: Date.now() });
  };

  const handleTurn = (scores) => {
    setLastScores(scores);
    awardXp(Math.max(1, Math.round(scores.overall / 10)));
  };

  // Learning-path progression: components report activity; the path engine
  // decides whether it satisfies the current lesson / checkpoint.
  const handleActivity = (evt) => {
    const result = applyActivity(getPath(), evt);
    if (!result.changed) return;
    setPath({ ...result.path });
    if (result.levelChange === 'up') {
      updateSettings({ ...settings, level: result.path.cefr });
    }
  };

  const startLesson = (lesson) => {
    if (lesson.scenarioId) {
      const s = SCENARIOS.find((x) => x.id === lesson.scenarioId);
      if (s && s.id !== scenario.id) {
        setScenario(s);
        setHistory([]);
        setLastScores(null);
      }
    }
    const tabFor = { scenario: 'arena', checkpoint: 'arena', dictation: 'dictation', cards: 'cards', quickfire: 'challenge' };
    setTab(tabFor[lesson.type] || 'arena');
  };

  const endSession = () => {
    if (history.length > 0) setDashboardOpen(true);
  };

  const closeDashboard = () => {
    setDashboardOpen(false);
    setHistory([]);
    setLastScores(null);
  };

  return (
    <div className="h-dvh flex flex-col bg-bg text-ink font-sans">
      {/* header */}
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-surface backdrop-blur">
        <h1 className="font-bold text-lg text-ink tracking-tight mr-1 whitespace-nowrap">
          Le Studio
          <span className="sr-only"> — French speaking practice</span>
        </h1>
        <span
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
            streak.count > 0 ? 'bg-surface2 text-ink' : 'bg-surface2 text-ink3'
          }`}
          title="Day streak"
        >
          <Flame size={13} /> {streak.count}
        </span>
        <span className="relative flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface2 text-ink text-xs font-semibold whitespace-nowrap" title="Experience points">
          <Bolt size={13} /> {xp.toLocaleString('en-GB')} XP
          {xpGain && (
            <span key={xpGain.id} className="xp-pop absolute -top-1 right-0 text-ink font-bold text-xs pointer-events-none">
              +{xpGain.amount}
            </span>
          )}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {tab === 'arena' && history.length > 0 && (
            <button
              onClick={endSession}
              className="btn btn-secondary min-h-10 px-3.5 rounded-xl text-xs"
            >
              End Session
            </button>
          )}
          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink text-lg"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink text-lg"
          >
            <Gear size={18} />
          </button>
        </div>
      </header>

      {/* missing-key banner */}
      {!ready && (
        <button
          onClick={() => setSettingsOpen(true)}
          className="fade-in mx-4 mt-3 flex items-center gap-3 text-left bg-surface2 border border-line rounded-xl px-4 py-3 hover:border-ink3 transition"
        >
          <span className="w-10 h-10 grid place-items-center rounded-xl bg-surface border border-line text-ink" aria-hidden="true"><Key size={18} /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Welcome to the Studio!</span>
            <span className="block text-xs text-ink2 mt-0.5">
              Add your free Groq API key to start speaking French — tap here.
            </span>
          </span>
          <span className="text-ink2" aria-hidden="true"><ArrowRight size={16} /></span>
        </button>
      )}

      {/* main area */}
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 min-w-0 flex flex-col">
          {tab === 'home' && (
            <HomeDashboard
              dailyGoal={settings.dailyGoal}
              level={settings.level}
              path={path}
              onStartLesson={startLesson}
              onOpenSetup={() => setPathSetupOpen(true)}
              onNavigate={setTab}
              onPickScenario={(s) => {
                if (s.id !== scenario.id) {
                  setScenario(s);
                  setHistory([]);
                  setLastScores(null);
                }
              }}
            />
          )}
          {tab === 'arena' && (
            <ChatArena
              apiKey={apiKey}
              mockMode={settings.mockMode}
              ttsRate={settings.ttsRate}
              level={settings.level}
              onTtsRate={(r) => updateSettings({ ...settings, ttsRate: r })}
              onTurn={handleTurn}
              history={history}
              setHistory={setHistory}
              scenario={scenario}
              setScenario={setScenario}
            />
          )}
          {tab === 'challenge' && <DailyChallenge apiKey={apiKey} mockMode={settings.mockMode} onActivity={handleActivity} />}
          {tab === 'dictation' && <Dictation ttsRate={settings.ttsRate} onXp={awardXp} onActivity={handleActivity} />}
          {tab === 'cards' && <Flashcards apiKey={apiKey} mockMode={settings.mockMode} onActivity={handleActivity} />}
          {tab === 'dev' && (
            <DevPanel
              telemetry={telemetry}
              apiKey={apiKey}
              mockMode={settings.mockMode}
              onMockMode={(v) => updateSettings({ ...settings, mockMode: v })}
              onClear={() => setTelemetry([])}
            />
          )}
        </main>
        {tab === 'arena' && <FeedbackWidget scores={lastScores} turnCount={history.length} />}
      </div>

      {/* bottom tab bar */}
      <nav className="flex border-t border-line bg-surface backdrop-blur pb-safe" aria-label="Main navigation">
        {TABS.map(([id, icon, label]) => (
          <TabButton key={id} id={id} icon={icon} label={label} active={tab === id} onClick={setTab} />
        ))}
        {settings.devPanel && <TabButton id="dev" icon={Terminal} label="Dev" active={tab === 'dev'} onClick={setTab} />}
      </nav>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        apiKey={apiKey}
        onKeyChange={setApiKey}
        settings={settings}
        onSettingsChange={updateSettings}
      />
      <SessionDashboard
        open={dashboardOpen}
        onClose={closeDashboard}
        apiKey={apiKey}
        mockMode={settings.mockMode}
        scenario={scenario}
        history={history}
        level={settings.level}
        onSessionSaved={(report) => {
          setStreakTick((t) => t + 1);
          handleActivity({ type: 'session', scenarioId: scenario.id, score: report?.average_scores?.overall ?? 0 });
        }}
      />
      <PathSetup
        open={pathSetupOpen}
        onClose={() => setPathSetupOpen(false)}
        onCreated={(p) => {
          setPath(p);
          setPathSetupOpen(false);
          updateSettings({ ...settings, level: p.cefr });
        }}
      />
    </div>
  );
}

function TabButton({ id, icon: TabIcon, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      aria-current={active ? 'page' : undefined}
      className={`flex-1 flex flex-col items-center gap-1 py-2.5 min-h-14 text-[11px] font-medium transition-colors ${
        active ? 'text-ink' : 'text-ink3 hover:text-ink2'
      }`}
    >
      <TabIcon size={18} />
      {label}
    </button>
  );
}
