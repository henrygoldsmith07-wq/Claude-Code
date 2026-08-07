import { lazy, Suspense, useState } from 'react';
import { BarChart, Map, Clock } from './icons';
import { ChevronRight } from './icons';

const LazyProfile = lazy(() => import('./Profile'));
const LazyAnalytics = lazy(() => import('./Analytics'));
const LazyFocus = lazy(() => import('./Focus'));
const LazyLearningPath = lazy(() => import('./LearningPath'));

function ScreenLoader() {
  return (
    <div className="grid place-items-center py-12" role="status" aria-label="Loading">
      <span className="w-6 h-6 rounded-full border-2 border-line border-t-ink animate-spin" />
    </div>
  );
}

const SECTIONS = [
  { id: 'stats', title: 'Stats & streak', subtitle: 'XP, level, streak & weekly goal — your private dashboard.', icon: BarChart },
  { id: 'path', title: 'Learning path', subtitle: '12 units · checkpoints · 60 lessons per goal.', icon: Map },
  { id: 'analytics', title: 'Analytics', subtitle: 'Time, retention & skill breakdown.', icon: BarChart },
  { id: 'focus', title: 'Focus & habits', subtitle: 'Timer, Pomodoro & habit tracker.', icon: Clock },
];

export default function ProgressHub({
  view,
  onView,
  onXp,
  weeklyGoal,
  onHeaderChange,
  path,
  dueCount,
  onStartLesson,
  onOpenPathSetup,
  prefs,
  onPrefsChange,
  baseLevel,
  onRunRecommendation,
}) {
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
        <div className="flex-1 min-h-0 overflow-y-auto px-[22px] py-4">
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
    <div className="h-full overflow-y-auto nice-scroll">
      <div className="max-w-[1020px] mx-auto px-[22px] py-6 space-y-6">
        <div className="text-center">
          <h2 className="text-[clamp(22px,4vw,30px)] font-bold tracking-[-0.02em]">Progress</h2>
          <p className="text-ink2 mt-1.5 text-sm max-w-xl mx-auto">Streak, learning path and analytics — the quiet scoreboard. No guilt, just shape and momentum.</p>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onView(s.id)}
              className="text-left bg-surface border border-line rounded-[20px] p-[22px] hover:border-ink3 transition flex flex-col gap-2"
            >
              <span className="w-8 h-8 grid place-items-center rounded-full bg-surface2 border border-line text-ink"><s.icon size={16} /></span>
              <span className="text-[18px] font-bold tracking-[-0.02em] leading-tight">{s.title}</span>
              <span className="text-sm text-ink2 leading-relaxed">{s.subtitle}</span>
              <span className="text-xs font-semibold text-ink inline-flex items-center gap-1 mt-1">Open <ChevronRight size={12} /></span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <span className="inline-block bg-surface border border-line rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink2">Private by architecture</span>
          <span className="inline-block bg-surface border border-line rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink2">Works offline</span>
        </div>
      </div>
    </div>
  );
}

function HubBack({ onBack, label }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1.5 px-[22px] py-2 text-[11px] font-semibold text-ink3 hover:text-ink shrink-0">
      <ChevronRight size={13} className="rotate-180" /> Back to {label}
    </button>
  );
}
