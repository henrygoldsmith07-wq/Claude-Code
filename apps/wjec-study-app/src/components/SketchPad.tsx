"use client";

import { useRef, useState } from "react";

interface Props {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function SketchPad({ onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  function getContext() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={480}
        height={280}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDrawing(false)}
        onPointerLeave={() => setDrawing(false)}
        className="touch-none rounded-lg border border-zinc-300 bg-white dark:border-zinc-700"
      />
      <div className="flex gap-2 text-xs">
        <button onClick={handleClear} className="rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700">
          Clear
        </button>
        <button
          onClick={() => canvasRef.current && onSave(canvasRef.current.toDataURL("image/png"))}
          className="rounded-full bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900"
        >
          Save sketch
        </button>
        <button onClick={onCancel} className="text-zinc-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
