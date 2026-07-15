import { notFound } from "next/navigation";
import { loadMeetingByShareId } from "@/lib/load";
import { MeetingView } from "@/components/MeetingView";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: { shareId: string } }) {
  const data = await loadMeetingByShareId(params.shareId);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40">Shared recording</p>
      <MeetingView
        meeting={data.meeting}
        playbackUrl={data.playbackUrl}
        initialChat={data.chat}
        readOnly
      />
    </div>
  );
}
