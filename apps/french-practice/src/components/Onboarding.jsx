import { useState } from 'react';
import { LEARNING_STYLES, TOPICS } from '../lib/personalise';
import { AVATARS } from '../lib/game';
import { SpeakButton } from './ui';
import { ChevronLeft, ArrowRight, Check, Sparkles, TOPIC_ICONS } from './icons';

// First-run onboarding, redesigned around speed-to-first-success:
// - 9 steps (was 14), grouped under a labelled progress indicator
// - no account, no sign-in, and NO OS permission prompts (reminders moved
//   to Settings, where the browser prompt happens in context)
// - "Quick start" and Skip both land in a fully working demo (Mock Mode),
//   never at an API-key wall
// - the final step delivers the first success: hear your first French
//   sentence before you even enter the app.

const GOALS = [
  { id: 'travel', emoji: '🧳', label: 'Travel', topics: ['travel', 'food', 'shopping'] },
  { id: 'work', emoji: '💼', label: 'Work & career', topics: ['work', 'study'] },
  { id: 'study', emoji: '🎓', label: 'Study & exams', topics: ['study', 'culture'] },
  { id: 'culture', emoji: '🎭', label: 'Culture & fun', topics: ['culture', 'food'] },
  { id: 'family', emoji: '👨‍👩‍👧', label: 'Family & friends', topics: ['daily', 'health'] },
];

const LEVELS = [
  { id: 'A1', label: 'A1 · Beginner', desc: 'Just starting out' },
  { id: 'A2', label: 'A2 · Elementary', desc: 'A few basics' },
  { id: 'B1', label: 'B1 · Intermediate', desc: 'Can hold simple conversations' },
  { id: 'B2', label: 'B2 · Upper-intermediate', desc: 'Comfortable in most situations' },
  { id: 'C1', label: 'C1 · Advanced', desc: 'Fluent, refining nuance' },
  { id: 'C2', label: 'C2 · Mastery', desc: 'Near-native' },
];

const GOAL_XP = [
  { id: 15, label: 'Casual', desc: '15 XP · ~5 min a day' },
  { id: 30, label: 'Regular', desc: '30 XP · ~10 min a day' },
  { id: 50, label: 'Serious', desc: '50 XP · ~20 min a day' },
];

const DEFAULTS = {
  name: '', goal: 'travel', level: 'B1', dailyGoal: 30, weeklyGoal: 150,
  learningStyle: 'balanced', favouriteTopics: ['travel', 'food'], lessonLength: 'medium',
  avatarId: 'sourire', reminders: false, habits: ['Speak French out loud', 'Review my flashcards'],
  apiKey: '', mock: false,
};

// step id → section for the labelled progress indicator
const SECTIONS = ['Welcome', 'About you', 'Your studio', 'Allons-y'];
const SECTION_OF = [0, 1, 1, 1, 2, 2, 2, 3, 3];

