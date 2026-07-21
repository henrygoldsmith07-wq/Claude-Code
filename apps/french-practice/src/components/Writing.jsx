import { useState } from 'react';
import { langName } from '../lib/i18n';
import { randomPoolSentence, toWords, diffWords, displayHits } from '../lib/sentences';
import { COMPLETION_STARTERS, randomFrom } from '../lib/writing';
import { judgeCompletion, friendlyError } from '../lib/groq';
import WritingStudio from './WritingStudio';
import AccentDrill from './AccentDrill';
import TranslateDrill from './TranslateDrill';
import { SpeakButton, Spinner } from './ui';
import { Pencil, Check, X, RefreshCw, ChevronLeft, ChevronRight, MessageCircle, BookOpen, Clock } from './icons';

// Writing hub: typing drill (accent-exact), sentence completion, free
// writing with AI correction, and the essay studio.

const MODES = [
  { id: 'accents', icon: Pencil, title: 'Accent trainer', subtitle: 'Retype words with every accent in place' },
  { id: 'translate', icon: RefreshCw, title: 'Translation drill', subtitle: 'EN→FR and FR→EN, alternating' },
  { id: 'typing', icon: Clock, title: 'Typing drill', subtitle: 'Copy a sentence exactly — accents count' },
  { id: 'completion', icon: MessageCircle, title: 'Sentence completion', subtitle: 'Finish a starter naturally, get judged' },
  { id: 'free', icon: Pencil, title: 'Free writing', subtitle: 'A short text from a prompt, AI-corrected' },
  { id: 'essay', icon: BookOpen, title: 'Essay studio', subtitle: 'Longer form, structured feedback and scores' },
];

export default function Writing({ apiKey, mockMode, level, onXp }) {
  const [mode, setMode] = useState(null);
  const active = MODES.find((m) => m.id === mode);

  if (!active) {
    return (
      <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-ink">Writing</h2>
            <p className="text-xs text-ink2 mt-1">From accurate typing to argued essays — always with feedback.</p>
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
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setMode(null)} aria-label="Back to writing" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <h2 className="flex-1 text-center text-sm font-semibold text-ink">{active.title}</h2>
          <span className="w-10" aria-hidden="true" />
        </div>
        {mode === 'accents' && <AccentDrill onXp={onXp} />}
        {mode === 'translate' && <TranslateDrill onXp={onXp} />}
        {mode === 'typing' && <TypingDrill onXp={onXp} />}
        {mode === 'completion' && <Completion apiKey={apiKey} mockMode={mockMode} level={level} onXp={onXp} />}
        {mode === 'free' && <WritingStudio depth="quick" apiKey={apiKey} mockMode={mockMode} level={level} onXp={onXp} />}
        {mode === 'essay' && <WritingStudio depth="essay" apiKey={apiKey} mockMode={mockMode} level={level} onXp={onXp} />}
      </div>
    </div>
  );
}

// Copy the sentence exactly. Case-insensitive, but accents and every word
// must match — the drill that finally teaches é vs è vs ê.
function TypingDrill({ onXp }) {
  const [sentence, setSentence] = useState(() => randomPoolSentence());
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);

  const words = sentence.text.split(/\s+/);

  const check = () => {
    const target = toWords(sentence.text);
    const hits = diffWords(target, toWords(input));
    const matched = hits.filter(Boolean).length;
    const accuracy = Math.round((matched / Math.max(1, target.length)) * 100);
    const gained = Math.max(1, Math.round(accuracy / 20));
    onXp(gained);
    setResult({ hits: displayHits(sentence.text, hits), accuracy, gained });
  };

  const next = () => {
    setSentence(randomPoolSentence(sentence.text));
    setInput('');
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-line rounded-2xl p-5 text-center space-y-2">
        <p className="text-[15px] text-ink leading-relaxed" lang="fr">
          {result
            ? words.map((w, i) => (
                <span key={i} className={result.hits[i] ? 'text-ink' : 'text-ink3 underline decoration-2 underline-offset-2'}>{w}{' '}</span>
              ))
            : sentence.text}
        </p>
        <p className="text-xs text-ink3 italic">{sentence.translation}</p>
        <SpeakButton text={sentence.text} label="Listen" />
      </div>

      {!result ? (
        <div className="space-y-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            lang="fr"
            placeholder="Type the sentence exactly, accents included…"
            aria-label="Type the sentence"
            className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink resize-none"
          />
          <button onClick={check} disabled={!input.trim()} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
            <Check size={14} /> Check
          </button>
        </div>
      ) : (
        <div className="fade-in bg-surface border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-ink tabular-nums">{result.accuracy}%</span>
            <span className="text-xs text-ink2">
              {result.accuracy === 100 ? 'Flawless, accents and all.' : 'Underlined words differ — check the accents.'} +{result.gained} XP
            </span>
          </div>
          <p className="text-xs text-ink3">You typed: <span className="text-ink2" lang="fr">{input}</span></p>
          <div className="flex gap-2">
            <button onClick={() => setResult(null)} className="btn btn-secondary flex-1 min-h-11 rounded-xl text-sm">Try again</button>
            <button onClick={next} className="btn btn-primary flex-1 min-h-11 rounded-xl text-sm"><RefreshCw size={13} /> Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Completion({ apiKey, mockMode, level, onXp }) {
  const [starter, setStarter] = useState(() => randomFrom(COMPLETION_STARTERS));
  const [completion, setCompletion] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const submit = async () => {
    setChecking(true);
    setError(null);
    try {
      const r = await judgeCompletion(apiKey, { starter: starter.fr, completion: completion.trim(), level, mock: mockMode });
      onXp(r.natural ? 5 : 2);
      setResult(r);
    } catch (e) {
      setError(friendlyError(e));
    }
    setChecking(false);
  };

  const next = () => {
    setStarter(randomFrom(COMPLETION_STARTERS, starter));
    setCompletion('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-line rounded-2xl p-5 space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink3">Finish this sentence · {starter.hint}</p>
        <p className="text-[17px] text-ink font-medium" lang="fr">{starter.fr} …</p>
        <p className="text-xs text-ink3 italic">{starter.en} …</p>
      </div>

      {!result ? (
        <div className="space-y-2">
          <textarea
            value={completion}
            onChange={(e) => setCompletion(e.target.value)}
            rows={2}
            lang="fr"
            placeholder={`…your ending, in ${langName()}`}
            aria-label="Your completion"
            className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink resize-none"
          />
          {checking ? (
            <Spinner label="Judging your sentence…" />
          ) : (
            <button onClick={submit} disabled={!completion.trim()} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
              <Check size={14} /> Judge it
            </button>
          )}
        </div>
      ) : (
        <div className="fade-in bg-surface border border-line rounded-2xl p-5 space-y-3">
          <p className="text-sm text-ink flex items-start gap-2">
            {result.natural ? <Check size={15} className="shrink-0 mt-0.5" /> : <X size={15} className="shrink-0 mt-0.5" />}
            <span>{result.feedback}</span>
          </p>
          <button onClick={next} className="btn btn-secondary w-full min-h-11 rounded-xl text-sm">
            <RefreshCw size={13} /> Another starter
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-ink text-center">{error}</p>}
    </div>
  );
}
