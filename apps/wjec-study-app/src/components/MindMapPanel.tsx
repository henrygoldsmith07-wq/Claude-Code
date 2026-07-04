"use client";

import { useState } from "react";
import type { MindMap } from "@/lib/types";

interface Props {
  apiKey: string;
}

const SIZE = 480;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 70;

function layout(mindMap: MindMap) {
  const positions = new Map<string, { x: number; y: number }>();
  mindMap.nodes.forEach((node, i) => {
    const angle = (i / mindMap.nodes.length) * Math.PI * 2 - Math.PI / 2;
    positions.set(node.id, {
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    });
  });
  return positions;
}

export default function MindMapPanel({ apiKey }: Props) {
  const [sourceText, setSourceText] = useState("");
  const [subjectContext, setSubjectContext] = useState("");
  const [mindMap, setMindMap] = useState<MindMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!sourceText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectContext: subjectContext || "general",
          sourceText,
          apiKey: apiKey || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate mind map");
      setMindMap({ topic: subjectContext || "Mind map", nodes: data.nodes, edges: data.edges });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate mind map");
    } finally {
      setLoading(false);
    }
  }

  const positions = mindMap ? layout(mindMap) : null;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <input
          value={subjectContext}
          onChange={(e) => setSubjectContext(e.target.value)}
          placeholder="Topic name (e.g. Cell membranes & transport)"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          rows={4}
          placeholder="Paste your notes here, or just describe the topic you want mapped…"
          className="mt-2 w-full rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading || !sourceText.trim()}
          className="mt-2 rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
        >
          {loading ? "Generating…" : "Generate mind map"}
        </button>
      </div>

      {mindMap && positions && (
        <div className="overflow-x-auto rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="mx-auto">
            {mindMap.edges.map((edge, i) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              if (!from || !to) return null;
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              return (
                <g key={i}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className="stroke-zinc-300 dark:stroke-zinc-700"
                    strokeWidth={1.5}
                  />
                  <text x={midX} y={midY} fontSize={9} className="fill-zinc-500 dark:fill-zinc-400">
                    {edge.label}
                  </text>
                </g>
              );
            })}
            {mindMap.nodes.map((node) => {
              const pos = positions.get(node.id);
              if (!pos) return null;
              return (
                <g key={node.id}>
                  <circle cx={pos.x} cy={pos.y} r={34} className="fill-violet-100 stroke-violet-400 dark:fill-violet-950 dark:stroke-violet-700" />
                  <foreignObject x={pos.x - 34} y={pos.y - 34} width={68} height={68}>
                    <div className="flex h-full w-full items-center justify-center p-1 text-center text-[9px] leading-tight text-zinc-900 dark:text-zinc-100">
                      {node.label}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
