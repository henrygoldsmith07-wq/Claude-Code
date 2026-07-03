import { NextResponse } from "next/server";
import { suggestCancellations } from "@/lib/anthropic";
import type { Subscription } from "@/lib/types";

export async function POST(request: Request) {
  let body: { subscriptions?: Subscription[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.subscriptions) || body.subscriptions.length === 0) {
    return NextResponse.json({ error: "subscriptions array is required" }, { status: 400 });
  }

  try {
    const suggestions = await suggestCancellations(body.subscriptions);
    return NextResponse.json({ suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Insight generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
