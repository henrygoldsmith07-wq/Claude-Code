import { useEffect, useRef, useState } from 'react';
import { langName } from '../lib/i18n';
import useRecorder from '../hooks/useRecorder';
import Waveform from './Waveform';
import { getScenarios } from '../lib/data';
import { transcribe, evaluateTurn, getHint, explainMistake, friendlyError } from '../lib/groq';
import { speechMetrics } from '../lib/analytics';
import { activeLanguage } from '../lib/i18n';
import { getSrs, recordGrammarError } from '../lib/storage';
import { allEntries } from '../lib/vocab';
import { Markdown, ScoreBadge, SpeakButton, RateSlider, Spinner } from './ui';
import { speak } from '../lib/tts';
import { ArrowRight, Book, Grid, Lightbulb, Mic, RefreshCw, Sparkles, Square, Volume, scenarioIcon } from './icons';
import ScenarioPicker from './ScenarioPicker';
import { getGrammarTopic } from '../lib/grammar';

const CURVEBALL_TURN = 3; // the surprise lands on the learner's 3rd turn

export default function ChatArena({ apiKey, mockMode, ttsRate, level, onTtsRate, onTurn, onGrammarTip, history, setHistory, scenario, setScenario, onEndSession }) {
  const [phase, setPhase] = useState('idle'); // idle | transcribing | editing | thinking
  const [draft, setDraft] = useState(''); // transcription editor / manual text
  const [spoken, setSpoken] = useState(null); // delivery coaching for a voice turn
  const [hintLevel, setHintLevel] = useState(0);
  const [hint, setHint] = useState('');
  const [hintLoading, setHintLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollRef = useRef(null);

  const recorder = useRecorder({
    onComplete: async (blob, durationMs) => {
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]); // haptic: stopped
      setPhase('transcribing');
      setError(null);
      try {
        const text = await transcribe(apiKey, blob, { mock: mockMode });
        setDraft(text);
        // Coach on delivery from the raw spoken transcript, before any edits.
        const m = speechMetrics(text, durationMs, activeLanguage().id);
        setSpoken(m.fillers > 0 || m.pace === 'fast' ? m : null);
        setPhase('editing'); // review/edit before it goes to the LLM
      } catch (e) {
        setError(friendlyError(e));
        setPhase('idle');
      }
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, phase]);

  const [reversed, setReversed] = useState(false);

  // Comprehensible input: feed the model the learner's strongest SRS words so
  // replies lean on vocabulary they actually know.
  const knownWords = () => {
    const srs = getSrs();
    return allEntries()
      .filter((e) => (srs[e.id]?.reps || 0) > 0)
      .sort((a, b) => (srs[b.id].reps || 0) - (srs[a.id].reps || 0))
      .slice(0, 40)
      .map((e) => e.fr);
  };

  const changeScenario = (id) => {
    const s = getScenarios().find((x) => x.id === id);
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
    setSpoken(null);
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
        knownWords: knownWords(),
        reversed,
        mock: mockMode,
      });
      if (evaluation.grammar_topic) recordGrammarError(evaluation.grammar_topic);
      const turn = { userText, evaluation, reply: evaluation.reply, curveball: turnNumber === CURVEBALL_TURN };
      setHistory((h) => [...h, turn]);
      onTurn(evaluation.scores);
      speak(evaluation.reply, { rate: ttsRate });
    } catch (e) {
      setError(friendlyError(e));
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
  const ScenarioIcon = scenarioIcon(scenario.id);
  const target = activeLanguage();

  return (
    <div className="flex flex-col h-full">
      {/* scenario context bar — what you're in, and how to change it */}
      <div className="border-b border-line bg-surface px-3 py-2.5 space-y-2">
        <div className="flex items-start gap-2.5">
          <span
            className="w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-surface2 border border-line text-ink"
            aria-hidden="true"
          >
            <ScenarioIcon size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-ink truncate">{scenario.title}</h2>
            <p className="text-[11px] text-ink2 leading-snug line-clamp-2">{scenario.setup}</p>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="btn btn-secondary shrink-0 min-h-9 px-3 rounded-xl text-xs"
            title="Browse every roleplay"
          >
            <Grid size={13} /> Change
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <button
            onClick={() => { setReversed((v) => !v); setHistory([]); setHint(''); setHintLevel(0); setPhase('idle'); }}
            aria-pressed={reversed}
            title="Swap roles: you play the professional, the AI plays the customer"
            className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
              reversed ? 'border-ink bg-surface2 text-ink' : 'border-line text-ink3 hover:text-ink2'
            }`}
          >
            <RefreshCw size={12} /> {reversed ? 'You serve' : 'Swap roles'}
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <RateSlider rate={ttsRate} onChange={onTtsRate} />
            {history.length > 0 && (
              <button
                onClick={onEndSession}
                className="btn btn-secondary shrink-0 min-h-8 px-2.5 rounded-lg text-[11px] whitespace-nowrap"
              >
                End session
              </button>
            )}
          </div>
        </div>
      </div>

      <ScenarioPicker
        open={pickerOpen}
        activeId={scenario.id}
        onPick={changeScenario}
        onClose={() => setPickerOpen(false)}
      />

      {/* transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto nice-scroll px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4" role="log" aria-live="polite" aria-busy={phase === 'thinking'}>
        <AiBubble text={scenario.opener} translation={scenario.openerTranslation} ttsRate={ttsRate} />
        {history.length === 0 && <HowItWorks language={target.name} />}
        {history.map((turn, i) => (
          <div key={i} className="space-y-4">
            <UserBubble turn={turn} onGrammarTip={onGrammarTip} apiKey={apiKey} mockMode={mockMode} level={level} />
            {turn.curveball && <CurveballDivider />}
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
          <p role="alert" className="fade-in text-xs text-danger bg-dangersoft border border-danger/40 rounded-xl px-3 py-2">
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

      {/* heads-up: the scenario throws its curveball at the learner next turn */}
      {history.length === CURVEBALL_TURN - 1 && !busy && (
        <p className="fade-in mx-4 mb-2 flex items-center justify-center gap-1.5 text-[11px] text-ink3">
          <Sparkles size={12} /> Brace yourself — this turn comes with a curveball.
        </p>
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
                className="min-h-11 w-20 rounded-xl text-sm text-ink2 hover:text-ink"
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
              <span className="w-20" aria-hidden="true" />
            </div>
            <p className="text-center text-[11px] text-ink3">3.5 s of silence sends it automatically</p>
          </div>
        ) : phase === 'editing' ? (
          <div className="space-y-2 fade-in">
            <p className="text-[11px] text-ink2 font-medium">Check your transcription before sending:</p>
            {spoken && (
              <p className="text-[11px] text-review bg-reviewsoft rounded-lg px-2.5 py-1.5" role="status">
                {spoken.fillers > 0
                  ? <>Coach: you hesitated on «{spoken.fillerWords.join('», «')}» — try to land the phrase in one breath.</>
                  : <>Coach: that came out fast ({spoken.wpm} wpm) — a slightly slower pace reads clearer.</>}
              </p>
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              lang={target.id}
              className="w-full bg-surface2 border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink resize-none"
              aria-label="Transcription to review"
            />
            <div className="flex gap-2">
              <button onClick={() => { setDraft(''); setSpoken(null); setPhase('idle'); }} className="min-h-11 px-4 rounded-xl text-sm text-ink2 hover:text-ink">
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
            <div className="flex-1 min-w-0 flex items-center gap-1 bg-surface2 rounded-xl border border-line focus-within:border-ink px-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(draft)}
                placeholder={busy ? '…' : `Or type in ${langName()}…`}
                disabled={busy}
                lang={target.id}
                className="flex-1 min-w-0 bg-transparent py-3 text-sm text-ink placeholder:text-ink3 focus:outline-none"
                aria-label="Typed reply"
              />
              {draft.trim() && (
                <button onClick={() => send(draft)} disabled={busy} aria-label="Send" className="text-ink px-1 min-h-11 grid place-items-center shrink-0"><ArrowRight size={16} /></button>
              )}
            </div>
            <button
              onClick={recorder.start}
              disabled={busy}
              aria-label="Record my reply"
              title="Record my reply"
              className="btn btn-primary w-12 h-12 shrink-0 rounded-full p-0"
            >
              {phase === 'transcribing' ? <span className="w-5 h-5 rounded-full border-2 border-onaccent border-t-transparent animate-spin" /> : <Mic size={20} />}
            </button>
          </div>
        )}
        {recorder.error && (
          <p role="alert" className="mt-2 text-[11px] text-danger bg-dangersoft border border-danger/40 rounded-lg px-2.5 py-1.5">
            {recorder.error}
          </p>
        )}
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
      {activeLanguage().id.toUpperCase()}
    </span>
  );
}

// Marks the scripted twist so the jump in the conversation reads as designed
// rather than as the model losing the thread.
function CurveballDivider() {
  return (
    <div className="flex items-center gap-2.5 fade-in" role="separator" aria-label="Curveball">
      <span className="h-px flex-1 bg-line" />
      <span className="pill text-[10px] uppercase tracking-wider text-ink">
        <Sparkles size={11} /> Curveball
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

// Shown until the first reply lands: the transcript is otherwise a wall of
// empty space, and nothing on screen says what the three controls below do.
function HowItWorks({ language }) {
  const steps = [
    [Mic, <>Tap the mic and answer out loud — you can fix the transcription before it sends.</>],
    [Lightbulb, <>Stuck? <span className="font-semibold">Hint</span> opens up in three steps, from vocabulary to a full sentence.</>],
    [Volume, <>Every reply can be replayed or translated, and each of yours gets corrections and a native version.</>],
  ];
  return (
    <div className="fade-in rounded-xl border border-line bg-surface2 px-3.5 py-3 space-y-2">
      <p className="text-xs font-semibold text-ink">Your turn — reply in {language}</p>
      <ul className="space-y-1.5">
        {steps.map(([StepIcon, text], i) => (
          <li key={i} className="flex items-start gap-2 text-[11px] text-ink2 leading-snug">
            <StepIcon size={13} className="mt-0.5 text-ink3" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AiBubble({ text, translation, ttsRate }) {
  const [showTranslation, setShowTranslation] = useState(false);
  return (
    <div className="flex items-end gap-2 max-w-[88%] sm:max-w-[75%] bubble-in">
      <Avatar />
      <div className="bg-surface2 rounded-2xl rounded-bl-md px-4 py-3 space-y-2">
        <p className="text-[15px] text-ink leading-relaxed" lang={activeLanguage().id}>{text}</p>
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

function UserBubble({ turn, onGrammarTip, apiKey, mockMode, level }) {
  const [expanded, setExpanded] = useState(false);
  const { evaluation } = turn;
  return (
    <div className="flex flex-col items-end gap-1.5 bubble-in">
      <div className="flex items-end gap-2 max-w-[88%] sm:max-w-[75%]">
        <div className="bg-accent rounded-2xl rounded-br-md px-4 py-3 shadow-md shadow-black/15">
          <p className="text-[15px] text-onaccent leading-relaxed" lang={activeLanguage().id}>{turn.userText}</p>
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
            <ExplainRule turn={turn} apiKey={apiKey} mockMode={mockMode} level={level} />
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink mb-1">Like a native</h4>
            <p className="text-[13px] text-ink italic" lang={activeLanguage().id}>{evaluation.native_alternative}</p>
            <SpeakButton text={evaluation.native_alternative} slow label="Listen" />
          </div>
          {(() => {
            const tipTopic = getGrammarTopic(evaluation.grammar_topic);
            return tipTopic ? (
              <button
                onClick={() => onGrammarTip?.(tipTopic.id)}
                className="w-full flex items-center gap-2.5 bg-surface border border-line rounded-xl px-3.5 py-2.5 text-left hover:border-ink3 transition-colors"
              >
                <Book size={14} className="text-ink2 shrink-0" />
                <span className="flex-1 text-xs text-ink">
                  <span className="font-semibold">Grammar tip:</span> this looks like{' '}
                  {/* the grammar library is French-only, whatever the target language */}
                  <span lang="fr" className="font-semibold">{tipTopic.title}</span> — review the lesson
                </span>
                <ArrowRight size={13} className="text-ink3 shrink-0" />
              </button>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

// On-demand deep dive: asks the LLM to explain the underlying rule behind
// this turn's corrections, in plain English with an extra example.
function ExplainRule({ turn, apiKey, mockMode, level }) {
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setExplanation(await explainMistake(apiKey, {
        userText: turn.userText,
        corrections: turn.evaluation.corrections,
        level,
        mock: mockMode,
      }));
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(false);
  };

  if (explanation) {
    return (
      <div className="fade-in mt-2 bg-surface border border-line rounded-xl px-3.5 py-2.5">
        <h5 className="text-[10px] font-bold uppercase tracking-wider text-ink3 mb-1">The rule behind it</h5>
        <Markdown className="text-xs text-ink leading-relaxed">{explanation}</Markdown>
      </div>
    );
  }
  if (busy) return <div className="mt-2"><Spinner label="Digging into the rule…" /></div>;
  return (
    <div className="mt-1.5">
      <button onClick={run} className="flex items-center gap-1.5 text-[11px] font-semibold text-ink2 hover:text-ink min-h-8">
        <Lightbulb size={13} /> Why? Explain the rule
      </button>
      {error && <p role="alert" className="text-xs text-ink">{error}</p>}
    </div>
  );
}
