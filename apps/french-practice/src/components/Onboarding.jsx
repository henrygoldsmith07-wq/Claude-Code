import { useState } from 'react';
import { LEARNING_STYLES, LESSON_LENGTHS, TOPICS } from '../lib/personalise';
import { AVATARS } from '../lib/game';
import { LANGUAGE_LIST, getLanguage } from '../lib/languages';
import { syncLanguage } from '../lib/i18n';
import { SpeakButton } from './ui';
import { ChevronLeft, ArrowRight, Check, Flame, Sparkles, TOPIC_ICONS } from './icons';

// First-run onboarding: deliberately thorough — fifteen steps that set up
// the whole studio — but never coercive:
// - a one-tap "Quick start" and an always-visible Skip land in a fully
//   working demo (Mock Mode), never at an API-key wall
// - no account, no sign-in, and NO OS permission prompts (the reminders
//   step records intent only; the browser prompt happens later, in
//   context, from Settings)
// - labelled section progress so the length feels navigable
// - the final step delivers the first success: hear your first French
//   sentence before you even enter the app.

const GOALS = [
  { id: 'travel', emoji: '🧳', label: 'Travel', topics: ['travel', 'food', 'shopping'] },
  { id: 'work', emoji: '💼', label: 'Work & business', topics: ['work', 'study'] },
  { id: 'study', emoji: '🎓', label: 'School & exams', topics: ['study', 'culture'] },
  { id: 'fluency', emoji: '🗣️', label: 'Fluency & confidence', topics: ['daily', 'culture'] },
  { id: 'culture', emoji: '🎭', label: 'Culture & fun', topics: ['culture', 'food'] },
  { id: 'family', emoji: '👨‍👩‍👧', label: 'Family & friends', topics: ['daily', 'health'] },
];

// First-phrase samples per target language — a friendly greeting the learner
// hears (and repeats) before entering the app.
const FIRST_PHRASE = {
  fr: { hi: 'Bonjour !', hiEn: 'Hello!', go: 'Bonjour ! On y va ?', goEn: 'Hello! Shall we get going?' },
  de: { hi: 'Hallo!', hiEn: 'Hello!', go: 'Hallo! Auf geht’s?', goEn: 'Hello! Shall we get going?' },
  es: { hi: '¡Hola!', hiEn: 'Hello!', go: '¡Hola! ¿Vamos?', goEn: 'Hello! Shall we get going?' },
};

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

const habitChoices = (lang) => [
  `Speak ${lang} out loud`, 'Review my flashcards', `Listen to something in ${lang}`,
  'Read a short text', 'Learn 5 new words', 'Do one conversation',
];

const RHYTHMS = [
  { id: 'daily', label: 'Most days', desc: 'A little every day — the gold standard', goalXp: 30 },
  { id: 'often', label: 'A few times a week', desc: 'Solid sessions, some rest days', goalXp: 50 },
  { id: 'weekends', label: 'Mostly weekends', desc: 'Longer, deeper sessions', goalXp: 50 },
];

const TOUR = [
  { emoji: '🎙️', title: 'Arena', text: 'Voice roleplay with an AI partner — 40 scenarios from bistro to bank.' },
  { emoji: '🎯', title: 'Skills', text: 'Speaking, listening, reading and writing drills, each scored.' },
  { emoji: '🗺️', title: 'Learning Path', text: '12 units and 60 lessons per goal, with checkpoints and knowledge stats.' },
  { emoji: '🗂️', title: 'Vocab & Memory', text: '42 packs and 520+ cards on SM-2 spaced repetition.' },
  { emoji: '🏛️', title: 'Culture & Reference', text: 'Cultural notes, 25 grammar topics, conjugations and a 2,000-word dictionary.' },
];

const DEFAULTS = {
  name: '', language: 'fr', goal: 'travel', level: 'B1', dailyGoal: 30, weeklyGoal: 150,
  learningStyle: 'balanced', favouriteTopics: ['travel', 'food'], lessonLength: 'medium',
  avatarId: 'sourire', reminders: false, habits: ['Speak French out loud', 'Review my flashcards'],
  apiKey: '', mock: false, rhythm: 'daily',
};

// step index → section for the labelled progress indicator
const SECTIONS = ['Welcome', 'About you', 'Your studio', 'Ready'];
const SECTION_OF = [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3];
const LAST_STEP = SECTION_OF.length - 1;

