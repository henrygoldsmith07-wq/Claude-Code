import { useEffect, useRef, useState } from 'react';
import useRecorder from '../hooks/useRecorder';
import Waveform from './Waveform';
import { SCENARIOS } from '../lib/data';
import { transcribe, evaluateTurn, getHint } from '../lib/groq';
import { Markdown, ScoreBadge, SpeakButton, RateSlider, Spinner } from './ui';
import { speak } from '../lib/tts';
import { ArrowRight, Lightbulb, Mic, Square, SCENARIO_ICONS } from './icons';

const CURVEBALL_TURN = 3; // the surprise lands on the learner's 3rd turn

export default function ChatArena({ apiKey, mockMode, ttsRate, level, onTtsRate, onTurn, history, setHistory, scenario, setScenario }) {
  const [phase, setPhase] = useState('idle'); // idle | transcribing | editing | thinking
  const [draft, setDraft] = useState(''); // transcription editor / manual text
  const [hintLevel, setHintLevel] = useState(0);
  const [hint, setHint] = useState('');
  const [hintLoading, setHintLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const recorder = useRecorder({
    onComplete: async (blob) => {
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]); // haptic: stopped
      setPhase('transcribing');
      setError(null);
      try {
        const text = await transcribe(apiKey, blob, { mock: mockMode });
        setDraft(text);
        setPhase('editing'); // review/edit before it goes to the LLM
      } catch (e) {
        setError(e.message);
        setPhase('idle');
      }
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, phase]);

  const changeScenario = (id) => {
    const s = SCENARIOS.find((x) => x.id === id);
    setScenario(s);
    setHistory([]);
    setHint('');
    setHintLevel(0);
    setError(null);
    setPhase('idle');
  };

  const send = async (text) => {
    const userText = text.trim();
    if (!userText || phase === 'thinking') return;
    setDraft('');
    setHint('');
    setHintLevel(0);
    setPhase('thinking');
    setError(null);
    const turnNumber = history.length + 1;
    try {
      const evaluation = await evaluateTurn(apiKey, {
        scenario,
        history,
        userText,
        curveball: turnNumber === CURVEBALL_TURN ? scenario.curveball : null,
        level,
        mock: mockMode,
      });
      const turn = { userText, evaluation, reply: evaluation.reply, curveball: turnNumber === CURVEBALL_TURN };
      setHistory((h) => [...h, turn]);
      onTurn(evaluation.scores);
      speak(evaluation.reply, { rate: ttsRate });
    } catch (e) {
      setError(e.message);
      setDraft(userText); // don't lose their words
      setPhase('editing');
      return;
    }
    setPhase('idle');
  };

  const askHint = async () => {
    const depth = Math.min(3, hintLevel + 1);
    setHintLoading(true);
    setHintLevel(depth);
    try {
      const lastAiReply = history.length ? history[history.length - 1].reply : scenario.opener;
      const h = await getHint(apiKey, { scenario, lastAiReply, level: depth, cefr: level, mock: mockMode });
      setHint(h);
    } catch {
      setHint(scenario.staticHints[depth - 1]); // offline fallback
    }
    setHintLoading(false);
  };

  const busy = phase === 'transcribing' || phase === 'thinking';

  return (
    <div className="flex flex-col h-full">
      {/* scenario card rail */}
      <div className="border-b border-line bg-surface px-3 pt-2.5 pb-2 space-y-1.5">
        <div className="snap-rail flex gap-2 overflow-x-auto" role="group" aria-label="Choose a scenario">
          {SCENARIOS.map((s) => {
            const active = s.id === scenario.id;
            const ScenarioIcon = SCENARIO_ICONS[s.id];
            return (
              <button
                key={s.id}
                onClick={() => changeScenario(s.id)}
                aria-pressed={active}
                className={`shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                  active
                    ? 'border-ink bg-surface shadow-sm'
                    : 'border-line bg-surface hover:border-ink3'
                }`}
              >
                <ScenarioIcon size={16} className={active ? 'text-ink' : 'text-ink3'} />
                <span className={`text-xs font-semibold whitespace-nowrap ${active ? 'text-ink' : 'text-ink2'}`}>
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end pr-1">
          <RateSlider rate={ttsRate} onChange={onTtsRate} />
        </div>
      </div>

      {/* transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto nice-scroll px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
        <p className="text-center text-[11px] text-ink3 max-w-sm mx-auto">{scenario.setup}</p>
        <AiBubble text={scenario.opener} translation={scenario.openerTranslation} ttsRate={ttsRate} />
        {history.map((turn, i) => (
          <div key={i} className="space-y-4">
            <UserBubble turn={turn} />
            {turn.curveball && (
              <p className="text-center text-[11px] text-ink/90 font-semibold tracking-wide uppercase">
                Curveball
              </p>
            )}
            <AiBubble text={turn.evaluation.reply} translation={turn.evaluation.translation} ttsRate={ttsRate} />
          </div>
        ))}
        {phase === 'thinking' && (
          <div className="flex items-end gap-2 bubble-in" aria-label="Your partner is typing…">
            <Avatar />
            <div className="bg-surface2 rounded-2xl rounded-bl-md px-4 py-3.5 flex gap-1.5">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs text-ink bg-surface2 border border-line rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        </div>
      </div>

      {/* hint strip */}
      {(hint || hintLoading) && (
        <div className="mx-4 sm:max-w-2xl sm:mx-auto sm:w-full mb-2 fade-in rounded-xl bg-surface2 border border-line px-3 py-2">
          {hintLoading
            ? <Spinner label={`Hint ${hintLevel}/3…`} />
            : <p className="text-xs text-ink2"><span className="font-bold">Hint {hintLevel}/3:</span> {hint}</p>}
        </div>
      )}

      {/* composer */}
      <div className="border-t border-line bg-surface px-4 pt-3 pb-safe">
        <div className="max-w-2xl mx-auto">
        {recorder.recording ? (
          <div className="space-y-2">
            <Waveform analyserRef={recorder.analyserRef} peakDb={recorder.peakDb} elapsed={recorder.elapsed} />
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={recorder.cancel}
                className="min-h-11 px-4 rounded-xl text-sm text-ink2 hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={recorder.stop}
                aria-label="Stop and send"
                className="rec-pulse w-16 h-16 rounded-full bg-accent text-onaccent text-2xl grid place-items-center active:scale-90 transition"
              >
                <Square size={20} />
              </button>
              <span className="text-[11px] text-ink3 w-20">3.5 s of silence auto-sends</span>
            </div>
          </div>
        ) : phase === 'editing' ? (
          <div className="space-y-2 fade-in">
            <p className="text-[11px] text-ink2 font-medium">Check your transcription before sending:</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              className="w-full bg-surface2 border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink resize-none"
              aria-label="Transcription to review"
            />
            <div className="flex gap-2">
              <button onClick={() => { setDraft(''); setPhase('idle'); }} className="min-h-11 px-4 rounded-xl text-sm text-ink2 hover:text-ink">
                Redo
              </button>
              <button
                onClick={() => send(draft)}
                disabled={!draft.trim()}
                className="btn btn-primary flex-1 min-h-11 rounded-xl text-sm"
              >
                Send <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <button
              onClick={askHint}
              disabled={busy || hintLevel >= 3}
              className="btn btn-secondary min-h-11 px-3 rounded-xl text-xs whitespace-nowrap"
            >
              <Lightbulb size={14} /> {hintLevel === 0 ? 'Hint' : `Hint ${Math.min(3, hintLevel + 1)}/3`}
            </button>
            <div className="flex-1 flex items-center gap-2 bg-surface2 rounded-xl border border-line focus-within:border-ink px-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(draft)}
                placeholder={busy ? '…' : 'Or type in French…'}
                disabled={busy}
                className="flex-1 bg-transparent py-3 text-sm text-ink placeholder:text-ink3 focus:outline-none"
                aria-label="Typed reply"
              />
              {draft.trim() && (
                <button onClick={() => send(draft)} disabled={busy} aria-label="Send" className="text-ink px-1 min-h-11 grid place-items-center"><ArrowRight size={16} /></button>
              )}
            </div>
            <button
              onClick={recorder.start}
              disabled={busy}
              aria-label="Record my reply"
              className="btn btn-primary w-14 h-14 rounded-full"
            >
              {phase === 'transcribing' ? <span className="w-5 h-5 rounded-full border-2 border-onaccent border-t-transparent animate-spin" /> : <Mic size={22} />}
            </button>
          </div>
        )}
        {recorder.error && <p role="alert" className="text-[11px] text-ink mt-2">{recorder.error}</p>}
        </div>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <span
      className="w-9 h-9 shrink-0 rounded-full bg-surface2 border border-line grid place-items-center mb-1 text-[10px] font-semibold tracking-widest text-ink2"
      aria-hidden="true"
    >
      FR
    </span>
  );
}

function AiBubble({ text, translation, ttsRate }) {
  const [showTranslation, setShowTranslation] = useState(false);
  return (
    <div className="flex items-end gap-2 max-w-[88%] sm:max-w-[75%] bubble-in">
      <Avatar />
      <div className="bg-surface2 rounded-2xl rounded-bl-md px-4 py-3 space-y-2">
        <p className="text-[15px] text-ink leading-relaxed" lang="fr">{text}</p>
        {showTranslation && <p className="text-xs text-ink2 italic border-t border-line pt-2">{translation}</p>}
        <div className="flex items-center gap-2">
          <SpeakButton text={text} rate={ttsRate} label="Replay" />
          <button
            onClick={() => setShowTranslation((v) => !v)}
            className="text-[11px] text-ink2 hover:text-ink min-h-8 px-1"
          >
            {showTranslation ? 'Hide' : 'Translate'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserBubble({ turn }) {
  const [expanded, setExpanded] = useState(false);
  const { evaluation } = turn;
  return (
    <div className="flex flex-col items-end gap-1.5 bubble-in">
      <div className="flex items-end gap-2 max-w-[88%] sm:max-w-[75%]">
        <div className="bg-accent rounded-2xl rounded-br-md px-4 py-3 shadow-md shadow-black/15">
          <p className="text-[15px] text-onaccent leading-relaxed" lang="fr">{turn.userText}</p>
        </div>
        <ScoreBadge value={evaluation.scores.overall} />
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[11px] text-ink2 hover:text-ink min-h-8 px-1"
      >
        {expanded ? 'Hide feedback' : 'Corrections & native version'}
      </button>
      {expanded && (
        <div className="w-full sm:max-w-[85%] fade-in bg-surface2 border border-line rounded-2xl p-4 space-y-3 text-left">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-1">Corrections</h4>
            <Markdown className="text-[13px] text-ink leading-relaxed">{evaluation.corrections}</Markdown>
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink mb-1">Like a native</h4>
            <p className="text-[13px] text-ink italic" lang="fr">{evaluation.native_alternative}</p>
            <SpeakButton text={evaluation.native_alternative} slow label="Listen" />
          </div>
        </div>
      )}
    </div>
  );
}
