import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import HomeDashboard from './components/HomeDashboard';
import FeedbackWidget from './components/FeedbackWidget';
const ChatArena = lazy(() => import('./components/ChatArena'));
const SessionDashboard = lazy(() => import('./components/SessionDashboard'));
const Vocabulary = lazy(() => import('./components/Vocabulary'));
const Grammar = lazy(() => import('./components/Grammar'));
const DevPanel = lazy(() => import('./components/DevPanel'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const Skills = lazy(() => import('./components/Skills'));
const AiHub = lazy(() => import('./components/AiHub'));
const PathSetup = lazy(() => import('./components/PathSetup'));
const LearningPath = lazy(() => import('./components/LearningPath'));
const Profile = lazy(() => import('./components/Profile'));
const Culture = lazy(() => import('./components/Culture'));
const RealWorld = lazy(() => import('./components/RealWorld'));
const Personalise = lazy(() => import('./components/Personalise'));
const Offline = lazy(() => import('./components/Offline'));
const Analytics = lazy(() => import('./components/Analytics'));
const Reference = lazy(() => import('./components/Reference'));
const Focus = lazy(() => import('./components/Focus'));
const Onboarding = lazy(() => import('./components/Onboarding'));
const GlobalSearch = lazy(() => import('./components/GlobalSearch'));
import { getPath, applyActivity } from './lib/path';
import { getGrammarTopic } from './lib/grammar';
import { getTrack } from './lib/listening';
import { getScenarios } from './lib/data';
import usePwaInstall from './hooks/usePwaInstall';
import {
  getApiKey, getSettings, setSettings as persistSettings, getStreak, getXp, addXp,
  getActiveSession, setActiveSession, clearActiveSession,
  getSrs, getNotebook, shouldRemindToday, markRemindedToday, getTodayXp,
  getCoins, addCoins, getAvatar, bumpChallengeMetric, addEventXp,
  getPrefs, setPrefs, getSessions, addStudyTime,
  setApiKey as persistApiKey, setAvatar as persistAvatar, ownAvatar, setHabitList,
  setOnboarded, setLastActivity, getLastActivity,
} from './lib/storage';
import { allEntries } from './lib/vocab';
import { notebookAsEntries, dueEntries } from './lib/memory';
import { adaptiveLevel } from './lib/personalise';
import { AVATARS, activeEvent, levelFromXp } from './lib/game';
import { syncLanguage } from './lib/i18n';
import { getLanguage } from './lib/languages';
import { setTelemetrySink } from './lib/groq';
import { Flame, Bolt, Sun, Moon, Gear, Key, ArrowRight, Home, MessageCircle, Layers, BookOpen, BarChart, Search, Target, Coins as CoinsIcon, StudioMark, X, Download } from './components/icons';
import LearnHub from './components/LearnHub';
import ProgressHub from './components/ProgressHub';

// Focused 5-tab nav: Today | Speak | Review | Learn | Progress
// Everything else lives underneath Learn / Progress so the bar never competes.
const TABS = [
  ['today', Home, 'Today'],
  ['speak', MessageCircle, 'Speak'],
  ['review', Layers, 'Review'],
  ['learn', BookOpen, 'Learn'],
  ['progress', BarChart, 'Progress'],
];
const TAB_ALIASES = { home: 'today', arena: 'speak', cards: 'review', skills: 'learn', grammar: 'learn', ai: 'learn', culture: 'learn', dev: 'progress' };

export default function App() {
  const [apiKey, setApiKey] = useState(getApiKey);
  const [settings, setSettings] = useState(() => {
    const current = getSettings();
    return getApiKey() ? current : { ...current, mockMode: true };
  });
  const [tab, _setTab] = useState('today');
  const [learnView, setLearnView] = useState(null);
  const [progressView, setProgressView] = useState(null);
  const setTab = (id) => {
    const canonical = TAB_ALIASES[id] || id;
    if (canonical === 'learn') setLearnView(null);
    if (canonical === 'progress') setProgressView(null);
    _setTab(canonical);
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [scenario, setScenario] = useState(() => {
    const saved = getActiveSession();
    return (saved && getScenarios().find((s) => s.id === saved.scenarioId)) || getScenarios()[0];
  });
  const [history, setHistory] = useState(() => {
    const saved = getActiveSession();
    return saved && Array.isArray(saved.history) ? saved.history : [];
  });
  const [lastScores, setLastScores] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [streakTick, setStreakTick] = useState(0);
  const [xp, setXp] = useState(getXp);
  const [xpGain, setXpGain] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [coins, setCoins] = useState(getCoins);
  const [avatarId, setAvatarId] = useState(getAvatar);
  const [profileOpen, setProfileOpen] = useState(false);
  const [realWorldOpen, setRealWorldOpen] = useState(false);
  const [personaliseOpen, setPersonaliseOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [referenceTool, setReferenceTool] = useState(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [prefs, setPrefsState] = useState(getPrefs);
  const pwa = usePwaInstall();
  const [installDismissed, setInstallDismissed] = useState(false);
  const [path, setPath] = useState(getPath);
  const [learningPathOpen, setLearningPathOpen] = useState(false);
  const [pathSetupOpen, setPathSetupOpen] = useState(false);
  const [grammarFocus, setGrammarFocus] = useState(null);
  const [skillArea, setSkillArea] = useState(null);
  const [speakingMode, setSpeakingMode] = useState(null);
  const [listeningMode, setListeningMode] = useState(null);

  useEffect(() => {
    setTelemetrySink((entry) => setTelemetry((t) => [...t.slice(-49), entry]));
    return () => setTelemetrySink(null);
  }, []);

  useEffect(() => {
    const warm = () => {
      import('./components/ChatArena');
      import('./components/Skills');
      import('./components/Vocabulary');
      import('./components/Grammar');
      import('./components/AiHub');
      import('./components/Culture');
      import('./components/Reference');
      import('./components/Analytics');
      import('./components/Profile');
      import('./components/GlobalSearch');
      import('./components/Focus');
      import('./components/RealWorld');
      import('./components/Personalise');
      import('./components/Offline');
      import('./components/PathSetup');
      import('./components/LearningPath');
      import('./components/SettingsModal');
      import('./components/SessionDashboard');
    };
    const ric = window.requestIdleCallback;
    const id = ric ? ric(warm, { timeout: 4000 }) : setTimeout(warm, 2500);
    return () => { (window.cancelIdleCallback || clearTimeout)(id); };
  }, []);

  const overlayClosers = [
    [searchOpen, () => setSearchOpen(false)],
    [settingsOpen, () => setSettingsOpen(false)],
    [profileOpen, () => setProfileOpen(false)],
    [realWorldOpen, () => setRealWorldOpen(false)],
    [personaliseOpen, () => setPersonaliseOpen(false)],
    [offlineOpen, () => setOfflineOpen(false)],
    [analyticsOpen, () => setAnalyticsOpen(false)],
    [referenceOpen, () => setReferenceOpen(false)],
    [focusOpen, () => setFocusOpen(false)],
    [learningPathOpen, () => setLearningPathOpen(false)],
    [pathSetupOpen, () => setPathSetupOpen(false)],
  ];
  const anyOverlayOpen = overlayClosers.some(([o]) => o);
  const closeTopOverlay = () => overlayClosers.find(([o]) => o)?.[1]();
  useEffect(() => {
    if (!anyOverlayOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeTopOverlay(); };
    const onPop = () => closeTopOverlay();
    window.history.pushState({ overlay: true }, '');
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyOverlayOpen]);

  useEffect(() => {
    if (!settings.smartReminders || !shouldRemindToday()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const srs = getSrs();
    const due = dueEntries([...allEntries(), ...notebookAsEntries(getNotebook())], srs).length;
    const streak = getStreak().count;
    const streakAtRisk = streak >= 3 && getTodayXp() === 0 && new Date().getHours() >= 17;
    if (due === 0 && !streakAtRisk) return;
    markRemindedToday();
    const body = streakAtRisk
      ? `Your ${streak}-day streak is at risk — two minutes today keeps it alive.`
      : `${due} card${due > 1 ? 's are' : ' is'} due for review — a few minutes now beats relearning later.`;
    notify('Le Studio', body);
  }, [settings.smartReminders]);

  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const srs = getSrs();
    const due = dueEntries([...allEntries(), ...notebookAsEntries(getNotebook())], srs).length;
    try {
      if (due > 0) navigator.setAppBadge(due);
      else navigator.clearAppBadge?.();
    } catch { /* badging unsupported */ }
  }, [tab, xp, streakTick]);

  useEffect(() => {
    const STEP = 20;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') addStudyTime(STEP);
    }, STEP * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (history.length > 0) setActiveSession(scenario.id, history);
    else clearActiveSession();
  }, [scenario.id, history]);

  const isDark = settings.theme
    ? settings.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('reduce-motion', !!settings.reduceMotion);
    el.classList.toggle('large-text', !!settings.largeText);
    el.classList.toggle('dyslexia', !!settings.dyslexiaFont);
    el.classList.toggle('high-contrast', !!settings.highContrast);
  }, [settings.reduceMotion, settings.largeText, settings.dyslexiaFont, settings.highContrast]);

  const updateSettings = (s) => {
    if (s.language !== settings.language) {
      syncLanguage(s.language);
      clearActiveSession();
      setScenario(getScenarios()[0]);
      setHistory([]);
    }
    setSettings(s);
    persistSettings(s);
  };

  const handleApiKeyChange = (key) => {
    setApiKey(key);
    if (key && settings.mockMode) updateSettings({ ...settings, mockMode: false });
  };

  const updatePrefs = (patch) => {
    setPrefs(patch);
    setPrefsState(getPrefs());
  };

  const finishOnboarding = (d) => {
    let timezone = null;
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { timezone = null; }
    updateSettings({
      ...settings,
      name: d.name.trim(),
      language: d.language,
      timezone,
      level: d.level,
      dailyGoal: d.dailyGoal,
      weeklyGoal: d.weeklyGoal,
      smartReminders: d.reminders,
      mockMode: d.mock || (!d.apiKey.trim() && settings.mockMode),
    });
    syncLanguage(d.language);
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
    if (!apiKey && !settings.mockMode) updateSettings({ ...settings, mockMode: true });
    setOnboarded();
    setOnboardingOpen(false);
  };

  const effectiveLevel = adaptiveLevel(settings.level, getSessions(), prefs.adaptiveDifficulty).level;

  const toggleTheme = () =>
    updateSettings({ ...settings, theme: isDark ? 'light' : 'dark' });

  const ready = Boolean(apiKey) || settings.mockMode;
  const streak = getStreak();
  void streakTick;

  const awardXp = (gained) => {
    const beforeXp = getXp();
    const beforeToday = getTodayXp();
    const newXp = addXp(gained);
    setXp(newXp);
    setXpGain({ amount: gained, id: Date.now() });
    setCoins(addCoins(Math.max(1, Math.round(gained / 3))));
    const event = activeEvent();
    if (event) addEventXp(event.id, gained);
    const before = levelFromXp(beforeXp);
    const after = levelFromXp(newXp);
    const dailyGoal = settings.dailyGoal || 30;
    try {
      if (after.level > before.level) {
        setCelebration({ kind: 'level', level: after.level, title: after.title, newTitle: after.title !== before.title });
        navigator.vibrate?.([30, 50, 30, 50, 70]);
      } else if (beforeToday < dailyGoal && getTodayXp() >= dailyGoal) {
        setCelebration({ kind: 'goal' });
        navigator.vibrate?.([25, 40, 45]);
      } else {
        navigator.vibrate?.(12);
      }
    } catch { /* no haptics */ }
  };

  const handleTurn = (scores) => {
    setLastScores(scores);
    awardXp(Math.max(1, Math.round(scores.overall / 10)));
    setLastActivity('session', scenario.id, `Conversation: ${scenario.title}`);
  };

  const handleActivity = (evt) => {
    const labels = {
      cards: 'Flashcard review',
      dictation: 'Dictée practice',
      quickfire: 'Quick Fire improv',
      session: evt.scenarioId ? `Conversation: ${getScenarios().find((x) => x.id === evt.scenarioId)?.title || ''}` : null,
      grammar: evt.topicId ? `Grammar: ${getGrammarTopic(evt.topicId)?.title || ''}` : null,
      listening: evt.trackId ? `Listening: ${getTrack(evt.trackId)?.title || ''}` : null,
      reading: 'Reading practice',
    };
    if (labels[evt.type]) setLastActivity(evt.type, evt.scenarioId || evt.topicId || evt.trackId || evt.textId, labels[evt.type]);
    if (['cards', 'session', 'dictation', 'quickfire', 'grammar'].includes(evt.type)) {
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
      const s = getScenarios().find((x) => x.id === lesson.scenarioId);
      if (s && s.id !== scenario.id) {
        setScenario(s);
        setHistory([]);
        setLastScores(null);
      }
    }
    if (lesson.type === 'dictation') { setSkillArea('listening'); setListeningMode('dictation'); setLearnView('skills'); setTab('learn'); return; }
    if (lesson.type === 'quickfire') { setSkillArea('speaking'); setSpeakingMode('quickfire'); setLearnView('skills'); setTab('learn'); return; }
    if (lesson.type === 'grammar') { setGrammarFocus(lesson.topicId); setLearnView('grammar'); setTab('learn'); return; }
    if (lesson.type === 'reading') { setSkillArea('reading'); setLearnView('skills'); setTab('learn'); return; }
    if (lesson.type === 'listening') { setSkillArea('listening'); setListeningMode(lesson.trackId); setLearnView('skills'); setTab('learn'); return; }
    if (lesson.type === 'cards') { setTab('review'); return; }
    // scenario/checkpoint -> Speak
    setTab(lesson.type === 'checkpoint' || lesson.type === 'scenario' ? 'speak' : 'today');
  };

  const startRoleplay = (scenarioId) => {
    const s = getScenarios().find((x) => x.id === scenarioId);
    if (s && s.id !== scenario.id) {
      setScenario(s);
      setHistory([]);
      setLastScores(null);
    }
    setRealWorldOpen(false);
    setTab('speak');
  };

  const runRecommendation = (type) => {
    setPersonaliseOpen(false);
    if (type === 'arena' || type === 'speak') { setTab('speak'); return; }
    if (type === 'cards' || type === 'review') { setTab('review'); return; }
    if (type === 'grammar') { setLearnView('grammar'); setTab('learn'); return; }
    if (type === 'reading' || type === 'listening' || type === 'dictation' || type === 'quickfire') { setLearnView('skills'); setTab('learn'); return; }
  };

  const goFromSearch = (hit) => {
    setSearchOpen(false);
    if (hit.type === 'scenario') {
      const sc = getScenarios().find((x) => x.id === hit.id);
      if (sc && sc.id !== scenario.id) { setScenario(sc); setHistory([]); setLastScores(null); }
      setTab('speak');
    }
    if (hit.type === 'grammar') { setGrammarFocus(hit.id); setLearnView('grammar'); setTab('learn'); }
    if (hit.type === 'reading') { setSkillArea('reading'); setLearnView('skills'); setTab('learn'); }
    if (hit.type === 'listening') { setSkillArea('listening'); setListeningMode(hit.id); setLearnView('skills'); setTab('learn'); }
  };

  const resumeActivity = (la) => {
    if (!la) return;
    if (la.type === 'session') {
      const sc = getScenarios().find((x) => x.id === la.id);
      if (sc && sc.id !== scenario.id) { setScenario(sc); setHistory([]); setLastScores(null); }
      setTab('speak');
    } else if (la.type === 'grammar') { setGrammarFocus(la.id); setLearnView('grammar'); setTab('learn'); }
    else if (la.type === 'listening') { setSkillArea('listening'); setListeningMode(la.id); setLearnView('skills'); setTab('learn'); }
    else if (la.type === 'reading') { setSkillArea('reading'); setLearnView('skills'); setTab('learn'); }
    else if (la.type === 'cards') setTab('review');
    else if (la.type === 'dictation') { setSkillArea('listening'); setListeningMode('dictation'); setLearnView('skills'); setTab('learn'); }
    else if (la.type === 'quickfire') { setSkillArea('speaking'); setSpeakingMode('quickfire'); setLearnView('skills'); setTab('learn'); }
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
      <a href="#main" className="skip-link">Skip to content</a>
      <span className="sr-only" role="status" aria-live="polite">
        {xpGain ? `${xpGain.amount} XP earned` : ''}
      </span>
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-surface backdrop-blur">
        <StudioMark size={27} />
        <h1 className="font-bold text-lg text-ink tracking-tight mr-1 whitespace-nowrap">
          {getLanguage(settings.language).studio}
          <span className="sr-only"> — {getLanguage(settings.language).name} speaking practice</span>
        </h1>
        <button
          onClick={() => setProfileOpen(true)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${streak.count > 0 ? 'bg-surface2 text-ink' : 'bg-surface2 text-ink3'}`}
          title="Day streak — tap for your stats"
          aria-label={`${streak.count}-day streak — open your stats`}
        >
          <Flame size={13} /> {streak.count}
        </button>
        <button onClick={() => setProfileOpen(true)} aria-label={`${xp} XP — open your stats`} className="relative flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface2 text-ink text-xs font-semibold whitespace-nowrap" title="Experience points — tap for your stats">
          <Bolt size={13} /> {xp.toLocaleString('en-GB')} XP
          {xpGain && (
            <span key={xpGain.id} className="xp-pop absolute -top-1 right-0 text-ink font-bold text-xs pointer-events-none">
              +{xpGain.amount}
            </span>
          )}
        </button>
        <button onClick={() => setProfileOpen(true)} aria-label={`${coins} coins — open your stats`} className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface2 text-ink text-xs font-semibold whitespace-nowrap" title="Coins — tap for your stats">
          <CoinsIcon size={13} /> {coins}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setSearchOpen(true)} aria-label="Search the studio" title="Search" className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink">
            <Search size={18} />
          </button>
          <button onClick={() => setProfileOpen(true)} aria-label="Open your profile" title="Profile" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 hover:bg-line text-lg">
            <span role="img" aria-hidden="true">{(AVATARS.find((a) => a.id === avatarId) || AVATARS[0]).emoji}</span>
          </button>
          {tab === 'speak' && history.length > 0 && (
            <button onClick={endSession} className="btn btn-secondary min-h-10 px-3.5 rounded-xl text-xs">End Session</button>
          )}
          <button onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title={isDark ? 'Light mode' : 'Dark mode'} className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink text-lg">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setSettingsOpen(true)} aria-label="Settings" className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink text-lg">
            <Gear size={18} />
          </button>
        </div>
      </header>

      {!ready && (
        <button onClick={() => setSettingsOpen(true)} className="fade-in mx-4 mt-3 flex items-center gap-3 text-left bg-surface2 border border-line rounded-xl px-4 py-3 hover:border-ink3 transition">
          <span className="w-10 h-10 grid place-items-center rounded-xl bg-surface border border-line text-ink" aria-hidden="true"><Key size={18} /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Welcome to the Studio!</span>
            <span className="block text-xs text-ink2 mt-0.5">Add your free Groq API key to start speaking {getLanguage(settings.language).name} — tap here.</span>
          </span>
          <span className="text-ink2" aria-hidden="true"><ArrowRight size={16} /></span>
        </button>
      )}

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

      <div className="flex-1 flex min-h-0">
        <main id="main" className="flex-1 min-w-0 flex flex-col">
          <Suspense fallback={<ScreenLoader />}>
          {tab === 'today' && (
            <HomeDashboard
              dailyGoal={settings.dailyGoal}
              level={settings.level}
              onStartLesson={startLesson}
              onNavigate={setTab}
              lastActivity={getLastActivity()}
              onResume={resumeActivity}
              onPickScenario={(s) => {
                if (s.id !== scenario.id) {
                  setScenario(s);
                  setHistory([]);
                  setLastScores(null);
                }
              }}
            />
          )}
          {tab === 'speak' && (
            <ChatArena
              onEndSession={endSession}
              apiKey={apiKey}
              mockMode={settings.mockMode}
              ttsRate={settings.ttsRate}
              level={effectiveLevel}
              onTtsRate={(r) => updateSettings({ ...settings, ttsRate: r })}
              onTurn={handleTurn}
              onGrammarTip={(topicId) => {
                setGrammarFocus(topicId);
                setLearnView('grammar');
                setTab('learn');
              }}
              history={history}
              setHistory={setHistory}
              scenario={scenario}
              setScenario={setScenario}
            />
          )}
          {tab === 'review' && (
            <Vocabulary apiKey={apiKey} mockMode={settings.mockMode} onActivity={handleActivity} onXp={awardXp} />
          )}
          {tab === 'learn' && (
            <LearnHub
              view={learnView}
              onView={(v) => {
                if (v === 'realworld-overlay') { setRealWorldOpen(true); return; }
                setLearnView(v);
              }}
              grammarFocus={grammarFocus}
              onFocusConsumed={() => setGrammarFocus(null)}
              onXp={awardXp}
              onActivity={handleActivity}
              skillsArea={skillArea}
              onSkillsArea={(a) => {
                setSkillArea(a);
                if (a !== 'speaking') setSpeakingMode(null);
                if (a !== 'listening') setListeningMode(null);
              }}
              speaking={{ mode: speakingMode, onModeChange: setSpeakingMode }}
              listening={{ mode: listeningMode, onModeChange: setListeningMode }}
              common={{ apiKey, mockMode: settings.mockMode, ttsRate: settings.ttsRate, level: effectiveLevel, onXp: awardXp, onActivity: handleActivity }}
              apiKey={apiKey}
              mockMode={settings.mockMode}
              level={effectiveLevel}
              referenceTool={referenceTool}
              onCloseReference={() => { setReferenceOpen(false); setReferenceTool(null); setLearnView(null); }}
            />
          )}
          {tab === 'progress' && (
            <ProgressHub
              view={progressView}
              onView={setProgressView}
              onXp={awardXp}
              weeklyGoal={settings.weeklyGoal}
              onHeaderChange={({ coins: c, avatarId: a }) => { setCoins(c); setAvatarId(a); }}
              path={path}
              dueCount={dueEntries([...allEntries(), ...notebookAsEntries(getNotebook())], getSrs()).length}
              onStartLesson={startLesson}
              onOpenPathSetup={() => setPathSetupOpen(true)}
              prefs={prefs}
              onPrefsChange={updatePrefs}
              baseLevel={settings.level}
              onRun={runRecommendation}
            />
          )}
          {tab === 'progress' && settings.devPanel && (
            <div className="px-4 pb-4">
              <DevPanel telemetry={telemetry} apiKey={apiKey} mockMode={settings.mockMode} onMockMode={(v) => updateSettings({ ...settings, mockMode: v })} onClear={() => setTelemetry([])} />
            </div>
          )}
          </Suspense>
        </main>
        {tab === 'speak' && <FeedbackWidget scores={lastScores} turnCount={history.length} />}
      </div>

      <nav className="flex border-t border-line bg-surface backdrop-blur pb-safe elev-nav" aria-label="Main navigation">
        {TABS.map(([id, icon, label]) => (
          <TabButton key={id} id={id} icon={icon} label={label} active={tab === id} onClick={setTab} />
        ))}
      </nav>

      <Suspense fallback={null}>
      {settingsOpen && (
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} apiKey={apiKey} onKeyChange={handleApiKeyChange} settings={settings} onSettingsChange={updateSettings} onReplayOnboarding={() => { setSettingsOpen(false); setOnboardingOpen(true); }} />
      )}
      {dashboardOpen && (
        <SessionDashboard open={dashboardOpen} onClose={closeDashboard} apiKey={apiKey} mockMode={settings.mockMode} scenario={scenario} history={history} level={effectiveLevel} onXp={awardXp} onSessionSaved={(report) => { setStreakTick((t) => t + 1); handleActivity({ type: 'session', scenarioId: scenario.id, score: report?.average_scores?.overall ?? 0 }); }} />
      )}
      {personaliseOpen && (<Personalise open={personaliseOpen} onClose={() => setPersonaliseOpen(false)} prefs={prefs} onPrefsChange={updatePrefs} baseLevel={settings.level} onRun={runRecommendation} />)}
      {offlineOpen && <Offline open={offlineOpen} onClose={() => setOfflineOpen(false)} pwa={pwa} />}
      {analyticsOpen && <Analytics open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />}
      {referenceOpen && (<Reference open={referenceOpen} initialTool={referenceTool} onXp={awardXp} onClose={() => { setReferenceOpen(false); setReferenceTool(null); }} />)}
      {focusOpen && <Focus open={focusOpen} onClose={() => setFocusOpen(false)} />}
      {learningPathOpen && (
        <div className="fixed inset-0 z-[55] overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label="Learning path">
          <div className="mx-auto min-h-full max-w-lg px-4 py-4">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="flex-1 text-lg font-bold text-ink">Learning path</h2>
              <button type="button" onClick={() => setLearningPathOpen(false)} aria-label="Close learning path" className="grid h-9 w-9 place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink"><X size={18} /></button>
            </div>
            <LearningPath path={path} dueCount={dueEntries([...allEntries(), ...notebookAsEntries(getNotebook())], getSrs()).length} onStartLesson={startLesson} onOpenSetup={() => { setLearningPathOpen(false); setPathSetupOpen(true); }} />
          </div>
        </div>
      )}
      {onboardingOpen && (<Onboarding open={onboardingOpen} onComplete={finishOnboarding} onSkip={skipOnboarding} onStartConversation={() => setTab('speak')} />)}
      {searchOpen && <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} onGo={goFromSearch} />}
      {realWorldOpen && (<RealWorld open={realWorldOpen} onClose={() => setRealWorldOpen(false)} onRoleplay={startRoleplay} onXp={awardXp} />)}
      {profileOpen && (<Profile open={profileOpen} onClose={() => setProfileOpen(false)} onXp={awardXp} weeklyGoal={settings.weeklyGoal} onHeaderChange={({ coins: c, avatarId: a }) => { setCoins(c); setAvatarId(a); }} />)}
      {pathSetupOpen && (<PathSetup open={pathSetupOpen} onClose={() => setPathSetupOpen(false)} onCreated={(p) => { setPath(p); setPathSetupOpen(false); updateSettings({ ...settings, level: p.cefr }); }} />)}
      </Suspense>
      {celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}
    </div>
  );
}

function Celebration({ data, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2800);
    return () => clearTimeout(id);
  }, [onDone]);
  const pieces = useMemo(() => {
    const shades = ['var(--ink)', 'var(--ink-2)', 'var(--ink-3)', 'var(--line)'];
    return Array.from({ length: 28 }, (_, i) => ({
      key: i,
      left: `${Math.round((i / 28) * 100 + (Math.random() * 6 - 3))}%`,
      dx: `${Math.round(Math.random() * 120 - 60)}px`,
      rot: `${Math.round(Math.random() * 540 + 180)}deg`,
      sz: `${6 + Math.round(Math.random() * 6)}px`,
      dur: `${1.9 + Math.random() * 1.1}s`,
      delay: `${Math.random() * 0.4}s`,
      pc: shades[i % shades.length],
      round: i % 3 === 0,
    }));
  }, []);
  const level = data.kind === 'level';
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center" role="dialog" aria-modal="true" aria-label={level ? 'Level up' : 'Goal reached'}>
      <button className="absolute inset-0 bg-black/40 fade-in" aria-label="Dismiss" onClick={onDone} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {pieces.map((p) => (
          <span key={p.key} className="confetti-piece" style={{ left: p.left, '--dx': p.dx, '--rot': p.rot, '--sz': p.sz, '--dur': p.dur, '--delay': p.delay, '--pc': p.pc, borderRadius: p.round ? '9999px' : '2px' }} />
        ))}
      </div>
      <div className="celebrate-pop relative mx-6 w-full max-w-xs bg-surface border border-line rounded-3xl elev-pop px-6 py-7 text-center">
        <div className="w-16 h-16 mx-auto grid place-items-center rounded-2xl bg-surface2 border border-line">
          {level ? <span className="text-2xl font-black text-ink tabular-nums">{data.level}</span> : <Target size={26} className="text-ink" />}
        </div>
        <p className="mt-4 text-lg font-bold text-ink" lang="fr">{level ? `Niveau ${data.level} !` : 'Objectif atteint !'}</p>
        <p className="mt-1 text-sm text-ink2">{level ? (data.newTitle ? `You’re now ${data.title}. Keep the momentum.` : 'Another level down — keep the momentum.') : 'Daily goal reached — anything more today is pure bonus.'}</p>
        <button onClick={onDone} className="btn btn-primary w-full min-h-11 rounded-xl text-sm mt-5">{level ? 'Merci !' : 'Allez !'}</button>
      </div>
    </div>
  );
}

function notify(title, body) {
  const options = { body, icon: `${import.meta.env.BASE_URL}icon-192.png`, badge: `${import.meta.env.BASE_URL}icon-192.png`, tag: 'le-studio-reminder' };
  try {
    if (navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, options))
        .catch(() => { try { new Notification(title, options); } catch { /* unsupported */ } });
    } else {
      new Notification(title, options);
    }
  } catch { /* notifications unsupported */ }
}

function ScreenLoader() {
  return (
    <div className="flex-1 grid place-items-center py-20" role="status" aria-label="Loading">
      <span className="w-6 h-6 rounded-full border-2 border-line border-t-ink animate-spin" />
    </div>
  );
}

function TabButton({ id, icon: TabIcon, label, active, onClick }) {
  return (
    <button onClick={() => onClick(id)} aria-current={active ? 'page' : undefined} className={`relative flex-1 flex flex-col items-center gap-1 py-2.5 min-h-14 text-[11px] font-medium transition-colors ${active ? 'text-ink' : 'text-ink3 hover:text-ink2'}`}>
      <span aria-hidden="true" className={`absolute top-0 h-0.5 rounded-full bg-ink transition-all duration-200 ${active ? 'w-8 opacity-100' : 'w-0 opacity-0'}`} />
      <TabIcon size={18} />
      {label}
    </button>
  );
}
