import { useMemo, useState } from 'react';
import { pingLatency } from '../lib/groq';
import { ChevronRight } from './icons';

// Developer & utility panel: token usage totals, latency pings, raw API
// payload log, and the Mock Mode toggle (settings-backed).

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
      <div className="text-[10px] text-ink3 mt-0.5">{label}</div>
    </div>
  );
}
