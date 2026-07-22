"use client";

interface Props {
  goal: number;
  done: number;
  onChangeGoal: (n: number) => void;
}

const PRESETS = [10, 20, 30, 50, 100];

export default function DailyGoalBar({ goal, done, onChangeGoal }: Props) {
  const pct = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  const met = goal > 0 && done >= goal;

  return (
    <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Daily review goal</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {met
              ? "Goal met — nice work."
              : goal > 0
                ? `${done} of ${goal} reviews today`
                : "Set a target to stay consistent"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChangeGoal(n)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                goal === n
                  ? "bg-[#3b4a6b] text-white"
                  : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChangeGoal(0)}
            className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Off
          </button>
        </div>
      </div>
      {goal > 0 && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                met ? "bg-emerald-500" : "bg-[#3b4a6b]"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[10px] tabular text-zinc-500">{pct}%</p>
        </div>
      )}
    </div>
  );
}
