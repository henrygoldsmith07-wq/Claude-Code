import { useState } from 'react';
import { LANGUAGE_LIST, getLanguage } from '../lib/languages';
import { syncLanguage } from '../lib/i18n';
import { SpeakButton } from './ui';
import { ArrowRight, Check, ChevronLeft, Sparkles } from './icons';

const GOALS = [
  { id: 'travel', emoji: '🧳', label: 'Travel', topics: ['travel', 'food', 'shopping'] },
  { id: 'work', emoji: '💼', label: 'Work & business', topics: ['work', 'study'] },
  { id: 'study', emoji: '🎓', label: 'School & exams', topics: ['study', 'culture'] },
  { id: 'fluency', emoji: '🗣️', label: 'Fluency & confidence', topics: ['daily', 'culture'] },
  { id: 'culture', emoji: '🎭', label: 'Culture & fun', topics: ['culture', 'food'] },
  { id: 'family', emoji: '👨‍👩‍👧', label: 'Family & friends', topics: ['daily', 'health'] },
];

const FIRST_PHRASE = {
  fr: { text: 'Bonjour ! On y va ?', translation: 'Hello! Shall we get going?' },
  de: { text: 'Hallo! Auf geht’s?', translation: 'Hello! Shall we get going?' },
  es: { text: '¡Hola! ¿Vamos?', translation: 'Hello! Shall we get going?' },
};

const LEVELS = [
  { id: 'A1', label: 'A1 · Beginner', desc: 'Just starting out' },
  { id: 'A2', label: 'A2 · Elementary', desc: 'A few basics' },
  { id: 'B1', label: 'B1 · Intermediate', desc: 'Can hold simple conversations' },
  { id: 'B2', label: 'B2 · Upper-intermediate', desc: 'Comfortable in most situations' },
  { id: 'C1', label: 'C1 · Advanced', desc: 'Fluent, refining nuance' },
  { id: 'C2', label: 'C2 · Mastery', desc: 'Near-native' },
];

const DEFAULTS = {
  name: '', language: 'fr', goal: null, level: 'B1', dailyGoal: 30, weeklyGoal: 150,
  learningStyle: 'balanced', favouriteTopics: ['travel', 'food'], lessonLength: 'medium',
  avatarId: 'sourire', reminders: false, habits: ['Speak French out loud', 'Review my flashcards'],
  apiKey: '', mock: true, rhythm: 'daily',
};

const SECTIONS = ['Language', 'Level', 'Goal', 'Speak'];
const SECTION_OF = [0, 1, 2, 3];

