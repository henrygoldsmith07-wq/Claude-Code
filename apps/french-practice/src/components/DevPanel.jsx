import { useMemo, useState } from 'react';
import { pingLatency } from '../lib/groq';
import {
  recordPlacementValidation, getPlacementValidationMetrics, getLastPlacement,
  getWritingSpeakingCorpus, updateCorpusHumanMark, updateCorpusSecondMark,
  getIntelligibilityBenchmark, recordBenchmarkSample,
} from '../lib/storage';
import { benchmarkStatus, mergeBenchmarkItems } from '../lib/intelligibility';
import { ChevronRight } from './icons';

// Developer & utility panel: token usage totals, latency pings, raw API
// payload log, the Mock Mode toggle (settings-backed), and the teacher entry
// point for placement validation — where a known CEFR level (teacher
// assessment or external exam) is paired against a real placement result.
// Nothing here fabricates data: every field comes from a human.

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function DevPanel({ telemetry, apiKey, mockMode, onMockMode, onClear }) {
  const [ping, setPing] = useState(null);
  const [pinging, setPinging] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const totals = useMemo(() => {
    let prompt = 0, completion = 0, calls = 0, latencySum = 0;
    for (const e of telemetry) {
      calls += 1;
      latencySum += e.latency || 0;
      if (e.usage) {
        prompt += e.usage.prompt_tokens || 0;
        completion += e.usage.completion_tokens || 0;
      }
    }
    return { prompt, completion, calls, avgLatency: calls ? Math.round(latencySum / calls) : 0 };
  }, [telemetry]);

  const doPing = async () => {
    setPinging(true);
    try {
      setPing(await pingLatency(apiKey));
    } catch {
      setPing(-1);
    }
    setPinging(false);
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Developer Panel</h2>
          <label className="flex items-center gap-2 text-xs text-ink2 cursor-pointer">
            <input
              type="checkbox"
              checked={mockMode}
              onChange={(e) => onMockMode(e.target.checked)}
              className="accent-ink w-4 h-4"
            />
            Mock Mode (offline)
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="API calls" value={totals.calls} />
          <Metric label="Input tokens" value={totals.prompt.toLocaleString()} />
          <Metric label="Output tokens" value={totals.completion.toLocaleString()} />
          <Metric label="Avg latency" value={`${totals.avgLatency} ms`} />
        </div>

        <div className="flex items-center gap-3 bg-surface border border-line rounded-2xl px-4 py-3">
          <button
            onClick={doPing}
            disabled={pinging || !apiKey}
            className="min-h-10 px-4 rounded-xl bg-surface2 text-ink2 text-xs font-bold hover:bg-line disabled:opacity-40"
          >
            {pinging ? 'Pinging…' : 'Ping Groq'}
          </button>
          <span className="text-sm font-mono text-ink2">
            {ping == null ? '—' : ping === -1 ? 'failed' : `${ping} ms`}
          </span>
          {!apiKey && <span className="text-[11px] text-ink3">API key required</span>}
          <button onClick={onClear} className="ml-auto text-[11px] text-ink3 hover:text-ink min-h-10">
            Clear log
          </button>
        </div>

        <PlacementValidationCard />

        <CorpusMarkingCard />

        <IntelligibilityCard />

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink2">
            Request log ({telemetry.length})
          </h3>
          {telemetry.length === 0 && (
            <p className="text-xs text-ink3 italic">No requests yet — go speak in the Arena!</p>
          )}
          {[...telemetry].reverse().map((e, i) => {
            const key = telemetry.length - 1 - i;
            return (
              <div key={key} className="bg-surface border border-line rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === key ? null : key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left min-h-11"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      e.error ? 'bg-transparent border-2 border-ink' : 'bg-ink3'
                    }`}
                    title={e.error ? 'failed' : 'success'}
                  />
                  <span className="text-xs font-mono text-ink flex-1 truncate">{e.label}</span>
                  {e.usage && (
                    <span className="text-[10px] font-mono text-ink3">
                      {e.usage.prompt_tokens}→{e.usage.completion_tokens} tok
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-ink2">{e.latency} ms</span>
                  <ChevronRight size={14} className={`text-ink3 transition-transform ${expanded === key ? "rotate-90" : ""}`} />
                </button>
                {expanded === key && (
                  <div className="border-t border-line p-3 space-y-2 text-[11px] font-mono">
                    {e.error && <pre className="text-ink whitespace-pre-wrap">{e.error}</pre>}
                    {e.payload && (
                      <details open>
                        <summary className="text-ink2 cursor-pointer">Sent payload</summary>
                        <pre className="text-ink2 whitespace-pre-wrap break-all max-h-48 overflow-y-auto nice-scroll mt-1">
                          {typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                    {e.response && (
                      <details>
                        <summary className="text-ink2 cursor-pointer">Raw response</summary>
                        <pre className="text-ink2 whitespace-pre-wrap break-all max-h-48 overflow-y-auto nice-scroll mt-1">
                          {JSON.stringify(e.response, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-surface border border-line rounded-2xl px-3 py-3 text-center">
      <div className="text-xl font-bold text-ink tabular-nums truncate">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink3 mt-0.5">{label}</div>
    </div>
  );
}

// Teacher/assessment entry: pair a known CEFR level with a real placement
// result. The store starts empty and stays honest — this form is the only
// way entries appear, and every field is human-supplied.
function PlacementValidationCard() {
  const last = getLastPlacement();
  const [form, setForm] = useState({
    knownLevel: '', placedLevel: last?.level || '', theta: last?.theta ?? '', se: last?.se ?? '',
    itemsAsked: last?.itemsAsked ?? '', rater: '', source: '',
  });
  const [saved, setSaved] = useState(null);
  const metrics = getPlacementValidationMetrics();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const useLast = () => {
    if (!last) return;
    setForm((f) => ({
      ...f,
      placedLevel: last.level || f.placedLevel,
      theta: last.theta ?? f.theta,
      se: last.se ?? f.se,
      itemsAsked: last.itemsAsked ?? f.itemsAsked,
    }));
  };

  const save = () => {
    const made = recordPlacementValidation({
      knownLevel: form.knownLevel,
      placedLevel: form.placedLevel,
      theta: Number(form.theta),
      se: Number(form.se),
      itemsAsked: Number(form.itemsAsked),
      rater: form.rater || undefined,
      source: form.source || undefined,
    });
    setSaved(made ? 'Saved.' : 'Could not save — check the fields.');
  };

  const inputCls = 'w-full bg-surface2 border border-line rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-ink';
  return (
    <section className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink2">Placement validation — teacher entry</h3>
        {last && (
          <button onClick={useLast} className="text-[11px] font-semibold text-ink2 hover:text-ink underline shrink-0">
            Use last test result
          </button>
        )}
      </div>
      <p className="text-[11px] text-ink3">
        Pair a learner’s independently known CEFR level (your assessment, a DELF/TCF/GCSE result) with the
        placement this app produced. Entries measure exact/within-one agreement, ability error and calibration —
        nothing is generated. Currently: <span className="font-semibold text-ink2">{metrics.label}</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-ink3">Known level</span>
          <select value={form.knownLevel} onChange={set('knownLevel')} className={inputCls}>
            <option value="">—</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-ink3">Placed level</span>
          <select value={form.placedLevel} onChange={set('placedLevel')} className={inputCls}>
            <option value="">—</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-ink3">Ability θ</span>
          <input type="number" step="0.1" value={form.theta} onChange={set('theta')} className={inputCls} placeholder="e.g. 0.2" />
        </label>
        <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-ink3">SE</span>
          <input type="number" step="0.05" min="0" value={form.se} onChange={set('se')} className={inputCls} placeholder="e.g. 0.45" />
        </label>
        <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-ink3">Items asked</span>
          <input type="number" min="1" max="100" value={form.itemsAsked} onChange={set('itemsAsked')} className={inputCls} placeholder="e.g. 12" />
        </label>
        <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-ink3">Rater</span>
          <input value={form.rater} onChange={set('rater')} className={inputCls} placeholder="who assessed" />
        </label>
        <label className="col-span-2 sm:col-span-3 space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-ink3">Source</span>
          <input value={form.source} onChange={set('source')} className={inputCls} placeholder="e.g. DELF B1, June sitting" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!form.knownLevel || !form.placedLevel}
          className="btn btn-primary min-h-9 px-4 rounded-lg text-xs disabled:opacity-40"
        >
          Record pair
        </button>
        {saved && <span className="text-[11px] text-ink2">{saved}</span>}
        <span className="ml-auto text-[11px] text-ink3">{metrics.message}</span>
      </div>
    </section>
  );
}

// Human-marking entry for the writing/speaking corpus. Entries arrive AI-only
// (seeded automatically by Writing Studio and Arena turns); this is where a
// qualified rater adds their mark — and a second rater re-marks for the
// double-marking agreement check. Nothing here invents a score.
function CorpusMarkingCard() {
  const corpus = getWritingSpeakingCorpus();
  const recent = [...corpus].reverse().slice(0, 8);
  const [selectedId, setSelectedId] = useState('');
  const selected = recent.find((e) => e.id === selectedId) || null;
  const [form, setForm] = useState({ score: '', corrections: '', rater: '' });
  const [saved, setSaved] = useState(null);

  const needsFirst = selected && !selected.hasHuman;
  const needsSecond = selected && selected.hasHuman && !selected.doubleMarked;

  const save = () => {
    if (!selected) return;
    const payload = {
      humanScore: Number(form.score),
      humanCorrections: form.corrections || null,
      rater: form.rater || undefined,
    };
    const made = needsSecond
      ? updateCorpusSecondMark(selected.id, { humanScore2: payload.humanScore, humanCorrections2: payload.humanCorrections, rater2: payload.rater })
      : updateCorpusHumanMark(selected.id, payload);
    setSaved(made ? 'Saved.' : 'Could not save — check the fields.');
    if (made) setForm({ score: '', corrections: '', rater: '' });
  };

  const inputCls = 'w-full bg-surface2 border border-line rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-ink';
  return (
    <section className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-ink2">Corpus marking — human rater entry</h3>
      <p className="text-[11px] text-ink3">
        Writing-studio reviews and arena turns seed the AI side of a corpus entry automatically. Add your independent
        mark here; when a second rater re-marks the same response, inter-rater agreement (exact, within-5, κ over bands)
        is measured. Scores are never generated.
      </p>
      {!recent.length ? (
        <p className="text-xs text-ink3 italic">No corpus entries yet — complete a writing review or arena turn first.</p>
      ) : (
        <>
          <label className="space-y-1 block"><span className="text-[10px] font-bold uppercase tracking-wider text-ink3">Response to mark</span>
            <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setSaved(null); }} className={inputCls}>
              <option value="">—</option>
              {recent.map((e) => (
                <option key={e.id} value={e.id}>
                  [{e.mode}] {String(e.prompt).slice(0, 40)} — AI {e.aiScore ?? '—'}{e.hasHuman ? `, marked (${e.rater || 'rater'})` : ', unmarked'}{e.doubleMarked ? ' +2nd' : ''}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <div className="space-y-2">
              <p className="text-[11px] bg-surface2 border border-line rounded-lg px-2 py-1.5 whitespace-pre-wrap max-h-24 overflow-y-auto nice-scroll" lang="fr">{selected.response}</p>
              <p className="text-[11px] text-ink3">
                {needsFirst && 'This entry has no human mark yet — add the first one.'}
                {needsSecond && `First mark: ${selected.humanScore} (${selected.rater || 'unnamed'}). Add an independent second mark.`}
                {selected.doubleMarked && `Double-marked: ${selected.humanScore} vs ${selected.humanScore2}.`}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-ink3">Score (0–100)</span>
                  <input type="number" min="0" max="100" value={form.score} onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))} className={inputCls} placeholder="e.g. 68" />
                </label>
                <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-ink3">Rater</span>
                  <input value={form.rater} onChange={(e) => setForm((f) => ({ ...f, rater: e.target.value }))} className={inputCls} placeholder="who marked" />
                </label>
                <label className="col-span-2 sm:col-span-3 space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-ink3">Corrections (optional)</span>
                  <input value={form.corrections} onChange={(e) => setForm((f) => ({ ...f, corrections: e.target.value }))} className={inputCls} placeholder="what you would correct" />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={save}
                  disabled={form.score === ''}
                  className="btn btn-primary min-h-9 px-4 rounded-lg text-xs disabled:opacity-40"
                >
                  {needsSecond ? 'Record second mark' : 'Record mark'}
                </button>
                {saved && <span className="text-[11px] text-ink2">{saved}</span>}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Ingestion point for human intelligibility ratings (see the protocol in
// intelligibility.js): paste labelled samples as JSON — target, transcript,
// humanMean (1–5 listener scale), optional raters. Rows that fail validation
// are rejected and counted, never coerced.
function IntelligibilityCard() {
  const stored = getIntelligibilityBenchmark();
  const status = benchmarkStatus(mergeBenchmarkItems(stored));
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState(null);

  const ingest = () => {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setResult('That is not valid JSON.');
      return;
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    let ok = 0;
    let bad = 0;
    for (const item of list) {
      if (recordBenchmarkSample(item)) ok += 1;
      else bad += 1;
    }
    setResult(`Imported ${ok} sample${ok === 1 ? '' : 's'}${bad ? ` · rejected ${bad} invalid row${bad === 1 ? '' : 's'}` : ''}.`);
    setRaw('');
  };

  const inputCls = 'w-full bg-surface2 border border-line rounded-lg px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-ink';
  return (
    <section className="bg-surface border border-line rounded-2xl p-4 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-ink2">Pronunciation benchmark — human ratings</h3>
      <p className="text-[11px] text-ink3">
        Feed in recordings rated by native listeners on the 1–5 intelligibility scale (“how much did you understand?”,
        not accent): <code className="font-mono">{'[{ target, transcript, humanMean, raters }]'}</code>. The scorer stays
        unvalidated until real labels exist. Currently:{' '}
        <span className="font-semibold text-ink2">{status.label}</span> · stored: {stored.length}
      </p>
      <textarea
        value={raw}
        onChange={(e) => { setRaw(e.target.value); setResult(null); }}
        rows={4}
        className={`${inputCls} font-mono resize-y`}
        placeholder='[{"target":"Je voudrais un café","transcript":"Je voudrai un café","humanMean":4,"raters":["L1","L2","L3"]}]'
        aria-label="Benchmark samples JSON"
      />
      <div className="flex items-center gap-3">
        <button onClick={ingest} disabled={!raw.trim()} className="btn btn-primary min-h-9 px-4 rounded-lg text-xs disabled:opacity-40">
          Import samples
        </button>
        {result && <span className="text-[11px] text-ink2">{result}</span>}
        {status.n > 0 && <span className="ml-auto text-[11px] text-ink3">{status.message}</span>}
      </div>
    </section>
  );
}
