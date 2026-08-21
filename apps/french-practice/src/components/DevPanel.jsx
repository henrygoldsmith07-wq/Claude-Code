import { useMemo, useState } from 'react';
import { pingLatency } from '../lib/groq';
import {
  recordPlacementValidation, getPlacementValidationMetrics, getLastPlacement,
} from '../lib/storage';
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
