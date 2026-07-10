"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function fmt(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// A date slider over a place's archived snapshots, letting the reader scrub back
// through history. The newest stop is "Latest" (live); older stops load that
// day's stored snapshot via a ?date= param. Hidden unless there are ≥2 days.
export default function TimelineControl({
  dates,
  current,
  basePath,
  extraQuery = "",
}: {
  dates: string[];
  current?: string;
  basePath: string;
  extraQuery?: string;
}) {
  const router = useRouter();
  const asc = [...dates].reverse(); // oldest → newest
  const startIdx = current ? Math.max(0, asc.indexOf(current)) : asc.length - 1;
  const [idx, setIdx] = useState(startIdx);

  if (asc.length < 2) return null;

  const isLatest = idx === asc.length - 1;
  const go = (i: number) => {
    setIdx(i);
    const params = new URLSearchParams(extraQuery);
    if (i !== asc.length - 1) params.set("date", asc[i]);
    const qs = params.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="rounded-xl border border-rule bg-panel p-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="uppercase tracking-wide text-muted">🕑 Timeline</span>
        <span className="font-medium text-foreground">
          {isLatest ? "Latest" : fmt(asc[idx])}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={asc.length - 1}
        value={idx}
        step={1}
        onChange={(e) => go(Number(e.target.value))}
        aria-label="Browse the news timeline by date"
        className="w-full accent-[color:var(--accent,#4f8cff)]"
      />
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{fmt(asc[0])}</span>
        <span>Latest</span>
      </div>
    </div>
  );
}
