"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mmss, relativeTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export function Dashboard() {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/meetings", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load meetings (${res.status})`);
      const data = (await res.json()) as { meetings: Meeting[] };
      setMeetings(data.meetings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // reflect newly recorded / transcribed meetings
    return () => clearInterval(t);
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this recording? This cannot be undone.")) return;
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    setMeetings((m) => m?.filter((x) => x.id !== id) ?? null);
  }

  function copyShare(shareId: string) {
    const url = `${window.location.origin}/share/${shareId}`;
    navigator.clipboard?.writeText(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meetings</h1>
          <p className="mt-1 text-sm text-white/40">
            Recordings from the desktop app appear here automatically.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {meetings === null && !error && <p className="text-sm text-white/40">Loading…</p>}

      {meetings?.length === 0 && (
        <div className="rounded-xl border border-dashed border-edge p-10 text-center text-sm text-white/40">
          No meetings yet. Open the desktop recorder, hit record, and stop — it’ll show up here.
        </div>
      )}

      <div className="grid gap-3">
        {meetings?.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-xl border border-edge bg-panel px-4 py-3"
          >
            <Link href={`/meeting/${m.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.title}</p>
              <p className="mt-0.5 text-xs text-white/40">
                {relativeTime(m.createdAt)}
                {m.durationSec > 0 && <> · {mmss(m.durationSec)}</>} · {statusLabel(m.status)}
              </p>
            </Link>
            <div className="ml-4 flex shrink-0 items-center gap-2">
              <button
                onClick={() => copyShare(m.shareId)}
                className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-white/60 hover:text-white"
                title="Copy share link"
              >
                Share
              </button>
              <button
                onClick={() => remove(m.id)}
                className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-white/40 hover:text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusLabel(status: Meeting["status"]): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "processing":
      return "Transcribing…";
    case "error":
      return "Error";
    default:
      return "Uploading…";
  }
}
