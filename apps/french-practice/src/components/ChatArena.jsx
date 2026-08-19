import { useEffect, useRef, useState } from 'react';
import { langName } from '../lib/i18n';
import useRecorder from '../hooks/useRecorder';
import Waveform from './Waveform';
import { getScenarios } from '../lib/data';
import { transcribe, evaluateTurn, evaluateRedoTurn, getHint, explainMistake, friendlyError } from '../lib/groq';
import { scoreDelta, redoVerdict } from '../lib/redo';
import { speechMetrics } from '../lib/analytics';
import { activeLanguage } from '../lib/i18n';
import {
  getSrs, getSessions, getMetrics, getReviewEvents, getGrammarProgress, getEvidenceLedgerModel,
  getSettings, recordGrammarError, recordWeaknessError, recordWeaknessRepair, getDueWeaknesses, getLearnerBrief,
} from '../lib/storage';
import { allEntries } from '../lib/vocab';
import { GRAMMAR_TOPICS } from '../lib/grammar';
import { buildLearningPlan } from '../lib/learningAdaptation';
import { Markdown, ScoreBadge, SpeakButton, RateSlider, Spinner } from './ui';
import { speak } from '../lib/tts';
import { ArrowRight, Book, Lightbulb, Mic, Square, scenarioIcon } from './icons';
import { getGrammarTopic } from '../lib/grammar';
import ScenarioPicker from './ScenarioPicker';

const CURVEBALL_TURN = 3; // the surprise lands on the learner's 3rd turn

function readSessionBudget() {
  try {
    const m = +sessionStorage.getItem('fp.sessionMins');
    if (m === 5 || m === 10 || m === 15) return m * 60;
  } catch { /* ignore */ }
  return null;
}

