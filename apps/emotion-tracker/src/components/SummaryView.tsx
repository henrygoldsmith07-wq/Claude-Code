"use client";

import { useState } from "react";
import type { ReflectionSummary } from "@/lib/types";

export default function SummaryView({ summary }: { summary: ReflectionSummary }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = [
      `Core emotion: ${summary.coreEmotion}`,
      "",
      "Triggers:",
      ...summary.underlyingTriggers.map((t) => `• ${t}`),
      "",
      "Possible biases:",
      ...summary.possibleBiases.map((b) => `• ${b.type}: ${b.description}`),
      "",
      `Other perspective: ${summary.otherPerspective}`,
      "",
      `Honest assessment: ${summary.balancedAssessment}`,
      "",
      "Caution flags:",
      ...summary.cautionFlags.map((c) => `• ${c}`),
      "",
      "Next steps:",
      ...summary.suggestedNextSteps.map((s) => `• ${s}`),
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            What's actually underneath it
          </h3>
          <p className="mt-1 text-lg font-medium">{summary.coreEmotion}</p>
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {copied ? "Copied!" : "Copy summary"}
        </button>
      </div>

      {summary.underlyingTriggers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            What actually triggered it
          </h3>
          <ul className="mt-1 list-inside list-disc text-sm">
            {summary.underlyingTriggers.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.possibleBiases.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Where you might be reasoning in your own favor
          </h3>
          <ul className="mt-1 flex flex-col gap-1.5">
            {summary.possibleBiases.map((b, i) => (
              <li
                key={i}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950"
              >
                <span className="font-medium">{b.type}</span> — {b.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          How the other side might see it
        </h3>
        <p className="mt-1 text-sm">{summary.otherPerspective}</p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Honest assessment
        </h3>
        <p className="mt-1 text-sm">{summary.balancedAssessment}</p>
      </div>

      {summary.cautionFlags.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Pause before you act on these
          </h3>
          <ul className="mt-1 flex flex-col gap-1.5">
            {summary.cautionFlags.map((c, i) => (
              <li
                key={i}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Sensible next steps
        </h3>
        <ul className="mt-1 list-inside list-disc text-sm">
          {summary.suggestedNextSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
