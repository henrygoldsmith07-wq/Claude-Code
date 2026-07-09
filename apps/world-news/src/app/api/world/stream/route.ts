import { fetchTopicGeoNews, GDELT_TOPICS } from "@/lib/gdelt";
import { enrichPointsWithGroq } from "@/lib/groq";

// Streams geolocated news dots to the globe as they're produced (Server-Sent
// Events), so they appear on the map progressively. Points come from GDELT
// (free, real coordinates) and are tagged by Groq when GROQ_API_KEY is set.
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        for (const topic of GDELT_TOPICS) {
          const raw = await fetchTopicGeoNews(topic);
          if (raw.length === 0) continue;
          const enriched = await enrichPointsWithGroq(raw);
          for (const point of enriched) send({ type: "point", point });
        }
      } catch {
        // Ignore — whatever was streamed already stands; the client falls back
        // for the rest.
      }

      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
