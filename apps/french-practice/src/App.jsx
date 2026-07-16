import { useEffect, useState } from 'react';
import ChatArena from './components/ChatArena';
import FeedbackWidget from './components/FeedbackWidget';
import SessionDashboard from './components/SessionDashboard';
import DailyChallenge from './components/DailyChallenge';
import Flashcards from './components/Flashcards';
import DevPanel from './components/DevPanel';
import SettingsModal from './components/SettingsModal';
import { SCENARIOS } from './lib/data';
import { getApiKey, getSettings, setSettings as persistSettings, getStreak, getXp, addXp } from './lib/storage';
import { setTelemetrySink } from './lib/groq';

const TABS = [
  ['arena', '💬', 'Arène'],
  ['challenge', '⚡', 'Tac au tac'],
  ['cards', '🃏', 'Cartes'],
];

export default function App() {
  const [apiKey, setApiKey] = useState(getApiKey);
  const [settings, setSettings] = useState(getSettings);
  const [tab, setTab] = useState('arena');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [history, setHistory] = useState([]);
  const [lastScores, setLastScores] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [streakTick, setStreakTick] = useState(0);
  const [xp, setXp] = useState(getXp);
  const [xpGain, setXpGain] = useState(null); // { amount, id } for the pop animation

  useEffect(() => {
    setTelemetrySink((entry) => setTelemetry((t) => [...t.slice(-49), entry]));
    return () => setTelemetrySink(null);
  }, []);

  const updateSettings = (s) => {
    setSettings(s);
    persistSettings(s);
  };

  const ready = Boolean(apiKey) || settings.mockMode;
  const streak = getStreak();
  void streakTick;

  const handleTurn = (scores) => {
    setLastScores(scores);
    const gained = Math.max(1, Math.round(scores.overall / 10));
    setXp(addXp(gained));
    setXpGain({ amount: gained, id: Date.now() });
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
    <div className="h-dvh flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* header */}
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur">
        <h1 className="font-black text-lg text-slate-100 tracking-tight mr-1 whitespace-nowrap">
          <span className="text-emerald-400">Le Studio</span>{' '}
          <span aria-hidden="true" className="hidden sm:inline">🗣️</span>
          <span className="sr-only">Pratique du français</span>
        </h1>
        <span
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold whitespace-nowrap ${
            streak.count > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-800 text-slate-500'
          }`}
          title="Série de jours"
        >
          🔥 {streak.count}
        </span>
        <span className="relative flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 text-xs font-extrabold whitespace-nowrap" title="Points d'expérience">
          ⚡ {xp.toLocaleString('fr-FR')} XP
          {xpGain && (
            <span key={xpGain.id} className="xp-pop absolute -top-1 right-0 text-emerald-400 font-black text-xs pointer-events-none">
              +{xpGain.amount}
            </span>
          )}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {tab === 'arena' && history.length > 0 && (
            <button
              onClick={endSession}
              className="btn-3d btn-3d-amber min-h-10 px-3.5 rounded-2xl border text-xs font-extrabold"
            >
              🏁 Terminer
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Réglages"
            className="w-10 h-10 grid place-items-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-lg"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* missing-key banner */}
      {!ready && (
        <button
          onClick={() => setSettingsOpen(true)}
          className="fade-in mx-4 mt-3 flex items-center gap-3 text-left bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border-2 border-b-4 border-emerald-500/40 rounded-2xl px-4 py-3 hover:border-emerald-400/70 transition"
        >
          <span className="text-3xl" aria-hidden="true">🔑</span>
          <span className="flex-1">
            <span className="block text-sm font-extrabold text-emerald-300">Bienvenue au Studio !</span>
            <span className="block text-xs text-slate-300 mt-0.5">
              Ajoutez votre clé API Groq (gratuite) pour commencer à parler français — touchez ici.
            </span>
          </span>
          <span className="text-emerald-400 font-black" aria-hidden="true">→</span>
        </button>
      )}

      {/* main area */}
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 min-w-0 flex flex-col">
          {tab === 'arena' && (
            <ChatArena
              apiKey={apiKey}
              mockMode={settings.mockMode}
              ttsRate={settings.ttsRate}
              onTtsRate={(r) => updateSettings({ ...settings, ttsRate: r })}
              onTurn={handleTurn}
              history={history}
              setHistory={setHistory}
              scenario={scenario}
              setScenario={setScenario}
            />
          )}
          {tab === 'challenge' && <DailyChallenge apiKey={apiKey} mockMode={settings.mockMode} />}
          {tab === 'cards' && <Flashcards apiKey={apiKey} mockMode={settings.mockMode} />}
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
      <nav className="flex border-t border-slate-800/80 bg-slate-900/80 backdrop-blur pb-safe" aria-label="Navigation principale">
        {TABS.map(([id, icon, label]) => (
          <TabButton key={id} id={id} icon={icon} label={label} active={tab === id} onClick={setTab} />
        ))}
        {settings.devPanel && <TabButton id="dev" icon="🛠" label="Dev" active={tab === 'dev'} onClick={setTab} />}
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
        onSessionSaved={() => setStreakTick((t) => t + 1)}
      />
    </div>
  );
}

function TabButton({ id, icon, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      aria-current={active ? 'page' : undefined}
      className="flex-1 flex flex-col items-center gap-0.5 py-2 min-h-14 text-[11px] font-extrabold transition-colors"
    >
      <span
        aria-hidden="true"
        className={`text-lg px-4 py-0.5 rounded-full transition-all ${
          active ? 'bg-emerald-500/15 scale-105' : ''
        }`}
      >
        {icon}
      </span>
      <span className={active ? 'text-emerald-400' : 'text-slate-500'}>{label}</span>
    </button>
  );
}
