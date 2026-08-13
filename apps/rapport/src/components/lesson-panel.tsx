"use client";

import { useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import type { Lesson } from "@/domain/types";

// ---------------------------------------------------------------------------
// A micro-lesson.
//
// Six short sections, with the common mistake given equal weight to the
// concept — for most of these skills people already roughly know what to do and
// are doing one specific thing that undoes it.
//
// Sources are collapsed by default but always present. A claim that leans on
// research should be checkable, and one that only leans on practitioner
// consensus should say so rather than borrowing authority it does not have.
// ---------------------------------------------------------------------------

export function LessonPanel({ lesson, onDone }: { lesson: Lesson; onDone: () => void | Promise<void> }) {
  const [showSources, setShowSources] = useState(false);

  return (
    <Card as="article" className="rise">
      <div className="flex items-center gap-2">
        <Badge tone="accent">{lesson.estimatedMinutes} min read</Badge>
      </div>
      <h2 className="mt-3 text-lg font-semibold tracking-tight">{lesson.title}</h2>

      <div className="mt-4 space-y-4">
        <Section label="The idea" body={lesson.concept} />
        <Section label="Why it matters" body={lesson.whyItMatters} />
        <Section label="What it looks like" body={lesson.example} />
        <Section label="The common mistake" body={lesson.commonMistake} tone="warn" />
        <Section label="Try it" body={lesson.practice} />
        <Section label="Where it applies" body={lesson.realWorldApplication} />
      </div>

      {lesson.sources.length > 0 ? (
        <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setShowSources((value) => !value)}
            className="text-xs font-medium underline"
            style={{ color: "var(--text-muted)" }}
            aria-expanded={showSources}
          >
            {showSources ? "Hide" : "Show"} what this is based on ({lesson.sources.length})
          </button>
          {showSources ? (
            <ul className="mt-3 space-y-3">
              {lesson.sources.map((source) => (
                <li key={source.citation} className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium" style={{ color: "var(--text)" }}>{source.citation}</span>
                    <Badge tone={source.strength === "strong" ? "accent" : source.strength === "moderate" ? "neutral" : "warn"}>
                      {source.strength === "practitioner-consensus" ? "practitioner consensus" : source.strength}
                    </Badge>
                  </div>
                  <p className="mt-1">{source.claim}</p>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer noopener" className="underline">
                      Source
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 text-[11px]" style={{ color: "var(--text-faint)" }}>
          Written from this skill&apos;s behaviour definitions rather than from a specific source.
        </p>
      )}

      <div className="mt-5">
        <Button onClick={() => void onDone()}>Got it</Button>
      </div>
    </Card>
  );
}

function Section({ label, body, tone = "normal" }: { label: string; body: string; tone?: "normal" | "warn" }) {
  return (
    <section>
      <h3
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: tone === "warn" ? "var(--warn)" : "var(--text-faint)" }}
      >
        {label}
      </h3>
      <p className="mt-1 text-[15px] leading-relaxed">{body}</p>
    </section>
  );
}
