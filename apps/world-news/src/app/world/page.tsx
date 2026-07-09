import Link from "next/link";
import { getWorldNews, getWorldArchiveDates } from "@/lib/news";
import { MissingApiKeyError, RateLimitError, type CountryNews } from "@/lib/gemini";
import TopicSection from "@/components/TopicSection";
import SourceList from "@/components/SourceList";
import TimeAgo from "@/components/TimeAgo";
import PodcastPlayer from "@/components/PodcastPlayer";
import TimelineControl from "@/components/TimelineControl";

// News is fetched live (with a short cache in getWorldNews), so never
// prerender this at build time.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Around the World — World News Globe",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-accent underline-offset-2 hover:underline">
        ← Back to the globe
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Around the World</h1>
      <p className="mt-1 text-sm text-muted">
        The most important news worldwide, summarised impartially and split by topic.
      </p>
      <div className="mt-6">{children}</div>
    </main>
  );
}

export default async function WorldPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const dateParam = typeof sp.date === "string" ? sp.date : undefined;

  const archiveDates = await getWorldArchiveDates().catch(() => []);
  const timeline = (
    <TimelineControl dates={archiveDates} current={dateParam} basePath="/world" />
  );

  // Historical view: load the archived world snapshot for the requested date.
  if (dateParam) {
    const archived = await getWorldNews(dateParam);
    return (
      <Shell>
        {timeline}
        {!archived || archived.topics.length === 0 ? (
          <div className="mt-4 rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
            No archived world news for this date.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted">
              Archived snapshot · <TimeAgo iso={archived.generatedAt} prefix="generated " />
            </p>
            {archived.topics.map((topic) => (
              <TopicSection key={topic.topic} topic={topic} />
            ))}
            <SourceList sources={archived.sources} />
          </div>
        )}
      </Shell>
    );
  }

  let news: CountryNews;
  try {
    news = await getWorldNews();
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return (
        <Shell>
          <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
            <p className="font-medium text-foreground">Gemini API key not configured.</p>
            <p className="mt-2">
              Add <code className="rounded bg-panel-soft px-1.5 py-0.5">GEMINI_API_KEY</code> to{" "}
              <code className="rounded bg-panel-soft px-1.5 py-0.5">.env.local</code> and restart
              the dev server. Get a key at{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                aistudio.google.com/apikey
              </a>
              .
            </p>
          </div>
        </Shell>
      );
    }
    if (error instanceof RateLimitError) {
      return (
        <Shell>
          <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
            <p className="font-medium text-foreground">Free-tier limit reached.</p>
            <p className="mt-2">
              Gemini&apos;s free tier caps how much news can be generated in a short
              window. Please wait a minute and try again — already-loaded pages stay
              cached. To lift the limit, enable billing on your Google AI Studio key.
            </p>
          </div>
        </Shell>
      );
    }
    console.error("Failed to load world news:", error);
    return (
      <Shell>
        <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
          Couldn&apos;t load the news right now. Please try again in a moment.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="-mt-4 mb-4 text-xs text-muted">
        <TimeAgo iso={news.generatedAt} />
      </p>

      {news.topics.length === 0 ? (
        <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
          No significant news surfaced right now. Try again later.
        </div>
      ) : (
        <div className="space-y-4">
          <PodcastPlayer scope="world" title="Around the World" />
          {archiveDates.length >= 2 && timeline}
          {news.topics.map((topic) => (
            <TopicSection key={topic.topic} topic={topic} />
          ))}
          <SourceList sources={news.sources} />
        </div>
      )}
    </Shell>
  );
}
