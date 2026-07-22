import { useState, useEffect } from 'react';
import { checkSentence, friendlyError } from '../lib/groq';
import { FREQ_LABELS } from '../lib/vocab';
import { SpeakButton, Spinner } from './ui';
import { Check, X, Bookmark, BookmarkFilled } from './icons';

// One rich vocabulary card: picture front (emoji-as-image content), full
// back (meaning, example, frequency rank, synonyms/antonyms, collocations,
// register note), TTS, one-click save, SRS ratings and the LLM sentence
// challenge.

const RATINGS = [
  ['again', 'Again', 'bg-transparent text-ink3 border-line'],
  ['hard', 'Hard', 'bg-surface2 text-ink2 border-line'],
  ['good', 'Good', 'bg-surface2 text-ink border-ink3'],
  ['easy', 'Easy', 'bg-accent text-onaccent border-accent'],
];

function ChipRow({ label, items }) {
  if (!items?.length) return null;
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink3">{label}</span>
      {items.map((s) => (
        <span key={s} lang="fr" className="px-1.5 py-0.5 rounded-md bg-surface2 text-ink2 text-xs">{s}</span>
      ))}
    </div>
  );
}

export default function VocabCard({ entry, cardDue, saved, onRate, onToggleSave, apiKey, mockMode }) {
  // Start on the back for every new card (including after advancing).
  // Combined with key={entry.id} on the parent, this ensures the front is never
  // shown first and there is no accidental answer flash during the transition.
  const [flipped, setFlipped] = useState(true);
  const [challenge, setChallenge] = useState(null);

  // Safety reset if the same component instance is reused without a key change.
  useEffect(() => {
    setFlipped(true);
    setChallenge(null);
  }, [entry.id]);

  const submitSentence = async () => {
    const sentence = challenge.sentence.trim();
    if (!sentence) return;
    setChallenge((c) => ({ ...c, checking: true }));
    try {
      const result = await checkSentence(apiKey, {
        card: { front: entry.fr, meaning: entry.en },
        sentence,
        mock: mockMode,
      });
      setChallenge((c) => ({ ...c, checking: false, result }));
    } catch (e) {
      setChallenge((c) => ({ ...c, checking: false, result: { correct: false, feedback: friendlyError(e) } }));
    }
  };

  return (
    <div className="space-y-4">
      {/* 3D flip card */}
      <div className="flip-scene">
        <button
          className={`flip-card w-full h-72 text-left ${flipped ? 'flipped' : ''}`}
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'Flip the card (front)' : 'Flip the card (back)'}
        >
          <div className="flip-face bg-gradient-to-br from-surface2 to-surface border border-line rounded-3xl grid place-items-center p-6 shadow-xl">
            {cardDue && (
              <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-accent text-onaccent text-[10px] font-semibold uppercase tracking-wider">
                Due
              </span>
            )}
            <span className="absolute top-4 left-4 px-2 py-0.5 rounded-md bg-surface text-ink3 text-[10px] font-semibold border border-line">
              {FREQ_LABELS[entry.freq] || 'My card'}
            </span>
            <div className="text-center">
              {entry.emoji && (
                <div className="text-6xl mb-3" role="img" aria-hidden="true">{entry.emoji}</div>
              )}
              <p className="text-3xl font-bold text-ink" lang="fr">{entry.fr}</p>
              <p className="text-xs text-ink3 mt-3">Tap to reveal</p>
            </div>
          </div>
          <div className="flip-face flip-face-back bg-gradient-to-br from-surface2 to-surface border border-line rounded-3xl p-5 flex flex-col justify-center gap-2.5 shadow-xl overflow-y-auto">
            <p className="text-lg font-bold text-ink">{entry.en}</p>
            {entry.example && <p className="text-sm text-ink italic" lang="fr">« {entry.example} »</p>}
            {entry.exampleEn && <p className="text-xs text-ink2">{entry.exampleEn}</p>}
            <ChipRow label="Syn" items={entry.syn} />
            <ChipRow label="Ant" items={entry.ant} />
            <ChipRow label="With" items={entry.coll} />
            {entry.note && <p className="text-[11px] text-ink3">{entry.note}</p>}
          </div>
        </button>
      </div>

      {/* audio + save */}
      <div className="flex items-center justify-center gap-2">
        <SpeakButton text={entry.fr} label="Word" />
        {entry.example && <SpeakButton text={entry.example} label="Sentence" />}
        {entry.example && <SpeakButton text={entry.example} slow />}
        <button
          onClick={onToggleSave}
          aria-label={saved ? 'Remove from notebook' : 'Save to notebook'}
          aria-pressed={saved}
          className={`inline-flex items-center gap-1 px-2 py-1 min-h-8 rounded-lg text-[11px] font-medium transition-colors ${
            saved ? 'bg-accent text-onaccent' : 'bg-surface2 text-ink2 hover:bg-line'
          }`}
        >
          {saved ? <BookmarkFilled size={12} /> : <Bookmark size={12} />} {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* SRS ratings (revealed side only) */}
      {flipped && (
        <div className="grid grid-cols-4 gap-2 fade-in">
          {RATINGS.map(([key, label, cls]) => (
            <button key={key} onClick={() => onRate(key)} className={`min-h-11 rounded-xl border text-xs font-bold ${cls} active:scale-95 transition`}>
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
              placeholder={`Write a sentence using “${entry.fr}”…`}
              lang="fr"
              className="w-full bg-surface2 border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink resize-none"
              aria-label="Your sentence"
            />
            {challenge.checking ? (
              <Spinner label="Checking…" />
            ) : challenge.result ? (
              <div className="fade-in rounded-xl px-3 py-2.5 text-sm border bg-surface2 border-line text-ink">
                <span className="inline-flex items-baseline gap-1.5">
                  {challenge.result.correct ? <Check size={13} className="self-center" /> : <X size={13} className="self-center" />}
                  <span>{challenge.result.feedback}</span>
                </span>
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
  );
}
