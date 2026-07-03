import { NextResponse } from "next/server";
import { generateCoachBriefing } from "@/lib/anthropic";

export async function POST(request: Request) {
  let body: { summary?: string; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.summary || !body.summary.trim()) {
    return NextResponse.json({ error: "summary is required" }, { status: 400 });
  }

  try {
    const briefing = await generateCoachBriefing(body.summary, body.apiKey);
    return NextResponse.json({ briefing });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Briefing generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
