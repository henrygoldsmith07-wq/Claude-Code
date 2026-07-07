import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { serializeDebate, serializeTopic, serializeTurn } from "@/lib/db/serialize";
import AppHeader from "@/components/AppHeader";
import DebateRoom from "@/components/DebateRoom";

export default async function DebatePage({ params }: { params: Promise<{ debateId: string }> }) {
  const { debateId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();
  if (!ObjectId.isValid(debateId)) notFound();

  const db = await getDb();
  const debateDoc = await db.collection("solo_debates").findOne({
    _id: new ObjectId(debateId),
    user_id: new ObjectId(session.user.id),
  });
  if (!debateDoc) notFound();

  const topicDoc = await db.collection("daily_topics").findOne({ _id: debateDoc.topic_id });
  if (!topicDoc) notFound();

  const turnDocs = await db
    .collection("solo_debate_turns")
    .find({ debate_id: debateDoc._id })
    .sort({ round_number: 1 })
    .toArray();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
        <DebateRoom
          debate={serializeDebate(debateDoc)}
          topic={serializeTopic(topicDoc)}
          initialTurns={turnDocs.map(serializeTurn)}
        />
      </main>
    </div>
  );
}
