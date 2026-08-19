import { useMemo, useState } from 'react';
import { getSrs, getGrammarProgress, getSessions, getMetrics, getSettings } from '../lib/storage';
import { LEVELS, coverageReport, profileFor, promotionGate } from '../lib/cefr';
import { DIMENSIONS, nextFocus, proficiency } from '../lib/proficiency';
import { assistanceFading, retentionCalibration } from '../lib/learningAdaptation';
import { GRAMMAR_TOPICS } from '../lib/grammar';
import { vocabCountByCefr } from '../lib/vocab';
import { startPlacement, selectItem, answerItem, placementResultFrom } from '../lib/placement';
import { Target, Check, ChevronRight } from './icons';

// The proficiency screen: one score, five components, and an honest account of
// how much evidence sits behind it. Everything shown here is derived from
// things the learner actually did — XP and streaks are deliberately absent,
// because attendance is not proficiency.

export default function Proficiency({ onXp }) {
  const [placing, setPlacing] = useState(false);
  const [level, setLevel] = useState(() => getSettings().level || 'A1');

  const evidence = useMemo(() => ({
    level,
    srs: safe(getSrs, {}),
    topicScores: safe(getGrammarProgress, {}),
    sessions: safe(getSessions, []),
    metrics: safe(getMetrics, []),
  }), [level, placing]);

  const result = useMemo(() => proficiency(evidence), [evidence]);
  const profile = profileFor(level);
  const gate = useMemo(() => promotionGate(level, {
    vocabKnown: result.parts.vocabulary.known || 0,
    grammarMastered: result.parts.grammar.mastered || 0,
    speakingAvg: result.parts.speaking.score || 0,
    checkpointsPassed: countCheckpoints(evidence.sessions),
  }), [level, result, evidence.sessions]);

  const successStreak = evidence.sessions.slice(-3).every((session) => Number(session?.report?.average_scores?.overall) >= 80) ? 3 : 0;
  const assist = assistanceFading({ level, confidence: result.confidence, successStreak });
  const retention = useMemo(() => retentionCalibration(evidence.srs), [evidence.srs]);
  const coverage = useMemo(
    () => coverageReport({ grammarTopics: GRAMMAR_TOPICS, vocabByLevel: vocabCountByCefr() }),
    [],
  );

  if (placing) {
    return <PlacementTest seedLevel={level} onDone={(r) => { setLevel(r.level); setPlacing(false); onXp?.(20); }} onCancel={() => setPlacing(false)} />;
  }

  return (
    <div className="h-full overflow-y-auto nice-scroll px-[22px] py-6">
      <div className="max-w-[820px] mx-auto space-y-4">
        <header className="text-center space-y-1">
          <Target className="w-7 h-7 mx-auto text-ink2" />
          <h2 className="text-xl font-bold">Proficiency</h2>
          <p className="text-sm text-ink2">{profile.label} · {profile.blurb}</p>
        </header>

        <section className="bg-surface border border-line rounded-2xl p-4 text-center">
          <p className="text-5xl font-bold tabular-nums">{result.score === null ? '—' : result.score}</p>
          <p className="text-sm font-semibold mt-1">{result.band || 'No score yet'}</p>
          <p className="text-xs text-ink2 mt-2">
            {result.score === null
              ? result.note
              : `Confidence ${Math.round(result.confidence * 100)}% — ${result.confidence < 0.5 ? 'thin evidence, treat as provisional' : 'enough evidence to be meaningful'}.`}
          </p>
          <p className="text-xs text-ink2 mt-2">{nextFocus(result)}</p>
        </section>

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Components</h3>
          {DIMENSIONS.map((d) => {
            const part = result.parts[d.id];
            return (
              <div key={d.id} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{d.label}</span>
                  <span className={part.score === null ? 'text-ink2 text-xs' : 'tabular-nums'}>
                    {part.score === null ? 'no evidence yet' : `${part.score}%`}
                  </span>
                </div>
                <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                  <div className="h-full bg-ink rounded-full transition-all" style={{ width: `${part.score ?? 0}%` }} />
                </div>
                <p className="text-[11px] text-ink2">{d.blurb}</p>
              </div>
            );
          })}
        </section>

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Moving to {gate.to}</h3>
            <span className="text-xs text-ink2">{Math.round(gate.progress * 100)}%</span>
          </div>
          {gate.ready ? (
            <p className="text-sm font-semibold"><Check className="w-4 h-4 inline mr-1" />Every gate met — sit the placement test to move up.</p>
          ) : (
            <ul className="space-y-1">
              {gate.missing.map((m) => (
                <li key={m.id} className="text-sm flex justify-between gap-3">
                  <span>{m.label}</span>
                  <span className="text-ink2 tabular-nums whitespace-nowrap">{m.have} / {m.need}</span>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => setPlacing(true)} className="w-full mt-2 bg-ink text-bg font-bold rounded-[14px] px-5 py-2.5 text-sm">
            Take the placement test
          </button>
        </section>

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-1.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">How much help you get</h3>
          <p className="text-xs text-ink2">Scaffolding fades as you improve — this is what is on at {level}.</p>
          <Row label="Captions" value={assist.captions} />
          <Row label="Translations" value={assist.translation} />
          <Row label="Sentence starters" value={assist.starters === 0 ? 'none' : `${assist.starters}`} />
          <Row label="Corrections" value={assist.correctionTiming} />
          <Row label="Partner simplifies" value={assist.simplifyPartner ? 'yes' : 'no'} />
        </section>

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Retention calibration</h3>
            <span className="text-[11px] text-ink3 tabular-nums">{retention.n} reviews</span>
          </div>
          {retention.ready ? (
            <>
              <p className="text-xs text-ink2">The scheduler predicts {Math.round(retention.predicted * 100)}% recall; observed recall is {Math.round(retention.actual * 100)}% ({retention.bias >= 0 ? '+' : ''}{Math.round(retention.bias * 100)} points).</p>
              <div className="space-y-1">
                {retention.curve.map((row) => (
                  <div key={`${row.from}-${row.to}`} className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 text-ink3 tabular-nums">{Math.round(row.from * 100)}–{Math.round(row.to * 100)}%</span>
                    <div className="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden"><div className="h-full bg-ink" style={{ width: `${row.actual * 100}%` }} /></div>
                    <span className="w-12 text-right text-ink2 tabular-nums">{Math.round(row.actual * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-ink2">Keep reviewing: calibration stays provisional until {retention.needed} more prediction/outcome pairs are recorded.</p>
          )}
        </section>

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-1.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">What the app teaches</h3>
          <p className="text-xs text-ink2">Syllabus coverage — {coverage.grammarCoverage}% of the grammar inventory is written.</p>
          {coverage.rows.map((r) => (
            <div key={r.level} className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{r.level}</span>
              <span className="text-ink2 text-xs tabular-nums">
                {r.grammarCovered}/{r.grammarWanted} grammar · {r.words} banded words
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between text-sm">
    <span>{label}</span>
    <span className="text-ink2">{value}</span>
  </div>
);

// ------------------------------------------------------------- placement ----

function PlacementTest({ seedLevel, onDone, onCancel }) {
  const [state, setState] = useState(() => startPlacement({ seedLevel }));
  const item = state.done ? null : selectItem(state);
  const result = state.done ? placementResultFrom(state) : null;

  if (result) {
    return (
      <div className="h-full overflow-y-auto nice-scroll px-[22px] py-6">
        <div className="max-w-[600px] mx-auto space-y-4 text-center">
          <h2 className="text-xl font-bold">Placement result</h2>
          <p className="text-5xl font-bold">{result.level}</p>
          <p className="text-sm text-ink2">
            Most likely {result.range}, from {result.itemsAsked} questions ({result.correct} correct).
          </p>
          <p className="text-xs text-ink2">
            Confidence {Math.round(result.confidence * 100)}%. A short test cannot place you more precisely than
            about half a band — the range is the honest answer.
          </p>
          {result.weakest && (
            <p className="text-sm">Weakest area: <strong>{result.weakest}</strong>. Strongest: <strong>{result.strongest}</strong>.</p>
          )}
          <button onClick={() => onDone(result)} className="w-full bg-ink text-bg font-bold rounded-[14px] px-5 py-3 text-sm">
            Set my level to {result.level}
          </button>
        </div>
      </div>
    );
  }

  if (!item) {
    return <div className="p-6 text-sm text-ink2">No more questions available.</div>;
  }

  const progress = state.asked.length / state.config.maxItems;

  return (
    <div className="h-full overflow-y-auto nice-scroll px-[22px] py-6">
      <div className="max-w-[600px] mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Placement test</h2>
          <button onClick={onCancel} className="text-xs text-ink2 underline hover:text-ink">Cancel</button>
        </div>
        <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
          <div className="h-full bg-ink rounded-full transition-all" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
        <p className="text-xs text-ink2">
          Question {state.asked.length + 1} · the test adapts, so it gets harder when you are right and easier when you are not.
        </p>

        <section className="bg-surface border border-line rounded-2xl p-4 space-y-3">
          <p className="text-base font-semibold">{item.q}</p>
          <div className="space-y-2">
            {item.options.map((o, i) => (
              <button
                key={i}
                onClick={() => setState(answerItem(state, item, i))}
                className="w-full text-left border border-line rounded-xl px-3 py-2.5 text-sm hover:border-ink transition"
              >
                {o}
                <ChevronRight className="w-4 h-4 inline float-right opacity-40" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// Storage helpers are defensive: this screen must render on a fresh install
// where none of these keys exist yet.
function safe(fn, fallback) {
  try {
    const v = fn?.();
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

function countCheckpoints(sessions) {
  return (sessions || []).filter((s) => s.checkpoint && (s.score ?? s.overall ?? 0) >= 70).length;
}

export { LEVELS };
