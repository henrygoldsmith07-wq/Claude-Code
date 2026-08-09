import Speaking from './Speaking';
import Listening from './Listening';
import Reading from './Reading';
import Writing from './Writing';
import { Mic, Volume, BookOpen, Pencil, ChevronLeft, ChevronRight } from './icons';

// Skills hub: the four skill areas behind one tab so the bottom nav stays
// usable. Deep links (Home cards, path lessons) jump straight to an area.

const AREAS = [
  { id: 'speaking', icon: Mic, title: 'Speaking', subtitle: 'Pronunciation, shadowing, quick-fire improv' },
  { id: 'listening', icon: Volume, title: 'Listening', subtitle: 'Podcasts, dialogues, news, dictée' },
  { id: 'reading', icon: BookOpen, title: 'Reading', subtitle: 'Stories, articles, classics, tap-to-translate' },
  { id: 'writing', icon: Pencil, title: 'Writing', subtitle: 'Typing, completion, free writing, essays' },
];

export default function Skills({ area, onAreaChange, speaking, listening, common }) {
  if (!area) {
    return (
      <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-ink">Skills</h2>
            <p className="text-xs text-ink2 mt-1">Drills for each of the four skills. Conversations live in the Arena.</p>
          </div>
          <div className="space-y-2.5">
            {AREAS.map((a) => (
              <button
                key={a.id}
                onClick={() => onAreaChange(a.id)}
                className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
              >
                <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink"><a.icon size={18} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink">{a.title}</span>
                  <span className="block text-xs text-ink3">{a.subtitle}</span>
                </span>
                <ChevronRight size={16} className="text-ink3 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <button
        onClick={() => onAreaChange(null)}
        className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold text-ink3 hover:text-ink shrink-0"
      >
        <ChevronLeft size={13} /> All skills
      </button>
      <div className="flex-1 min-h-0">
        {area === 'speaking' && (
          <Speaking
            mode={speaking.mode}
            onModeChange={speaking.onModeChange}
            apiKey={common.apiKey}
            mockMode={common.mockMode}
            ttsRate={common.ttsRate}
            level={common.level}
            onXp={common.onXp}
            onActivity={common.onActivity}
          />
        )}
        {area === 'listening' && (
          <Listening
            mode={listening.mode}
            onModeChange={listening.onModeChange}
            ttsRate={common.ttsRate}
            onXp={common.onXp}
            onActivity={common.onActivity}
          />
        )}
        {area === 'reading' && (
          <Reading apiKey={common.apiKey} mockMode={common.mockMode} onXp={common.onXp} onActivity={common.onActivity} />
        )}
        {area === 'writing' && (
          <Writing apiKey={common.apiKey} mockMode={common.mockMode} level={common.level} onXp={common.onXp} />
        )}
      </div>
    </div>
  );
}