export default function Onboarding({ open, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState(DEFAULTS);
  const set = (patch) => setD((prev) => ({ ...prev, ...patch }));

  if (!open) return null;

  const chooseGoal = (g) => set({ goal: g.id, favouriteTopics: [...new Set([...d.favouriteTopics, ...g.topics])] });
  const toggleTopic = (id) => set({ favouriteTopics: d.favouriteTopics.includes(id) ? d.favouriteTopics.filter((t) => t !== id) : [...d.favouriteTopics, id] });

  // Quick start: good defaults + working demo, straight to the finish step.
  const quickStart = () => {
    set({ mock: true });
    setStep(8);
  };

  const steps = [
    {
      title: 'Bienvenue !', subtitle: 'Ready in about a minute',
      body: (
        <div className="text-center space-y-5 py-2">
          <div className="text-6xl">🇫🇷</div>
          <p className="text-sm text-ink2 leading-relaxed">
            Your all-in-one studio for speaking real French — conversations, lessons,
            flashcards and more.
          </p>
          <div className="bg-surface2 border border-line rounded-2xl px-4 py-3 text-left space-y-1.5">
            {['No account, no sign-in — you\'re already in', 'Everything stays on this device', 'Free, no ads, works offline'].map((t) => (
              <p key={t} className="text-xs text-ink inline-flex items-center gap-2 w-full"><Check size={13} className="shrink-0 text-ink2" /> {t}</p>
            ))}
          </div>
          <button onClick={quickStart} className="text-[11px] font-semibold text-ink3 hover:text-ink underline underline-offset-2">
            In a hurry? Quick start with good defaults →
          </button>
        </div>
      ),
    },
    {
      title: 'Who are we teaching?', subtitle: 'A name (optional) and your reason',
      body: (
        <div className="space-y-3">
          <input
            value={d.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Your name or a nickname… (optional)"
            aria-label="Your name"
            className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink"
          />
          <Cards items={GOALS} selected={d.goal} onPick={(g) => chooseGoal(g)} />
        </div>
      ),
    },
    {
      title: 'What’s your level?', subtitle: 'A rough guess is fine — the app adapts',
      body: (
        <div className="space-y-3">
          <Cards items={LEVELS.map((l) => ({ id: l.id, label: l.label, desc: l.desc }))} selected={d.level} onPick={(l) => set({ level: l.id })} />
          <p className="text-[11px] text-ink3 text-center">
            Not sure? Pick anything — the 2-minute adaptive placement test on Home will pin it down.
          </p>
        </div>
      ),
    },
    {
      title: 'Set a daily goal', subtitle: 'Weekly goal is set automatically',
      body: <Cards items={GOAL_XP} selected={d.dailyGoal} onPick={(g) => set({ dailyGoal: g.id, weeklyGoal: g.id * 5 })} />,
    },
    {
      title: 'How do you like to learn?', subtitle: 'This orders your daily recommendations',
      body: <Cards items={LEARNING_STYLES.map((s) => ({ id: s.id, emoji: s.emoji, label: s.title, desc: s.desc }))} selected={d.learningStyle} onPick={(s) => set({ learningStyle: s.id })} />,
    },
    {
      title: 'Pick some favourite topics', subtitle: 'They steer which scenarios come up',
      body: (
        <div className="flex flex-wrap gap-2 justify-center">
          {TOPICS.map((t) => {
            const on = d.favouriteTopics.includes(t.id);
            const TopicIcon = TOPIC_ICONS[t.id];
            return (
              <button key={t.id} onClick={() => toggleTopic(t.id)} aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium border transition-colors ${on ? 'bg-accent text-onaccent border-accent' : 'bg-surface text-ink2 border-line hover:border-ink3'}`}>
                {TopicIcon && <TopicIcon size={13} aria-hidden="true" />} {t.title}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: 'Choose an avatar', subtitle: 'Your face around the studio',
      body: (
        <div className="grid grid-cols-3 gap-2.5">
          {AVATARS.filter((a) => !a.achievement).map((a) => (
            <button key={a.id} onClick={() => set({ avatarId: a.id })} aria-pressed={d.avatarId === a.id}
              className={`bg-surface border rounded-2xl p-3 text-center transition-colors ${d.avatarId === a.id ? 'border-ink' : 'border-line hover:border-ink3'}`}>
              <span className="block text-3xl" aria-hidden="true">{a.emoji}</span>
              <span className="block text-[11px] font-semibold text-ink mt-1 truncate" lang="fr">{a.name}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Connect the AI (optional)', subtitle: 'A free Groq key powers conversations',
      body: (
        <div className="space-y-3">
          <input
            value={d.apiKey}
            onChange={(e) => set({ apiKey: e.target.value, mock: false })}
            placeholder="Paste your Groq API key…"
            aria-label="Groq API key"
            className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink"
          />
          <p className="text-[11px] text-ink3">Get one free at console.groq.com. It's stored only on this device.</p>
          <button onClick={() => set({ mock: true, apiKey: '' })} aria-pressed={d.mock}
            className={`w-full min-h-11 rounded-xl text-sm border transition-colors ${d.mock ? 'bg-surface2 border-ink text-ink' : 'bg-surface border-line text-ink2 hover:border-ink3'}`}>
            {d.mock ? '✓ Exploring in demo mode — everything works' : 'I\'ll add it later — explore in demo mode'}
          </button>
          <p className="text-[11px] text-ink3">
            No account either way — reminders, if you want them later, live in Settings.
          </p>
        </div>
      ),
    },
    {
      title: d.name ? `C'est parti, ${d.name.trim()} !` : 'C\'est parti !', subtitle: 'Your first French, right now',
      body: (
        <div className="text-center space-y-5 py-2">
          <div className="text-6xl">🎉</div>
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink2">Hear your first sentence</p>
            <p className="text-lg font-semibold text-ink" lang="fr">« Bonjour ! On y va ? »</p>
            <p className="text-xs text-ink3 italic">"Hello! Shall we get going?"</p>
            <div className="flex justify-center"><SpeakButton text="Bonjour ! On y va ?" label="Listen" /></div>
          </div>
          <p className="text-xs text-ink2">
            Your studio is tuned to you — change anything later in Settings or Personalise.
          </p>
        </div>
      ),
      last: true,
    },
  ];

  const cur = steps[step];
  const total = steps.length;
  // Only the goal step gates Next (a goal is preselected, so it never blocks).
  const next = () => (step < total - 1 ? setStep(step + 1) : onComplete(d));

  return (
    <div className="fixed inset-0 z-[60] bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Onboarding">
      {/* labelled progress */}
      <div className="px-4 pt-4 shrink-0">
        <div className="flex items-center gap-2">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} aria-label="Back" className="w-9 h-9 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line"><ChevronLeft size={16} /></button>
          ) : <span className="w-9" aria-hidden="true" />}
          <div className="flex-1 flex gap-1.5" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={total} aria-label={`Step ${step + 1} of ${total}`}>
            {SECTIONS.map((label, si) => {
              const stepsIn = SECTION_OF.filter((x) => x === si).length;
              const doneIn = SECTION_OF.slice(0, step + 1).filter((x) => x === si).length;
              return (
                <div key={label} className="flex-1">
                  <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(doneIn / stepsIn) * 100}%` }} />
                  </div>
                  <p className={`text-[9px] mt-1 text-center ${SECTION_OF[step] === si ? 'text-ink font-semibold' : 'text-ink3'}`}>{label}</p>
                </div>
              );
            })}
          </div>
          <button onClick={onSkip} className="text-[11px] font-semibold text-ink3 hover:text-ink shrink-0 px-1">Skip</button>
        </div>
        <p className="text-[10px] text-ink3 mt-1 text-center tabular-nums">Step {step + 1} of {total}</p>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto nice-scroll px-4 py-5">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-bold text-ink text-center">{cur.title}</h2>
          <p className="text-xs text-ink2 text-center mt-1 mb-5">{cur.subtitle}</p>
          {cur.body}
        </div>
      </div>

      {/* footer */}
      <div className="shrink-0 border-t border-line bg-surface px-4 py-3">
        <button
          onClick={next}
          className="btn btn-primary w-full max-w-md mx-auto min-h-12 rounded-xl text-sm"
        >
          {cur.last ? <><Sparkles size={15} /> Start learning</> : <>Continue <ArrowRight size={15} /></>}
        </button>
      </div>
    </div>
  );
}

// Selectable vertical option cards (single choice).
function Cards({ items, selected, onPick }) {
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const on = selected === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onPick(it)}
            aria-pressed={on}
            className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left border transition-colors ${on ? 'bg-surface2 border-ink' : 'bg-surface border-line hover:border-ink3'}`}
          >
            {it.emoji && <span className="text-xl shrink-0" aria-hidden="true">{it.emoji}</span>}
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-ink">{it.label}</span>
              {it.desc && <span className="block text-xs text-ink3">{it.desc}</span>}
            </span>
            {on && <Check size={16} className="text-ink shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
