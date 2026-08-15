import { useCallback, useEffect, useMemo, useState } from 'react';
import useRecorder from '../hooks/useRecorder';
import { transcribe, friendlyError } from '../lib/groq';
import { speak } from '../lib/tts';
import { recordSkillScore } from '../lib/storage';
import {
  BOARDS, CRITERIA, TASK_CRITERIA, TIER, boardList, specCaveat,
} from '../lib/exams/boards.js';
import {
  PHASE, buildPaper, initRun, beginPrep, beginSpeaking, timeLeft, phaseAllowance,
  notesAllowed, completeSection, scoreTask, scorePaper, gradeEstimate, examFeedback,
  benchmarkExaminer, EXAMINER_SCRIPTS,
} from '../lib/exams/simulator.js';
import { availableThemes } from '../lib/exams/tasks.js';
import { Clock, Mic, Square, GraduationCap, ChevronRight, Check } from './icons';
import { Spinner } from './ui';

// The exam simulator.
//
// The clock is the feature. Candidates lose marks for running short far more
// often than for being wrong, so the timer runs for real: it does not pause
// when you panic, and the report tells you exactly how much of your allowance
// you left on the table.

const fmt = (s) => {
  if (s === null || s === undefined) return '—';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

export default function ExamSimulator({ apiKey, mockMode, onXp, onActivity }) {
  const [boardId, setBoardId] = useState('wjec-gcse');
  const [tier, setTier] = useState(TIER.HIGHER);
  const [theme, setTheme] = useState('');
  const [mode, setMode] = useState('full');
  const [run, setRun] = useState(null);
  const [scores, setScores] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const board = BOARDS[boardId];
  const themes = useMemo(() => availableThemes(), []);

  const start = () => {
    try {
      const paper = buildPaper({ boardId, tier, mode, theme: theme || null });
      setRun(initRun(paper));
      setScores({});
      setError(null);
      onActivity?.('exam', boardId, `${board.name} speaking`);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!run) {
    return (
      <Setup
        board={board} boardId={boardId} setBoardId={setBoardId}
        tier={tier} setTier={setTier} theme={theme} setTheme={setTheme}
        themes={themes} mode={mode} setMode={setMode} onStart={start} error={error}
      />
    );
  }

  if (run.phase === PHASE.REVIEW || run.phase === PHASE.DONE) {
    return (
      <Review
        run={run} scores={scores} setScores={setScores}
        onRestart={() => setRun(null)} onXp={onXp}
      />
    );
  }

  return (
    <Sitting
      run={run} setRun={setRun} apiKey={apiKey} mockMode={mockMode}
      busy={busy} setBusy={setBusy} onAbort={() => setRun(null)}
    />
  );
}

// ------------------------------------------------------------------ setup ---

function Setup({ board, boardId, setBoardId, tier, setTier, theme, setTheme, themes, mode, setMode, onStart, error }) {
  const bench = benchmarkExaminer(EXAMINER_SCRIPTS);
  return (
    <div className="h-full overflow-y-auto nice-scroll px-[22px] py-6">
      <div className="max-w-[820px] mx-auto space-y-5">
        <header className="text-center space-y-1">
          <GraduationCap className="w-7 h-7 mx-auto text-ink2" />
          <h2 className="text-xl font-bold">Exam simulator</h2>
          <p className="text-sm text-ink2">Speaking tests under real timings — role-play, photo card and conversation.</p>
        </header>

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <Field label="Board">
            <div className="grid grid-cols-2 gap-2">
              {boardList().map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setBoardId(b.id); if (!b.tiers.length) setTier(TIER.HIGHER); }}
                  className={`text-left rounded-xl border px-3 py-2 text-sm transition ${boardId === b.id ? 'border-ink bg-ink text-bg' : 'border-line hover:border-ink2'}`}
                >
                  <span className="font-semibold block">{b.name}</span>
                  <span className={`text-[11px] ${boardId === b.id ? 'opacity-80' : 'text-ink2'}`}>{b.qualification} · {b.country}</span>
                </button>
              ))}
            </div>
          </Field>

          {board.tiers.length > 0 && (
            <Field label="Tier">
              <Segmented
                options={board.tiers.map((t) => ({ id: t, label: t === TIER.FOUNDATION ? 'Foundation' : 'Higher' }))}
                value={tier}
                onChange={setTier}
              />
            </Field>
          )}

          <Field label="Mode">
            <Segmented
              options={[
                { id: 'full', label: 'Full paper' },
                { id: 'single', label: 'One task' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </Field>

          <Field label="Theme (optional)">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full bg-bg border border-line rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Any theme (as in the real exam)</option>
              {themes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </section>

        <section className="bg-surface border border-line rounded-2xl p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">This paper</h3>
          <ul className="mt-2 space-y-1.5">
            {board.tasks.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">{t.label}</span>
                <span className="text-ink2 text-xs text-right">{t.blurb}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink2 mt-3">Supervised preparation: {fmt(board.prepTotal)}.</p>
        </section>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button onClick={onStart} className="w-full bg-ink text-bg font-bold rounded-[14px] px-5 py-3 text-sm hover:opacity-90 transition">
          Start under exam conditions
        </button>

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Before you rely on this</h3>
          <p className="text-xs text-ink2">{specCaveat(boardId)}</p>
          <p className="text-xs text-ink2">
            Marks here are practice feedback, not a predicted grade. {bench.message}
          </p>
        </section>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <label className="block space-y-1.5">
    <span className="text-[11px] font-bold uppercase tracking-wider text-ink2">{label}</span>
    {children}
  </label>
);

function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-line overflow-hidden">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-4 py-2 text-sm font-semibold transition ${value === o.id ? 'bg-ink text-bg' : 'hover:bg-surface2'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- sitting ---

function Sitting({ run, setRun, apiKey, mockMode, busy, setBusy, onAbort }) {
  const [, tick] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [spoken, setSpoken] = useState(0);
  const [error, setError] = useState(null);

  const section = run.paper.sections[run.sectionIndex];
  const left = timeLeft(run);
  const allowance = phaseAllowance(run);

  // One interval drives the display; the rules live in the pure module.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const { recording, elapsed, start: startRec, stop: stopRec, error: recError } = useRecorder({
    onComplete: async (blob) => {
      setBusy(true);
      setError(null);
      try {
        const text = await transcribe(apiKey, blob, { mock: mockMode });
        setTranscript((prev) => (prev ? `${prev} ${text}` : text));
      } catch (e) {
        setError(friendlyError ? friendlyError(e) : e.message);
      } finally {
        setBusy(false);
      }
    },
  });

  // Speaking time accumulates across push-to-talk bursts — the shortfall
  // figure has to count real speech, not the wall clock, or every thoughtful
  // pause would read as a lost mark.
  const finishBurst = useCallback(() => {
    stopRec();
    setSpoken((s) => s + elapsed);
  }, [stopRec, elapsed]);

  const next = () => {
    const updated = completeSection(run, { transcript, spokenSeconds: spoken });
    setTranscript('');
    setSpoken(0);
    setRun(updated);
  };

  if (run.phase === PHASE.BRIEFING) {
    return (
      <Shell title="Before you start" onAbort={onAbort}>
        <div className="space-y-3">
          <p className="text-sm">
            You will get <strong>{fmt(run.paper.prepSeconds)}</strong> of preparation, then each task runs to its own clock.
            You may keep notes for the role-play and photo card, but <strong>not</strong> for the conversation.
          </p>
          <ul className="space-y-1.5">
            {run.paper.sections.map((s) => (
              <li key={s.taskId} className="flex justify-between text-sm border-b border-line py-1.5 last:border-0">
                <span className="font-semibold">{s.label}</span>
                <span className="text-ink2">{fmt(s.seconds)} · {s.marks} marks</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink2">{run.paper.caveat}</p>
          <button onClick={() => setRun(beginPrep(run))} className="w-full bg-ink text-bg font-bold rounded-[14px] px-5 py-3 text-sm">
            Begin preparation
          </button>
        </div>
      </Shell>
    );
  }

  if (run.phase === PHASE.PREP) {
    return (
      <Shell title="Preparation" timer={left} allowance={allowance} onAbort={onAbort}>
        <div className="space-y-4">
          <p className="text-sm text-ink2">Read every task. Plan what you will say — but you cannot read a script aloud in the exam.</p>
          {run.paper.sections.map((s) => (
            <Material key={s.taskId} section={s} />
          ))}
          <button onClick={() => setRun(beginSpeaking(run))} className="w-full bg-ink text-bg font-bold rounded-[14px] px-5 py-3 text-sm">
            I am ready — start the first task
          </button>
        </div>
      </Shell>
    );
  }

  const overrun = left === 0;

  return (
    <Shell
      title={`${section.label} — ${run.sectionIndex + 1} of ${run.paper.sections.length}`}
      timer={left}
      allowance={allowance}
      onAbort={onAbort}
    >
      <div className="space-y-4">
        {notesAllowed(run)
          ? <Material section={section} />
          : (
            <div className="bg-surface2 border border-line rounded-xl p-3">
              <p className="text-sm font-semibold">Notes are not allowed in the conversation.</p>
              <p className="text-xs text-ink2 mt-1">The examiner will move between themes. Answer, then extend without being asked.</p>
              <ConversationPrompts material={section.material} />
            </div>
          )}

        <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink2">Your answer</span>
            <span className="text-xs text-ink2">Spoken {fmt(spoken + (recording ? elapsed : 0))} of {fmt(section.seconds)}</span>
          </div>

          <button
            onMouseDown={startRec}
            onMouseUp={finishBurst}
            onMouseLeave={() => recording && finishBurst()}
            onTouchStart={(e) => { e.preventDefault(); startRec(); }}
            onTouchEnd={(e) => { e.preventDefault(); finishBurst(); }}
            disabled={busy}
            className={`w-full rounded-[14px] px-5 py-4 text-sm font-bold transition select-none ${recording ? 'bg-red-500 text-white' : 'bg-ink text-bg hover:opacity-90'} disabled:opacity-50`}
          >
            {recording
              ? <><Square className="w-4 h-4 inline mr-2" />Release to stop — {fmt(elapsed)}</>
              : <><Mic className="w-4 h-4 inline mr-2" />Hold to speak</>}
          </button>
          <p className="text-[11px] text-ink2 text-center">Push-to-talk: hold while you speak, release when you pause. Bursts add up.</p>

          {busy && <Spinner label="Transcribing…" />}
          {(error || recError) && <p className="text-sm text-red-500">{error || recError}</p>}
          {transcript && (
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={4}
              className="w-full bg-bg border border-line rounded-xl px-3 py-2 text-sm"
              aria-label="Transcript of what you said"
            />
          )}
        </div>

        {overrun && (
          <p className="text-sm font-semibold text-amber-600">Time is up on this task. In the real exam the examiner would move on.</p>
        )}

        <button onClick={next} disabled={busy} className="w-full border border-line rounded-[14px] px-5 py-3 text-sm font-bold hover:border-ink2 transition disabled:opacity-50">
          {run.sectionIndex + 1 === run.paper.sections.length ? 'Finish and mark' : 'Next task'}
          <ChevronRight className="w-4 h-4 inline ml-1" />
        </button>
      </div>
    </Shell>
  );
}

function Shell({ title, timer, allowance, children, onAbort }) {
  const pct = allowance ? Math.max(0, Math.min(1, timer / allowance)) : 0;
  const low = allowance && timer <= Math.max(15, allowance * 0.15);
  return (
    <div className="h-full overflow-y-auto nice-scroll px-[22px] py-6">
      <div className="max-w-[820px] mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onAbort} className="text-xs text-ink2 hover:text-ink underline">Abandon</button>
        </div>
        {allowance != null && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${low ? 'text-red-500' : 'text-ink2'}`} />
              <span className={`font-mono text-lg font-bold ${low ? 'text-red-500' : ''}`}>{fmt(timer)}</span>
              <span className="text-xs text-ink2">of {fmt(allowance)}</span>
            </div>
            <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${low ? 'bg-red-500' : 'bg-ink'}`} style={{ width: `${pct * 100}%` }} />
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function Material({ section }) {
  const m = section.material;
  if (!m) return null;

  if (section.taskId === 'roleplay') {
    return (
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <h3 className="text-sm font-bold">{section.label}</h3>
        <p className="text-sm">{m.setting}</p>
        <p className="text-sm text-ink2 italic">{m.settingFr}</p>
        <ol className="space-y-1.5 mt-2">
          {m.prompts.map((p) => (
            <li key={p.id} className="text-sm flex gap-2">
              <span className="font-bold text-ink2">{p.unpredictable ? '!' : p.id}</span>
              <span>
                {p.en}
                {p.ask && <span className="ml-1 text-[11px] font-bold uppercase text-ink2">(you ask)</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (section.taskId === 'photocard') {
    return (
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <h3 className="text-sm font-bold">{m.title}</h3>
        <div className="bg-surface2 border border-line rounded-xl p-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink2">The photo</span>
          <p className="text-sm mt-1">{m.scene}</p>
        </div>
        <ul className="space-y-1.5">
          {m.questions.map((q, i) => (
            <li key={i} className="text-sm">
              <span className="font-semibold">{q.fr}</span>
              <span className="text-ink2 text-xs block">{q.en}{q.tense ? ` · ${q.tense} tense expected` : ''}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (section.taskId === 'reading-aloud') {
    return (
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <h3 className="text-sm font-bold">Read this aloud</h3>
        <p className="text-base leading-relaxed">{m.text}</p>
        <button onClick={() => speak(m.text, { rate: 0.9 })} className="text-xs underline text-ink2 hover:text-ink">
          Hear it first (practice only — not available in the exam)
        </button>
        <p className="text-xs text-ink2">{m.notes}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
      <h3 className="text-sm font-bold">{section.label}</h3>
      <ConversationPrompts material={m} />
    </div>
  );
}

function ConversationPrompts({ material }) {
  if (!material) return null;
  return (
    <div className="space-y-1.5 mt-2">
      <p className="text-sm font-semibold">{material.opening?.fr}</p>
      <p className="text-xs text-ink2">{material.opening?.en}</p>
      <ul className="mt-2 space-y-1">
        {(material.followUps || []).map((f, i) => (
          <li key={i} className="text-sm text-ink2">{f.fr}</li>
        ))}
        {material.stretch && <li className="text-sm text-ink2 italic">{material.stretch.fr}</li>}
      </ul>
      {material.candidateAsks && (
        <p className="text-xs font-semibold mt-2">Remember: {material.candidateAsks}</p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- review ---

function Review({ run, scores, setScores, onRestart, onXp }) {
  const [awarded, setAwarded] = useState(false);

  const taskScores = run.paper.sections.map((s) => scoreTask({
    boardId: run.paper.boardId,
    taskId: s.taskId,
    tier: run.paper.tier || TIER.HIGHER,
    scores: scores[s.taskId] || {},
  }));
  const paperScore = scorePaper({ boardId: run.paper.boardId, tier: run.paper.tier, taskScores });
  const grade = gradeEstimate(paperScore.percent, { board: run.paper.boardName });
  const notes = examFeedback(run, paperScore);

  const setCriterion = (taskId, criterion, value) => {
    setScores((prev) => ({ ...prev, [taskId]: { ...(prev[taskId] || {}), [criterion]: value } }));
  };

  const finish = () => {
    if (paperScore.percent !== null) {
      recordSkillScore('speaking', paperScore.percent);
      onXp?.(30);
    }
    setAwarded(true);
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-[22px] py-6">
      <div className="max-w-[820px] mx-auto space-y-4">
        <h2 className="text-xl font-bold">Marking</h2>
        <p className="text-sm text-ink2">
          Score each criterion against the band descriptors. Reading your own transcript against a mark scheme is
          the single most useful thing a candidate can do — it is what the examiner will be doing.
        </p>

        {run.paper.sections.map((s, i) => {
          const t = run.transcripts[i];
          return (
            <section key={s.taskId} className="bg-surface border border-line rounded-2xl p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-bold">{s.label}</h3>
                <span className="text-xs text-ink2">
                  {fmt(t?.spokenSeconds || 0)} of {fmt(s.seconds)}
                  {t?.shortfall > 20 && <span className="text-amber-600 font-semibold"> · {fmt(t.shortfall)} short</span>}
                </span>
              </div>
              {t?.transcript && (
                <p className="text-sm bg-surface2 border border-line rounded-xl p-3 whitespace-pre-wrap">{t.transcript}</p>
              )}
              {(TASK_CRITERIA[s.taskId] || []).map((c) => (
                <CriterionSlider
                  key={c}
                  criterion={CRITERIA[c]}
                  value={scores[s.taskId]?.[c]}
                  onChange={(v) => setCriterion(s.taskId, c, v)}
                />
              ))}
            </section>
          );
        })}

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Result</h3>
          <p className="text-2xl font-bold">
            {paperScore.percent === null ? '—' : `${paperScore.marks} / ${paperScore.outOf}`}
            {paperScore.percent !== null && <span className="text-base text-ink2 font-semibold ml-2">({paperScore.percent}%)</span>}
          </p>
          {grade.indicativeBand && <p className="text-sm font-semibold">{grade.indicativeBand}</p>}
          <p className="text-xs text-ink2">{grade.note}</p>
        </section>

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">What to fix</h3>
          {notes.map((n, i) => (
            <p key={i} className="text-sm">{n.text}</p>
          ))}
        </section>

        <div className="flex gap-2">
          {!awarded && paperScore.percent !== null && (
            <button onClick={finish} className="flex-1 bg-ink text-bg font-bold rounded-[14px] px-5 py-3 text-sm">
              <Check className="w-4 h-4 inline mr-1" />Log this attempt
            </button>
          )}
          <button onClick={onRestart} className="flex-1 border border-line rounded-[14px] px-5 py-3 text-sm font-bold hover:border-ink2 transition">
            Sit another paper
          </button>
        </div>
      </div>
    </div>
  );
}

function CriterionSlider({ criterion, value, onChange }) {
  if (!criterion) return null;
  const current = value ?? '';
  const band = value === undefined ? null : criterion.bands.slice().reverse().find((b) => value >= b.min);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{criterion.label}</span>
        <span className="text-xs text-ink2">{value === undefined ? 'not scored' : `${value}%`}</span>
      </div>
      <p className="text-[11px] text-ink2">{criterion.blurb}</p>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={current === '' ? 50 : current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        aria-label={`${criterion.label} score`}
      />
      {band && <p className="text-xs"><strong>{band.label}</strong> — {band.desc}</p>}
    </div>
  );
}