export default function Onboarding({ open, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState('fwd'); // slide direction for the step transition
  const [d, setD] = useState(DEFAULTS);
  const set = (patch) => setD((prev) => ({ ...prev, ...patch }));
  // Move to a step, remembering whether it's forward or back so the content
  // slides in from the matching side. reduce-motion (Settings) neutralises it.
  const goTo = (n) => { setDir(n >= step ? 'fwd' : 'back'); setStep(n); };

  if (!open) return null;

  const chooseGoal = (g) => set({ goal: g.id, favouriteTopics: [...new Set([...d.favouriteTopics, ...g.topics])] });
  const toggleTopic = (id) => set({ favouriteTopics: d.favouriteTopics.includes(id) ? d.favouriteTopics.filter((t) => t !== id) : [...d.favouriteTopics, id] });

  const toggleHabit = (name) => set({ habits: d.habits.includes(name) ? d.habits.filter((h) => h !== name) : [...d.habits, name] });

  // Target-language config drives the language-aware copy below.
  const lang = getLanguage(d.language);
  const phrase = FIRST_PHRASE[d.language] || FIRST_PHRASE.fr;

  // Switching the target language live points the whole studio (content,
  // speech, AI) at it, so the rest of onboarding — and the sample phrases —
  // are already in the chosen language.
  const chooseLanguage = (id) => {
    syncLanguage(id);
    set({ language: id, habits: habitChoices(getLanguage(id).name).slice(0, 2) });
  };

  // Quick start: good defaults + working demo, straight to the finish step.
  const quickStart = () => {
    set({ mock: true });
    goTo(LAST_STEP);
  };

  const steps = [
    {
      title: 'Welcome!', subtitle: 'A guided setup for your whole studio',
      body: (
        <div className="text-center space-y-5 py-2">
          <div className="text-6xl">🎙️</div>
          <p className="text-sm text-ink2 leading-relaxed">
            Your all-in-one studio for really speaking a new language — conversations,
            lessons, flashcards and more.
          </p>
          <div className="bg-surface2 border border-line rounded-2xl px-4 py-3 text-left space-y-1.5">
            {['No account, no sign-in — you\'re already in (guest mode)', 'Everything stays on this device', 'Free, no ads, works offline'].map((t) => (
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
      title: 'Which language?', subtitle: 'The one you want to learn',
      body: (
        <div className="space-y-3">
          <Cards
            items={LANGUAGE_LIST.map((l) => ({ id: l.id, emoji: l.flag, label: l.name, desc: `${l.nativeName} · ${l.hello}` }))}
            selected={d.language}
            onPick={(l) => chooseLanguage(l.id)}
          />
          <p className="text-[11px] text-ink3 text-center">
            Explanations and translations are in English. You can switch languages any time in Settings.
          </p>
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
      title: 'How often will you practise?', subtitle: 'Honest answers make better plans',
      body: (
        <div className="space-y-3">
          <Cards
            items={RHYTHMS.map((r) => ({ id: r.id, label: r.label, desc: r.desc }))}
            selected={d.rhythm}
            onPick={(r) => { const rr = RHYTHMS.find((x) => x.id === r.id); set({ rhythm: rr.id, dailyGoal: rr.goalXp, weeklyGoal: rr.goalXp * 5 }); }}
          />
          <p className="text-[11px] text-ink3 text-center">Little and often beats cramming — spaced practice is how memory works.</p>
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
      title: 'Build a habit', subtitle: 'Pick the daily habits you want to track',
      body: (
        <div className="space-y-2">
          {habitChoices(lang.name).map((h) => {
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
      title: 'Gentle reminders?', subtitle: 'One nudge a day when reviews pile up',
      body: (
        <div className="space-y-3">
          <Cards
            items={[
              { id: true, label: 'Yes, remind me', desc: 'A single daily nudge, never more' },
              { id: false, label: 'No thanks', desc: 'I\'ll keep my own rhythm' },
            ]}
            selected={d.reminders}
            onPick={(o) => set({ reminders: o.id })}
          />
          <p className="text-[11px] text-ink3 text-center">
            Nothing is asked of your browser now — if you opt in, you'll confirm the
            notification permission later, in Settings, when it's actually needed.
          </p>
        </div>
      ),
    },
    {
      title: 'Meet your streak', subtitle: 'The one number that keeps you coming back',
      body: (
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 bg-reviewsoft text-review rounded-full px-4 py-2 text-lg font-bold">
              <Flame size={22} /> 1-day streak
            </span>
          </div>
          <p className="text-sm text-ink2 leading-relaxed text-center">
            Hit your daily goal and your streak grows by one. Miss a day and it resets —
            so a few minutes daily beats a big weekend cram. Today already counts as day one.
          </p>
          <div className="bg-surface2 border border-line rounded-2xl px-4 py-3 text-left space-y-1.5">
            {['Streak freezes cover the odd missed day', 'Vacation mode pauses it while you’re away', 'Longer streaks unlock badges and postcards'].map((t) => (
              <p key={t} className="text-xs text-ink inline-flex items-center gap-2 w-full"><Check size={13} className="shrink-0 text-ink2" /> {t}</p>
            ))}
          </div>
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
      title: 'A quick tour', subtitle: 'Where everything lives',
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
      title: 'Say your first phrase', subtitle: 'Out loud — that\'s the whole method',
      body: (
        <div className="text-center space-y-4 py-2">
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-2">
            <p className="text-lg font-semibold text-ink" lang={d.language}>« {phrase.hi} »</p>
            <p className="text-xs text-ink3 italic">"{phrase.hiEn}"</p>
            <div className="flex justify-center"><SpeakButton text={phrase.hi} label="Listen" /></div>
          </div>
          <p className="text-xs text-ink2">Listen, then say it out loud. Yes, really out loud — speaking from minute
            one is what makes this studio work.</p>
        </div>
      ),
    },
    {
      title: d.name ? `${lang.hello}, ${d.name.trim()} !` : `${lang.hello} !`, subtitle: `Your first ${lang.name}, right now`,
      body: (
        <div className="text-center space-y-5 py-2">
          <div className="text-6xl">🎉</div>
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink2">Hear your first sentence</p>
            <p className="text-lg font-semibold text-ink" lang={d.language}>« {phrase.go} »</p>
            <p className="text-xs text-ink3 italic">"{phrase.goEn}"</p>
            <div className="flex justify-center"><SpeakButton text={phrase.go} label="Listen" /></div>
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
  const next = () => (step < total - 1 ? goTo(step + 1) : onComplete(d));

  return (
    <div className="fixed inset-0 z-[60] bg-bg flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label="Onboarding">
      {/* labelled progress */}
      <div className="px-4 pt-4 shrink-0">
        <div className="flex items-center gap-2">
          {step > 0 ? (
            <button onClick={() => goTo(step - 1)} aria-label="Back" className="w-9 h-9 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line"><ChevronLeft size={16} /></button>
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

      {/* body — re-keyed per step so the content slides in on each change */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto nice-scroll px-4 py-5">
        <div key={step} className={`max-w-md mx-auto ${dir === 'fwd' ? 'step-fwd' : 'step-back'}`}>
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
