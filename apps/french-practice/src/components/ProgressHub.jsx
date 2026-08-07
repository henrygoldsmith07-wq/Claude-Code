import { lazy, Suspense, useState } from 'react';
import { BarChart, Map, Clock, Sliders, Download } from './icons';
import { ChevronRight } from './icons';

const LazyProfile = lazy(() => import('./Profile'));
const LazyAnalytics = lazy(() => import('./Analytics'));
const LazyFocus = lazy(() => import('./Focus'));
const LazyPersonalise = lazy(() => import('./Personalise'));
const LazyLearningPath = lazy(() => import('./LearningPath'));

function ScreenLoader() {
  return (
    <div className="grid place-items-center py-12" role="status" aria-label="Loading">
      <span className="w-6 h-6 rounded-full border-2 border-line border-t-ink animate-spin" />
    </div>
  );
}

const SECTIONS = [
  { id: 'stats', title: 'Stats & streak', subtitle: 'XP, level, streak, weekly goal', icon: BarChart },
  { id: 'path', title: 'Learning path', subtitle: 'Roadmap, checkpoints, lessons', icon: Map },
  { id: 'analytics', title: 'Analytics', subtitle: 'Time, retention, skill breakdown', icon: BarChart },
  { id: 'focus', title: 'Focus & habits', subtitle: 'Timer, Pomodoro, habit tracker', icon: Clock },
];

export default function ProgressHub({
  view,
  onView,
  onXp,
  weeklyGoal,
  onHeaderChange,
  // parent bridges
  path,
  dueCount,
  onStartLesson,
  onOpenPathSetup,
  prefs,
  onPrefsChange,
  baseLevel,
  onRunRecommendation,
}) {
  const [focusOpen, setFocusOpen] = useState(false);

  if (view === 'stats') {
    return (
      <div className="h-full flex flex-col min-h-0">
        <HubBack onBack={() => onView(null)} label="Progress" />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Suspense fallback={<ScreenLoader />}>
            <LazyProfile open onClose={() => onView(null)} onXp={onXp} weeklyGoal={weeklyGoal} onHeaderChange={onHeaderChange} />
          </Suspense>
        </div>
      </div>
    );
  }
  if (view === 'path') {
    return (
      <div className="h-full flex flex-col min-h-0">
        <HubBack onBack={() => onView(null)} label="Progress" />
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          <Suspense fallback={<ScreenLoader />}>
            <LazyLearningPath path={path} dueCount={dueCount} onStartLesson={onStartLesson} onOpenSetup={onOpenPathSetup} />
          </Suspense>
        </div>
      </div>
    );
  }
  if (view === 'analytics') {
    return (
      <div className="h-full flex flex-col min-h-0">
        <HubBack onBack={() => onView(null)} label="Progress" />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Suspense fallback={<ScreenLoader />}>
            <LazyAnalytics open onClose={() => onView(null)} />
          </Suspense>
        </div>
      </div>
    );
  }
  if (view === 'focus') {
    return (
      <div className="h-full flex flex-col min-h-0">
        <HubBack onBack={() => onView(null)} label="Progress" />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Suspense fallback={<ScreenLoader />}>
            <LazyFocus open onClose={() => onView(null)} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Progress</h2>
          <p className="text-xs text-ink3 mt-1">Streak, learning path, analytics and focus tools.</p>
        </div>
        <div className="grid gap-2.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onView(s.id)}
              className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
            >
              <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink border border-line"><s.icon size={18} /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-ink">{s.title}</span>
                <span className="block text-xs text-ink3">{s.subtitle}</span>
              </span>
              <ChevronRight size={16} className="text-ink3 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HubBack({ onBack, label }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold text-ink3 hover:text-ink shrink-0">
      <ChevronRight size={13} className="rotate-180" /> Back to {label}
    </button>
  );
}
