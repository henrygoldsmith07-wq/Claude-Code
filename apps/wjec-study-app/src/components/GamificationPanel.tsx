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
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium">Level {level}</p>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
          <div
            className="h-full rounded-full"
            style={{
              width: `${(xpProgress / XP_PER_LEVEL) * 100}%`,
              backgroundColor: accent ?? "#8b5cf6",
            }}
          />
        </div>
        <p className="text-xs text-ink3">
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
                ? "rounded-full bg-reviewsoft px-3 py-1 text-xs font-medium text-review"
                : "rounded-full bg-surface2 px-3 py-1 text-xs text-ink3"
            }
          >
            {badge.name}
          </span>
        ))}
      </div>
    </div>
  );
}
