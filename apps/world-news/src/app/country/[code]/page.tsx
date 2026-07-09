import Link from "next/link";
import { notFound } from "next/navigation";
import { getCountryName } from "@/lib/countries";
import { getCountryNews, UnknownCountryError } from "@/lib/news";
import { MissingApiKeyError, type CountryNews } from "@/lib/gemini";
import TopicSection from "@/components/TopicSection";
import SourceList from "@/components/SourceList";

// News is fetched live (with a short cache in getCountryNews), so never
// prerender this at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const name = getCountryName(code);
  return { title: name ? `${name} — World News Globe` : "World News Globe" };
}

function BackLink() {
  return (
    <Link href="/" className="text-sm text-accent underline-offset-2 hover:underline">
      ← Back to the globe
    </Link>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <BackLink />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6">{children}</div>
    </main>
  );
}

export default async function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  let news: CountryNews;
  try {
    news = await getCountryNews(code);
  } catch (error) {
    if (error instanceof UnknownCountryError) notFound();
    if (error instanceof MissingApiKeyError) {
      const name = getCountryName(code) ?? "This country";
      return (
        <Shell title={name}>
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
    console.error("Failed to load country news:", error);
    return (
      <Shell title={getCountryName(code) ?? "News"}>
        <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
          Couldn&apos;t load the news right now. Please try again in a moment.
        </div>
      </Shell>
    );
  }

  const generated = new Date(news.generatedAt).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Shell title={news.country}>
      <p className="-mt-4 mb-6 text-xs text-muted">Updated {generated}</p>

      {news.topics.length === 0 ? (
        <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
          No significant recent news surfaced for {news.country}. Try again later.
        </div>
      ) : (
        <div className="space-y-4">
          {news.topics.map((topic) => (
            <TopicSection key={topic.topic} topic={topic} />
          ))}
          <SourceList sources={news.sources} />
        </div>
      )}
    </Shell>
  );
}
