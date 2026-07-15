import { createClient } from "@/lib/supabase/server";
import { getFactorRatings } from "@/lib/ratings";
import AppHeader from "@/components/AppHeader";
import RatingBreakdown from "@/components/RatingBreakdown";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("total_points", { ascending: false })
    .limit(50);

  const ratings = user ? await getFactorRatings(supabase, user.id) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        {ratings && <RatingBreakdown ratings={ratings} />}
        <div className="surface-card overflow-hidden">
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
              {(profiles ?? []).map((profile, index) => (
                <tr
                  key={profile.id}
                  className={`tabular border-b border-[var(--rule)] last:border-0 ${
                    profile.id === user?.id ? "bg-[var(--accent-soft)]" : ""
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
