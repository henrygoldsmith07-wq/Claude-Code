import { useMemo, useState } from 'react';
import { FLASHCARDS } from '../lib/data';
import { checkSentence } from '../lib/groq';
import { getSrs, rateCard } from '../lib/storage';
import { SpeakButton, Spinner } from './ui';

// "Du coup" filler-word deck: 3D flip cards, SRS ratings, TTS (normal + 0.75×
// slow-mo) and an LLM-verified "use it in a sentence" challenge.

const RATINGS = [
  ['again', 'Encore', 'bg-rose-500/20 text-rose-300 border-rose-500/40'],
  ['hard', 'Difficile', 'bg-amber-500/20 text-amber-300 border-amber-500/40'],
  ['good', 'Bien', 'bg-teal-500/20 text-teal-300 border-teal-500/40'],
  ['easy', 'Facile', 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'],
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
          <h2 className="text-lg font-extrabold text-slate-100">🃏 « Du coup » — Mots de liaison</h2>
          <p className="text-xs text-slate-400 mt-1">
            {cardSrs && <span className="text-teal-400">révisée ×{cardSrs.reps} · intervalle {cardSrs.interval} j</span>}
          </p>
          <div className="flex justify-center gap-1.5 mt-2" aria-label={`Carte ${index + 1} sur ${FLASHCARDS.length}`}>
            {FLASHCARDS.map((c, i) => (
              <span
                key={c.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-5 bg-emerald-400' : srs[c.id] ? 'w-1.5 bg-teal-600' : 'w-1.5 bg-slate-700'
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
            aria-label={flipped ? 'Retourner la carte (recto)' : 'Retourner la carte (verso)'}
          >
            <div className="flip-face bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-3xl grid place-items-center p-6 shadow-xl">
              <div className="text-center">
                <p className="text-4xl font-black text-emerald-400">{card.front}</p>
                <p className="text-xs text-slate-500 mt-4">Touchez pour révéler ↻</p>
              </div>
            </div>
            <div className="flip-face flip-face-back bg-gradient-to-br from-emerald-950 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 flex flex-col justify-center gap-3 shadow-xl">
              <p className="text-xl font-bold text-slate-100">{card.meaning}</p>
              <p className="text-sm text-emerald-200 italic">« {card.example} »</p>
              <p className="text-xs text-slate-400">{card.exampleTranslation}</p>
              <p className="text-[10px] uppercase tracking-wider text-teal-400">{card.register}</p>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button onClick={() => go(-1)} aria-label="Carte précédente" className="w-11 h-11 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700">←</button>
          <SpeakButton text={card.example} label="Exemple" />
          <SpeakButton text={card.example} slow />
          <button onClick={() => go(1)} aria-label="Carte suivante" className="w-11 h-11 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700">→</button>
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
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300">✍️ Défi : utilisez-le dans une phrase</h3>
          {!challenge ? (
            <button
              onClick={() => setChallenge({ sentence: '', checking: false, result: null })}
              className="w-full min-h-11 rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold hover:bg-slate-700"
            >
              Relever le défi
            </button>
          ) : (
            <div className="space-y-2 fade-in">
              <textarea
                value={challenge.sentence}
                onChange={(e) => setChallenge((c) => ({ ...c, sentence: e.target.value, result: null }))}
                rows={2}
                placeholder={`Écrivez une phrase avec « ${card.front} »…`}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
                aria-label="Votre phrase"
              />
              {challenge.checking ? (
                <Spinner label="Vérification…" />
              ) : challenge.result ? (
                <div className={`fade-in rounded-xl px-3 py-2.5 text-sm border ${
                  challenge.result.correct
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                }`}>
                  {challenge.result.correct ? '✅ ' : '❌ '}{challenge.result.feedback}
                </div>
              ) : (
                <button
                  onClick={submitSentence}
                  disabled={!challenge.sentence.trim()}
                  className="btn-3d btn-3d-emerald w-full min-h-11 rounded-2xl text-sm font-extrabold"
                >
                  Vérifier ma phrase
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
