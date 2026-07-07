import Link from "next/link";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { serializeProfile } from "@/lib/db/serialize";
import { signOutAction } from "@/app/login/actions";
import { pointsIntoLevel, POINTS_PER_LEVEL } from "@/lib/gamification";

export default async function AppHeader() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const db = await getDb();
  const profileDoc = await db.collection("profiles").findOne({ _id: new ObjectId(session.user.id) });
  const profile = profileDoc ? serializeProfile(profileDoc) : null;

  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--rule)] bg-[var(--panel)] px-6 py-3">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Daily Debate
      </Link>
      <nav className="flex items-center gap-4 text-sm text-zinc-400">
        <Link href="/" className="hover:text-[var(--foreground)]">
          Today
        </Link>
        <Link href="/leaderboard" className="hover:text-[var(--foreground)]">
          Leaderboard
        </Link>
      </nav>
      <div className="flex items-center gap-4 text-sm">
        {profile && (
          <span className="tabular text-zinc-400" title={`${pointsIntoLevel(profile.total_points)}/${POINTS_PER_LEVEL} pts into level ${profile.level}`}>
            Lvl {profile.level} · {profile.total_points} pts · 🔥 {profile.current_streak}
          </span>
        )}
        <form action={signOutAction}>
          <button type="submit" className="text-zinc-500 hover:text-[var(--foreground)]">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
