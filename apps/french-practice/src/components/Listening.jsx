import { useEffect, useRef, useState } from 'react';
import { LISTENING_KINDS, LISTENING_TRACKS, getTrack } from '../lib/listening';
import { recordSkillScore } from '../lib/storage';
import { speakLines, stopSpeaking } from '../lib/tts';
import Dictation from './Dictation';
import AudioCourse from './AudioCourse';
import NumberDash from './NumberDash';
import { Volume, Play, Square, ChevronLeft, ChevronRight, Check, X, RefreshCw } from './icons';

// Listening hub: TTS-narrated tracks (mini-podcasts, dialogues, news,
// scenes) with listen-first transcripts, per-line highlighting, variable
// speed, and comprehension quizzes — plus the Dictée drill.

export default function Listening({ mode, onModeChange, ttsRate, onXp, onActivity }) {
  if (mode === 'dictation') {
    return (
      <Shell title="Dictée" onBack={() => onModeChange(null)}>
        <Dictation ttsRate={ttsRate} onXp={onXp} onActivity={onActivity} />
      </Shell>
    );
  }
  if (mode === 'course') {
    return (
      <Shell title="Cours audio" onBack={() => onModeChange(null)}>
        <AudioCourse ttsRate={ttsRate} onXp={onXp} />
      </Shell>
    );
  }
  if (mode === 'numbers') {
    return (
      <Shell title="Les nombres" onBack={() => onModeChange(null)}>
        <NumberDash ttsRate={ttsRate} onXp={onXp} />
      </Shell>
    );
  }
  if (mode && getTrack(mode)) {
    return (
      <Shell title={getTrack(mode).title} onBack={() => onModeChange(null)}>
        <TrackPlayer track={getTrack(mode)} baseRate={ttsRate} onXp={onXp} onActivity={onActivity} />
      </Shell>
    );
  }

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-ink">Listening</h2>
          <p className="text-xs text-ink2 mt-1">
            Train your ear: audio first, transcript after. Adjustable speed on everything.
          </p>
        </div>

        <button
          onClick={() => onModeChange('dictation')}
          className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
        >
          <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink"><Volume size={18} /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Dictée</span>
            <span className="block text-xs text-ink3">Type what you hear, word by word</span>
          </span>
          <ChevronRight size={16} className="text-ink3 shrink-0" />
        </button>

        <button
          onClick={() => onModeChange('course')}
          className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
        >
          <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink"><Play size={18} /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Cours audio — hands-free</span>
            <span className="block text-xs text-ink3">Listen, repeat aloud, learn — no taps needed</span>
          </span>
          <ChevronRight size={16} className="text-ink3 shrink-0" />
        </button>

        <button
          onClick={() => onModeChange('numbers')}
          className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
        >
          <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink"><Volume size={18} /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Les nombres — rapid fire</span>
            <span className="block text-xs text-ink3">Hear numbers, prices, times & years; type the digits</span>
          </span>
          <ChevronRight size={16} className="text-ink3 shrink-0" />
        </button>

        {LISTENING_KINDS.map((kind) => (
          <section key={kind.id}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-2">
              {kind.title} <span className="normal-case font-normal text-ink3">— {kind.description}</span>
            </h3>
            <div className="space-y-2">
              {LISTENING_TRACKS.filter((t) => t.kind === kind.id).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onModeChange(t.id)}
                  className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3 text-left hover:border-ink3 transition-colors"
                >
                  <span className="w-9 h-9 shrink-0 grid place-items-center rounded-lg bg-surface2 text-ink"><Play size={14} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink truncate" lang="fr">{t.title}</span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md border border-line text-[10px] font-semibold text-ink3">{t.cefr}</span>
                    </span>
                    <span className="block text-xs text-ink3 truncate">{t.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Shell({ title, onBack, children }) {
  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to listening" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <h2 className="flex-1 text-center text-sm font-semibold text-ink truncate" lang="fr">{title}</h2>
          <span className="w-10" aria-hidden="true" />
        </div>
        {children}
      </div>
    </div>
  );
}

function TrackPlayer({ track, baseRate, onXp, onActivity }) {
  const [rate, setRate] = useState(baseRate);
  const [playing, setPlaying] = useState(false);
  const [currentLine, setCurrentLine] = useState(-1);
  const [listened, setListened] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [quiz, setQuiz] = useState(null); // { index, correct, picked, done }
  // Real recorded audio: tracks with audioSrc play the MP3 from /audio/;
  // if the file is missing (it's a drop-in — see public/audio/README.md)
  // we fall back to TTS so the track still works.
  const [audioFailed, setAudioFailed] = useState(false);
  const audioRef = useRef(null);
  const hasRealAudio = Boolean(track.audioSrc) && !audioFailed;

  useEffect(() => () => { stopSpeaking(); audioRef.current?.pause(); }, []);

  const play = () => {
    setPlaying(true);
    setCurrentLine(-1);
    if (hasRealAudio && audioRef.current) {
      audioRef.current.playbackRate = rate;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setAudioFailed(true));
      return;
    }
    speakLines(track.lines, {
      rate,
      onLine: setCurrentLine,
      onEnd: () => {
        setPlaying(false);
        setCurrentLine(-1);
        setListened(true);
      },
    });
  };

  const stop = () => {
    stopSpeaking();
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false);
    setCurrentLine(-1);
    setListened(true);
  };

  const answer = (i) => {
    if (quiz.picked != null) return;
    const correct = i === track.questions[quiz.index].answer;
    setQuiz({ ...quiz, picked: i, correct: quiz.correct + (correct ? 1 : 0) });
  };

  const nextQuestion = () => {
    if (quiz.index + 1 < track.questions.length) {
      setQuiz({ ...quiz, index: quiz.index + 1, picked: null });
    } else {
      const gained = Math.max(1, quiz.correct * 5);
      onXp(gained);
      recordSkillScore('listening', Math.round((quiz.correct / track.questions.length) * 100));
      onActivity?.({ type: 'listening', trackId: track.id });
      setQuiz({ ...quiz, done: true, gained });
    }
  };

  return (
    <div className="space-y-4">
      {/* hidden native audio element for real recordings */}
      {track.audioSrc && (
        <audio
          ref={audioRef}
          src={track.audioSrc}
          preload="metadata"
          onError={() => setAudioFailed(true)}
          onEnded={() => { setPlaying(false); setListened(true); }}
        />
      )}
      {/* player */}
      <div className="bg-surface border border-line rounded-2xl p-5 space-y-4">
        {track.audioSrc && (
          <p className="text-[11px] text-ink3 text-center -mb-1">
            {hasRealAudio
              ? '🎙️ Real native recording'
              : 'Recording not installed — playing with TTS (see public/audio/README.md).'}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          {playing ? (
            <button onClick={stop} aria-label="Stop" className="btn btn-primary w-14 h-14 rounded-full">
              <Square size={18} />
            </button>
          ) : (
            <button onClick={play} aria-label="Play" className="btn btn-primary w-14 h-14 rounded-full">
              <Play size={18} />
            </button>
          )}
        </div>
        <label className="flex items-center justify-center gap-2 text-[11px] text-ink2">
          <span className="text-ink3">0.5×</span>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            disabled={playing}
            className="w-32 accent-ink"
            aria-label="Playback speed"
          />
          <span className="text-ink3">1.5×</span>
          <span className="font-mono w-9">{rate.toFixed(1)}×</span>
        </label>
        <p className="text-[11px] text-ink3 text-center">
          {playing
            ? 'Playing…'
            : listened
              ? 'Listen again at a slower speed, or check the transcript below.'
              : 'Listen once before opening the transcript — train the ear first.'}
        </p>
      </div>

      {/* transcript */}
      <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Transcript</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setShowTranscript((v) => !v)}
              className="text-[11px] font-semibold text-ink2 hover:text-ink min-h-8"
            >
              {showTranscript ? 'Hide' : 'Show'}
            </button>
            {showTranscript && (
              <button
                onClick={() => setShowTranslations((v) => !v)}
                className="text-[11px] font-semibold text-ink2 hover:text-ink min-h-8"
              >
                {showTranslations ? 'Hide English' : 'Translate'}
              </button>
            )}
          </div>
        </div>
        {showTranscript ? (
          <ol className="space-y-2.5">
            {track.lines.map((line, i) => (
              <li key={i} className={`text-sm leading-relaxed ${currentLine === i ? 'bg-surface2 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                <p className="text-ink" lang="fr">
                  {line.speaker && <span className="font-semibold text-ink3 mr-1.5">{line.speaker} —</span>}
                  {line.fr}
                </p>
                {showTranslations && <p className="text-xs text-ink3 italic mt-0.5">{line.en}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-ink3">
            Hidden while you listen. {listened ? 'You’ve listened — open it whenever you like.' : ''}
          </p>
        )}
      </div>

      {/* comprehension quiz */}
      <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Comprehension check</h3>
        {!quiz ? (
          <button
            onClick={() => setQuiz({ index: 0, correct: 0, picked: null, done: false })}
            disabled={!listened}
            className="btn btn-primary w-full min-h-11 rounded-xl text-sm"
          >
            {listened ? 'Start the quiz' : 'Listen first to unlock'}
          </button>
        ) : quiz.done ? (
          <div className="text-center space-y-2 fade-in">
            <p className="text-2xl font-bold text-ink tabular-nums">{quiz.correct}/{track.questions.length}</p>
            <p className="text-xs text-ink2">
              {quiz.correct === track.questions.length ? 'Perfect comprehension.' : 'Replay the track and listen for the details you missed.'}
              {' '}+{quiz.gained} XP
            </p>
            <button
              onClick={() => setQuiz({ index: 0, correct: 0, picked: null, done: false })}
              className="btn btn-secondary min-h-10 px-4 rounded-xl text-xs"
            >
              <RefreshCw size={12} /> Retake
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-ink3 tabular-nums">Question {quiz.index + 1}/{track.questions.length}</p>
            <p className="text-sm text-ink">{track.questions[quiz.index].q}</p>
            {track.questions[quiz.index].options.map((opt, i) => {
              const isAnswer = i === track.questions[quiz.index].answer;
              let cls = 'border-line bg-surface text-ink2 hover:border-ink3';
              if (quiz.picked != null && isAnswer) cls = 'border-ink bg-surface2 text-ink font-semibold';
              else if (quiz.picked === i) cls = 'border-line text-ink3 line-through';
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={quiz.picked != null}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${cls}`}
                >
                  <span className="inline-flex items-center gap-2">
                    {quiz.picked != null && isAnswer && <Check size={13} />}
                    {quiz.picked === i && !isAnswer && <X size={13} />}
                    {opt}
                  </span>
                </button>
              );
            })}
            {quiz.picked != null && (
              <button onClick={nextQuestion} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
                {quiz.index + 1 < track.questions.length ? 'Next question' : 'See my score'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
