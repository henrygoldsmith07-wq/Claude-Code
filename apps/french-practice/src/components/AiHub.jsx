import { useEffect, useRef, useState } from 'react';
import { langName } from '../lib/i18n';
import { tutorChat, characterChat, translateText, generateExercises, generateLesson, generateStory, generateVocabFromImage, friendlyError } from '../lib/groq';
import { getHabits, getLearnerBrief, getSrs, getNotebook, saveToNotebook, isInNotebook } from '../lib/storage';
import { findEntry, allEntries } from '../lib/vocab';
import { speak, stopSpeaking } from '../lib/tts';
import { Markdown, Spinner, SpeakButton } from './ui';
import Quiz from './Quiz';
import {
  GraduationCap, MessageCircle, Globe, Target, Map, RefreshCw, BookOpen, Play, Square,
  ChevronLeft, ChevronRight, ArrowRight, Sparkles, Camera, Check, Plus,
} from './icons';

// AI hub: five tools built directly on the LLM — a tutor you can ask
// anything, in-character chat partners, an instant translator, an exercise
// generator for any topic, and a lesson built from your own mistake bank.

const MODES = [
  { id: 'tutor', icon: GraduationCap, title: 'AI tutor', subtitle: 'Ask anything — grammar, usage, culture' },
  { id: 'characters', icon: MessageCircle, title: 'Characters', subtitle: 'Chat with distinct personalities' },
  { id: 'translate', icon: Globe, title: 'Translator', subtitle: 'Instant translation, both directions' },
  { id: 'exercises', icon: Target, title: 'Exercise maker', subtitle: 'Generate practice drills on any topic' },
  { id: 'lesson', icon: Map, title: 'My lesson', subtitle: 'A lesson built from your recurring mistakes' },
  { id: 'story', icon: BookOpen, title: 'Story studio', subtitle: 'A story woven from words you’ve learned' },
  { id: 'snap', icon: Camera, title: 'Snap & learn', subtitle: 'Photograph anything — get words to learn' },
];

const CHARACTERS = [
  {
    id: 'odette',
    name: 'Grand-mère Odette',
    desc: 'A warm Lyon grandmother — recipes, gardens, the old days',
    persona: 'You are Odette, a warm 78-year-old grandmother from Lyon. You love cooking, your vegetable garden, and telling affectionate stories about the old days. You call the learner «mon petit» and always worry whether they have eaten.',
    opener: "Bonjour mon petit ! Viens t'asseoir, je viens de faire une soupe. Tu as mangé quelque chose aujourd'hui ?",
  },
  {
    id: 'marcel',
    name: 'Marcel',
    desc: 'A gruff Marseille fisherman with a heart of gold',
    persona: 'You are Marcel, a gruff but kind 55-year-old fisherman from Marseille. You speak plainly, complain about the weather and tourists, and soften quickly when someone shows real interest in the sea.',
    opener: 'Oh, salut ! Tu tombes bien, je rentre du port. Alors, tu aimes le poisson ou pas ?',
  },
  {
    id: 'celeste',
    name: 'Céleste',
    desc: 'A dramatic Parisian stage actress',
    persona: 'You are Céleste, a dramatic 40-year-old Parisian stage actress. Everything is either magnifique or a catastrophe. You adore theatre, gossip, and grand pronouncements, and you find the learner utterly fascinating.',
    opener: "Ah, enfin quelqu'un d'intéressant ! Dis-moi tout : tu es déjà allé au théâtre à Paris ?",
  },
  {
    id: 'hugo',
    name: 'Hugo',
    desc: 'A ten-year-old obsessed with space',
    persona: 'You are Hugo, an enthusiastic 10-year-old French boy obsessed with space and rockets. You use simple, short sentences, get excited easily, and pepper the learner with fun facts and questions.',
    opener: "Salut ! Tu savais que Jupiter a plein de lunes ? C'est trop cool, non ?",
  },
];

