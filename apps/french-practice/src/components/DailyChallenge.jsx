import { useEffect, useRef, useState } from 'react';
import useRecorder from '../hooks/useRecorder';
import Waveform from './Waveform';
import { randomTopic } from '../lib/data';
import { transcribe } from '../lib/groq';
import { Spinner } from './ui';
import { RefreshCw, Mic, Square } from './icons';

// "Think on Your Feet": random topic, 45-second countdown, WPM flow tracking.

const CHALLENGE_SECONDS = 45;

export default function DailyChallenge({ apiKey, mockMode, onActivity }) {
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
        onActivity?.({ type: 'quickfire', wpm: Math.round(words / (seconds / 60)) });
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
  // monochrome urgency: the ring fades as time runs out, numbers do the shouting
  const timerColor =
    remaining <= 10
      ? 'color-mix(in srgb, var(--ink) 45%, transparent)'
      : remaining <= 20
        ? 'color-mix(in srgb, var(--ink) 70%, transparent)'
        : 'var(--ink)';
  const r = 54;
  const circ = 2 * Math.PI * r;

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <div>
          <h2 className="text-lg font-bold text-ink">Quick Fire</h2>
          <p className="text-xs text-ink2 mt-1">45 seconds to improvise on a French topic. No prep!</p>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-ink2 font-bold mb-2">Your topic</p>
          <p className="text-lg text-ink font-medium leading-snug" lang="fr">{topic.fr}</p>
          <p className="text-xs text-ink3 italic mt-1.5">{topic.en}</p>
          <button onClick={newTopic} disabled={recorder.recording} className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink2 hover:text-ink min-h-9 disabled:opacity-40">
            <RefreshCw size={12} /> New topic
          </button>
        </div>

        {/* countdown ring */}
        <div className="flex justify-center">
          <div className="relative">
            <svg width="128" height="128" role="timer" aria-label={`${remaining} seconds left`}>
              <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
              <circle
                cx="64" cy="64" r={r} fill="none"
                stroke={timerColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
                transform="rotate(-90 64 64)"
                style={{ transition: 'stroke-dashoffset 0.2s linear, stroke 0.3s' }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <span className="text-3xl font-bold text-ink tabular-nums">{remaining}</span>
            </div>
          </div>
        </div>

        {recorder.recording ? (
          <div className="space-y-3">
            <Waveform analyserRef={recorder.analyserRef} peakDb={recorder.peakDb} elapsed={recorder.elapsed} />
            <button
              onClick={recorder.stop}
              className="rec-pulse w-16 h-16 mx-auto rounded-full bg-accent text-onaccent text-2xl grid place-items-center active:scale-90 transition"
              aria-label="Finish now"
            >
              <Square size={20} />
            </button>
          </div>
        ) : transcribing ? (
          <Spinner label="Analyzing your improv…" />
        ) : (
          <button
            onClick={() => { setResult(null); recorder.start(); }}
            className="btn btn-primary min-h-13 px-8 py-3.5 rounded-xl"
          >
            <Mic size={16} /> Start speaking
          </button>
        )}

        {(error || recorder.error) && (
          <p role="alert" className="text-xs text-ink">{error || recorder.error}</p>
        )}

        {result && (
          <div className="fade-in bg-surface border border-line rounded-2xl p-5 space-y-4 text-left">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Words / minute" value={result.wpm} accent />
              <Stat label="Words" value={result.words} />
              <Stat label="Seconds" value={result.seconds} />
            </div>
            <p className="text-[11px] text-ink3 text-center">
              {result.wpm >= 100 ? 'Very fluid pace — relaxed native level.'
                : result.wpm >= 70 ? 'Good conversational pace, keep going.'
                : result.wpm >= 40 ? 'Steady pace — aim for 70+ words/min for more flow.'
                : 'Build confidence: keep talking without stopping, mistakes and all.'}
            </p>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-1">Your improvisation</h4>
              <p className="text-sm text-ink leading-relaxed">{result.transcript}</p>
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
      <div className={`text-2xl font-bold tabular-nums ${accent ? 'text-ink' : 'text-ink'}`}>{value}</div>
      <div className="text-[10px] text-ink3 mt-0.5">{label}</div>
    </div>
  );
}
