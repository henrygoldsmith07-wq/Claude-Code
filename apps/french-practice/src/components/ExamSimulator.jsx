import { useCallback, useEffect, useMemo, useState } from 'react';
import useRecorder from '../hooks/useRecorder';
import { transcribe, friendlyError } from '../lib/groq';
import { speak } from '../lib/tts';
import {
  getExamBoundarySets, getExaminerScripts, getRealExamResults, recordExaminerMark,
  recordRealExamResult, recordSkillScore, saveExamBoundarySet,
} from '../lib/storage';
import {
  BOARDS, CRITERIA, EXAM_MODE, EXAM_MODES, TASK_CRITERIA, TIER, boardList, specCaveat, timingQa,
} from '../lib/exams/boards.js';
import {
  PHASE, buildPaper, initRun, beginPrep, beginSpeaking, timeLeft, phaseAllowance,
  notesAllowed, completeSection, scoreTask, scorePaper, gradeEstimate, examFeedback,
  benchmarkExaminer, scoreExamTechnique, validateAgainstResults,
} from '../lib/exams/simulator.js';
import { availableThemes } from '../lib/exams/tasks.js';
import { parseBoundaryImport } from '../lib/exams/boundaries.js';
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
  const [examMode, setExamMode] = useState(EXAM_MODE.SPEAKING);
  const [boundarySets, setBoundarySets] = useState(() => getExamBoundarySets());
  const [boundarySetId, setBoundarySetId] = useState('');
  const [run, setRun] = useState(null);
  const [scores, setScores] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const board = BOARDS[boardId];
  const themes = useMemo(() => availableThemes(), []);
  const selectedBoundary = boundarySets.find((set) => set.id === boundarySetId) || null;

  useEffect(() => {
    const matching = boundarySets.find((set) => (!set.boardId || set.boardId === boardId) && (!set.tier || set.tier === tier));
    if (!selectedBoundary || (selectedBoundary.boardId && selectedBoundary.boardId !== boardId) || (selectedBoundary.tier && selectedBoundary.tier !== tier)) {
      setBoundarySetId(matching?.id || '');
    }
  }, [boardId, tier, boundarySets, selectedBoundary]);

  const start = () => {
    try {
      const paper = buildPaper({
        boardId,
        tier,
        mode,
        examMode,
        theme: theme || null,
        boundaries: selectedBoundary?.boundaries || null,
        boundarySource: selectedBoundary ? `${selectedBoundary.series} · ${selectedBoundary.source}` : null,
      });
      setRun(initRun(paper));
      setScores({});
      setError(null);
      onActivity?.({ type: examMode, boardId, label: `${board.name} ${EXAM_MODES[examMode].label}`, mode: 'exam' });
    } catch (e) {
      setError(e.message);
    }
  };

  if (!run) {
    return (
      <Setup
        board={board} boardId={boardId} setBoardId={setBoardId}
        tier={tier} setTier={setTier} theme={theme} setTheme={setTheme}
        themes={themes} mode={mode} setMode={setMode} examMode={examMode} setExamMode={setExamMode}
        boundarySets={boundarySets} boundarySetId={boundarySetId} setBoundarySetId={setBoundarySetId}
        onBoundarySaved={(set) => { setBoundarySets((all) => [...all.filter((item) => item.id !== set.id), set]); setBoundarySetId(set.id); }}
        onStart={start} error={error}
      />
    );
  }

  if (run.phase === PHASE.REVIEW || run.phase === PHASE.DONE) {
    return (
      <Review
        run={run} scores={scores} setScores={setScores}
        onRestart={() => setRun(null)} onXp={onXp} onActivity={onActivity}
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

function Setup({
  board, boardId, setBoardId, tier, setTier, theme, setTheme, themes, mode, setMode,
  examMode, setExamMode, boundarySets, boundarySetId, setBoundarySetId, onBoundarySaved, onStart, error,
}) {
  const bench = benchmarkExaminer(getExaminerScripts());
  const qa = timingQa(boardId);
  const matchingBoundaries = boundarySets.filter((set) => (!set.boardId || set.boardId === boardId) && (!set.tier || set.tier === tier));
  return (
    <div className="h-full overflow-y-auto nice-scroll px-[22px] py-6">
      <div className="max-w-[820px] mx-auto space-y-5">
        <header className="text-center space-y-1">
          <GraduationCap className="w-7 h-7 mx-auto text-ink2" />
          <h2 className="text-xl font-bold">Exam simulator</h2>
          <p className="text-sm text-ink2">{EXAM_MODES[examMode].description}</p>
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

          <Field label="Exam format">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.values(EXAM_MODES).map((format) => (
                <button
                  key={format.id}
                  onClick={() => setExamMode(format.id)}
                  className={`text-left rounded-xl border px-3 py-2 text-sm transition ${examMode === format.id ? 'border-ink bg-ink text-bg' : 'border-line hover:border-ink2'}`}
                >
                  <span className="font-semibold block">{format.label}</span>
                  <span className={`text-[11px] ${examMode === format.id ? 'opacity-80' : 'text-ink2'}`}>{format.id === EXAM_MODE.SPEAKING ? 'Oral' : 'Written paper'}</span>
                </button>
              ))}
            </div>
          </Field>

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
          {examMode === EXAM_MODE.SPEAKING ? (
            <ul className="mt-2 space-y-1.5">
              {board.tasks.map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-ink2 text-xs text-right">{t.blurb}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-sm font-semibold">One original {EXAM_MODES[examMode].label.toLowerCase()} paper selected for {board.name}.</p>
              <p className="text-xs text-ink2">The prompt bank is tagged by board style. The task is original practice material, not a live or copied paper.</p>
            </div>
          )}
          <p className="text-xs text-ink2 mt-3">Supervised preparation: {fmt(examMode === EXAM_MODE.SPEAKING ? board.prepTotal : 300)}.</p>
        </section>

        <BoundaryImport
          boardId={boardId}
          tier={tier}
          sets={matchingBoundaries}
          selectedId={boundarySetId}
          onSelect={setBoundarySetId}
          onSaved={onBoundarySaved}
        />

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Timing QA</h3>
            <span className={`text-xs font-bold ${qa.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{qa.ok ? 'PASS' : 'CHECK'}</span>
          </div>
          <p className="text-xs text-ink2">{qa.checks} internal timing and mark checks were run for this board. This does not replace the board’s current specification.</p>
          {!qa.ok && qa.issues.map((issue) => <p key={issue} className="text-xs text-amber-600">{issue}</p>)}
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

function BoundaryImport({ boardId, tier, sets, selectedId, onSelect, onSaved }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const importBoundaries = () => {
    try {
      const parsed = parseBoundaryImport(raw, { boardId, tier, sourceUrl });
      parsed.sets.forEach((set) => onSaved(saveExamBoundarySet(set)));
      setSaved(true);
      setError(null);
      setRaw('');
    } catch (e) {
      setSaved(false);
      setError(e.message);
    }
  };

  return (
    <section className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Real grade boundaries</h3>
          <p className="text-xs text-ink2 mt-1">Paste a teacher-checked CSV, TSV or JSON table. Nothing is bundled as official.</p>
        </div>
        <button onClick={() => setOpen((value) => !value)} className="text-xs font-semibold underline text-ink2 hover:text-ink">
          {open ? 'Close' : 'Import'}
        </button>
      </div>

      {sets.length > 0 && (
        <select value={selectedId} onChange={(e) => onSelect(e.target.value)} className="w-full bg-bg border border-line rounded-xl px-3 py-2 text-sm">
          <option value="">No boundary set — show percentage only</option>
          {sets.map((set) => <option key={set.id} value={set.id}>{set.series} · {set.source}</option>)}
        </select>
      )}

      {saved && <p className="text-xs text-emerald-600">Boundary set saved locally for this board and tier.</p>}

      {open && (
        <div className="space-y-2">
          <textarea
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setSaved(false); }}
            rows={6}
            placeholder={'grade,minPercent,series\n9,85,June 2025\n8,76,June 2025\n7,68,June 2025'}
            className="w-full bg-bg border border-line rounded-xl px-3 py-2 text-xs font-mono"
            aria-label="Grade boundary import"
          />
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Source page or document (optional)"
            className="w-full bg-bg border border-line rounded-xl px-3 py-2 text-sm"
            aria-label="Grade boundary source"
          />
          <button onClick={importBoundaries} disabled={!raw.trim()} className="w-full bg-ink text-bg font-bold rounded-xl px-4 py-2 text-sm disabled:opacity-40">
            Import boundary set
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-[11px] text-ink2">Accepted JSON includes <code>boundaries</code> as grade-to-percent values, or rows with <code>grade</code> plus <code>minPercent</code> (or <code>minMark</code> and <code>maxMark</code>).</p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- sitting ---

function Sitting({ run, setRun, apiKey, mockMode, busy, setBusy, onAbort }) {
  const [, tick] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [spoken, setSpoken] = useState(0);
  const [techniqueEvidence, setTechniqueEvidence] = useState({ candidateAsked: false, unexpectedHandled: false, usedNotes: false });
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
    const updated = completeSection(run, {
      transcript,
      spokenSeconds: spoken,
      ...techniqueEvidence,
    });
    setTranscript('');
    setSpoken(0);
    setTechniqueEvidence({ candidateAsked: false, unexpectedHandled: false, usedNotes: false });
    setRun(updated);
  };

  if (run.phase === PHASE.BRIEFING) {
    return (
      <Shell title="Before you start" onAbort={onAbort}>
        <div className="space-y-3">
          <p className="text-sm">
            You will get <strong>{fmt(run.paper.prepSeconds)}</strong> of preparation, then each {EXAM_MODES[run.paper.examMode || EXAM_MODE.SPEAKING].label.toLowerCase()} task runs to its own clock.
            {run.paper.examMode === EXAM_MODE.SPEAKING && <> You may keep notes for the role-play and photo card, but <strong>not</strong> for the conversation.</>}
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
          <p className="text-sm text-ink2">Read every task and plan your response. During the timed task, follow the rules shown for that exam format.</p>
          {run.paper.sections.map((s) => (
            <Material key={s.taskId} section={s} phase="prep" />
          ))}
          <button onClick={() => setRun(beginSpeaking(run))} className="w-full bg-ink text-bg font-bold rounded-[14px] px-5 py-3 text-sm">
            I am ready — start the first task
          </button>
        </div>
      </Shell>
    );
  }

  if (run.paper.examMode && run.paper.examMode !== EXAM_MODE.SPEAKING) {
    return (
      <NonSpeakingTask
        key={`${run.paper.examMode}-${section.materialId || section.taskId}`}
        run={run}
        section={section}
        setRun={setRun}
        onAbort={onAbort}
      />
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
          ? <Material section={section} phase="response" />
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
          <div className="grid sm:grid-cols-2 gap-2 text-xs text-ink2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={techniqueEvidence.candidateAsked} onChange={(e) => setTechniqueEvidence((v) => ({ ...v, candidateAsked: e.target.checked }))} /> I asked my own question</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={techniqueEvidence.unexpectedHandled} onChange={(e) => setTechniqueEvidence((v) => ({ ...v, unexpectedHandled: e.target.checked }))} /> I handled the unexpected prompt</label>
            {section.taskId === 'conversation' && <label className="flex items-center gap-2"><input type="checkbox" checked={techniqueEvidence.usedNotes} onChange={(e) => setTechniqueEvidence((v) => ({ ...v, usedNotes: e.target.checked }))} /> I looked at notes during conversation</label>}
          </div>
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

function NonSpeakingTask({ run, section, setRun, onAbort }) {
  const [, tick] = useState(0);
  const [written, setWritten] = useState('');
  const [answers, setAnswers] = useState({});
  const [plays, setPlays] = useState(0);
  const left = timeLeft(run);
  const mode = run.paper.examMode;
  const material = section.material || {};
  const questions = material.questions || [];

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const submit = () => {
    const spentSeconds = Math.max(0, section.seconds - (left || 0));
    const wordCount = written.trim().split(/\s+/).filter(Boolean).length;
    const chosen = Object.values(answers).map(Number).filter(Number.isFinite);
    const correct = questions.reduce((count, question, index) => count + (Number(answers[index]) === question.answer ? 1 : 0), 0);
    const responseData = mode === EXAM_MODE.WRITING
      ? {
        complete: wordCount >= (material.minWords || 1),
        wordCount,
        minWords: material.minWords || null,
        maxWords: material.maxWords || null,
      }
      : {
        complete: chosen.length === questions.length,
        answers,
        answerCount: chosen.length,
        expectedCount: questions.length,
        correct,
        objectiveScore: questions.length ? Math.round((correct / questions.length) * 100) : 0,
      };
    const transcript = mode === EXAM_MODE.WRITING
      ? written
      : questions.map((question, index) => `${question.prompt} — ${question.options?.[answers[index]] || 'No answer'}`).join('\n');
    setRun(completeSection(run, { transcript, spentSeconds, responseData }));
  };

  return (
    <Shell
      title={`${section.label} — ${run.sectionIndex + 1} of ${run.paper.sections.length}`}
      timer={left}
      allowance={phaseAllowance(run)}
      onAbort={onAbort}
    >
      <div className="space-y-4">
        <Material section={section} phase="response" />

        {mode === EXAM_MODE.LISTENING && (
          <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
            <button
              onClick={() => { speak(material.script, { rate: 0.9 }); setPlays((value) => value + 1); }}
              disabled={plays >= (material.playCount || 2)}
              className="w-full bg-ink text-bg font-bold rounded-[14px] px-5 py-3 text-sm disabled:opacity-40"
            >
              {plays >= (material.playCount || 2) ? 'No plays remaining' : `Play recording (${(material.playCount || 2) - plays} left)`}
            </button>
            <p className="text-[11px] text-ink2">The script stays hidden. Use the original recording for the simulation; replay allowance is shown above.</p>
          </div>
        )}

        {mode === EXAM_MODE.WRITING ? (
          <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs text-ink2"><span>Your response</span><span>{written.trim().split(/\s+/).filter(Boolean).length} words</span></div>
            <textarea value={written} onChange={(e) => setWritten(e.target.value)} rows={12} className="w-full bg-bg border border-line rounded-xl px-3 py-2 text-sm" aria-label="Written exam response" />
          </div>
        ) : (
          <QuestionChoices questions={questions} answers={answers} onAnswer={(index, value) => setAnswers((current) => ({ ...current, [index]: value }))} />
        )}

        {left === 0 && <p className="text-sm font-semibold text-amber-600">Time is up. Submit what you have; in the real exam the paper would move on.</p>}
        <button onClick={submit} className="w-full border border-line rounded-[14px] px-5 py-3 text-sm font-bold hover:border-ink2 transition">
          {run.sectionIndex + 1 === run.paper.sections.length ? 'Finish and mark' : 'Submit task'}
          <ChevronRight className="w-4 h-4 inline ml-1" />
        </button>
      </div>
    </Shell>
  );
}

function QuestionChoices({ questions, answers, onAnswer }) {
  return (
    <div className="space-y-3">
      {questions.map((question, index) => (
        <fieldset key={question.prompt} className="bg-surface border border-line rounded-2xl p-4 space-y-2">
          <legend className="text-sm font-semibold">{index + 1}. {question.prompt}</legend>
          <div className="grid gap-2 mt-2">
            {(question.options || []).map((option, optionIndex) => (
              <label key={option} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer ${Number(answers[index]) === optionIndex ? 'border-ink bg-surface2' : 'border-line'}`}>
                <input type="radio" name={`exam-question-${index}`} checked={Number(answers[index]) === optionIndex} onChange={() => onAnswer(index, optionIndex)} />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
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

  if (section.examMode === EXAM_MODE.WRITING) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">{m.title}</h3>
          <span className="text-xs text-ink2">{m.wordTarget}</span>
        </div>
        {m.boardStyle && <p className="text-[11px] text-ink2">{m.boardStyle} · original material</p>}
        <p className="text-sm font-semibold" lang="fr">{m.prompt}</p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-ink2">
          {(m.instructions || []).map((instruction) => <li key={instruction} lang="fr">{instruction}</li>)}
        </ul>
      </div>
    );
  }

  if (section.examMode === EXAM_MODE.LISTENING) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">{m.title}</h3>
          <span className="text-xs text-ink2">{m.questions?.length || 0} questions</span>
        </div>
        {m.boardStyle && <p className="text-[11px] text-ink2">{m.boardStyle} · original material</p>}
        <p className="text-sm text-ink2">Listen first, then choose one answer for each question. The French script is hidden until the task ends.</p>
      </div>
    );
  }

  if (section.examMode === EXAM_MODE.READING) {
    return (
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">{m.title}</h3>
          <span className="text-xs text-ink2">{m.questions?.length || 0} questions</span>
        </div>
        {m.boardStyle && <p className="text-[11px] text-ink2">{m.boardStyle} · original material</p>}
        <p className="text-base leading-relaxed" lang="fr">{m.passage}</p>
      </div>
    );
  }

  if (section.taskId === 'roleplay') {
    return (
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-2">
        <h3 className="text-sm font-bold">{section.label}</h3>
        {m.boardStyle && <p className="text-[11px] text-ink2">{m.boardStyle} · original material</p>}
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
        {m.boardStyle && <p className="text-[11px] text-ink2">{m.boardStyle} · original material</p>}
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
      {m.boardStyle && <p className="text-[11px] text-ink2">{m.boardStyle} · original material</p>}
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

function Review({ run, scores, setScores, onRestart, onXp, onActivity }) {
  const [awarded, setAwarded] = useState(false);
  const [examinerPercent, setExaminerPercent] = useState('');
  const [examinerGrade, setExaminerGrade] = useState('');
  const [actualGrade, setActualGrade] = useState('');
  const [validationMessage, setValidationMessage] = useState(null);

  const taskScores = run.paper.sections.map((s) => scoreTask({
    boardId: run.paper.boardId,
    taskId: s.taskId,
    tier: run.paper.tier || TIER.HIGHER,
    scores: scores[s.taskId] || {},
    outOf: s.marks,
    automaticScore: run.transcripts.find((t) => t.taskId === s.taskId)?.responseData?.objectiveScore,
  }));
  const paperScore = scorePaper({ boardId: run.paper.boardId, tier: run.paper.tier, taskScores });
  const grade = gradeEstimate(paperScore.percent, {
    boundaries: run.paper.boundaries,
    boundarySource: run.paper.boundarySource,
    board: run.paper.boardName,
  });
  const technique = scoreExamTechnique(run);
  const notes = examFeedback(run, paperScore);
  const benchmark = benchmarkExaminer(getExaminerScripts());
  const realResults = validateAgainstResults(getRealExamResults());
  const examMode = run.paper.examMode || EXAM_MODE.SPEAKING;

  const setCriterion = (taskId, criterion, value) => {
    setScores((prev) => ({ ...prev, [taskId]: { ...(prev[taskId] || {}), [criterion]: value } }));
  };

  const finish = () => {
    if (paperScore.percent !== null) {
      recordSkillScore(examMode, paperScore.percent, {
        boardId: run.paper.boardId,
        techniqueScore: technique.score,
        examMode,
      });
      onActivity?.({ type: examMode, boardId: run.paper.boardId, score: paperScore.percent, techniqueScore: technique.score, mode: 'exam', label: `${run.paper.boardName} ${EXAM_MODES[examMode].label}` });
      onXp?.(30);
    }
    setAwarded(true);
  };

  const saveValidation = () => {
    const percent = Number(examinerPercent);
    if (!Number.isFinite(percent)) return;
    recordExaminerMark({
      boardId: run.paper.boardId,
      examMode,
      appPercent: paperScore.percent,
      examinerPercent: percent,
      appGrade: grade.grade,
      examinerGrade: examinerGrade || null,
      outOf: paperScore.outOf,
    });
    if (grade.grade && actualGrade) {
      recordRealExamResult({ boardId: run.paper.boardId, predictedGrade: grade.grade, actualGrade, percent: paperScore.percent });
    }
    setExaminerPercent('');
    setExaminerGrade('');
    setActualGrade('');
    setValidationMessage('Saved locally. It will count as provisional until there are enough real marked attempts.');
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-[22px] py-6">
      <div className="max-w-[820px] mx-auto space-y-4">
        <h2 className="text-xl font-bold">{EXAM_MODES[examMode].label} marking</h2>
        <p className="text-sm text-ink2">
          Score language level against the plain-English criteria. Exam technique is shown separately and never folded into the language mark.
        </p>

        {run.paper.sections.map((s, i) => {
          const t = run.transcripts[i];
          return (
            <section key={s.taskId} className="bg-surface border border-line rounded-2xl p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-bold">{s.label}</h3>
                <span className="text-xs text-ink2">
                  {examMode === EXAM_MODE.SPEAKING ? `${fmt(t?.spokenSeconds || 0)} spoken` : `${fmt(t?.spentSeconds || 0)} used`} of {fmt(s.seconds)}
                  {examMode === EXAM_MODE.SPEAKING && t?.shortfall > 20 && <span className="text-amber-600 font-semibold"> · {fmt(t.shortfall)} short</span>}
                </span>
              </div>
              {displayTranscript(t) && (
                <p className="text-sm bg-surface2 border border-line rounded-xl p-3 whitespace-pre-wrap">{displayTranscript(t)}</p>
              )}
              {(s.criteria || TASK_CRITERIA[s.taskId] || []).map((c) => (
                <CriterionSlider
                  key={c}
                  criterion={CRITERIA[c]}
                  value={scores[s.taskId]?.[c]}
                  onChange={(v) => setCriterion(s.taskId, c, v)}
                />
              ))}
              {t?.responseData?.objectiveScore != null && <p className="text-xs text-ink2">Automatic comprehension check: {t.responseData.objectiveScore}% — review the answers above before relying on it.</p>}
            </section>
          );
        })}

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Result</h3>
          <p className="text-2xl font-bold">
            {paperScore.percent === null ? '—' : `${paperScore.marks} / ${paperScore.outOf}`}
            {paperScore.percent !== null && <span className="text-base text-ink2 font-semibold ml-2">({paperScore.percent}%)</span>}
          </p>
          {grade.grade && <p className="text-lg font-bold">Estimated grade: {grade.grade}</p>}
          {grade.indicativeBand && <p className="text-sm font-semibold">{grade.indicativeBand}</p>}
          <p className="text-xs text-ink2">{grade.note}</p>
        </section>

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Exam technique — separate score</h3>
            <span className="text-lg font-bold">{technique.score == null ? '—' : `${technique.score}/100`}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-ink2">
            {Object.entries(technique.components || {}).map(([key, value]) => <span key={key}>{key.replace(/([A-Z])/g, ' $1')}: <strong className="text-ink">{value}</strong></span>)}
          </div>
          <p className="text-xs text-ink2">{technique.note}</p>
        </section>

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Examiner validation</h3>
          <p className="text-xs text-ink2">Enter a real human mark for this attempt if a qualified teacher has checked it. These records stay on this device.</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <input type="number" min="0" max="100" value={examinerPercent} onChange={(e) => setExaminerPercent(e.target.value)} placeholder="Examiner %" className="bg-bg border border-line rounded-xl px-3 py-2 text-sm" aria-label="Examiner percentage" />
            <input value={examinerGrade} onChange={(e) => setExaminerGrade(e.target.value)} placeholder="Examiner grade (optional)" className="bg-bg border border-line rounded-xl px-3 py-2 text-sm" aria-label="Examiner grade" />
            <input value={actualGrade} onChange={(e) => setActualGrade(e.target.value)} placeholder={grade.grade ? 'Actual result (optional)' : 'Import boundaries first'} className="bg-bg border border-line rounded-xl px-3 py-2 text-sm" aria-label="Actual exam grade" disabled={!grade.grade} />
          </div>
          <button onClick={saveValidation} disabled={!examinerPercent || paperScore.percent === null} className="w-full border border-line rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40">Save human check</button>
          <p className="text-xs text-ink2">{benchmark.label}: {benchmark.message}</p>
          {realResults.n > 0 && <p className="text-xs text-ink2">Real results: {realResults.message}</p>}
          {validationMessage && <p className="text-xs text-emerald-600">{validationMessage}</p>}
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

function displayTranscript(transcript) {
  if (!transcript) return '';
  if (transcript.responseData?.answers && transcript.transcript) return transcript.transcript;
  return transcript.transcript || '';
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
