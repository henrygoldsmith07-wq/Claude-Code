import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { getOrCreateTodayTopic } from "@/lib/dailyTopic";
import AppHeader from "@/components/AppHeader";
import TopicCard from "@/components/TopicCard";

// Generates today's topic via the Gemini API on first request each day —
// not something that can be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const topic = await getOrCreateTodayTopic();

  let activeDebateId: string | null = null;
  if (session?.user?.id) {
    const db = await getDb();
    const activeDebate = await db.collection("solo_debates").findOne(
      { user_id: new ObjectId(session.user.id), topic_id: new ObjectId(topic.id), status: "active" },
      { sort: { created_at: -1 } },
    );
    activeDebateId = activeDebate ? activeDebate._id.toString() : null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Today&apos;s topic</p>
          <h1 className="text-2xl font-semibold tracking-tight">{topic.title}</h1>
        </div>
        <TopicCard topic={topic} activeDebateId={activeDebateId} />
      </main>
    </div>
  );
}
