import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import HomeDashboard from './components/HomeDashboard';
import FeedbackWidget from './components/FeedbackWidget';
// Everything beyond Home is code-split: each screen and overlay is a
// separate chunk that only downloads when first opened, so the initial
// load ships the app shell + Home instead of every screen at once.
const ChatArena = lazy(() => import('./components/ChatArena'));
const SessionDashboard = lazy(() => import('./components/SessionDashboard'));
const Vocabulary = lazy(() => import('./components/Vocabulary'));
const Grammar = lazy(() => import('./components/Grammar'));
const DevPanel = lazy(() => import('./components/DevPanel'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const Skills = lazy(() => import('./components/Skills'));
const AiHub = lazy(() => import('./components/AiHub'));
const PathSetup = lazy(() => import('./components/PathSetup'));
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
  shouldOnboard, setOnboarded, setLastActivity, getLastActivity,
} from './lib/storage';
import { allEntries } from './lib/vocab';
import { notebookAsEntries, dueEntries } from './lib/memory';
import { adaptiveLevel } from './lib/personalise';
import { AVATARS, activeEvent, levelFromXp } from './lib/game';
import { syncLanguage } from './lib/i18n';
import { getLanguage } from './lib/languages';
import { setTelemetrySink } from './lib/groq';
import { Flame, Bolt, Sun, Moon, Gear, Key, ArrowRight, Home, MessageCircle, Mic, Layers, Terminal, Book, BookOpen, Sparkles, Landmark, Download, X, Grid, Compass, Sliders, BarChart, Clock, ChevronRight, Search, Target, Coins as CoinsIcon } from './components/icons';

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  // Restore an in-flight conversation (page refresh must not lose a session).
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
  const [xpGain, setXpGain] = useState(null); // { amount, id } for the pop animation
  const [celebration, setCelebration] = useState(null); // { kind, level, title } — level-up / goal party
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

  // Warm the code-split chunks during idle time after first paint: keeps
  // startup light, makes later navigation instant, and re-populates the
  // offline cache so every screen still works with no network.
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
      import('./components/SettingsModal');
      import('./components/SessionDashboard');
    };
    const ric = window.requestIdleCallback;
    const id = ric ? ric(warm, { timeout: 4000 }) : setTimeout(warm, 2500);
    return () => { (window.cancelIdleCallback || clearTimeout)(id); };
  }, []);

  // Overlay stack: Escape closes the topmost overlay, and while any overlay
  // is open the browser Back button closes it instead of leaving the app.
  const overlayClosers = [
    [searchOpen, () => setSearchOpen(false)],
    [moreOpen, () => setMoreOpen(false)],
    [settingsOpen, () => setSettingsOpen(false)],
    [profileOpen, () => setProfileOpen(false)],
    [realWorldOpen, () => setRealWorldOpen(false)],
    [personaliseOpen, () => setPersonaliseOpen(false)],
    [offlineOpen, () => setOfflineOpen(false)],
    [analyticsOpen, () => setAnalyticsOpen(false)],
    [referenceOpen, () => setReferenceOpen(false)],
    [focusOpen, () => setFocusOpen(false)],
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

  // Smart reminders: once per day, when the user opted in, surface a browser
  // notification. Two triggers, streak-at-risk first — protecting a streak is
  // the strongest pull back. Works while the tab is open (no backend to push
  // from); routed through the service worker when available so it's reliable
  // on mobile, where the bare Notification constructor is blocked.
  useEffect(() => {
    if (!settings.smartReminders || !shouldRemindToday()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const srs = getSrs();
    const due = dueEntries([...allEntries(), ...notebookAsEntries(getNotebook())], srs).length;
    const streak = getStreak().count;
    // Only nag about the streak in the evening, once nothing's been done today.
    const streakAtRisk = streak >= 3 && getTodayXp() === 0 && new Date().getHours() >= 17;
    if (due === 0 && !streakAtRisk) return;
    markRemindedToday();
    const body = streakAtRisk
      ? `Your ${streak}-day streak is at risk — two minutes today keeps it alive.`
      : `${due} card${due > 1 ? 's are' : ' is'} due for review — a few minutes now beats relearning later.`;
    notify('Le Studio', body);
  }, [settings.smartReminders]);

  // App badge: mirror the due-review count on the installed app icon — an
  // ambient nudge that persists on the home screen even when the app is shut.
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const srs = getSrs();
    const due = dueEntries([...allEntries(), ...notebookAsEntries(getNotebook())], srs).length;
    try {
      if (due > 0) navigator.setAppBadge(due);
      else navigator.clearAppBadge?.();
    } catch { /* badging unsupported on this platform */ }
  }, [tab, xp, streakTick]);

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
    if (s.language !== settings.language) {
      syncLanguage(s.language);
      // The in-flight scenario belonged to the old language — start fresh.
      clearActiveSession();
      setScenario(getScenarios()[0]);
      setHistory([]);
    }
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
    // Guest mode: skipping must land in a working app, not an API-key wall.
    if (!apiKey && !settings.mockMode) updateSettings({ ...settings, mockMode: true });
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
    const beforeXp = getXp();
    const beforeToday = getTodayXp();
    const newXp = addXp(gained);
    setXp(newXp);
    setXpGain({ amount: gained, id: Date.now() });
    setCoins(addCoins(Math.max(1, Math.round(gained / 3))));
    const event = activeEvent();
    if (event) addEventXp(event.id, gained);

    // Celebrate the two moments that used to pass silently: crossing a level,
    // and reaching the day's goal for the first time. Confetti + a firmer
    // haptic for the party; a light tick otherwise.
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
    } catch { /* no haptics on this device */ }
  };

  const handleTurn = (scores) => {
    setLastScores(scores);
    awardXp(Math.max(1, Math.round(scores.overall / 10)));
    setLastActivity('session', scenario.id, `Conversation: ${scenario.title}`);
  };

  // Learning-path progression: components report activity; the path engine
  // decides whether it satisfies the current lesson / checkpoint.
  const handleActivity = (evt) => {
    // Remember what the learner was doing so Home can offer to resume it.
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
      const s = getScenarios().find((x) => x.id === lesson.scenarioId);
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
    const s = getScenarios().find((x) => x.id === scenarioId);
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

  // Deep-link a global search result to the right surface.
  const goFromSearch = (hit) => {
    setSearchOpen(false);
    if (hit.type === 'scenario') {
      const sc = getScenarios().find((x) => x.id === hit.id);
      if (sc && sc.id !== scenario.id) { setScenario(sc); setHistory([]); setLastScores(null); }
      setTab('arena');
    }
    if (hit.type === 'grammar') { setGrammarFocus(hit.id); setTab('grammar'); }
    if (hit.type === 'reading') { setSkillArea('reading'); setTab('skills'); }
    if (hit.type === 'listening') { setSkillArea('listening'); setListeningMode(hit.id); setTab('skills'); }
  };

  // Home's continue card → jump straight back into the recorded activity.
  const resumeActivity = (la) => {
    if (!la) return;
    if (la.type === 'session') {
      const sc = getScenarios().find((x) => x.id === la.id);
      if (sc && sc.id !== scenario.id) { setScenario(sc); setHistory([]); setLastScores(null); }
      setTab('arena');
    } else if (la.type === 'grammar') { setGrammarFocus(la.id); setTab('grammar'); }
    else if (la.type === 'listening') { setSkillArea('listening'); setListeningMode(la.id); setTab('skills'); }
    else if (la.type === 'reading') { setSkillArea('reading'); setTab('skills'); }
    else if (la.type === 'cards') setTab('cards');
    else if (la.type === 'dictation') { setSkillArea('listening'); setListeningMode('dictation'); setTab('skills'); }
    else if (la.type === 'quickfire') { setSkillArea('speaking'); setSpeakingMode('quickfire'); setTab('skills'); }
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
      {/* screen-reader announcements for XP gains */}
      <span className="sr-only" role="status" aria-live="polite">
        {xpGain ? `${xpGain.amount} XP earned` : ''}
      </span>
      {/* header */}
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-surface backdrop-blur">
        <h1 className="font-bold text-lg text-ink tracking-tight mr-1 whitespace-nowrap">
          {getLanguage(settings.language).studio}
          <span className="sr-only"> — {getLanguage(settings.language).name} speaking practice</span>
        </h1>
        <button
          onClick={() => setProfileOpen(true)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
            streak.count > 0 ? 'bg-surface2 text-ink' : 'bg-surface2 text-ink3'
          }`}
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
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search the studio"
            title="Search"
            className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink"
          >
            <Search size={18} />
          </button>
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
              Add your free Groq API key to start speaking {getLanguage(settings.language).name} — tap here.
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
        <main id="main" className="flex-1 min-w-0 flex flex-col">
          <Suspense fallback={<ScreenLoader />}>
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
          </Suspense>
        </main>
        {tab === 'arena' && <FeedbackWidget scores={lastScores} turnCount={history.length} />}
      </div>

      {/* bottom tab bar — 4 core destinations plus a "More" sheet */}
      <nav className="flex border-t border-line bg-surface backdrop-blur pb-safe elev-nav" aria-label="Main navigation">
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

      {/* Overlays mount only when open, so their code-split chunks download
          on demand rather than on first load. fallback={null} keeps the
          brief chunk fetch invisible behind the tap. */}
      <Suspense fallback={null}>
      {settingsOpen && (
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          apiKey={apiKey}
          onKeyChange={setApiKey}
          settings={settings}
          onSettingsChange={updateSettings}
          onReplayOnboarding={() => { setSettingsOpen(false); setOnboardingOpen(true); }}
        />
      )}
      {dashboardOpen && (
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
      )}
      {personaliseOpen && (
        <Personalise
          open={personaliseOpen}
          onClose={() => setPersonaliseOpen(false)}
          prefs={prefs}
          onPrefsChange={updatePrefs}
          baseLevel={settings.level}
          onRun={runRecommendation}
        />
      )}
      {offlineOpen && <Offline open={offlineOpen} onClose={() => setOfflineOpen(false)} pwa={pwa} />}
      {analyticsOpen && <Analytics open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />}
      {referenceOpen && <Reference open={referenceOpen} onClose={() => setReferenceOpen(false)} />}
      {focusOpen && <Focus open={focusOpen} onClose={() => setFocusOpen(false)} />}
      {onboardingOpen && <Onboarding open={onboardingOpen} onComplete={finishOnboarding} onSkip={skipOnboarding} />}
      {searchOpen && <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} onGo={goFromSearch} />}
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
      {realWorldOpen && (
        <RealWorld
          open={realWorldOpen}
          onClose={() => setRealWorldOpen(false)}
          onRoleplay={startRoleplay}
          onXp={awardXp}
        />
      )}
      {profileOpen && (
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
      )}
      {pathSetupOpen && (
        <PathSetup
          open={pathSetupOpen}
          onClose={() => setPathSetupOpen(false)}
          onCreated={(p) => {
            setPath(p);
            setPathSetupOpen(false);
            updateSettings({ ...settings, level: p.cefr });
          }}
        />
      )}
      </Suspense>
      {celebration && <Celebration data={celebration} onDone={() => setCelebration(null)} />}
    </div>
  );
}

// A brief, monochrome confetti party for a genuine win — level-up or the
// day's goal. Auto-dismisses; tap anywhere to close early. Purely additive,
// so reduced-motion users simply get a near-instant card, no falling pieces.
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
          <span
            key={p.key}
            className="confetti-piece"
            style={{
              left: p.left, '--dx': p.dx, '--rot': p.rot, '--sz': p.sz,
              '--dur': p.dur, '--delay': p.delay, '--pc': p.pc,
              borderRadius: p.round ? '9999px' : '2px',
            }}
          />
        ))}
      </div>
      <div className="celebrate-pop relative mx-6 w-full max-w-xs bg-surface border border-line rounded-3xl elev-pop px-6 py-7 text-center">
        <div className="w-16 h-16 mx-auto grid place-items-center rounded-2xl bg-surface2 border border-line">
          {level
            ? <span className="text-2xl font-black text-ink tabular-nums">{data.level}</span>
            : <Target size={26} className="text-ink" />}
        </div>
        <p className="mt-4 text-lg font-bold text-ink" lang="fr">
          {level ? `Niveau ${data.level} !` : 'Objectif atteint !'}
        </p>
        <p className="mt-1 text-sm text-ink2">
          {level
            ? (data.newTitle ? `You’re now ${data.title}. Keep the momentum.` : 'Another level down — keep the momentum.')
            : 'Daily goal reached — anything more today is pure bonus.'}
        </p>
        <button onClick={onDone} className="btn btn-primary w-full min-h-11 rounded-xl text-sm mt-5">
          {level ? 'Merci !' : 'Allez !'}
        </button>
      </div>
    </div>
  );
}

// Fire a notification, preferring the service-worker registration (required on
// Android Chrome, where `new Notification()` throws) and falling back to the
// page-level constructor on desktop.
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
  } catch { /* notifications unsupported on this platform */ }
}

// Lightweight fallback shown while a code-split screen chunk loads.
function ScreenLoader() {
  return (
    <div className="flex-1 grid place-items-center py-20" role="status" aria-label="Loading">
      <span className="w-6 h-6 rounded-full border-2 border-line border-t-ink animate-spin" />
    </div>
  );
}

// The "More" bottom sheet: every destination that isn't a core bar tab,
// grouped by intent so the overflow stays navigable rather than a flat dump.
function MoreSheet({ open, onClose, activeTab, devPanel, onTab, onOpen, overlays }) {
  if (!open) return null;
  // Swipe-down anywhere on the sheet header closes it (mobile gesture).
  let touchY = null;
  const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (touchY != null && e.touches[0].clientY - touchY > 70) { touchY = null; onClose(); }
  };
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
      <div className="relative bg-surface border-t border-line rounded-t-3xl max-h-[85dvh] overflow-y-auto nice-scroll pb-safe sheet-enter elev-sheet">
        <div className="sticky top-0 flex items-center gap-2 px-4 py-3 bg-surface border-b border-line" onTouchStart={onTouchStart} onTouchMove={onTouchMove}>
          <span aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 top-1.5 w-9 h-1 rounded-full bg-line" />
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
      className={`relative flex-1 flex flex-col items-center gap-1 py-2.5 min-h-14 text-[11px] font-medium transition-colors ${
        active ? 'text-ink' : 'text-ink3 hover:text-ink2'
      }`}
    >
      {/* active indicator: a short bar at the top of the tab */}
      <span aria-hidden="true" className={`absolute top-0 h-0.5 rounded-full bg-ink transition-all duration-200 ${active ? 'w-8 opacity-100' : 'w-0 opacity-0'}`} />
      <TabIcon size={18} />
      {label}
    </button>
  );
}
