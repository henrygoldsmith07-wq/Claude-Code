import { useMemo, useState } from 'react';
import useRecorder from '../hooks/useRecorder';
import Waveform from './Waveform';
import { randomPoolSentence, toWords, diffWords, displayHits } from '../lib/sentences';
import { transcribe, accentFeedback, friendlyError } from '../lib/groq';
import { speechMetrics } from '../lib/analytics';
import { activeLanguage } from '../lib/i18n';
import { recordSkillScore, recordPronunciationGap } from '../lib/storage';
import { speak, stopSpeaking, adaptiveTtsRate } from '../lib/tts';
import { SpeakButton, Spinner } from './ui';
import { accentToleranceScore, calibratedConfidence, PHONEMES, getPhonemeProfile, nextMinimalPair, recordPhonemeAttempt, weakestPhonemes } from '../lib/phonemeProfile';
import { noiseGate } from '../lib/adaptivePractice';
import { Mic, Square, Play, RefreshCw } from './icons';

// Pronunciation ("read aloud") and Shadowing ("listen & repeat") drills.
// The learner speaks the target sentence; Whisper transcribes; the word-level
// diff scores how much was recognized (a solid proxy for clarity), and the
// LLM turns the mis-transcriptions into specific accent feedback.

export default function Pronunciation({ mode, apiKey, mockMode, ttsRate, level, onXp, onActivity }) {
  const shadow = mode === 'shadow';
  const [sentence, setSentence] = useState(() => randomPoolSentence());
  const [played, setPlayed] = useState(false); // shadowing requires listening first
  const [phase, setPhase] = useState('idle'); // idle | scoring
  const [result, setResult] = useState(null); // { heard, accuracy, gained, hits, feedback }
  const [error, setError] = useState(null);

  const words = useMemo(() => sentence.text.split(/\s+/), [sentence]);

  const [phonemeTick, setPhonemeTick] = useState(0);
  const recorder = useRecorder({
    onComplete: async (blob, durationMs) => {
      setPhase('scoring');
      setError(null);
      // Noise gate
      const gate = noiseGate(recorder.peakDb ?? -20);
      if(!gate.ok){
        setError(gate.reason);
        setPhase('idle');
        return;
      }
      try {
        const heard = await transcribe(apiKey, blob, { mock: mockMode });
        // Accent-tolerant scoring: if only accents differ, count as hit
        const target = toWords(sentence.text);
        const heardWords = toWords(heard);
        const rawHits = diffWords(target, heardWords);
        // Bump hits where accent tolerance fires
        const hits = rawHits.map((hit, i)=> hit ? true : (accentToleranceScore(target[i]||'', heardWords[i]||'')!=null));
        const matched = hits.filter(Boolean).length;
        const rawAcc = matched / Math.max(1, target.length);
        const accCal = calibratedConfidence(rawAcc);
        const accuracy = Math.round(accCal * 100);
        const gained = Math.max(1, Math.round(accuracy / 10));
        onXp(gained);
        recordSkillScore(mode === 'shadowing' ? 'speaking' : 'pronunciation', accuracy);
        onActivity?.({
          type: 'pronunciation',
          mode: shadow ? 'shadowing' : 'pronunciation',
          score: accuracy,
          accuracy,
          label: shadow ? 'Shadowing clarity' : 'Read-aloud clarity',
        });
        const metrics = speechMetrics(heard, durationMs, activeLanguage().id);
        // Phoneme bookkeeping (light): treat underlined = miss
        for(let i=0;i<target.length;i++) recordPhonemeAttempt('overall', { correct: hits[i], confidence: accCal, trackGap: false });
        recordPronunciationGap(`${mode}:sentence-clarity`, {
          label: 'Sentence clarity',
          score: accuracy,
          source: mode === 'shadowing' ? 'shadowing' : 'read-aloud',
          context: { missedWords: target.filter((_, i) => !hits[i]).slice(0, 8), rawAccuracy: Math.round(rawAcc * 100) },
        });
        setPhonemeTick(t=>t+1);
        void phonemeTick; void PHONEMES; void getPhonemeProfile;
        let feedback = '';
        try {
          feedback = await accentFeedback(apiKey, { target: sentence.text, heard, level, mock: mockMode });
        } catch {
          feedback = ''; // scoring still stands without coach commentary
        }
        setResult({ heard, accuracy, gained, hits: displayHits(sentence.text, hits), feedback, metrics, rawAcc: Math.round(rawAcc*100), calibrated: accuracy });
      } catch (e) {
        setError(friendlyError(e));
      }
      setPhase('idle');
    },
  });

  const play = (slow) => {
    stopSpeaking();
    const lvlRate = adaptiveTtsRate(level);
    speak(sentence.text, { rate: slow ? Math.min(lvlRate, 0.75) : lvlRate });
    setPlayed(true);
  };

  const next = () => {
    stopSpeaking();
    setSentence(randomPoolSentence(sentence.text));
    setPlayed(false);
    setResult(null);
    setError(null);
  };

  const canRecord = !shadow || played;

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink2 text-center">
        {shadow
          ? 'Listen to the native rhythm first, then repeat it as closely as you can.'
          : 'Read the sentence aloud, clearly and at a natural pace.'}
      </p>

      {/* the target sentence */}
      <div className="bg-surface border border-line rounded-2xl p-5 text-center space-y-3">
        <p className="text-[17px] text-ink leading-relaxed" lang="fr">
          {result
            ? words.map((w, i) => (
                <span key={i} className={result.hits[i] ? 'text-ink' : 'text-ink3 underline decoration-2 underline-offset-2'}>
                  {w}{' '}
                </span>
              ))
            : sentence.text}
        </p>
        <p className="text-xs text-ink3 italic">{sentence.translation}</p>
        <div className="flex justify-center gap-2">
          <button onClick={() => play(false)} className="btn btn-secondary min-h-10 px-4 rounded-xl text-xs">
            <Play size={12} /> {shadow && !played ? 'Listen first' : 'Hear it'}
          </button>
          <button onClick={() => play(true)} className="btn btn-secondary min-h-10 px-3 rounded-xl text-xs">
            0.75×
          </button>
        </div>
      </div>

      {/* record / score */}
      {recorder.recording ? (
        <div className="space-y-3">
          <Waveform analyserRef={recorder.analyserRef} peakDb={recorder.peakDb} elapsed={recorder.elapsed} />
          <button
            onClick={recorder.stop}
            aria-label="Stop and score"
            className="rec-pulse w-16 h-16 mx-auto rounded-full bg-accent text-onaccent grid place-items-center active:scale-90 transition"
          >
            <Square size={20} />
          </button>
        </div>
      ) : phase === 'scoring' ? (
        <div className="text-center"><Spinner label="Scoring your pronunciation…" /></div>
      ) : !result ? (
        <div className="text-center space-y-2">
          <button
            onClick={() => { setResult(null); recorder.start(); }}
            disabled={!canRecord}
            className="btn btn-primary min-h-12 px-8 rounded-xl text-sm"
          >
            <Mic size={15} /> {shadow ? 'Repeat it' : 'Read it aloud'}
          </button>
          {!canRecord && <p className="text-[11px] text-ink3">Play the sentence first</p>}
        </div>
      ) : (
        <div className="fade-in bg-surface border border-line rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-ink tabular-nums">{result.accuracy}%</span>
            <span className="text-xs text-ink2">
              {result.accuracy >= 90 ? 'Crystal clear.' : result.accuracy >= 65 ? 'Mostly understood.' : 'Hard to recognize — slow down and retry.'}
              {' '}+{result.gained} XP
            </span>
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-1">The recognizer heard</h4>
            <p className="text-sm text-ink2" lang="fr">{result.heard || '—'}</p>
            <p className="text-[11px] text-ink3 mt-1">Underlined words above weren't recognized — they're your likely trouble spots.</p>
          </div>

          {/* delivery: how fast, and how many audible hesitations */}
          {result.metrics && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface2 rounded-xl px-3.5 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink3">Pace</p>
                <p className="text-lg font-bold text-ink tabular-nums leading-tight">
                  {result.metrics.wpm} <span className="text-[11px] font-normal text-ink3">wpm</span>
                </p>
                <p className="text-[11px] text-ink3">
                  {result.metrics.pace === 'measured' ? 'measured — build flow' : result.metrics.pace === 'fast' ? 'fast — mind clarity' : 'natural pace'}
                </p>
              </div>
              <div className="bg-surface2 rounded-xl px-3.5 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink3">Hesitations</p>
                <p className="text-lg font-bold text-ink tabular-nums leading-tight">{result.metrics.fillers}</p>
                <p className="text-[11px] text-ink3">
                  {result.metrics.fillers === 0 ? 'none heard — fluent' : 'filler word' + (result.metrics.fillers > 1 ? 's' : '')}
                </p>
              </div>
            </div>
          )}
          {result.feedback && (
            <div className="bg-surface2 border border-line rounded-xl px-3.5 py-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1">Accent coach</h4>
              <p className="text-xs text-ink2 leading-relaxed">{result.feedback}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setResult(null); }}
              className="btn btn-secondary flex-1 min-h-11 rounded-xl text-sm"
            >
              <Mic size={13} /> Try again
            </button>
            <button onClick={next} className="btn btn-primary flex-1 min-h-11 rounded-xl text-sm">
              <RefreshCw size={13} /> Next sentence
            </button>
          </div>
        </div>
      )}

      {(error || recorder.error) && (
        <p role="alert" className="text-xs text-ink text-center">{error || recorder.error}</p>
      )}
      <MinimalPairStrip level={level} />
      <PhonemeWeakStrip />
      <div className="text-center">
        <SpeakButton text={sentence.text} slow />
      </div>
    </div>
  );
}
function MinimalPairStrip({ level }){
  const [pair, setPair] = useState(()=> nextMinimalPair('u-ou'));
  const weak = weakestPhonemes(1)[0];
  const phoneme = weak?.id || 'u-ou';
  return (
    <div className="bg-surface border border-line rounded-2xl p-4 flex items-center gap-3">
      <div className="flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">Minimal pair · {phoneme}</p>
        <p className="text-sm text-ink" lang="fr">{pair[0]} — {pair[1]}</p>
      </div>
      <SpeakButton text={pair[0]} label={pair[0]} />
      <SpeakButton text={pair[1]} label={pair[1]} />
      <button onClick={()=> setPair(nextMinimalPair(phoneme))} className="btn btn-secondary min-h-9 px-3 rounded-lg text-xs">New</button>
    </div>
  );
}
function PhonemeWeakStrip(){
  const weak = weakestPhonemes(3);
  if(!weak.length) return null;
  return (
    <div className="bg-surface2 border border-line rounded-xl px-3.5 py-2.5 space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">Phoneme focus</p>
      {weak.map(w=> (
        <div key={w.id} className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink">{w.label}</span>
          <span className="text-[11px] text-ink3">{w.stats.misses}/{w.stats.attempts}</span>
        </div>
      ))}
    </div>
  );
}
