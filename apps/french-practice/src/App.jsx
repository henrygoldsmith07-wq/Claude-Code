import { useEffect, useState } from 'react';
import ChatArena from './components/ChatArena';
import FeedbackWidget from './components/FeedbackWidget';
import SessionDashboard from './components/SessionDashboard';
import Vocabulary from './components/Vocabulary';
import Grammar from './components/Grammar';
import DevPanel from './components/DevPanel';
import SettingsModal from './components/SettingsModal';
import HomeDashboard from './components/HomeDashboard';
import Skills from './components/Skills';
import AiHub from './components/AiHub';
import PathSetup from './components/PathSetup';
import { getPath, applyActivity } from './lib/path';
import { SCENARIOS } from './lib/data';
import Profile from './components/Profile';
import Culture from './components/Culture';
import RealWorld from './components/RealWorld';
import Personalise from './components/Personalise';
import Offline from './components/Offline';
import Analytics from './components/Analytics';
import Reference from './components/Reference';
import Focus from './components/Focus';
import Onboarding from './components/Onboarding';
import usePwaInstall from './hooks/usePwaInstall';
import {
  getApiKey, getSettings, setSettings as persistSettings, getStreak, getXp, addXp,
  getActiveSession, setActiveSession, clearActiveSession,
  getSrs, getNotebook, isCardDue, shouldRemindToday, markRemindedToday,
  getCoins, addCoins, getAvatar, bumpChallengeMetric, addEventXp,
  getPrefs, setPrefs, getSessions, addStudyTime,
  setApiKey as persistApiKey, setAvatar as persistAvatar, ownAvatar, setHabitList,
  shouldOnboard, setOnboarded,
} from './lib/storage';
import { allEntries } from './lib/vocab';
import { notebookAsEntries } from './lib/memory';
import { adaptiveLevel } from './lib/personalise';
import { AVATARS, activeEvent } from './lib/game';
import { setTelemetrySink } from './lib/groq';
import { Flame, Bolt, Sun, Moon, Gear, Key, ArrowRight, Home, MessageCircle, Mic, Layers, Terminal, Book, BookOpen, Sparkles, Landmark, Download, X, Grid, Compass, Sliders, BarChart, Clock, ChevronRight, Coins as CoinsIcon } from './components/icons';

// The bottom bar holds only the core daily-practice destinations; everything
// else lives in the "More" sheet (see MORE_GROUPS) so the bar stays uncluttered.
const TABS = [
  ['home', Home, 'Home'],
  ['arena', MessageCircle, 'Arena'],
  ['skills', Mic, 'Skills'],
  ['cards', Layers, 'Vocab'],
];

// Tabs that render in <main> but are reached through the More sheet rather than
// the bar — used to light up the More button as "active".
const MORE_TAB_IDS = ['grammar', 'ai', 'culture', 'dev'];

