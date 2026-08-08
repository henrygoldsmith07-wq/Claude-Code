"use client";

import { useState } from "react";
import type { NewsPoint } from "@/lib/gemini";
import { dotColor } from "@/lib/topicColors";

interface NewsFeedProps {
  points: NewsPoint[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (point: NewsPoint) => void;
}

export default function NewsFeed({
  points,
  open: controlledOpen,
  onOpenChange,
  onSelect,
}: NewsFeedProps) {
  const [internalOpen, setInternalOpen] = useState(true);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-20 left-4 z-40 rounded-full border border-rule bg-panel/95 px-3 py-2 text-xs shadow-lg backdrop-blur hover:border-accent"
      >
        📰 Feed ({points.length})
      </button>
    );
  }

  return (
    <div className="absolute bottom-20 left-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-rule bg-panel/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-rule px-3 py-2">
        <div>
          <p className="text-sm font-semibold">Newsfeed</p>
          <p className="text-[11px] text-muted">
            {points.length} stories in current view
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded px-2 py-0.5 text-sm text-muted hover:bg-panel-soft"
        >
          ✕
        </button>
      </div>

      <div className="max-h-80 space-y-0 overflow-y-auto">
        {points.length === 0 ? (
          <p className="p-4 text-sm text-muted">
            Zoom or pan to see stories in this view, or wait for the live stream.
          </p>
        ) : (
          points.map((p, i) => (
            <button
              key={`${p.lat}-${p.lng}-${i}`}
              type="button"
              onClick={() => onSelect?.(p)}
              className="block w-full border-b border-rule/60 px-3 py-2.5 text-left hover:bg-panel-soft"
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: dotColor(p.topic) }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-foreground">
                    {p.headline}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {p.location}
                    {p.topic ? ` · ${p.topic}` : ""}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
