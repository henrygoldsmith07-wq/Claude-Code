import { useEffect, useRef, useState } from 'react';
import useRecorder from '../hooks/useRecorder';
import Waveform from './Waveform';
import { randomTopic } from '../lib/data';
import { transcribe } from '../lib/groq';
import { Spinner } from './ui';

// "Think on Your Feet": random topic, 45-second countdown, WPM flow tracking.

const CHALLENGE_SECONDS = 45;

export default function DailyChallenge({ apiKey, mockMode }) {
  const [topic, setTopic] = useState(randomTopic);
  const [remaining, setRemaining] = useState(CHALLENGE_SECONDS);
  const [result, setResult] = useState(null); // { transcript, wpm, seconds }
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState(null);
  const deadlineRef = useRef(null);

  const recorder = useRecorder({
    onComplete: async (blob, durationMs) => {
      clearInterval(deadlineRef.current);
      setTranscribing(true);
      setError(null);
      try {
        const transcript = await transcribe(apiKey, blob, { mock: mockMode });
        const seconds = Math.min(CHALLENGE_SECONDS, durationMs / 1000);
        const words = transcript.split(/\s+/).filter(Boolean).length;
        setResult({ transcript, seconds: Math.round(seconds), words, wpm: Math.round(words / (seconds / 60)) });
      } catch (e) {
        setError(e.message);
      }
      setTranscribing(false);
    },
  });

  // countdown drives auto-stop at 0
  useEffect(() => {
    if (!recorder.recording) return;
    setRemaining(CHALLENGE_SECONDS);
    const startedAt = performance.now();
    deadlineRef.current = setInterval(() => {
      const left = CHALLENGE_SECONDS - (performance.now() - startedAt) / 1000;
      setRemaining(Math.max(0, Math.ceil(left)));
      if (left <= 0) {
        clearInterval(deadlineRef.current);
        recorder.stop();
      }
    }, 200);
    return () => clearInterval(deadlineRef.current);
  }, [recorder.recording]); // eslint-disable-line react-hooks/exhaustive-deps

  const newTopic = () => {
    setTopic(randomTopic());
    setResult(null);
    setError(null);
    setRemaining(CHALLENGE_SECONDS);
  };

  const pct = (remaining / CHALLENGE_SECONDS) * 100;
  const timerColor = remaining <= 10 ? '#fb7185' : remaining <= 20 ? '#fbbf24' : '#34d399';
  const r = 54;
  const circ = 2 * Math.PI * r;

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <div>
          <h2 className="text-lg font-bold text-slate-100">⚡ Tac au tac</h2>
          <p className="text-xs text-slate-400 mt-1">45 secondes pour improviser sur un sujet. Pas de préparation !</p>
        </div>

        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-teal-300 font-bold mb-2">Votre sujet</p>
          <p className="text-lg text-slate-100 font-medium leading-snug">{topic}</p>
          <button onClick={newTopic} disabled={recorder.recording} className="mt-3 text-xs text-slate-400 hover:text-slate-200 min-h-9 disabled:opacity-40">
            🎲 Autre sujet
          </button>
        </div>

        {/* countdown ring */}
        <div className="flex justify-center">
          <div className="relative">
            <svg width="128" height="128" role="timer" aria-label={`${remaining} secondes restantes`}>
              <circle cx="64" cy="64" r={r} fill="none" stroke="rgb(30 41 59)" strokeWidth="8" />
              <circle
                cx="64" cy="64" r={r} fill="none"
                stroke={timerColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
                transform="rotate(-90 64 64)"
                style={{ transition: 'stroke-dashoffset 0.2s linear, stroke 0.3s' }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <span className="text-3xl font-black text-slate-100 tabular-nums">{remaining}</span>
            </div>
          </div>
        </div>

        {recorder.recording ? (
          <div className="space-y-3">
            <Waveform analyserRef={recorder.analyserRef} peakDb={recorder.peakDb} elapsed={recorder.elapsed} />
            <button
              onClick={recorder.stop}
              className="rec-pulse w-16 h-16 mx-auto rounded-full bg-rose-500 text-white text-2xl grid place-items-center active:scale-90 transition"
              aria-label="Terminer maintenant"
            >
              ◼
            </button>
          </div>
        ) : transcribing ? (
          <Spinner label="Analyse de votre improvisation…" />
        ) : (
          <button
            onClick={() => { setResult(null); recorder.start(); }}
            className="btn-3d btn-3d-emerald min-h-13 px-8 py-3.5 rounded-2xl font-extrabold shadow-lg shadow-emerald-500/25"
          >
            🎙️ C'est parti !
          </button>
        )}

        {(error || recorder.error) && (
          <p role="alert" className="text-xs text-rose-400">{error || recorder.error}</p>
        )}

        {result && (
          <div className="fade-in bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 space-y-4 text-left">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Mots / minute" value={result.wpm} accent />
              <Stat label="Mots" value={result.words} />
              <Stat label="Secondes" value={result.seconds} />
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              {result.wpm >= 100 ? 'Débit très fluide — niveau natif décontracté ! 🚀'
                : result.wpm >= 70 ? 'Bon débit conversationnel, continuez ! 👏'
                : result.wpm >= 40 ? 'Débit posé — visez 70+ mots/min pour plus de fluidité.'
                : 'Prenez confiance : parlez sans vous arrêter, même avec des erreurs.'}
            </p>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-300 mb-1">Votre improvisation</h4>
              <p className="text-sm text-slate-200 leading-relaxed">{result.transcript}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <div className={`text-2xl font-black tabular-nums ${accent ? 'text-emerald-400' : 'text-slate-100'}`}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
