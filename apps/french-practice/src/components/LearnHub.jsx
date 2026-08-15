import { lazy, Suspense } from 'react';
import { Book, Mic, Volume, BookOpen, Pencil, Sparkles, Landmark, Compass, Search, ChevronRight, GraduationCap } from './icons';

const LazyGrammar = lazy(() => import('./Grammar'));
const LazySkills = lazy(() => import('./Skills'));
const LazyCulture = lazy(() => import('./Culture'));
const LazyAiHub = lazy(() => import('./AiHub'));
const LazyReference = lazy(() => import('./Reference'));
const LazyExamSimulator = lazy(() => import('./ExamSimulator'));

function ScreenLoader() {
  return (
    <div className="grid place-items-center py-12" role="status" aria-label="Loading">
      <span className="w-6 h-6 rounded-full border-2 border-line border-t-ink animate-spin" />
    </div>
  );
}

const SECTIONS = [
  { id: 'grammar', title: 'Grammar', subtitle: '60 CEFR topics · A1 to C1', icon: Book },
  { id: 'skills', title: 'Skills', subtitle: 'Speaking · Listening · Reading · Writing', icon: Mic },
  { id: 'ai', title: 'AI tutor', subtitle: 'Ask anything, get exercises', icon: Sparkles },
  { id: 'culture', title: 'Culture', subtitle: 'Customs, food, regions, history', icon: Landmark },
  { id: 'exams', title: 'Exam simulator', subtitle: 'WJEC · AQA · Edexcel — timed speaking', icon: GraduationCap },
  { id: 'reference', title: 'Reference', subtitle: 'Dictionary & conjugations', icon: Search },
  { id: 'realworld', title: 'Real-world', subtitle: 'Travel, café, medical phrases', icon: Compass },
];

export default function LearnHub({
  view,
  onView,
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
  if (view === 'exams') {
    return (
      <div className="h-full flex flex-col min-h-0">
        <HubBack onBack={() => onView(null)} label="Learn" />
        <div className="flex-1 min-h-0">
          <Suspense fallback={<ScreenLoader />}>
            <LazyExamSimulator apiKey={apiKey} mockMode={mockMode} onXp={onXp} onActivity={onActivity} />
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
    return (
      <div className="h-full overflow-y-auto nice-scroll px-[22px] py-6">
        <div className="max-w-[1020px] mx-auto space-y-4">
          <HubBack onBack={() => onView(null)} label="Learn" inline={false} />
          <p className="text-sm text-ink2">Real-world phrasebooks live as an overlay — tap below to open it.</p>
          <button onClick={() => onView('realworld-overlay')} className="inline-flex items-center justify-center bg-ink text-bg font-bold rounded-[14px] px-5 py-3 text-sm hover:opacity-90 transition">Open phrasebook</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto nice-scroll">
      <div className="max-w-[1020px] mx-auto px-[22px] py-6 space-y-6">
        <div className="text-center">
          <h2 className="text-[clamp(22px,4vw,30px)] font-bold tracking-[-0.02em]">Learn</h2>
          <p className="text-ink2 mt-1.5 text-sm max-w-xl mx-auto">Grammar, skills and reference — one calm place. Pick what you need today; the rest waits.</p>
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
          <span className="inline-block bg-surface border border-line rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink2">25 grammar topics</span>
          <span className="inline-block bg-surface border border-line rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink2">4 skills · PWA offline</span>
          <span className="inline-block bg-surface border border-line rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink2">Search with ⌘K</span>
        </div>
      </div>
    </div>
  );
}

function HubBack({ onBack, label, inline = true }) {
  return (
    <button
      onClick={onBack}
      className={`flex items-center gap-1.5 px-[22px] py-2 text-[11px] font-semibold text-ink3 hover:text-ink shrink-0 ${inline ? '' : 'mb-2'}`}
    >
      <ChevronRight size={13} className="rotate-180" /> Back to {label}
    </button>
  );
}
