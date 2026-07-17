import { useState } from 'react';
import { getRoadmap, currentLesson, pathFinished, lessonProgress } from '../lib/path';
import { GOALS } from '../lib/path';
import {
  Map, ChevronRight, Check, Lock, CheckCircle, Target,
  MessageCircle, Volume, Layers, Clock, SCENARIO_ICONS,
} from './icons';

const LESSON_ICONS = { scenario: MessageCircle, dictation: Volume, cards: Layers, quickfire: Clock, checkpoint: Target };

const lessonIcon = (lesson) =>
  (lesson.scenarioId && SCENARIO_ICONS[lesson.scenarioId]) || LESSON_ICONS[lesson.type] || MessageCircle;

// The Learning Path panel on Home: today's lesson, unit progress, and the
// full roadmap with locked/done states. Smart review: when the SRS queue
// piles up, a review step is suggested before the lesson.

export default function LearningPath({ path, dueCount, onStartLesson, onOpenSetup }) {
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  if (!path) {
    return (
      <button
        onClick={onOpenSetup}
        className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
      >
        <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink">
          <Map size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-ink">Start your learning path</span>
          <span className="block text-xs text-ink3 mt-0.5">
            Pick a goal, take a 2-minute placement test, and get a personal roadmap from A1 to C2.
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-ink3" />
      </button>
    );
  }

  const roadmap = getRoadmap(path.goal);
  const goalTitle = GOALS.find((g) => g.id === path.goal)?.title || path.goal;
  const finished = pathFinished(path);
  const lesson = currentLesson(path);
  const unit = finished ? null : roadmap[path.unitIndex];
  const unitDone = unit ? unit.lessons.filter((_, i) => path.completed[`${unit.id}.${i}`]).length : 0;
  const reviewFirst = !finished && dueCount >= 3 && lesson?.type !== 'cards';

  return (
    <section className="bg-surface border border-line rounded-2xl overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <Map size={16} className="text-ink2 shrink-0" />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 flex-1">
          {goalTitle} path
        </h3>
        <span className="px-2 py-0.5 rounded-md border border-ink text-[11px] font-bold text-ink" title="Your CEFR level">
          {path.cefr}
        </span>
        <button onClick={onOpenSetup} className="text-[11px] text-ink3 hover:text-ink min-h-8">
          Change
        </button>
      </div>

      {finished ? (
        <div className="px-5 pb-5">
          <p className="text-sm text-ink">
            You've completed every unit on this path. Retake it at {path.cefr}, or change goal for fresh ground.
          </p>
        </div>
      ) : (
        <>
          {/* unit progress */}
          <div className="px-5 pb-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-semibold text-ink">
                Unit {path.unitIndex + 1}: {unit.title}
              </span>
              <span className="text-[11px] text-ink3 tabular-nums">{unitDone}/{unit.lessons.length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
              <div
                className="h-full bg-ink rounded-full transition-all duration-500"
                style={{ width: `${(unitDone / unit.lessons.length) * 100}%` }}
              />
            </div>
          </div>

          {/* smart review nudge */}
          {reviewFirst && (
            <button
              onClick={() => onStartLesson({ type: 'cards' })}
              className="mx-5 mb-2.5 w-[calc(100%-2.5rem)] flex items-center gap-2.5 bg-surface2 border border-line rounded-xl px-3.5 py-2.5 text-left hover:border-ink3 transition-colors"
            >
              <Layers size={14} className="text-ink2 shrink-0" />
              <span className="flex-1 text-xs text-ink">
                <span className="font-semibold">{dueCount} cards due</span> — a quick review first keeps them stuck
              </span>
              <ChevronRight size={14} className="text-ink3" />
            </button>
          )}

          {/* today's lesson */}
          {lesson && (
            <button
              onClick={() => onStartLesson(lesson)}
              className="w-full flex items-center gap-3.5 border-t border-line px-5 py-4 text-left hover:bg-surface2 transition-colors"
            >
              <span className={`w-10 h-10 shrink-0 grid place-items-center rounded-xl ${
                lesson.type === 'checkpoint' ? 'bg-accent text-onaccent' : 'bg-surface2 text-ink'
              }`}>
                {(() => { const LIcon = lessonIcon(lesson); return <LIcon size={18} />; })()}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-ink3">
                  {lesson.type === 'checkpoint' ? 'Checkpoint' : "Today's lesson"}
                </span>
                <span className="block text-sm font-semibold text-ink truncate">{lesson.title}</span>
                {lesson.need > 1 && (
                  <span className="block text-xs text-ink3 mt-0.5">
                    {lessonProgress(path, lesson.key)}/{lesson.need} done
                  </span>
                )}
              </span>
              <ChevronRight size={16} className="text-ink3 shrink-0" />
            </button>
          )}
        </>
      )}

      {/* roadmap */}
      <button
        onClick={() => setRoadmapOpen((v) => !v)}
        aria-expanded={roadmapOpen}
        className="w-full border-t border-line px-5 py-3 text-left text-[11px] font-semibold text-ink2 hover:text-ink flex items-center justify-between"
      >
        {roadmapOpen ? 'Hide roadmap' : 'View full roadmap'}
        <ChevronRight size={14} className={`transition-transform ${roadmapOpen ? 'rotate-90' : ''}`} />
      </button>
      {roadmapOpen && (
        <ol className="border-t border-line px-5 py-4 space-y-4 fade-in">
          {roadmap.map((u, ui) => {
            const state = ui < path.unitIndex ? 'done' : ui === path.unitIndex ? 'current' : 'locked';
            return (
              <li key={u.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  {state === 'done' && <CheckCircle size={14} className="text-ink" />}
                  {state === 'current' && <span className="w-3.5 h-3.5 rounded-full border-2 border-ink" aria-label="current unit" />}
                  {state === 'locked' && <Lock size={13} className="text-ink3" />}
                  <span className={`text-xs font-semibold ${state === 'locked' ? 'text-ink3' : 'text-ink'}`}>
                    Unit {ui + 1} — {u.title}
                  </span>
                </div>
                <ul className="ml-6 space-y-1">
                  {u.lessons.map((l, li) => {
                    const done = Boolean(path.completed[`${u.id}.${li}`]);
                    const isCurrent = state === 'current' && li === path.lessonIndex;
                    return (
                      <li key={li} className="flex items-center gap-2 text-xs">
                        {done
                          ? <Check size={12} className="text-ink shrink-0" />
                          : <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrent ? 'bg-ink' : 'bg-line'}`} />}
                        <span className={done ? 'text-ink3 line-through' : isCurrent ? 'text-ink font-medium' : 'text-ink3'}>
                          {l.title}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
