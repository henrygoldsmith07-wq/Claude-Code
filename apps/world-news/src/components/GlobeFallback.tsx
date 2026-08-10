"use client";

import Link from "next/link";
import type { NewsPoint } from "@/lib/gemini";
import { dotColor } from "@/lib/topicColors";

function supportsWebGL(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export default function GlobeFallback({
  points,
  onSelectCountry,
}: {
  points: NewsPoint[];
  onSelectCountry?: (code: string) => void;
}) {
  const byCountry = new Map<string, NewsPoint[]>();
  for (const p of points) {
    const k = p.countryCode || "—";
    const arr = byCountry.get(k) ?? [];
    arr.push(p);
    byCountry.set(k, arr);
  }
  const sorted = [...byCountry.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 24);

  if (supportsWebGL()) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-auto bg-background p-6">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-300">Globe unavailable — showing list fallback</p>
          <p className="mt-1 text-xs text-muted">
            WebGL is not available on this device/browser. Dots are shown below by country, grouped and
            linked. For the full globe, try a browser with WebGL 1+ enabled or switch to the <Link href="/world?lite=1" className="text-accent underline">lite list</Link>.
          </p>
        </div>
        <div className="rounded-xl border border-rule bg-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Headlines by country — tap to open
          </p>
          <ul className="mt-3 space-y-2">
            {sorted.map(([code, list]) => (
              <li key={code} className="flex items-start justify-between gap-3 border-b border-rule/60 py-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {code}{" "}
                    <span className="text-xs font-normal text-muted">· {list.length} stories</span>
                  </p>
                  <ul className="mt-1 space-y-1">
                    {list.slice(0, 3).map((p, i) => (
                      <li key={i} className="flex gap-2 text-xs text-muted">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dotColor(p.topic) }} />
                        <span className="line-clamp-2">{p.headline}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {code !== "—" && onSelectCountry && (
                  <button
                    type="button"
                    onClick={() => onSelectCountry(code)}
                    className="shrink-0 rounded-full border border-rule bg-panel-soft px-3 py-1 text-xs hover:border-accent"
                  >
                    Open →
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function webGLAvailable(): boolean {
  return supportsWebGL();
}
