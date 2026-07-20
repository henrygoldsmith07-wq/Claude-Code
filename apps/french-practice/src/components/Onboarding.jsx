import { useState } from 'react';
import { LEARNING_STYLES, LESSON_LENGTHS, TOPICS } from '../lib/personalise';
import { AVATARS } from '../lib/game';
import { ChevronLeft, ChevronRight, Check, ArrowRight, Sparkles, TOPIC_ICONS } from './icons';

// Extra-long first-run onboarding: a guided, multi-step wizard that greets the
// learner, collects their goals and preferences, sets up an avatar, reminders
// and habits, and tours the app — writing everything on the final step.

const LEVELS = [
  { id: 'A1', label: 'A1 · Beginner', desc: 'Just starting out' },
  { id: 'A2', label: 'A2 · Elementary', desc: 'A few basics' },
  { id: 'B1', label: 'B1 · Intermediate', desc: 'Can hold simple conversations' },
  { id: 'B2', label: 'B2 · Upper-intermediate', desc: 'Comfortable in most situations' },
  { id: 'C1', label: 'C1 · Advanced', desc: 'Fluent, refining nuance' },
  { id: 'C2', label: 'C2 · Mastery', desc: 'Near-native' },
];

const GOALS = [
  { id: 'travel', emoji: '🧳', label: 'Travel', topics: ['travel', 'food', 'shopping'] },
  { id: 'work', emoji: '💼', label: 'Work & career', topics: ['work', 'study'] },
  { id: 'study', emoji: '🎓', label: 'Study & exams', topics: ['study', 'culture'] },
  { id: 'culture', emoji: '🎭', label: 'Culture & fun', topics: ['culture', 'food'] },
  { id: 'family', emoji: '👨‍👩‍👧', label: 'Family & friends', topics: ['daily', 'health'] },
];

const HABIT_CHOICES = [
  'Speak French out loud', 'Review my flashcards', 'Listen to something in French',
  'Read a short text', 'Learn 5 new words', 'Do one conversation',
];

const GOAL_XP = [
  { id: 15, label: 'Casual', desc: '15 XP · ~5 min' },
  { id: 30, label: 'Regular', desc: '30 XP · ~10 min' },
  { id: 50, label: 'Serious', desc: '50 XP · ~20 min' },
];

const TOUR = [
  { emoji: '🎙️', title: 'Arena', text: 'Voice roleplay with an AI partner — ordering coffee, interviews, and more.' },
  { emoji: '🎯', title: 'Skills', text: 'Speaking, listening, reading and writing drills, each scored.' },
  { emoji: '✨', title: 'AI studio', text: 'A tutor, in-character chats, a translator and exercise generators.' },
  { emoji: '🗂️', title: 'Vocab & Memory', text: 'Spaced-repetition flashcards with a forgetting-curve dashboard.' },
  { emoji: '🏛️', title: 'Culture & Reference', text: 'Cultural notes, conjugation tables, minimal pairs and a dictionary.' },
];

