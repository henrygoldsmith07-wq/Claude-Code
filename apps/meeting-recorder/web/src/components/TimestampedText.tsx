"use client";

import React from "react";
import { parseTimestamp } from "@/lib/format";

const TIMESTAMP_RE = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;

/**
 * Renders text, turning any [m:ss] / [h:mm:ss] tokens into clickable links that
 * seek the player. Used for AI answers and the summary.
 */
export function TimestampedText({
  text,
  onSeek,
}: {
  text: string;
  onSeek: (seconds: number) => void;
}) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  // Reset lastIndex because the regex is defined with the /g flag at module scope.
  TIMESTAMP_RE.lastIndex = 0;
  while ((match = TIMESTAMP_RE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const label = match[1];
    nodes.push(
      <button
        key={`ts-${key++}`}
        onClick={() => onSeek(parseTimestamp(label))}
        className="mx-0.5 rounded bg-brand/20 px-1 font-mono text-xs text-brand-soft hover:bg-brand/40"
      >
        {label}
      </button>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <span className="whitespace-pre-wrap">{nodes}</span>;
}
