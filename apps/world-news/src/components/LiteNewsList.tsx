"use client";
import Link from "next/link";
import type { CountryNews } from "@/lib/gemini";
import { dotColor } from "@/lib/topicColors";

export default function LiteNewsList({ news }: { news: CountryNews }) {
  const stories = news.stories ?? [];
  const points = news.points ?? [];
  // Sort stories by significance when available, otherwise keep original order
  const sorted = [...stories].sort((a, b) => (b.significance ?? -1) - (a.significance ?? -1));
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-rule bg-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Lite mode — globe off
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Low-bandwidth view: stories ranked by editorial significance (not popularity), full text
          and sources, no Three.js. Timeline is an observed sequence — not a causal explanation
          unless a source states the cause.
        </p>
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-3">
          {sorted.map((s) => (
            <article
              key={s.id}
              className="rounded-xl border border-rule bg-panel p-4 hover:border-accent/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: dotColor(s.topic) }}
                  aria-hidden
                />
                <span className="text-xs font-medium text-muted">{s.topic}</span>
                {typeof s.significance === "number" && (
                  <span className="rounded-full border border-rule bg-panel-soft px-2 py-0.5 text-[11px] text-muted">
                    Significance {s.significance}
                  </span>
                )}
              </div>
              <h3 className="mt-1 text-sm font-semibold leading-tight">{s.headline}</h3>
              {s.location?.label && (
                <p className="mt-0.5 text-xs text-muted">
                  📍 {s.location.label}
                  {s.location.countryCode ? ` · ${s.location.countryCode}` : ""}
                </p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.summary}</p>
              {s.significanceReasons && s.significanceReasons.length > 0 && (
                <p className="mt-1 text-[11px] text-muted">
                  Why significant: {s.significanceReasons.join(" · ")}
                </p>
              )}
              {s.timeline.length > 0 && (
                <ol className="mt-2 space-y-1 border-l border-rule pl-3">
                  {s.timeline.slice(0, 4).map((e, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-medium text-foreground">{e.date}</span>{" "}
                      <span className="text-muted">— {e.label}</span>
                      {e.kind === "correction" && (
                        <span className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-300">
                          correction
                        </span>
                      )}
                      {e.kind === "update" && (
                        <span className="ml-1 rounded bg-sky-500/15 px-1 py-0.5 text-[10px] text-sky-300">
                          update
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {s.historicalContext && s.historicalContext.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  <span className="font-medium">Prior context:</span> {s.historicalContext.join(" · ")}
                </p>
              )}
              {s.widelyAgreedFacts.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  <span className="font-medium text-success">Widely agreed:</span>{" "}
                  {s.widelyAgreedFacts.slice(0, 2).join(" · ")}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.sources.slice(0, 4).map((src) => (
                  <a
                    key={src.url}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent underline-offset-2 hover:underline"
                  >
                    {src.publisher ?? new URL(src.url).hostname.replace(/^www\./, "")}
                  </a>
                ))}
              </div>
              {s.methodology?.provenanceNote && (
                <p className="mt-2 text-[11px] italic text-muted/80">{s.methodology.provenanceNote}</p>
              )}
            </article>
          ))}
        </div>
      ) : points.length > 0 ? (
        <div className="rounded-xl border border-rule bg-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Headlines in view ({points.length})
          </p>
          <ul className="mt-3 space-y-2">
            {points.slice(0, 24).map((p, i) => (
              <li key={`${p.lat}-${p.lng}-${i}`} className="flex gap-2 text-sm">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: dotColor(p.topic) }}
                />
                <span>
                  <span className="font-medium text-foreground">{p.headline}</span>{" "}
                  <span className="text-xs text-muted">
                    {p.location}
                    {p.topic ? ` · ${p.topic}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl border border-rule bg-panel p-4 text-sm text-muted">
          No headlines yet — the page is still generating. Refresh shortly.
        </p>
      )}

      <div className="flex gap-2">
        <Link
          href="/world"
          className="rounded-lg border border-rule bg-panel px-3 py-2 text-sm hover:border-accent"
        >
          Around the world →
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-rule bg-panel px-3 py-2 text-sm hover:border-accent"
        >
          Globe view
        </Link>
      </div>
    </div>
  );
}
