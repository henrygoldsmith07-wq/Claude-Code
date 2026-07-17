import { useMemo, useState } from 'react';
import { FLASHCARDS, SCENARIOS } from '../lib/data';
import { speak, stopSpeaking } from '../lib/tts';
import { Play, Volume, RefreshCw, Check } from './icons';

// Dictée: pure listening drill. The app speaks a French sentence the learner
// cannot see; they type what they heard and get a word-level diff + accuracy
// score. Everything runs locally (TTS + diff) — no API calls.

const POOL = [
  ...FLASHCARDS.map((c) => ({ text: c.example, translation: c.exampleTranslation })),
  ...SCENARIOS.map((s) => ({ text: s.opener, translation: s.openerTranslation })),
];

const randomSentence = (excludeText) => {
  const candidates = POOL.filter((s) => s.text !== excludeText);
  return candidates[Math.floor(Math.random() * candidates.length)];
};

// Normalize for comparison: lowercase, strip punctuation, keep accents —
// hearing «déjà» as "deja" is still a miss worth flagging at B1+.
const toWords = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

// Word-level LCS alignment: marks each target word heard/missed.
function diffWords(target, attempt) {
  const m = target.length;
  const n = attempt.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = target[i] === attempt[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hit = new Array(m).fill(false);
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (target[i] === attempt[j]) { hit[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return hit;
}

export default function Dictation({ ttsRate, onXp, onActivity }) {
  const [sentence, setSentence] = useState(() => randomSentence());
  const [input, setInput] = useState('');
  const [played, setPlayed] = useState(false);
  const [result, setResult] = useState(null); // { hits, targetTokens, accuracy, gained }

  const targetWords = useMemo(() => sentence.text.split(/\s+/), [sentence]);

  const play = (slow) => {
    stopSpeaking();
    speak(sentence.text, { rate: slow ? Math.min(ttsRate, 0.75) : ttsRate });
    setPlayed(true);
  };

  const check = () => {
    const target = toWords(sentence.text);
    const hits = diffWords(target, toWords(input));
    const matched = hits.filter(Boolean).length;
    const accuracy = Math.round((matched / Math.max(1, target.length)) * 100);
    const gained = Math.max(1, Math.round(accuracy / 10));
    onXp(gained);
    onActivity?.({ type: 'dictation', accuracy });
    setResult({ hits, accuracy, gained });
  };

  const next = () => {
    stopSpeaking();
    setSentence(randomSentence(sentence.text));
    setInput('');
    setPlayed(false);
    setResult(null);
  };

  // Map normalized-hit flags back onto the display words (both arrays align
  // 1:1 because toWords only strips punctuation, never merges words).
  const displayHits = useMemo(() => {
    if (!result) return null;
    const target = toWords(sentence.text);
    let k = 0;
    return targetWords.map((w) => (toWords(w).length ? result.hits[(k += 1) - 1] : true));
  }, [result, sentence, targetWords]);

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-5 text-center">
        <div>
          <h2 className="text-lg font-semibold text-ink">Dictée</h2>
          <p className="text-xs text-ink2 mt-1">
            Listen to the French sentence, then type exactly what you heard. Accents count.
          </p>
        </div>

        {/* audio controls */}
        <div className="bg-surface border border-line rounded-2xl p-6 space-y-4">
          <div className="w-16 h-16 mx-auto grid place-items-center rounded-full bg-surface2 text-ink">
            <Volume size={26} />
          </div>
          <div className="flex justify-center gap-2">
            <button onClick={() => play(false)} className="btn btn-primary min-h-11 px-5 rounded-xl text-sm">
              <Play size={13} /> {played ? 'Play again' : 'Play'}
            </button>
            <button onClick={() => play(true)} className="btn btn-secondary min-h-11 px-4 rounded-xl text-sm">
              0.75×
            </button>
          </div>
          {!played && <p className="text-[11px] text-ink3">Press play to hear your sentence</p>}
        </div>

        {/* answer */}
        {!result ? (
          <div className="space-y-2 text-left">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && played && input.trim()) {
                  e.preventDefault();
                  check();
                }
              }}
              rows={2}
              disabled={!played}
              placeholder={played ? 'Type what you heard…' : 'Listen first, then type here'}
              lang="fr"
              className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink resize-none disabled:opacity-50"
              aria-label="What you heard"
            />
            <button
              onClick={check}
              disabled={!played || !input.trim()}
              className="btn btn-primary w-full min-h-11 rounded-xl text-sm"
            >
              <Check size={14} /> Check
            </button>
          </div>
        ) : (
          <div className="fade-in bg-surface border border-line rounded-2xl p-5 space-y-4 text-left">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-ink tabular-nums">{result.accuracy}%</span>
              <span className="text-xs text-ink2">
                {result.accuracy === 100 ? 'Perfect ear.' : result.accuracy >= 70 ? 'Well heard.' : 'Tricky one — replay and compare.'}
                {' '}+{result.gained} XP
              </span>
            </div>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-1">The sentence</h4>
              <p className="text-[15px] leading-relaxed" lang="fr">
                {targetWords.map((w, i) => (
                  <span key={i} className={displayHits[i] ? 'text-ink' : 'text-ink3 underline decoration-2 underline-offset-2'}>
                    {w}{' '}
                  </span>
                ))}
              </p>
              <p className="text-xs text-ink3 italic mt-1.5">{sentence.translation}</p>
            </div>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-1">You wrote</h4>
              <p className="text-sm text-ink2" lang="fr">{input || '—'}</p>
            </div>
            <button onClick={next} className="btn btn-secondary w-full min-h-11 rounded-xl text-sm">
              <RefreshCw size={13} /> Next sentence
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
