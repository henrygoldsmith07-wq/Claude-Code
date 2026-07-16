import { useMemo, useState } from 'react';
import { pingLatency } from '../lib/groq';

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
          <h2 className="text-lg font-bold text-slate-100">🛠 Panneau développeur</h2>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={mockMode}
              onChange={(e) => onMockMode(e.target.checked)}
              className="accent-emerald-400 w-4 h-4"
            />
            Mock Mode (hors-ligne)
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Appels API" value={totals.calls} />
          <Metric label="Tokens entrée" value={totals.prompt.toLocaleString()} />
          <Metric label="Tokens sortie" value={totals.completion.toLocaleString()} />
          <Metric label="Latence moy." value={`${totals.avgLatency} ms`} />
        </div>

        <div className="flex items-center gap-3 bg-slate-900 border border-slate-700/60 rounded-2xl px-4 py-3">
          <button
            onClick={doPing}
            disabled={pinging || !apiKey}
            className="min-h-10 px-4 rounded-xl bg-slate-800 text-teal-300 text-xs font-bold hover:bg-slate-700 disabled:opacity-40"
          >
            {pinging ? 'Ping…' : '📡 Ping Groq'}
          </button>
          <span className="text-sm font-mono text-slate-300">
            {ping == null ? '—' : ping === -1 ? 'échec' : `${ping} ms`}
          </span>
          {!apiKey && <span className="text-[11px] text-slate-500">clé API requise</span>}
          <button onClick={onClear} className="ml-auto text-[11px] text-slate-500 hover:text-rose-400 min-h-10">
            Vider le journal
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Journal des requêtes ({telemetry.length})
          </h3>
          {telemetry.length === 0 && (
            <p className="text-xs text-slate-500 italic">Aucune requête pour l'instant — parlez dans l'arène !</p>
          )}
          {[...telemetry].reverse().map((e, i) => {
            const key = telemetry.length - 1 - i;
            return (
              <div key={key} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === key ? null : key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left min-h-11"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${e.error ? 'bg-rose-500' : 'bg-emerald-400'}`} />
                  <span className="text-xs font-mono text-slate-200 flex-1 truncate">{e.label}</span>
                  {e.usage && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {e.usage.prompt_tokens}→{e.usage.completion_tokens} tok
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-teal-400">{e.latency} ms</span>
                  <span className="text-slate-600 text-xs">{expanded === key ? '▲' : '▼'}</span>
                </button>
                {expanded === key && (
                  <div className="border-t border-slate-800 p-3 space-y-2 text-[11px] font-mono">
                    {e.error && <pre className="text-rose-400 whitespace-pre-wrap">{e.error}</pre>}
                    {e.payload && (
                      <details open>
                        <summary className="text-slate-400 cursor-pointer">Payload envoyé</summary>
                        <pre className="text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto nice-scroll mt-1">
                          {typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                    {e.response && (
                      <details>
                        <summary className="text-slate-400 cursor-pointer">Réponse brute</summary>
                        <pre className="text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto nice-scroll mt-1">
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
    <div className="bg-slate-900 border border-slate-700/60 rounded-2xl px-3 py-3 text-center">
      <div className="text-xl font-black text-slate-100 tabular-nums truncate">{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