const TUTOR_STARTERS = [
  'When do I use «tu» vs «vous»?',
  'Explain the subjonctif simply',
  '«Savoir» vs «connaître» — what’s the difference?',
];

export default function AiHub({ apiKey, mockMode, level, onXp }) {
  const [mode, setMode] = useState(null);
  const active = MODES.find((m) => m.id === mode);

  if (!active) {
    return (
      <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-ink">AI studio</h2>
            <p className="text-xs text-ink2 mt-1">A tutor, characters, a translator and generators — all yours to ask.</p>
          </div>
          <div className="space-y-2.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
              >
                <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink"><m.icon size={18} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink">{m.title}</span>
                  <span className="block text-xs text-ink3">{m.subtitle}</span>
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
      <div className="flex items-center gap-2 px-4 pt-3 pb-1 shrink-0">
        <button onClick={() => setMode(null)} aria-label="Back to AI studio" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
          <ChevronLeft size={18} />
        </button>
        <h2 className="flex-1 text-center text-sm font-semibold text-ink">{active.title}</h2>
        <span className="w-10" aria-hidden="true" />
      </div>
      <div className="flex-1 min-h-0">
        {mode === 'tutor' && <Tutor apiKey={apiKey} mockMode={mockMode} level={level} onXp={onXp} />}
        {mode === 'characters' && <Characters apiKey={apiKey} mockMode={mockMode} level={level} onXp={onXp} />}
        {mode === 'translate' && <Translator apiKey={apiKey} mockMode={mockMode} onXp={onXp} />}
        {mode === 'exercises' && <ExerciseMaker apiKey={apiKey} mockMode={mockMode} level={level} onXp={onXp} />}
        {mode === 'lesson' && <PersonalLesson apiKey={apiKey} mockMode={mockMode} level={level} onXp={onXp} />}
        {mode === 'story' && <StoryStudio apiKey={apiKey} mockMode={mockMode} level={level} onXp={onXp} />}
        {mode === 'snap' && <SnapLearn apiKey={apiKey} mockMode={mockMode} level={level} onXp={onXp} />}
      </div>
    </div>
  );
}

// Shared chat scaffold for the tutor and the characters: scrolling
// transcript, composer, busy state. `send` maps the transcript to a reply.
function MiniChat({ send, placeholder, empty, starters = [], opener, speakFirstLine, onExchange }) {
  const [messages, setMessages] = useState(() => (opener ? [{ role: 'assistant', content: opener }] : []));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const submit = async (text) => {
    const content = (text || input).trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const reply = await send(next);
      setMessages([...next, { role: 'assistant', content: reply }]);
      onExchange?.();
    } catch (e) {
      setError(friendlyError(e));
      setMessages(messages); // roll back the unanswered turn
      setInput(content);
    }
    setBusy(false);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto nice-scroll px-4 py-3">
        <div className="max-w-md mx-auto space-y-3">
          {messages.length === 0 && (
            <div className="text-center space-y-3 py-8">
              {empty}
              {starters.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="text-xs bg-surface border border-line rounded-full px-3 py-1.5 text-ink2 hover:border-ink3 hover:text-ink transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble-in flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'user' ? (
                <div className="max-w-[85%] bg-accent rounded-2xl rounded-br-md px-4 py-2.5">
                  <p className="text-[14px] text-onaccent leading-relaxed">{m.content}</p>
                </div>
              ) : (
                <div className="max-w-[92%] bg-surface border border-line rounded-2xl rounded-bl-md px-4 py-3">
                  <Markdown className="text-[13.5px] text-ink leading-relaxed">{m.content}</Markdown>
                  {speakFirstLine && (
                    <SpeakButton text={m.content.split('\n')[0]} label="Listen" />
                  )}
                </div>
              )}
            </div>
          ))}
          {busy && <Spinner label="Thinking…" />}
          {error && <p role="alert" className="text-xs text-ink text-center">{error}</p>}
        </div>
      </div>
      <div className="shrink-0 border-t border-line bg-surface px-4 py-3">
        <form
          className="max-w-md mx-auto flex gap-2"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="flex-1 min-w-0 bg-surface2 border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink"
          />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="btn btn-primary min-h-11 px-4 rounded-xl">
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

