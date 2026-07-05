import { NextResponse } from "next/server";
import { suggestCancellations } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rateLimit";
import type { Subscription } from "@/lib/types";

// Cap the payload so a single request can't send a huge list and drive up
// token usage (and cost) on the server fallback key.
const MAX_SUBSCRIPTIONS = 500;

export async function POST(request: Request) {
  // Calls the paid Anthropic API — rate limit per client so it can't be
  // spammed to run up the account owner's bill.
  const limited = checkRateLimit(request, { name: "insights", limit: 15, windowMs: 60_000 });
  if (limited) return limited;

  let body: { subscriptions?: Subscription[]; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.subscriptions) || body.subscriptions.length === 0) {
    return NextResponse.json({ error: "subscriptions array is required" }, { status: 400 });
  }
  if (body.subscriptions.length > MAX_SUBSCRIPTIONS) {
    return NextResponse.json(
      { error: `subscriptions must contain at most ${MAX_SUBSCRIPTIONS} items` },
      { status: 400 },
    );
  }

  try {
    const suggestions = await suggestCancellations(body.subscriptions, body.apiKey);
    return NextResponse.json({ suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Insight generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