export default function ChatArena({ apiKey, mockMode, ttsRate, level, onTtsRate, onTurn, onGrammarTip, history, setHistory, scenario, setScenario, onEndSession }) {
  const [phase, setPhase] = useState('idle'); // idle | transcribing | editing | thinking
  const [draft, setDraft] = useState(''); // transcription editor / manual text
  const [spoken, setSpoken] = useState(null); // delivery coaching for a voice turn
  const [hintLevel, setHintLevel] = useState(0);
  const [hint, setHint] = useState('');
  const [hintLoading, setHintLoading] = useState(false);
  const [error, setError] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(readSessionBudget);
  // Active redo: idx of the turn being retried. While set, the correction
  // for that turn is hidden so the learner must recall it.
  const [redoIdx, setRedoIdx] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [weaknessDue, setWeaknessDue] = useState(() => getDueWeaknesses()[0] || null);
  const scrollRef = useRef(null);

  // Honour Home's 5/10/15 min presets: countdown only, never auto-sends speech.
  useEffect(() => {
    if (secondsLeft == null) return undefined;
    if (secondsLeft <= 0) {
      try { sessionStorage.removeItem('fp.sessionMins'); } catch { /* ignore */ }
      onEndSession?.();
      return undefined;
    }
    const id = setInterval(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft, onEndSession]);

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

  const changeScenario = (id) => {
    const s = getScenarios().find((x) => x.id === id);
    if (!s) return;
    setScenario(s);
    setHistory([]);
    setHint('');
    setHintLevel(0);
    setError(null);
    setPhase('idle');
    setRedoIdx(null);
    setPickerOpen(false);
    // If this scenario targets a due weakness, count it as a deliberate retest attempt
    const due = weaknessDue;
    if (due && due.topicId) {
      // Mark the retest as started; outcome is recorded on next error/repair
      try { window.dispatchEvent(new CustomEvent('fp:retest-start', { detail: { topicId: due.topicId, scenarioId: id } })); } catch { /* ignore */ }
    }
    setWeaknessDue(getDueWeaknesses()[0] || null);
  };

  const send = async (text) => {
    const userText = text.trim();
    if (!userText || phase === 'thinking') return;
    // Redo path: re-evaluate the same turn with correction hidden
    if (redoIdx != null) {
      const idx = redoIdx;
      const original = history[idx];
      if (!original) { setRedoIdx(null); return; }
      setDraft('');
      setSpoken(null);
      setPhase('thinking');
      setError(null);
      try {
        const redoEval = await evaluateRedoTurn(apiKey, {
          scenario,
          historyBefore: history.slice(0, idx),
          originalText: original.userText,
          retryText: userText,
          level,
          mock: mockMode,
        });
        if (redoEval.grammar_topic) {
          recordGrammarError(redoEval.grammar_topic);
          recordWeaknessError(redoEval.grammar_topic, { scenarioId: scenario.id });
        }
        // Repair signal: successful redo counts as evidence the learner recovered the form
        if (original.evaluation?.grammar_topic) {
          const improved = (redoEval.scores?.overall ?? 0) > (original.evaluation.scores?.overall ?? 0);
          if (improved) recordWeaknessRepair(original.evaluation.grammar_topic, { scenarioId: scenario.id, passed: true });
        }
        const { deltas, deltaOverall } = scoreDelta(original.evaluation.scores, redoEval.scores);
        const verdict = redoVerdict(deltaOverall);
        const redo = { retryText: userText, evaluation: redoEval, deltas, deltaOverall, verdict, note: redoEval.redo_note };
        setHistory((h) => h.map((t, i) => (i === idx ? { ...t, redo } : t)));
        onTurn(redoEval.scores);
        speak(redoEval.reply, { rate: ttsRate });
      } catch (e) {
        setError(friendlyError(e));
        setDraft(userText);
        setPhase('editing');
        return;
      }
      setRedoIdx(null);
      setPhase('idle');
      return;
    }
    setDraft('');
    setSpoken(null);
    setHint('');
    setHintLevel(0);
    setPhase('thinking');
    setError(null);
    const turnNumber = history.length + 1;
    try {
      const learner = getLearnerBrief();
      const learningPlan = buildLearningPlan({
        level,
        entries: allEntries(),
        srs: getSrs(),
        sessions: getSessions(),
        metrics: getMetrics(),
        reviewEvents: getReviewEvents(),
        grammarTopics: GRAMMAR_TOPICS,
        grammarProgress: getGrammarProgress(),
        errorModel: getEvidenceLedgerModel(),
        correctionFrequency: getSettings().correctionFrequency,
        confidence: learner.errorQueue?.length ? 0.45 : 0.55,
        userRate: ttsRate,
        userText,
      });
      const evaluation = await evaluateTurn(apiKey, {
        scenario,
        history,
        userText,
        curveball: turnNumber === CURVEBALL_TURN ? scenario.curveball : null,
        level,
        knownWords: learningPlan.input.knownWords,
        learningPlan,
        reversed,
        learner,
        mock: mockMode,
      });
      if (evaluation.grammar_topic) recordWeaknessError(evaluation.grammar_topic, { scenarioId: scenario.id });
      if (evaluation.grammar_topic) recordGrammarError(evaluation.grammar_topic);
      const turn = {
        userText,
        evaluation,
        reply: evaluation.reply,
        curveball: turnNumber === CURVEBALL_TURN,
        correctionPolicy: learningPlan.correction,
        learningSnapshot: {
          targetLevel: learningPlan.progression.targetLevel,
          listeningStage: learningPlan.listening.stage,
          newWords: learningPlan.input.newWords,
          speechRate: learningPlan.speech.rate,
        },
      };
      setHistory((h) => [...h, turn]);
      onTurn(evaluation.scores);
      speak(evaluation.reply, { rate: learningPlan.speech.rate });
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

  return (
    <div className="flex flex-col h-full">
      {/* scenario card rail */}
      <div className="border-b border-line bg-surface px-3 pt-2.5 pb-2 space-y-1.5">
        <div className="snap-rail flex gap-2 overflow-x-auto" role="group" aria-label="Choose a scenario">
          {getScenarios().map((s) => {
            const active = s.id === scenario.id;
            const ScenarioIcon = scenarioIcon(s.id);
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
          <button onClick={() => setPickerOpen(true)} className="shrink-0 px-3.5 py-2.5 rounded-xl border border-dashed border-line bg-surface text-xs font-semibold text-ink2 hover:border-ink3 hover:text-ink whitespace-nowrap">Browse all {getScenarios().length} →</button>
        </div>
        <ScenarioPicker open={pickerOpen} activeId={scenario.id} onPick={changeScenario} onClose={() => setPickerOpen(false)} />
        {weaknessDue && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-center justify-between gap-2" role="status">
            <span className="text-xs text-ink"><span className="font-bold">Retest due:</span> {(() => { const t = getGrammarTopic(weaknessDue.topicId); return t ? t.title : weaknessDue.topicId; })()} — last slip {Math.max(1, Math.round((Date.now() - new Date(weaknessDue.lastErrorAt).getTime())/86400000))}d ago. Practise it again?</span>
            <button onClick={() => changeScenario(scenario.id)} className="shrink-0 text-xs font-semibold text-amber-800 underline">Keep this scenario</button>
          </div>
        )}
        <div className="flex items-center justify-between pr-1 gap-2">
          <button
            onClick={() => { setReversed((v) => !v); setHistory([]); setHint(''); setHintLevel(0); setPhase('idle'); }}
            aria-pressed={reversed}
            title="Swap roles: you play the professional, the AI plays the customer"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
              reversed ? 'border-ink bg-surface2 text-ink' : 'border-line text-ink3 hover:text-ink2'
            }`}
          >
            🔄 {reversed ? 'Roles swapped — you serve' : 'Swap roles'}
          </button>
          <div className="flex items-center gap-2">
            {secondsLeft != null && (
              <span
                className={`tabular-nums text-[11px] font-bold px-2 py-1 rounded-lg border ${
                  secondsLeft <= 60 ? 'border-ink text-ink bg-surface2' : 'border-line text-ink3'
                }`}
                title="Session timer from Home preset"
                aria-live="polite"
              >
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </span>
            )}
            <RateSlider rate={ttsRate} onChange={onTtsRate} />
          </div>
        </div>
      </div>

      {/* transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto nice-scroll px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
        <p className="text-center text-[11px] text-ink3 max-w-sm mx-auto">{scenario.setup}</p>
        <AiBubble text={scenario.opener} translation={scenario.openerTranslation} ttsRate={ttsRate} />
        {redoIdx != null && history[redoIdx] && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-ink" role="status">
            <span className="font-bold">Redo mode</span> — correction hidden. Recall the fix from memory, then re-speak or re-type the same turn. We’ll compare the two attempts.
          </div>
        )}
        {history.map((turn, i) => (
          <div key={i} className="space-y-4">
            <UserBubble
              turn={turn}
              idx={i}
              redoActive={redoIdx === i}
              onRedo={(idx) => { setRedoIdx(idx); setDraft(''); setSpoken(null); setError(null); setPhase('idle'); }}
              onCancelRedo={() => setRedoIdx(null)}
              onGrammarTip={onGrammarTip}
              apiKey={apiKey}
              mockMode={mockMode}
              level={level}
              correctionPolicy={turn.correctionPolicy}
            />
            {turn.curveball && (
              <p className="text-center text-[11px] text-ink/90 font-semibold tracking-wide uppercase">
                Curveball
              </p>
            )}
            <AiBubble text={turn.evaluation.reply} translation={turn.evaluation.translation} ttsRate={ttsRate} />
            {turn.redo && <RedoCompare redo={turn.redo} before={turn.evaluation.scores} idx={i} />}
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
        {redoIdx != null && phase === 'idle' && !recorder.recording && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
            <span className="text-xs text-ink"><span className="font-bold">Retrying turn {redoIdx + 1}</span> — say it again without peeking.</span>
            <button onClick={() => setRedoIdx(null)} className="text-xs font-semibold text-ink2 hover:text-ink min-h-8 px-2">Cancel redo</button>
          </div>
        )}
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
            <div className={`flex-1 flex items-center gap-2 rounded-xl border px-3 ${redoIdx != null ? 'bg-amber-50 border-amber-300 focus-within:border-amber-400' : 'bg-surface2 border-line focus-within:border-ink'}`}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(draft)}
                placeholder={busy ? '…' : redoIdx != null ? `Redo turn ${redoIdx + 1} — type your improved ${langName()}…` : `Or type in ${langName()}…`}
                disabled={busy}
                className="flex-1 bg-transparent py-3 text-sm text-ink placeholder:text-ink3 focus:outline-none"
                aria-label={redoIdx != null ? 'Retry reply' : 'Typed reply'}
              />
              {draft.trim() && (
                <button onClick={() => send(draft)} disabled={busy} aria-label={redoIdx != null ? 'Send retry' : 'Send'} className="text-ink px-1 min-h-11 grid place-items-center"><ArrowRight size={16} /></button>
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

function UserBubble({ turn, idx, redoActive, onRedo, onCancelRedo, onGrammarTip, apiKey, mockMode, level, correctionPolicy }) {
  const [expanded, setExpanded] = useState(false);
  const { evaluation } = turn;
  const feedbackOff = correctionPolicy?.preference === 'off';
  const redoHidden = redoActive && !expanded; // correction collapsed while redo active
  return (
    <div className="flex flex-col items-end gap-1.5 bubble-in">
      <div className="flex items-end gap-2 max-w-[88%] sm:max-w-[75%]">
        <div className={`rounded-2xl rounded-br-md px-4 py-3 shadow-md shadow-black/15 ${turn.redo ? 'bg-ink text-bg' : 'bg-accent text-onaccent'}`}> 
          <p className={`text-[15px] leading-relaxed ${turn.redo ? 'text-bg' : 'text-onaccent'}`} lang="fr">{turn.userText}</p>
        </div>
        <ScoreBadge value={evaluation.scores.overall} />
      </div>
      <div className="flex items-center gap-2">
        {!feedbackOff ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-ink2 hover:text-ink min-h-8 px-1"
          >
            {expanded ? 'Hide feedback' : correctionPolicy?.timing === 'delayed' ? 'Review saved feedback' : 'Corrections & native version'}
          </button>
        ) : <span className="text-[11px] text-ink3 min-h-8 px-1 grid place-items-center">Feedback off</span>}
        {!turn.redo && (
          redoActive ? (
            <button onClick={onCancelRedo} className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 min-h-8 px-2 rounded-lg bg-amber-50 border border-amber-200">Cancel redo</button>
          ) : (
            <button onClick={() => onRedo(idx)} className="text-[11px] font-semibold text-ink2 hover:text-ink min-h-8 px-2 rounded-lg border border-line bg-surface hover:border-ink3">Redo this turn →</button>
          )
        )}
      </div>
      {expanded && (
        <div className="w-full sm:max-w-[85%] fade-in bg-surface2 border border-line rounded-2xl p-4 space-y-3 text-left">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-1">Corrections</h4>
            <Markdown className="text-[13px] text-ink leading-relaxed">{evaluation.corrections}</Markdown>
            <ExplainRule turn={turn} apiKey={apiKey} mockMode={mockMode} level={level} />
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink mb-1">Like a native</h4>
            <p className="text-[13px] text-ink italic" lang="fr">{evaluation.native_alternative}</p>
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
                  <span lang="fr" className="font-semibold">{tipTopic.title}</span> — review the lesson
                </span>
                <ArrowRight size={13} className="text-ink3 shrink-0" />
              </button>
            ) : null;
          })()}
        </div>
      )}
      {redoActive && !expanded && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 w-full sm:max-w-[85%] text-left">
          Correction hidden — redo the turn from memory. Open feedback only after you retry.
        </p>
      )}
    </div>
  );
}

function RedoCompare({ redo, before, idx }) {
  const sign = (n) => (n > 0 ? `+${n}` : String(n));
  const tone = redo.deltaOverall > 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : redo.deltaOverall < 0 ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-ink2 bg-surface2 border-line';
  return (
    <div className={`fade-in rounded-2xl border px-4 py-3 space-y-2 text-left sm:max-w-[85%] ml-auto w-full ${tone}`}> 
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider">Redo — turn {idx + 1}</h4>
        <span className={`text-xs font-black tabular-nums ${redo.deltaOverall > 0 ? 'text-emerald-700' : redo.deltaOverall < 0 ? 'text-amber-700' : 'text-ink2'}`}>{sign(redo.deltaOverall)} overall</span>
      </div>
      <p className="text-xs leading-relaxed"><span className="font-semibold">Retry:</span> <span lang="fr">“{redo.retryText}”</span></p>
      <p className="text-xs leading-relaxed italic">{redo.verdict}{redo.note ? ` — ${redo.note}` : ''}</p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {Object.entries(redo.deltas).map(([k, v]) => (
          <span key={k} className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${v > 0 ? 'bg-emerald-100 border-emerald-200 text-emerald-800' : v < 0 ? 'bg-amber-100 border-amber-200 text-amber-800' : 'bg-surface border-line text-ink3'}`}>
            {k} {sign(v)}
          </span>
        ))}
      </div>
      <div className="flex gap-2 text-[11px] text-ink2">
        <span>Before {before.overall}</span><span aria-hidden="true">→</span><span className="font-bold text-ink">Retry {redo.evaluation.scores.overall}</span>
      </div>
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
