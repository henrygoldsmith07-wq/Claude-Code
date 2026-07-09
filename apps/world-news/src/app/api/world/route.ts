import { NextResponse } from "next/server";
import { getWorldNews } from "@/lib/news";
import { MissingApiKeyError, RateLimitError } from "@/lib/gemini";

// Powers the news dots (and conflict arcs) on the globe views. On any failure
// it returns empty arrays with 200 so the globe simply renders without dots
// rather than erroring.
export async function GET() {
  try {
    const news = await getWorldNews();
    return NextResponse.json(news);
  } catch (error) {
    if (!(error instanceof MissingApiKeyError) && !(error instanceof RateLimitError)) {
      console.error("Failed to load world news for globe:", error);
    }
    return NextResponse.json({ points: [], conflicts: [] });
  }
}
