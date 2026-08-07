import { lazy, Suspense } from 'react';
import { Book, Mic, Volume, BookOpen, Pencil, Sparkles, Landmark, Compass, Search, ChevronRight } from './icons';

const LazyGrammar = lazy(() => import('./Grammar'));
const LazySkills = lazy(() => import('./Skills'));
const LazyCulture = lazy(() => import('./Culture'));
const LazyAiHub = lazy(() => import('./AiHub'));
const LazyReference = lazy(() => import('./Reference'));

function ScreenLoader() {
  return (
    <div className="grid place-items-center py-12" role="status" aria-label="Loading">
      <span className="w-6 h-6 rounded-full border-2 border-line border-t-ink animate-spin" />
    </div>
  );
}

const SECTIONS = [
  { id: 'grammar', title: 'Grammar', subtitle: 'CEFR topics, drills, explainers', icon: Book },
  { id: 'skills', title: 'Skills practice', subtitle: 'Speaking · Listening · Reading · Writing', icon: Mic },
  { id: 'ai', title: 'AI tutor', subtitle: 'Ask anything, get exercises', icon: Sparkles },
  { id: 'culture', title: 'Culture', subtitle: 'Customs, food, regions, history', icon: Landmark },
  { id: 'reference', title: 'Reference', subtitle: 'Dictionary, conjugations', icon: Search },
  { id: 'realworld', title: 'Real-world', subtitle: 'Travel, café, medical phrases', icon: Compass },
];

export default function LearnHub({
  view,
  onView,
  // forwarded props
  grammarFocus,
  onFocusConsumed,
  onXp,
  onActivity,
  skillsArea,
  onSkillsArea,
  speaking,
  listening,
  common,
  apiKey,
  mockMode,
  level,
  referenceTool,
  onCloseReference,
}) {
  if (view === 'grammar') {
    return (
      <div className="h-full flex flex-col min-h-0">
        <HubBack onBack={() => onView(null)} label="Learn" />
        <div className="flex-1 min-h-0">
          <Suspense fallback={<ScreenLoader />}>
            <LazyGrammar focusTopicId={grammarFocus} onFocusConsumed={onFocusConsumed} onXp={onXp} onActivity={onActivity} />
          </Suspense>
        </div>
      </div>
    );
  }
  if (view === 'skills') {
    return (
      <div className="h-full flex flex-col min-h-0">
        <HubBack onBack={() => onView(null)} label="Learn" />
        <div className="flex-1 min-h-0">
          <Suspense fallback={<ScreenLoader />}>
            <LazySkills area={skillsArea} onAreaChange={onSkillsArea} speaking={speaking} listening={listening} common={common} />
          </Suspense>
        </div>
      </div>
    );
  }
  if (view === 'ai') {
    return (
      <div className="h-full flex flex-col min-h-0">
        <HubBack onBack={() => onView(null)} label="Learn" />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Suspense fallback={<ScreenLoader />}>
            <LazyAiHub apiKey={apiKey} mockMode={mockMode} level={level} onXp={onXp} />
          </Suspense>
        </div>
      </div>
    );
  }
  if (view === 'culture') {
    return (
      <div className="h-full flex flex-col min-h-0">
        <HubBack onBack={() => onView(null)} label="Learn" />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Suspense fallback={<ScreenLoader />}>
            <LazyCulture onXp={onXp} />
          </Suspense>
        </div>
      </div>
    );
  }
  if (view === 'reference') {
    return (
      <div className="h-full flex flex-col min-h-0">
        <HubBack onBack={() => onView(null)} label="Learn" />
        <div className="flex-1 min-h-0 overflow-hidden">
          <Suspense fallback={<ScreenLoader />}>
            <LazyReference open initialTool={referenceTool} onXp={onXp} onClose={onCloseReference} />
          </Suspense>
        </div>
      </div>
    );
  }
  if (view === 'realworld') {
    // RealWorld is an overlay-style component; reuse via Learn view by delegating to parent overlay
    return (
      <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
        <div className="max-w-lg mx-auto space-y-4">
          <HubBack onBack={() => onView(null)} label="Learn" inline={false} />
          <p className="text-sm text-ink2">Real-world phrasebooks live as an overlay — tap below to open it.</p>
          <button onClick={() => onView('realworld-overlay')} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">Open phrasebook</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Learn</h2>
          <p className="text-xs text-ink3 mt-1">Grammar, skills and reference — all in one place. Pick what you need today.</p>
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
        <p className="text-[11px] text-ink3 text-center px-2">Everything here is searchable — tap the search icon in the header to jump straight to a topic.</p>
      </div>
    </div>
  );
}

function HubBack({ onBack, label, inline = true }) {
  return (
    <button
      onClick={onBack}
      className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold text-ink3 hover:text-ink shrink-0 ${inline ? '' : 'mb-2'}`}
    >
      <ChevronRight size={13} className="rotate-180" /> Back to {label}
    </button>
  );
}
