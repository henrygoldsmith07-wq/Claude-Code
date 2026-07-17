import { useMemo, useState } from 'react';
import { FLASHCARDS } from '../lib/data';
import { checkSentence } from '../lib/groq';
import { getSrs, rateCard } from '../lib/storage';
import { SpeakButton, Spinner } from './ui';
import { ChevronLeft, ChevronRight, Check, X } from './icons';

// "Du coup" filler-word deck: 3D flip cards, SRS ratings, TTS (normal + 0.75×
// slow-mo) and an LLM-verified "use it in a sentence" challenge.

// Monochrome SRS scale: difficulty reads through contrast, not hue —
// "Encore" is a faint outline, "Facile" is the full-ink solid button.
const RATINGS = [
  ['again', 'Again', 'bg-transparent text-ink3 border-line'],
  ['hard', 'Hard', 'bg-surface2 text-ink2 border-line'],
  ['good', 'Good', 'bg-surface2 text-ink border-ink3'],
  ['easy', 'Easy', 'bg-accent text-onaccent border-accent'],
];

export default function Flashcards({ apiKey, mockMode }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [srsTick, setSrsTick] = useState(0); // re-render after a rating
  const [challenge, setChallenge] = useState(null); // { sentence, checking, result }
  const srs = useMemo(() => getSrs(), [srsTick]);

  const card = FLASHCARDS[index];
  const cardSrs = srs[card.id];

  const go = (dir) => {
    setFlipped(false);
    setChallenge(null);
    setIndex((i) => (i + dir + FLASHCARDS.length) % FLASHCARDS.length);
  };

  const rate = (rating) => {
    rateCard(card.id, rating);
    setSrsTick((t) => t + 1);
    setTimeout(() => go(1), 250);
  };

  const submitSentence = async () => {
    const sentence = challenge.sentence.trim();
    if (!sentence) return;
    setChallenge((c) => ({ ...c, checking: true }));
    try {
      const result = await checkSentence(apiKey, { card, sentence, mock: mockMode });
      setChallenge((c) => ({ ...c, checking: false, result }));
    } catch (e) {
      setChallenge((c) => ({ ...c, checking: false, result: { correct: false, feedback: e.message } }));
    }
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-md mx-auto space-y-5">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-ink">“Du coup” — Filler Words</h2>
          <p className="text-xs text-ink2 mt-1">
            {cardSrs && <span className="text-ink2">reviewed ×{cardSrs.reps} · interval {cardSrs.interval}d</span>}
          </p>
          <div className="flex justify-center gap-1.5 mt-2" aria-label={`Card ${index + 1} of ${FLASHCARDS.length}`}>
            {FLASHCARDS.map((c, i) => (
              <span
                key={c.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-5 bg-ink' : srs[c.id] ? 'w-1.5 bg-ink2' : 'w-1.5 bg-line'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 3D flip card */}
        <div className="flip-scene">
          <button
            className={`flip-card w-full h-64 text-left ${flipped ? 'flipped' : ''}`}
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? 'Flip the card (front)' : 'Flip the card (back)'}
          >
            <div className="flip-face bg-gradient-to-br from-surface2 to-surface border border-line rounded-3xl grid place-items-center p-6 shadow-xl">
              <div className="text-center">
                <p className="text-4xl font-bold text-ink" lang="fr">{card.front}</p>
                <p className="text-xs text-ink3 mt-4">Tap to reveal</p>
              </div>
            </div>
            <div className="flip-face flip-face-back bg-gradient-to-br from-surface2 to-surface border border-line rounded-3xl p-6 flex flex-col justify-center gap-3 shadow-xl">
              <p className="text-xl font-bold text-ink">{card.meaning}</p>
              <p className="text-sm text-ink italic" lang="fr">« {card.example} »</p>
              <p className="text-xs text-ink2">{card.exampleTranslation}</p>
              <p className="text-[10px] uppercase tracking-wider text-ink2">{card.register}</p>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button onClick={() => go(-1)} aria-label="Previous card" className="w-11 h-11 rounded-full bg-surface2 text-ink2 hover:bg-line grid place-items-center"><ChevronLeft size={18} /></button>
          <SpeakButton text={card.example} label="Example" />
          <SpeakButton text={card.example} slow />
          <button onClick={() => go(1)} aria-label="Next card" className="w-11 h-11 rounded-full bg-surface2 text-ink2 hover:bg-line grid place-items-center"><ChevronRight size={18} /></button>
        </div>

        {/* SRS ratings (revealed side only) */}
        {flipped && (
          <div className="grid grid-cols-4 gap-2 fade-in">
            {RATINGS.map(([key, label, cls]) => (
              <button key={key} onClick={() => rate(key)} className={`min-h-11 rounded-xl border text-xs font-bold ${cls} active:scale-95 transition`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* use-it-in-a-sentence challenge */}
        <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink2">Challenge: use it in a sentence</h3>
          {!challenge ? (
            <button
              onClick={() => setChallenge({ sentence: '', checking: false, result: null })}
              className="w-full min-h-11 rounded-xl bg-surface2 text-ink text-sm font-semibold hover:bg-line"
            >
              Take the challenge
            </button>
          ) : (
            <div className="space-y-2 fade-in">
              <textarea
                value={challenge.sentence}
                onChange={(e) => setChallenge((c) => ({ ...c, sentence: e.target.value, result: null }))}
                rows={2}
                placeholder={`Write a sentence using “${card.front}”…`}
                className="w-full bg-surface2 border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink resize-none"
                aria-label="Your sentence"
              />
              {challenge.checking ? (
                <Spinner label="Checking…" />
              ) : challenge.result ? (
                <div className={`fade-in rounded-xl px-3 py-2.5 text-sm border ${
                  challenge.result.correct
                    ? 'bg-surface2 border-line text-ink'
                    : 'bg-surface2 border-line text-ink'
                }`}>
                  <span className="inline-flex items-baseline gap-1.5">{challenge.result.correct ? <Check size={13} className="self-center" /> : <X size={13} className="self-center" />}<span>{challenge.result.feedback}</span></span>
                </div>
              ) : (
                <button
                  onClick={submitSentence}
                  disabled={!challenge.sentence.trim()}
                  className="btn btn-primary w-full min-h-11 rounded-xl text-sm"
                >
                  Check my sentence
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