export default function Onboarding({ open, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState({
    name: '', goal: null, level: 'B1', dailyGoal: 30, weeklyGoal: 150,
    learningStyle: 'balanced', favouriteTopics: [], lessonLength: 'medium',
    avatarId: 'sourire', reminders: false, habits: ['Speak French out loud', 'Review my flashcards'],
    apiKey: '', mock: false,
  });
  const set = (patch) => setD((prev) => ({ ...prev, ...patch }));

  if (!open) return null;

  const chooseGoal = (g) => set({ goal: g.id, favouriteTopics: [...new Set([...d.favouriteTopics, ...g.topics])] });
  const toggleTopic = (id) => set({ favouriteTopics: d.favouriteTopics.includes(id) ? d.favouriteTopics.filter((t) => t !== id) : [...d.favouriteTopics, id] });
  const toggleHabit = (name) => set({ habits: d.habits.includes(name) ? d.habits.filter((h) => h !== name) : [...d.habits, name] });

  const enableReminders = () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
    set({ reminders: true });
  };

  // Each entry: { title, subtitle, body, canNext }
  const steps = [
    {
      title: 'Bienvenue !', subtitle: 'Welcome to Le Studio',
      body: (
        <div className="text-center space-y-4 py-4">
          <div className="text-6xl">🇫🇷</div>
          <p className="text-sm text-ink2 leading-relaxed">
            A calm, all-in-one studio for practising French — speaking, listening, reading and
            writing, with an AI partner in your pocket. Let’s set it up in a minute or two.
          </p>
        </div>
      ),
    },
    {
      title: 'What should we call you?', subtitle: 'For a friendlier greeting (optional)',
      body: (
        <input
          value={d.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Your name or a nickname…"
          aria-label="Your name"
          className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink"
        />
      ),
    },
    {
      title: 'Why are you learning French?', subtitle: 'We’ll tailor suggestions to it',
      body: <Cards items={GOALS} selected={d.goal} onPick={(g) => chooseGoal(g)} />,
      canNext: () => Boolean(d.goal),
    },
    {
      title: 'What’s your level?', subtitle: 'You can change this any time',
      body: <Cards items={LEVELS.map((l) => ({ id: l.id, label: l.label, desc: l.desc }))} selected={d.level} onPick={(l) => set({ level: l.id })} />,
    },
    {
      title: 'Set a daily goal', subtitle: 'How much do you want to do each day?',
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
            // Stroke icon, not emoji: it follows currentColor, so it inverts
            // with the chip when selected (colour emojis don't).
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
      title: 'How long are your sessions?', subtitle: 'Sets how many activities a plan holds',
      body: <Cards items={LESSON_LENGTHS.map((l) => ({ id: l.id, label: l.title, desc: l.minutes }))} selected={d.lessonLength} onPick={(l) => set({ lessonLength: l.id })} />,
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
      title: 'Stay on track', subtitle: 'One gentle daily nudge when reviews are due',
      body: (
        <div className="text-center space-y-4 py-2">
          <div className="text-5xl">🔔</div>
          {d.reminders ? (
            <p className="text-sm text-ink inline-flex items-center gap-1.5 justify-center"><Check size={15} /> Reminders on — you can change this in Settings.</p>
          ) : (
            <button onClick={enableReminders} className="btn btn-secondary min-h-11 px-5 rounded-xl text-sm">Enable daily reminders</button>
          )}
          <p className="text-[11px] text-ink3">Optional — the app never sends anything without your say-so.</p>
        </div>
      ),
    },
    {
      title: 'Build a habit', subtitle: 'Pick the daily habits you want to track',
      body: (
        <div className="space-y-2">
          {HABIT_CHOICES.map((h) => {
            const on = d.habits.includes(h);
            return (
              <button key={h} onClick={() => toggleHabit(h)} aria-pressed={on}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left border transition-colors ${on ? 'bg-surface2 border-ink' : 'bg-surface border-line hover:border-ink3'}`}>
                <span className={`w-7 h-7 shrink-0 grid place-items-center rounded-full border ${on ? 'bg-accent text-onaccent border-accent' : 'border-line text-ink3'}`}><Check size={14} /></span>
                <span className="text-sm text-ink">{h}</span>
              </button>
            );
          })}
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
          <p className="text-[11px] text-ink3">Get one free at console.groq.com. It’s stored only on this device.</p>
          <button onClick={() => set({ mock: true, apiKey: '' })} aria-pressed={d.mock}
            className={`w-full min-h-11 rounded-xl text-sm border transition-colors ${d.mock ? 'bg-surface2 border-ink text-ink' : 'bg-surface border-line text-ink2 hover:border-ink3'}`}>
            {d.mock ? '✓ Exploring in offline demo mode' : 'I’ll add it later — explore in demo mode'}
          </button>
        </div>
      ),
    },
    {
      title: 'A quick tour', subtitle: 'Here’s what’s inside',
      body: (
        <div className="space-y-2.5">
          {TOUR.map((t) => (
            <div key={t.title} className="flex items-start gap-3 bg-surface border border-line rounded-2xl px-4 py-3">
              <span className="text-2xl shrink-0" aria-hidden="true">{t.emoji}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{t.title}</span>
                <span className="block text-xs text-ink3">{t.text}</span>
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: d.name ? `You’re all set, ${d.name.trim()} !` : 'You’re all set !', subtitle: 'On y va — let’s learn some French',
      body: (
        <div className="text-center space-y-4 py-4">
          <div className="text-6xl">🎉</div>
          <p className="text-sm text-ink2 leading-relaxed">
            Your studio is tuned to you. You can revisit any of this in Settings and the
            Personalise panel whenever you like.
          </p>
        </div>
      ),
      last: true,
    },
  ];

  const cur = steps[step];
  const total = steps.length;
  const canNext = cur.canNext ? cur.canNext() : true;
  const next = () => (step < total - 1 ? setStep(step + 1) : onComplete(d));

  return (
    <div className="fixed inset-0 z-[60] bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Onboarding">
      {/* progress */}
      <div className="px-4 pt-4 shrink-0">
        <div className="flex items-center gap-2">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} aria-label="Back" className="w-9 h-9 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line"><ChevronLeft size={16} /></button>
          ) : <span className="w-9" aria-hidden="true" />}
          <div className="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
          </div>
          <button onClick={onSkip} className="text-[11px] font-semibold text-ink3 hover:text-ink shrink-0 px-1">Skip</button>
        </div>
        <p className="text-[10px] text-ink3 mt-1.5 text-center tabular-nums">Step {step + 1} of {total}</p>
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
          disabled={!canNext}
          className="btn btn-primary w-full max-w-md mx-auto min-h-12 rounded-xl text-sm disabled:opacity-50"
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
