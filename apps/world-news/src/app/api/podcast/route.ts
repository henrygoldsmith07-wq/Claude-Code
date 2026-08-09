import { unstable_cache } from "next/cache";
import { getCountryNews, getWorldNews, UnknownCountryError } from "@/lib/news";
import { MissingApiKeyError, RateLimitError } from "@/lib/gemini";
import { generatePodcast, type Podcast } from "@/lib/podcast";

// Returns a NotebookLM-style two-host audio-briefing script for either a country
// (?scope=country&code=us) or the world (?scope=world). Built from the same
// cached news the pages render, and itself cached per scope+code+day so the
// (free) Groq call only runs once per window.
export const dynamic = "force-dynamic";

function cacheDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "world" ? "world" : "country";
  const code = (searchParams.get("code") ?? "").toLowerCase();

  if (scope === "country" && !/^[a-z]{2}$/.test(code)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const build = unstable_cache(
      async (): Promise<Podcast> => {
        const news = scope === "world" ? await getWorldNews() : await getCountryNews(code);
        return generatePodcast(news);
      },
      ["podcast", scope, code, cacheDay()],
      { revalidate: 6 * 60 * 60 },
    );
    return Response.json(await build());
  } catch (error) {
    if (error instanceof UnknownCountryError) {
      return Response.json({ error: "unknown_country" }, { status: 404 });
    }
    if (error instanceof MissingApiKeyError) {
      return Response.json({ error: "no_api_key" }, { status: 503 });
    }
    if (error instanceof RateLimitError) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    console.error("Failed to build podcast:", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