function Tutor({ apiKey, mockMode, level, onXp }) {
  const learner = useRef(getLearnerBrief()).current;
  // Lead the suggestions with the learner's own weak grammar, so the tutor's
  // first prompt targets exactly what they keep getting wrong.
  const starters = learner.weakGrammar?.length
    ? [`Help me with ${learner.weakGrammar[0]}`, ...TUTOR_STARTERS].slice(0, 3)
    : TUTOR_STARTERS;
  return (
    <MiniChat
      send={(messages) => tutorChat(apiKey, { messages, level, learner, mock: mockMode })}
      placeholder="Ask your tutor anything…"
      onExchange={() => onXp(2)}
      starters={starters}
      empty={<p className="text-sm text-ink2">Grammar rules, word nuances, culture, study advice — ask away.</p>}
    />
  );
}

function Characters({ apiKey, mockMode, level, onXp }) {
  const [character, setCharacter] = useState(null);

  if (!character) {
    return (
      <div className="h-full overflow-y-auto nice-scroll px-4 py-4">
        <div className="max-w-md mx-auto space-y-3">
          <p className="text-xs text-ink2 text-center">Pick a partner — each has their own personality. They reply in ${langName()} with a translation.</p>
          <div className="space-y-2.5">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCharacter(c)}
                className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
              >
                <span className="w-10 h-10 shrink-0 grid place-items-center rounded-full bg-surface2 text-ink text-sm font-bold">
                  {c.name.replace('Grand-mère ', '')[0]}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink" lang="fr">{c.name}</span>
                  <span className="block text-xs text-ink3">{c.desc}</span>
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
      <div className="shrink-0 px-4 pb-2 flex items-center justify-center gap-2">
        <span className="text-xs text-ink2">
          Talking to <span className="font-semibold text-ink" lang="fr">{character.name}</span>
        </span>
        <button onClick={() => setCharacter(null)} className="text-[11px] text-ink3 hover:text-ink underline underline-offset-2">
          switch
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <MiniChat
          key={character.id}
          send={(messages) => characterChat(apiKey, { messages, persona: character.persona, level, learner: getLearnerBrief(), mock: mockMode })}
          placeholder="Répondez en français…"
          opener={character.opener}
          speakFirstLine
          onExchange={() => onXp(2)}
        />
      </div>
    </div>
  );
}

function Translator({ apiKey, mockMode, onXp }) {
  const [direction, setDirection] = useState('en-fr');
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const translation = await translateText(apiKey, { text: text.trim(), direction, mock: mockMode });
      setResult(translation);
      onXp(1);
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(false);
  };

  const swap = () => {
    setDirection((d) => (d === 'en-fr' ? 'fr-en' : 'en-fr'));
    setResult(null);
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-center gap-3">
          <span className={`text-sm font-semibold ${direction === 'en-fr' ? 'text-ink' : 'text-ink3'}`}>English</span>
          <button onClick={swap} aria-label="Swap direction" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <RefreshCw size={15} />
          </button>
          <span className={`text-sm font-semibold ${direction === 'fr-en' ? 'text-ink' : 'text-ink3'}`}>Français</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setResult(null); }}
          rows={4}
          lang={direction === 'fr-en' ? 'fr' : 'en'}
          placeholder={direction === 'fr-en' ? 'Collez ou tapez du français…' : 'Paste or type English…'}
          aria-label="Text to translate"
          className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm text-ink leading-relaxed placeholder:text-ink3 focus:outline-none focus:border-ink resize-y"
        />
        {busy ? (
          <Spinner label="Translating…" />
        ) : (
          <button onClick={run} disabled={!text.trim()} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
            <Globe size={14} /> Translate
          </button>
        )}
        {error && <p role="alert" className="text-xs text-ink text-center">{error}</p>}
        {result && (
          <div className="fade-in bg-surface border border-line rounded-2xl p-5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink3">
              {direction === 'en-fr' ? langName() : 'English'}
            </p>
            <p className="text-[15px] text-ink leading-relaxed" lang={direction === 'en-fr' ? 'fr' : 'en'}>{result}</p>
            {direction === 'en-fr' && <SpeakButton text={result} label="Listen" />}
          </div>
        )}
      </div>
    </div>
  );
}

