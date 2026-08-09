import Link from "next/link";
import { notFound } from "next/navigation";
import { loadMeetingById } from "@/lib/load";
import { MeetingView } from "@/components/MeetingView";

export const dynamic = "force-dynamic";

export default async function MeetingPage({ params }: { params: { id: string } }) {
  const data = await loadMeetingById(params.id);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-white/40 hover:text-white/70">
        ← All meetings
      </Link>
      <MeetingView
        meeting={data.meeting}
        playbackUrl={data.playbackUrl}
        initialChat={data.chat}
      />
    </div>
  );
}
