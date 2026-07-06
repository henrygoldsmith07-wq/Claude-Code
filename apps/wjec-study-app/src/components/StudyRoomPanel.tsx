"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface LeaderboardEntry {
  display_name: string;
  xp: number;
  current_streak: number;
}

interface Props {
  userId: string;
  displayName: string;
}

// A shared "study room": Supabase Realtime presence shows who else is
// studying right now, and a periodically-refreshed leaderboard shows peer XP
// standings. Presence is ephemeral (in-memory on the channel); the
// leaderboard is read through the hardened get_leaderboard() RPC.
export default function StudyRoomPanel({ userId, displayName }: Props) {
  const [online, setOnline] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function refreshLeaderboard() {
      const { data } = await supabase.rpc("get_leaderboard");
      if (data) setLeaderboard(data);
    }
    refreshLeaderboard();

    const channel = supabase.channel("study-room", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ name: string }>();
        const names = Object.values(state)
          .flat()
          .map((p) => p.name);
        setOnline(names);
        // A join/leave usually means XP standings shifted, so refresh.
        refreshLeaderboard();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: displayName || "Anonymous" });
        }
      });

    const interval = setInterval(refreshLeaderboard, 30000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId, displayName]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm font-medium">
          Studying now
          <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-emerald-500 align-middle" />
        </p>
        {online.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            You&apos;re the first one here — invite a friend to study alongside you.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {online.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm font-medium">Leaderboard</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Friendly XP standings — a nudge to keep going, not a ranking to stress over.
        </p>
        <ol className="mt-3 flex flex-col gap-1.5">
          {leaderboard.map((entry, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-5 text-right text-xs text-zinc-400">{i + 1}</span>
                {entry.display_name}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {entry.xp} XP · {entry.current_streak}🔥
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
