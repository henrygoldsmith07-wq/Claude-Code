"use client";

import { XP_PER_LEVEL } from "@/lib/gamification";
import type { Badge } from "@/lib/gamification";

interface Props {
  level: number;
  xpProgress: number;
  badges: Badge[];
  accent?: string;
}

export default function GamificationPanel({ level, xpProgress, badges, accent }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium">Level {level}</p>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full"
            style={{
              width: `${(xpProgress / XP_PER_LEVEL) * 100}%`,
              backgroundColor: accent ?? "#8b5cf6",
            }}
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {xpProgress} / {XP_PER_LEVEL} XP
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span
            key={badge.id}
            title={badge.description}
            className={
              badge.earned
                ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : "rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
            }
          >
            {badge.name}
          </span>
        ))}
      </div>
    </div>
  );
}
