import { useEffect, useRef, useState } from 'react';
import useRecorder from '../hooks/useRecorder';
import Waveform from './Waveform';
import { SCENARIOS } from '../lib/data';
import { transcribe, evaluateTurn, getHint } from '../lib/groq';
import { Markdown, ScoreBadge, SpeakButton, RateSlider, Spinner } from './ui';
import { speak } from '../lib/tts';

const CURVEBALL_TURN = 3; // the surprise lands on the learner's 3rd turn

export default function ChatArena({ apiKey, mockMode, ttsRate, onTtsRate, onTurn, history, setHistory, scenario, setScenario }) {
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
    const level = Math.min(3, hintLevel + 1);
    setHintLoading(true);
    setHintLevel(level);
    try {
      const lastAiReply = history.length ? history[history.length - 1].reply : scenario.opener;
      const h = await getHint(apiKey, { scenario, lastAiReply, level, mock: mockMode });
      setHint(h);
    } catch {
      setHint(scenario.staticHints[level - 1]); // offline fallback
    }
    setHintLoading(false);
  };

  const busy = phase === 'transcribing' || phase === 'thinking';

  return (
    <div className="flex flex-col h-full">
      {/* scenario card rail */}
      <div className="border-b border-slate-800/80 bg-slate-900/50 px-3 pt-2.5 pb-2 space-y-1.5">
        <div className="snap-rail flex gap-2 overflow-x-auto" role="group" aria-label="Choix du scénario">
          {SCENARIOS.map((s) => {
            const active = s.id === scenario.id;
            return (
              <button
                key={s.id}
                onClick={() => changeScenario(s.id)}
                aria-pressed={active}
                className={`shrink-0 flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-2xl border-2 border-b-4 text-left transition-colors ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-700/70 bg-slate-800/60 hover:border-slate-500'
                }`}
              >
                <span className="text-2xl" aria-hidden="true">{s.emoji}</span>
                <span className={`text-xs font-extrabold whitespace-nowrap ${active ? 'text-emerald-300' : 'text-slate-300'}`}>
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
        <p className="text-center text-[11px] text-slate-500 max-w-sm mx-auto">{scenario.setup}</p>
        <AiBubble text={scenario.opener} translation={scenario.openerTranslation} ttsRate={ttsRate} />
        {history.map((turn, i) => (
          <div key={i} className="space-y-4">
            <UserBubble turn={turn} />
            {turn.curveball && (
              <p className="text-center text-[11px] text-amber-400/90 font-semibold tracking-wide uppercase">
                ⚡ Imprévu !
              </p>
            )}
            <AiBubble text={turn.evaluation.reply} translation={turn.evaluation.translation} ttsRate={ttsRate} />
          </div>
        ))}
        {phase === 'thinking' && (
          <div className="flex items-end gap-2 bubble-in" aria-label="Votre partenaire écrit…">
            <Avatar />
            <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3.5 flex gap-1.5">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        </div>
      </div>

      {/* hint strip */}
      {(hint || hintLoading) && (
        <div className="mx-4 sm:max-w-2xl sm:mx-auto sm:w-full mb-2 fade-in rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2">
          {hintLoading
            ? <Spinner label={`Indice ${hintLevel}/3…`} />
            : <p className="text-xs text-amber-200"><span className="font-bold">💡 Indice {hintLevel}/3 :</span> {hint}</p>}
        </div>
      )}

      {/* composer */}
      <div className="border-t border-slate-800/80 bg-slate-900/70 px-4 pt-3 pb-safe">
        <div className="max-w-2xl mx-auto">
        {recorder.recording ? (
          <div className="space-y-2">
            <Waveform analyserRef={recorder.analyserRef} peakDb={recorder.peakDb} elapsed={recorder.elapsed} />
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={recorder.cancel}
                className="min-h-11 px-4 rounded-xl text-sm text-slate-400 hover:text-slate-200"
              >
                Annuler
              </button>
              <button
                onClick={recorder.stop}
                aria-label="Arrêter et envoyer"
                className="rec-pulse w-16 h-16 rounded-full bg-rose-500 text-white text-2xl grid place-items-center active:scale-90 transition"
              >
                ◼
              </button>
              <span className="text-[11px] text-slate-500 w-20">3,5 s de silence = envoi auto</span>
            </div>
          </div>
        ) : phase === 'editing' ? (
          <div className="space-y-2 fade-in">
            <p className="text-[11px] text-slate-400 font-medium">✏️ Vérifiez votre transcription avant l'envoi :</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              className="w-full bg-slate-800 border border-emerald-500/40 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-400 resize-none"
              aria-label="Transcription à vérifier"
            />
            <div className="flex gap-2">
              <button onClick={() => { setDraft(''); setPhase('idle'); }} className="min-h-11 px-4 rounded-xl text-sm text-slate-400 hover:text-slate-200">
                Refaire
              </button>
              <button
                onClick={() => send(draft)}
                disabled={!draft.trim()}
                className="btn-3d btn-3d-emerald flex-1 min-h-11 rounded-2xl font-extrabold text-sm"
              >
                Envoyer →
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <button
              onClick={askHint}
              disabled={busy || hintLevel >= 3}
              className="btn-3d btn-3d-amber min-h-11 px-3 rounded-2xl border text-xs font-extrabold whitespace-nowrap"
            >
              💡 {hintLevel === 0 ? 'Un indice' : `Indice ${Math.min(3, hintLevel + 1)}/3`}
            </button>
            <div className="flex-1 flex items-center gap-2 bg-slate-800 rounded-xl border border-slate-700 focus-within:border-emerald-500 px-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(draft)}
                placeholder={busy ? '…' : 'Ou écrivez en français…'}
                disabled={busy}
                className="flex-1 bg-transparent py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
                aria-label="Réponse écrite"
              />
              {draft.trim() && (
                <button onClick={() => send(draft)} disabled={busy} aria-label="Envoyer" className="text-emerald-400 font-bold px-1 min-h-11">→</button>
              )}
            </div>
            <button
              onClick={recorder.start}
              disabled={busy}
              aria-label="Enregistrer ma réponse"
              className="btn-3d btn-3d-emerald w-14 h-14 rounded-full text-xl grid place-items-center shadow-lg shadow-emerald-500/25"
            >
              {phase === 'transcribing' ? <span className="w-5 h-5 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" /> : '🎙️'}
            </button>
          </div>
        )}
        {recorder.error && <p role="alert" className="text-[11px] text-rose-400 mt-2">{recorder.error}</p>}
        </div>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <span
      className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-600/30 border border-emerald-500/40 grid place-items-center text-lg mb-1"
      aria-hidden="true"
    >
      🇫🇷
    </span>
  );
}

function AiBubble({ text, translation, ttsRate }) {
  const [showTranslation, setShowTranslation] = useState(false);
  return (
    <div className="flex items-end gap-2 max-w-[88%] sm:max-w-[75%] bubble-in">
      <Avatar />
      <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 space-y-2">
        <p className="text-[15px] text-slate-100 leading-relaxed">{text}</p>
        {showTranslation && <p className="text-xs text-slate-400 italic border-t border-slate-700 pt-2">{translation}</p>}
        <div className="flex items-center gap-2">
          <SpeakButton text={text} rate={ttsRate} label="Rejouer" />
          <button
            onClick={() => setShowTranslation((v) => !v)}
            className="text-[11px] text-slate-400 hover:text-slate-200 min-h-8 px-1"
          >
            {showTranslation ? 'Cacher' : '🇬🇧 Traduire'}
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
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl rounded-br-md px-4 py-3 shadow-md shadow-emerald-900/40">
          <p className="text-[15px] text-white leading-relaxed">{turn.userText}</p>
        </div>
        <ScoreBadge value={evaluation.scores.overall} />
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[11px] text-slate-400 hover:text-emerald-300 min-h-8 px-1"
      >
        {expanded ? '▲ Masquer le feedback' : '▼ Corrections & version native'}
      </button>
      {expanded && (
        <div className="w-full sm:max-w-[85%] fade-in bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3 text-left">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-teal-300 mb-1">Corrections</h4>
            <Markdown className="text-[13px] text-slate-200 leading-relaxed">{evaluation.corrections}</Markdown>
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Comme un natif 🇫🇷</h4>
            <p className="text-[13px] text-slate-200 italic">{evaluation.native_alternative}</p>
            <SpeakButton text={evaluation.native_alternative} slow label="Écouter" />
          </div>
        </div>
      )}
    </div>
  );
}
