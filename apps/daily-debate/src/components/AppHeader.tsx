import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { pointsIntoLevel, POINTS_PER_LEVEL } from "@/lib/gamification";

export default async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--rule)] bg-[var(--panel)] px-6 py-3">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Daily Debate
      </Link>
      <nav className="flex items-center gap-4 text-sm text-zinc-400">
        <Link href="/" className="hover:text-[var(--foreground)]">
          Today
        </Link>
        <Link href="/pvp" className="hover:text-[var(--foreground)]">
          PvP
        </Link>
        <Link href="/leaderboard" className="hover:text-[var(--foreground)]">
          Leaderboard
        </Link>
      </nav>
      <div className="flex items-center gap-4 text-sm">
        {profile && (
          <span
            className="chip-elevated tabular rounded-full px-3 py-1 text-zinc-300"
            title={`${pointsIntoLevel(profile.total_points)}/${POINTS_PER_LEVEL} pts into level ${profile.level}`}
          >
            Lvl {profile.level} · {profile.total_points} pts · 🔥 {profile.current_streak}
          </span>
        )}
        <form action={signOut}>
          <button type="submit" className="btn btn-ghost px-3 py-1 text-xs">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
