"use client";

import { useEffect, useState } from "react";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// Turn an ISO timestamp into a coarse "x minutes/hours ago" phrase.
function relative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = then - Date.now();
  const mins = Math.round(diffMs / 60000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

// Live "Updated 12 minutes ago" label that refreshes itself, so users can see
// how fresh the summary is. The absolute time is kept as a hover tooltip.
export default function TimeAgo({ iso, prefix = "Updated " }: { iso: string; prefix?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const label = relative(iso);
  if (!label) return null;
  const absolute = new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <span title={absolute}>
      {prefix}
      {label}
    </span>
  );
}
