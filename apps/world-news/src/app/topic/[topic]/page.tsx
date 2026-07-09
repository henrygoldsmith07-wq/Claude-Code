import Link from "next/link";
import { notFound } from "next/navigation";
import NewsGlobe from "@/components/NewsGlobe";
import { getTopicBySlug, TOPIC_EMOJI, TOPIC_LINKS, TOPIC_SLUGS } from "@/lib/topics";

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const name = getTopicBySlug(topic);
  return { title: name ? `${name} — World News Globe` : "World News Globe" };
}

export default async function TopicGlobePage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  const name = getTopicBySlug(topic);
  if (!name) notFound();

  const slug = TOPIC_SLUGS[name];

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-6 pt-8 text-center">
        <Link
          href="/"
          className="pointer-events-auto text-xs font-medium uppercase tracking-[0.2em] text-muted hover:text-accent"
        >
          ← World News Globe
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {TOPIC_EMOJI[name]} {name}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Pick a country to read its latest {name.toLowerCase()} news.
        </p>

        {/* Switch to another topic's globe */}
        <div className="pointer-events-auto mt-4 flex flex-wrap justify-center gap-2">
          {TOPIC_LINKS.map((t) => (
            <Link
              key={t.slug}
              href={`/topic/${t.slug}`}
              className={`rounded-full border px-3 py-1 text-xs backdrop-blur transition-colors ${
                t.slug === slug
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-rule bg-panel/70 text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {t.emoji} {t.topic}
            </Link>
          ))}
        </div>
      </div>

      <div className="absolute inset-0">
        <NewsGlobe
          topicSlug={slug}
          topicName={name}
          worldPoints
          showArcs={name === "World & Conflict"}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 text-center text-xs text-muted">
        Hover to highlight a country · click for its {name.toLowerCase()} news
      </div>
    </main>
  );
}