// Sequential multiple-choice runner shared by the generator and the lesson.
function ExerciseMaker({ apiKey, mockMode, level, onXp }) {
  const [topic, setTopic] = useState('');
  const [exercises, setExercises] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const generate = async (t) => {
    const chosen = (t || topic).trim();
    if (!chosen) return;
    setBusy(true);
    setError(null);
    setExercises(null);
    try {
      setExercises(await generateExercises(apiKey, { topic: chosen, level, mock: mockMode }));
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(false);
  };

  const SUGGESTIONS = ['passé composé vs imparfait', 'ordering in a restaurant', 'object pronouns', 'the subjonctif'];

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-4">
      <div className="max-w-md mx-auto space-y-4">
        {!exercises && (
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); generate(); }}
            >
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Any topic — a tense, a situation, a word…"
                aria-label="Exercise topic"
                className="flex-1 min-w-0 bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink"
              />
              <button type="submit" disabled={!topic.trim() || busy} className="btn btn-primary min-h-11 px-4 rounded-xl text-sm">
                <Sparkles size={14} /> Go
              </button>
            </form>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setTopic(s); generate(s); }}
                  disabled={busy}
                  className="text-xs bg-surface border border-line rounded-full px-3 py-1.5 text-ink2 hover:border-ink3 hover:text-ink transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            {busy && <Spinner label="Writing your exercises…" />}
            {error && <p role="alert" className="text-xs text-ink text-center">{error}</p>}
          </>
        )}
        {exercises && (
          <Quiz
            exercises={exercises}
            onXp={onXp}
            footer={
              <button onClick={() => { setExercises(null); setTopic(''); }} className="btn btn-secondary w-full min-h-11 rounded-xl text-sm">
                <RefreshCw size={13} /> New topic
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}

function PersonalLesson({ apiKey, mockMode, level, onXp }) {
  const [lesson, setLesson] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const habits = getHabits().slice().sort((a, b) => b.count - a.count).slice(0, 5);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      setLesson(await generateLesson(apiKey, { habits, level, mock: mockMode }));
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(false);
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-4">
      <div className="max-w-md mx-auto space-y-4">
        {!lesson && (
          <>
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-2">
              <p className="text-sm font-semibold text-ink">A lesson written just for you</p>
              <p className="text-xs text-ink2 leading-relaxed">
                {habits.length > 0
                  ? 'Built from the mistakes that keep coming back in your sessions:'
                  : 'No recurring mistakes recorded yet — finish an Arena session first, or generate a general lesson for your level.'}
              </p>
              {habits.length > 0 && (
                <ul className="space-y-1">
                  {habits.map((h) => (
                    <li key={h.key} className="flex items-baseline gap-2 text-xs text-ink2">
                      <span className="text-ink3 tabular-nums shrink-0">{h.count}×</span>
                      <span>{h.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {busy ? (
              <Spinner label="Writing your lesson…" />
            ) : (
              <button onClick={generate} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
                <Sparkles size={14} /> Generate my lesson
              </button>
            )}
            {error && <p role="alert" className="text-xs text-ink text-center">{error}</p>}
          </>
        )}
        {lesson && (
          <div className="fade-in space-y-4">
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-2">
              <h3 className="text-sm font-semibold text-ink">{lesson.title}</h3>
              <Markdown className="text-[13px] text-ink2 leading-relaxed">{lesson.explanation}</Markdown>
            </div>
            <Quiz
              exercises={lesson.exercises}
              onXp={onXp}
              footer={
                <button onClick={() => setLesson(null)} className="btn btn-secondary w-full min-h-11 rounded-xl text-sm">
                  <RefreshCw size={13} /> Another lesson
                </button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

// The learner's known words (reviewed ≥ twice) plus their notebook, falling
// back to common words so a first-time user still gets a story.
function learnedWords() {
  const srs = getSrs();
  const known = Object.entries(srs)
    .filter(([, s]) => (s?.reps || 0) >= 2)
    .map(([id]) => findEntry(id))
    .filter(Boolean)
    .map((e) => e.fr);
  const nb = getNotebook().map((n) => n.fr).filter(Boolean);
  const words = [...new Set([...known, ...nb])];
  if (words.length >= 8) return words;
  const common = allEntries().filter((e) => (e.freq || 5) <= 2).map((e) => e.fr);
  return [...new Set([...words, ...common])].slice(0, 24);
}

// Story studio: weaves the learner's own vocabulary into a short story they
// can read and — the podcast angle — have narrated aloud, with tap-to-reveal
// translations per paragraph.
function StoryStudio({ apiKey, mockMode, level, onXp }) {
  const [story, setStory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [shown, setShown] = useState({}); // paragraph index → translation revealed
  const [playing, setPlaying] = useState(false);
  const words = learnedWords();

  useEffect(() => () => stopSpeaking(), []);

  const generate = async () => {
    setBusy(true); setError(null); setShown({}); stopSpeaking(); setPlaying(false);
    try {
      const s = await generateStory(apiKey, { words, level, mock: mockMode });
      setStory(s);
      onXp?.(5); // reading reward
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(false);
  };

  const narrate = () => {
    if (!story) return;
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    setPlaying(true);
    speak(story.paragraphs.map((p) => p.fr).join(' '), { onEnd: () => setPlaying(false) });
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-4">
      <div className="max-w-md mx-auto space-y-4">
        {!story && (
          <>
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-2.5">
              <p className="text-sm font-semibold text-ink">A story from your own words</p>
              <p className="text-xs text-ink2 leading-relaxed">
                We’ll weave a short {langName()} story around the {words.length >= 8 ? `${Math.min(words.length, 24)} words you’ve learned` : 'most useful words for your level'}, pitched at {level}. Read it, then have it read aloud.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {words.slice(0, 10).map((w) => (
                  <span key={w} className="px-2 py-0.5 rounded-full bg-surface2 text-ink2 text-[11px]" lang="fr">{w}</span>
                ))}
              </div>
            </div>
            {busy ? (
              <Spinner label="Writing your story…" />
            ) : (
              <button onClick={generate} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
                <Sparkles size={14} /> Write my story
              </button>
            )}
            {error && <p role="alert" className="text-xs text-ink text-center">{error}</p>}
          </>
        )}
        {story && (
          <div className="fade-in space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="flex-1 text-base font-bold text-ink" lang="fr">{story.title}</h3>
              <button onClick={narrate} aria-label={playing ? 'Stop narration' : 'Listen to the story'} className="btn btn-secondary min-h-10 px-3 rounded-xl text-xs shrink-0">
                {playing ? <><Square size={13} /> Stop</> : <><Play size={13} /> Listen</>}
              </button>
            </div>
            {story.paragraphs.map((p, i) => (
              <div key={i} className="bg-surface border border-line rounded-2xl p-4 space-y-1.5">
                <p className="text-[15px] text-ink leading-relaxed" lang="fr">{p.fr}</p>
                {shown[i] ? (
                  <p className="text-[13px] text-ink3 italic">{p.en}</p>
                ) : (
                  <button onClick={() => setShown((s) => ({ ...s, [i]: true }))} className="text-[11px] font-semibold text-ink3 hover:text-ink">
                    Show translation
                  </button>
                )}
              </div>
            ))}
            <button onClick={generate} className="btn btn-secondary w-full min-h-11 rounded-xl text-sm">
              <RefreshCw size={13} /> Another story
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Downscale a picked image to a compact JPEG data URL, so the vision request
// stays small and fast regardless of the phone camera's resolution.
function fileToDataUrl(file, maxDim = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not open that image.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Snap & learn: photograph a scene, sign or object; a vision model names the
// useful things in the target language and reads any printed text, and the
// learner saves the words they want straight into their notebook.
function SnapLearn({ apiKey, mockMode, level, onXp }) {
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState({}); // fr → true once added to notebook
  const inputRef = useRef(null);

  const reset = () => {
    setPreview(null); setResult(null); setError(null); setSaved({});
    if (inputRef.current) inputRef.current.value = '';
  };

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null); setResult(null); setSaved({});
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      const res = await generateVocabFromImage(apiKey, { imageDataUrl: dataUrl, level, mock: mockMode });
      setResult(res);
      onXp?.(5); // learning-from-the-world reward
    } catch (err) {
      setError(friendlyError(err));
    }
    setBusy(false);
  };

  const save = (item) => {
    const id = `snap-${item.fr.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    saveToNotebook({ id, fr: item.fr, en: item.en, note: 'Snapped from a photo' });
    setSaved((s) => ({ ...s, [item.fr]: true }));
  };

  const saveAll = () => {
    result?.items.forEach((it) => { if (!saved[it.fr] && !isInNotebook(`snap-${it.fr.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`)) save(it); });
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-4">
      <div className="max-w-md mx-auto space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Photograph or upload an image to learn vocabulary"
          onChange={onPick}
          className="sr-only"
        />

        {!result && !busy && (
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
            <p className="text-sm font-semibold text-ink">Learn from the world around you</p>
            <p className="text-xs text-ink2 leading-relaxed">
              Point your camera at objects, a menu or a street sign. We’ll name the useful things in {langName()} — with translations — and read any printed text, so you can save exactly the words you want.
            </p>
            <button onClick={() => inputRef.current?.click()} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
              <Camera size={15} /> Take or upload a photo
            </button>
            {error && <p role="alert" className="text-xs text-ink text-center">{error}</p>}
          </div>
        )}

        {preview && (
          <div className="rounded-2xl overflow-hidden border border-line">
            <img src={preview} alt="Your photo" className="w-full max-h-52 object-cover" />
          </div>
        )}

        {busy && <Spinner label="Reading your photo…" />}

        {error && result === null && preview && !busy && (
          <button onClick={reset} className="btn btn-secondary w-full min-h-11 rounded-xl text-sm">
            <Camera size={14} /> Try another photo
          </button>
        )}

        {result && !busy && (
          <div className="fade-in space-y-3">
            {result.caption && (
              <div className="bg-surface2 rounded-2xl p-3.5 space-y-1">
                <p className="text-sm text-ink" lang="fr">{result.caption}</p>
                {result.captionEn && <p className="text-xs text-ink3 italic">{result.captionEn}</p>}
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink2">{result.items.length} words spotted</p>
              <button onClick={saveAll} className="text-xs font-semibold text-ink3 hover:text-ink">Save all</button>
            </div>
            <div className="space-y-2">
              {result.items.map((it) => {
                const done = saved[it.fr];
                return (
                  <div key={it.fr} className="flex items-center gap-3 bg-surface border border-line rounded-2xl px-3.5 py-2.5">
                    <span className="text-xl shrink-0" aria-hidden="true">{it.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink truncate" lang="fr">{it.fr}</span>
                      <span className="block text-xs text-ink3 truncate">{it.en}</span>
                    </span>
                    <SpeakButton text={it.fr} label="" />
                    <button
                      onClick={() => save(it)}
                      disabled={done}
                      aria-label={done ? `${it.fr} saved to notebook` : `Save ${it.fr} to notebook`}
                      className={`w-9 h-9 grid place-items-center rounded-full shrink-0 ${done ? 'bg-successsoft text-success' : 'bg-surface2 text-ink2 hover:bg-line'}`}
                    >
                      {done ? <Check size={16} /> : <Plus size={16} />}
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={reset} className="btn btn-secondary w-full min-h-11 rounded-xl text-sm">
              <Camera size={14} /> Snap another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