export default function Onboarding({ open, onComplete, onSkip, onStartConversation }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState('fwd');
  const [d, setD] = useState(DEFAULTS);
  const set = (patch) => setD((previous) => ({ ...previous, ...patch }));

  if (!open) return null;

  const goTo = (nextStep) => {
    setDir(nextStep >= step ? 'fwd' : 'back');
    setStep(nextStep);
  };

  const chooseLanguage = (id) => {
    syncLanguage(id);
    set({ language: id, habits: [`Speak ${getLanguage(id).name} out loud`, 'Review my flashcards'] });
  };

  const chooseGoal = (goal) => set({
    goal: goal.id,
    favouriteTopics: [...new Set([...d.favouriteTopics, ...goal.topics])],
  });

  const lang = getLanguage(d.language);
  const phrase = FIRST_PHRASE[d.language] || FIRST_PHRASE.fr;
  const steps = [
    {
      title: 'Which language?',
      subtitle: 'Choose the language you want to speak',
      body: (
        <div className="space-y-3">
          <Cards
            items={LANGUAGE_LIST.map((languageOption) => ({
              id: languageOption.id,
              emoji: languageOption.flag,
              label: languageOption.name,
              desc: `${languageOption.nativeName} · ${languageOption.hello}`,
            }))}
            selected={d.language}
            onPick={(languageOption) => chooseLanguage(languageOption.id)}
          />
          <p className="text-center text-[11px] text-ink3">You can change this any time in Settings.</p>
        </div>
      ),
    },
    {
      title: 'What’s your level?',
      subtitle: 'A rough guess is fine — the studio adapts',
      body: (
        <div className="space-y-3">
          <Cards items={LEVELS} selected={d.level} onPick={(level) => set({ level: level.id })} />
          <p className="text-center text-[11px] text-ink3">You can take a placement test later from Learning path.</p>
        </div>
      ),
    },
    {
      title: 'What do you want to practise?',
      subtitle: 'Optional — skip this if you just want to speak',
      body: (
        <div className="space-y-3">
          <Cards items={GOALS} selected={d.goal} onPick={chooseGoal} />
          <button
            type="button"
            onClick={() => set({ goal: null, favouriteTopics: [] })}
            aria-pressed={d.goal == null}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${d.goal == null ? 'border-ink bg-surface2 font-semibold text-ink' : 'border-line bg-surface text-ink2 hover:border-ink3'}`}
          >
            Skip goal for now
            <span className="mt-0.5 block text-xs font-normal text-ink3">Start with an open conversation instead.</span>
          </button>
        </div>
      ),
    },
    {
      title: `Ready to speak ${lang.name}?`,
      subtitle: 'Everything else can be set up later',
      last: true,
      body: (
        <div className="space-y-4 py-2 text-center">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink2">Your first phrase</p>
            <p className="mt-3 text-xl font-semibold text-ink" lang={d.language}>« {phrase.text} »</p>
            <p className="mt-1 text-xs italic text-ink3">“{phrase.translation}”</p>
            <div className="mt-3 flex justify-center"><SpeakButton text={phrase.text} label="Listen" /></div>
          </div>
          <p className="text-sm leading-relaxed text-ink2">
            Demo mode is ready now. Name, avatar, reminders, habits, topics and lesson length can wait until you need them.
          </p>
          <div className="rounded-2xl border border-line bg-surface2 px-4 py-3 text-left">
            {['No API key required', 'No account or sign-in', 'Your data stays on this device'].map((item) => (
              <p key={item} className="inline-flex w-full items-center gap-2 text-xs text-ink">
                <Check size={13} className="shrink-0 text-ink2" /> {item}
              </p>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const next = () => {
    if (!current.last) {
      goTo(step + 1);
      return;
    }
    onComplete({ ...d, mock: true, apiKey: '' });
    onStartConversation?.();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-bg" role="dialog" aria-modal="true" aria-label="Getting started">
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-2">
          {step > 0
            ? <button type="button" onClick={() => goTo(step - 1)} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line"><ChevronLeft size={16} /></button>
            : <span className="w-9" aria-hidden="true" />}
          <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuenow={step + 1} aria-valuemin="1" aria-valuemax={steps.length} aria-label={`Step ${step + 1} of ${steps.length}`}>
            {SECTIONS.map((section, index) => (
              <div key={section} className="flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${index <= step ? 100 : 0}%` }} />
                </div>
                <p className={`mt-1 text-center text-[9px] ${SECTION_OF[step] === index ? 'font-semibold text-ink' : 'text-ink3'}`}>{section}</p>
              </div>
            ))}
          </div>
          <button type="button" onClick={onSkip} className="shrink-0 px-1 text-[11px] font-semibold text-ink3 hover:text-ink">Skip</button>
        </div>
        <p className="mt-1 text-center text-[10px] tabular-nums text-ink3">Step {step + 1} of {steps.length}</p>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto nice-scroll px-4 py-5">
        <div key={step} className={`mx-auto max-w-md ${dir === 'fwd' ? 'step-fwd' : 'step-back'}`}>
          <h2 className="text-center text-xl font-bold text-ink">{current.title}</h2>
          <p className="mb-5 mt-1 text-center text-xs text-ink2">{current.subtitle}</p>
          {current.body}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-4 py-3">
        <button type="button" onClick={next} className="btn btn-primary mx-auto flex min-h-12 w-full max-w-md items-center justify-center gap-2 rounded-xl text-sm">
          {current.last ? <><Sparkles size={15} /> Start a 5-minute conversation</> : <>Continue <ArrowRight size={15} /></>}
        </button>
      </div>
    </div>
  );
}

function Cards({ items, selected, onPick }) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const selectedItem = selected === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item)}
            aria-pressed={selectedItem}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${selectedItem ? 'border-ink bg-surface2' : 'border-line bg-surface hover:border-ink3'}`}
          >
            {item.emoji && <span className="shrink-0 text-xl" aria-hidden="true">{item.emoji}</span>}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{item.label}</span>
              {item.desc && <span className="block text-xs text-ink3">{item.desc}</span>}
            </span>
            {selectedItem && <Check size={16} className="shrink-0 text-ink" />}
          </button>
        );
      })}
    </div>
  );
}