export default function App() {
  const [apiKey, setApiKey] = useState(getApiKey);
  const [settings, setSettings] = useState(getSettings);
  const [tab, setTab] = useState('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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
  const [coins, setCoins] = useState(getCoins);
  const [avatarId, setAvatarId] = useState(getAvatar);
  const [profileOpen, setProfileOpen] = useState(false);
  const [realWorldOpen, setRealWorldOpen] = useState(false);
  const [personaliseOpen, setPersonaliseOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(shouldOnboard);
  const [prefs, setPrefsState] = useState(getPrefs);
  const pwa = usePwaInstall();
  const [installDismissed, setInstallDismissed] = useState(false);
  const [path, setPath] = useState(getPath);
  const [pathSetupOpen, setPathSetupOpen] = useState(false);
  const [grammarFocus, setGrammarFocus] = useState(null); // topic id from an Arena tip
  const [skillArea, setSkillArea] = useState(null); // null = skills hub; speaking|listening|reading|writing
  const [speakingMode, setSpeakingMode] = useState(null); // null = hub; deep-linked by Home/path
  const [listeningMode, setListeningMode] = useState(null); // null = hub; 'dictation' | track id

  useEffect(() => {
    setTelemetrySink((entry) => setTelemetry((t) => [...t.slice(-49), entry]));
    return () => setTelemetrySink(null);
  }, []);

  // Smart reminders: once per day, when reviews are waiting and the user
  // opted in, surface a browser notification (works while the tab is open —
  // there's no backend to push from).
  useEffect(() => {
    if (!settings.smartReminders || !shouldRemindToday()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const srs = getSrs();
    const due = [...allEntries(), ...notebookAsEntries(getNotebook())]
      .filter((e) => isCardDue(srs[e.id])).length;
    if (due === 0) return;
    markRemindedToday();
    try {
      new Notification('Le Studio', {
        body: `${due} card${due > 1 ? 's are' : ' is'} due for review — a few minutes now beats relearning later.`,
      });
    } catch { /* notification constructor unsupported (e.g. some mobile browsers) */ }
  }, [settings.smartReminders]);

  // Time studied: accumulate seconds while the tab is visible (the honest
  // "app open and in use" proxy — paused when the tab is hidden).
  useEffect(() => {
    const STEP = 20;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') addStudyTime(STEP);
    }, STEP * 1000);
    return () => clearInterval(id);
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

  const updatePrefs = (patch) => {
    setPrefs(patch);
    setPrefsState(getPrefs());
  };

  // Apply everything the onboarding wizard collected, then dismiss it.
  const finishOnboarding = (d) => {
    updateSettings({
      ...settings,
      name: d.name.trim(),
      level: d.level,
      dailyGoal: d.dailyGoal,
      weeklyGoal: d.weeklyGoal,
      smartReminders: d.reminders,
      mockMode: settings.mockMode || d.mock,
    });
    updatePrefs({ learningStyle: d.learningStyle, lessonLength: d.lessonLength, favouriteTopics: d.favouriteTopics });
    persistAvatar(d.avatarId);
    ownAvatar(d.avatarId);
    setAvatarId(d.avatarId);
    if (d.habits.length) setHabitList(d.habits);
    if (d.apiKey.trim()) {
      persistApiKey(d.apiKey.trim());
      setApiKey(d.apiKey.trim());
    }
    setOnboarded();
    setOnboardingOpen(false);
  };

  const skipOnboarding = () => {
    setOnboarded();
    setOnboardingOpen(false);
  };

  // Adaptive difficulty nudges the level fed to the LLM from recent scores.
  const effectiveLevel = adaptiveLevel(settings.level, getSessions(), prefs.adaptiveDifficulty).level;

  const toggleTheme = () =>
    updateSettings({ ...settings, theme: isDark ? 'light' : 'dark' });

  const ready = Boolean(apiKey) || settings.mockMode;
  const streak = getStreak();
  void streakTick;

  // XP also feeds the gamification loop: coins alongside every gain, plus
  // progress toward the active seasonal event.
  const awardXp = (gained) => {
    setXp(addXp(gained));
    setXpGain({ amount: gained, id: Date.now() });
    setCoins(addCoins(Math.max(1, Math.round(gained / 3))));
    const event = activeEvent();
    if (event) addEventXp(event.id, gained);
  };

  const handleTurn = (scores) => {
    setLastScores(scores);
    awardXp(Math.max(1, Math.round(scores.overall / 10)));
  };

  // Learning-path progression: components report activity; the path engine
  // decides whether it satisfies the current lesson / checkpoint.
  const handleActivity = (evt) => {
    // Daily-challenge metrics count the same activity stream the path uses.
    if (['cards', 'session', 'dictation', 'quickfire'].includes(evt.type)) {
      bumpChallengeMetric(evt.type);
    }
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
    const tabFor = {
      scenario: 'arena', checkpoint: 'arena', dictation: 'skills', cards: 'cards',
      quickfire: 'skills', grammar: 'grammar', reading: 'skills', listening: 'skills',
    };
    if (lesson.type === 'dictation') { setSkillArea('listening'); setListeningMode('dictation'); }
    if (lesson.type === 'quickfire') { setSkillArea('speaking'); setSpeakingMode('quickfire'); }
    if (lesson.type === 'grammar') setGrammarFocus(lesson.topicId);
    if (lesson.type === 'reading') setSkillArea('reading');
    if (lesson.type === 'listening') { setSkillArea('listening'); setListeningMode(lesson.trackId); }
    setTab(tabFor[lesson.type] || 'arena');
  };

  // From the Real-World phrasebook: jump into the matching Arena roleplay.
  const startRoleplay = (scenarioId) => {
    const s = SCENARIOS.find((x) => x.id === scenarioId);
    if (s && s.id !== scenario.id) {
      setScenario(s);
      setHistory([]);
      setLastScores(null);
    }
    setRealWorldOpen(false);
    setTab('arena');
  };

  // Route a personalised recommendation to the right activity.
  const runRecommendation = (type) => {
    setPersonaliseOpen(false);
    if (type === 'arena') { setTab('arena'); return; }
    if (type === 'cards') { setTab('cards'); return; }
    if (type === 'grammar') { setTab('grammar'); return; }
    if (type === 'reading') { setSkillArea('reading'); setTab('skills'); return; }
    if (type === 'dictation') { startLesson({ type: 'dictation' }); return; }
    if (type === 'quickfire') { startLesson({ type: 'quickfire' }); return; }
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
    <div className="h-dvh flex flex-col bg-bg text-ink font-sans app-enter">
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
        <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface2 text-ink text-xs font-semibold whitespace-nowrap" title="Coins">
          <CoinsIcon size={13} /> {coins}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setProfileOpen(true)}
            aria-label="Open your profile"
            title="Profile"
            className="w-10 h-10 grid place-items-center rounded-full bg-surface2 hover:bg-line text-lg"
          >
            <span role="img" aria-hidden="true">{(AVATARS.find((a) => a.id === avatarId) || AVATARS[0]).emoji}</span>
          </button>
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

      {/* install banner — appears once the browser offers installation */}
      {pwa.canInstall && !installDismissed && (
        <div className="fade-in mx-4 mt-3 flex items-center gap-3 bg-surface2 border border-line rounded-xl px-4 py-3">
          <span className="w-10 h-10 grid place-items-center rounded-xl bg-surface border border-line text-ink" aria-hidden="true"><Download size={18} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-ink">Install Le Studio</span>
            <span className="block text-xs text-ink2 mt-0.5">Add it to your device for full-screen, offline practice.</span>
          </span>
          <button onClick={() => pwa.promptInstall()} className="btn btn-primary min-h-9 px-3.5 rounded-lg text-xs shrink-0">Install</button>
          <button onClick={() => setInstallDismissed(true)} aria-label="Dismiss install banner" className="w-8 h-8 grid place-items-center rounded-full text-ink3 hover:text-ink shrink-0"><X size={15} /></button>
        </div>
      )}

      {/* main area */}
      <div className="flex-1 flex min-h-0">
        <main className="flex-1 min-w-0 flex flex-col">
          {tab === 'home' && (
            <HomeDashboard
              dailyGoal={settings.dailyGoal}
              weeklyGoal={settings.weeklyGoal}
              level={settings.level}
              path={path}
              onStartLesson={startLesson}
              onOpenSetup={() => setPathSetupOpen(true)}
              onNavigate={setTab}
              onOpenRealWorld={() => setRealWorldOpen(true)}
              onOpenPersonalise={() => setPersonaliseOpen(true)}
              onOpenOffline={() => setOfflineOpen(true)}
              onOpenAnalytics={() => setAnalyticsOpen(true)}
              onOpenReference={() => setReferenceOpen(true)}
              onOpenFocus={() => setFocusOpen(true)}
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
              level={effectiveLevel}
              onTtsRate={(r) => updateSettings({ ...settings, ttsRate: r })}
              onTurn={handleTurn}
              onGrammarTip={(topicId) => {
                setGrammarFocus(topicId);
                setTab('grammar');
              }}
              history={history}
              setHistory={setHistory}
              scenario={scenario}
              setScenario={setScenario}
            />
          )}
          {tab === 'skills' && (
            <Skills
              area={skillArea}
              onAreaChange={(a) => {
                setSkillArea(a);
                if (a !== 'speaking') setSpeakingMode(null);
                if (a !== 'listening') setListeningMode(null);
              }}
              speaking={{ mode: speakingMode, onModeChange: setSpeakingMode }}
              listening={{ mode: listeningMode, onModeChange: setListeningMode }}
              common={{
                apiKey,
                mockMode: settings.mockMode,
                ttsRate: settings.ttsRate,
                level: effectiveLevel,
                onXp: awardXp,
                onActivity: handleActivity,
              }}
            />
          )}
          {tab === 'ai' && (
            <AiHub apiKey={apiKey} mockMode={settings.mockMode} level={effectiveLevel} onXp={awardXp} />
          )}
          {tab === 'culture' && <Culture onXp={awardXp} />}
          {tab === 'cards' && <Vocabulary apiKey={apiKey} mockMode={settings.mockMode} onActivity={handleActivity} onXp={awardXp} />}
          {tab === 'grammar' && (
            <Grammar
              focusTopicId={grammarFocus}
              onFocusConsumed={() => setGrammarFocus(null)}
              onXp={awardXp}
              onActivity={handleActivity}
            />
          )}
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

      {/* bottom tab bar — 4 core destinations plus a "More" sheet */}
      <nav className="flex border-t border-line bg-surface backdrop-blur pb-safe" aria-label="Main navigation">
        {TABS.map(([id, icon, label]) => (
          <TabButton key={id} id={id} icon={icon} label={label} active={tab === id} onClick={setTab} />
        ))}
        <TabButton
          id="more"
          icon={Grid}
          label="More"
          active={moreOpen || MORE_TAB_IDS.includes(tab)}
          onClick={() => setMoreOpen(true)}
        />
      </nav>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        apiKey={apiKey}
        onKeyChange={setApiKey}
        settings={settings}
        onSettingsChange={updateSettings}
        onReplayOnboarding={() => { setSettingsOpen(false); setOnboardingOpen(true); }}
      />
      <SessionDashboard
        open={dashboardOpen}
        onClose={closeDashboard}
        apiKey={apiKey}
        mockMode={settings.mockMode}
        scenario={scenario}
        history={history}
        level={effectiveLevel}
        onSessionSaved={(report) => {
          setStreakTick((t) => t + 1);
          handleActivity({ type: 'session', scenarioId: scenario.id, score: report?.average_scores?.overall ?? 0 });
        }}
      />
      <Personalise
        open={personaliseOpen}
        onClose={() => setPersonaliseOpen(false)}
        prefs={prefs}
        onPrefsChange={updatePrefs}
        baseLevel={settings.level}
        onRun={runRecommendation}
      />
      <Offline open={offlineOpen} onClose={() => setOfflineOpen(false)} pwa={pwa} />
      <Analytics open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
      <Reference open={referenceOpen} onClose={() => setReferenceOpen(false)} />
      <Focus open={focusOpen} onClose={() => setFocusOpen(false)} />
      <Onboarding open={onboardingOpen} onComplete={finishOnboarding} onSkip={skipOnboarding} />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        activeTab={tab}
        devPanel={settings.devPanel}
        onTab={(id) => { setTab(id); setMoreOpen(false); }}
        onOpen={(fn) => { fn(); setMoreOpen(false); }}
        overlays={{
          reference: () => setReferenceOpen(true),
          realWorld: () => setRealWorldOpen(true),
          focus: () => setFocusOpen(true),
          analytics: () => setAnalyticsOpen(true),
          personalise: () => setPersonaliseOpen(true),
          offline: () => setOfflineOpen(true),
        }}
      />
      <RealWorld
        open={realWorldOpen}
        onClose={() => setRealWorldOpen(false)}
        onRoleplay={startRoleplay}
        onXp={awardXp}
      />
      <Profile
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onXp={awardXp}
        weeklyGoal={settings.weeklyGoal}
        onHeaderChange={({ coins: c, avatarId: a }) => {
          setCoins(c);
          setAvatarId(a);
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

// The "More" bottom sheet: every destination that isn't a core bar tab,
// grouped by intent so the overflow stays navigable rather than a flat dump.
function MoreSheet({ open, onClose, activeTab, devPanel, onTab, onOpen, overlays }) {
  if (!open) return null;
  const groups = [
    {
      label: 'Learn',
      items: [
        { icon: Book, title: 'Grammar', subtitle: 'Interactive CEFR topics', onClick: () => onTab('grammar'), active: activeTab === 'grammar' },
        { icon: Sparkles, title: 'AI tools', subtitle: 'Tutor, explanations, exercises', onClick: () => onTab('ai'), active: activeTab === 'ai' },
        { icon: Landmark, title: 'Culture', subtitle: 'Customs, food, history & more', onClick: () => onTab('culture'), active: activeTab === 'culture' },
      ],
    },
    {
      label: 'Practice & tools',
      items: [
        { icon: Compass, title: 'Real-world', subtitle: 'Travel, restaurant, medical…', onClick: () => onOpen(overlays.realWorld) },
        { icon: BookOpen, title: 'Reference', subtitle: 'Dictionary, conjugations, drills', onClick: () => onOpen(overlays.reference) },
        { icon: Clock, title: 'Focus & habits', subtitle: 'Timer, Pomodoro, habit tracker', onClick: () => onOpen(overlays.focus) },
      ],
    },
    {
      label: 'Your progress',
      items: [
        { icon: BarChart, title: 'Analytics', subtitle: 'Time, retention, skill breakdown', onClick: () => onOpen(overlays.analytics) },
        { icon: Sliders, title: 'Personalise', subtitle: 'Style, difficulty, recommendations', onClick: () => onOpen(overlays.personalise) },
        { icon: Download, title: 'Offline & devices', subtitle: 'Downloads, install, sync', onClick: () => onOpen(overlays.offline) },
      ],
    },
  ];
  if (devPanel) {
    groups.push({
      label: 'Developer',
      items: [{ icon: Terminal, title: 'Dev panel', subtitle: 'Telemetry & mock mode', onClick: () => onTab('dev'), active: activeTab === 'dev' }],
    });
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="More">
      <button className="absolute inset-0 bg-black/40 fade-in" aria-label="Close" onClick={onClose} />
      <div className="relative bg-surface border-t border-line rounded-t-2xl max-h-[85dvh] overflow-y-auto nice-scroll pb-safe sheet-enter">
        <div className="sticky top-0 flex items-center gap-2 px-4 py-3 bg-surface border-b border-line">
          <span className="font-bold text-ink">More</span>
          <button onClick={onClose} aria-label="Close" className="ml-auto w-9 h-9 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-5 max-w-md mx-auto">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink3 mb-2 px-1">{g.label}</p>
              <div className="space-y-2">
                {g.items.map((it) => (
                  <button
                    key={it.title}
                    onClick={it.onClick}
                    aria-current={it.active ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 text-left rounded-xl px-3.5 py-3 border transition ${
                      it.active ? 'bg-surface2 border-ink3' : 'bg-surface2 border-line hover:border-ink3'
                    }`}
                  >
                    <span className="w-10 h-10 grid place-items-center rounded-xl bg-surface border border-line text-ink shrink-0" aria-hidden="true">
                      <it.icon size={18} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink">{it.title}</span>
                      <span className="block text-xs text-ink3 mt-0.5 truncate">{it.subtitle}</span>
                    </span>
                    <span className="text-ink3" aria-hidden="true"><ChevronRight size={16} /></span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
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
