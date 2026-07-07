import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { serializeProfile } from "@/lib/db/serialize";
import AppHeader from "@/components/AppHeader";

export default async function LeaderboardPage() {
  const session = await auth();
  const db = await getDb();
  const docs = await db.collection("profiles").find({}).sort({ total_points: -1 }).limit(50).toArray();
  const profiles = docs.map(serializeProfile);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <div className="overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--panel)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Streak</th>
                <th className="px-4 py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile, index) => (
                <tr
                  key={profile.id}
                  className={`tabular border-b border-[var(--rule)] last:border-0 ${
                    profile.id === session?.user?.id ? "bg-[var(--accent-soft)]" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-zinc-500">{index + 1}</td>
                  <td className="px-4 py-3">{profile.username ?? "Anonymous"}</td>
                  <td className="px-4 py-3">{profile.level}</td>
                  <td className="px-4 py-3">🔥 {profile.current_streak}</td>
                  <td className="px-4 py-3 text-right font-medium">{profile.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
