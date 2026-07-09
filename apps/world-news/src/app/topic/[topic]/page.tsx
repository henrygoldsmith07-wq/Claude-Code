import { notFound } from "next/navigation";
import NewsGlobe from "@/components/NewsGlobe";
import FavoriteButton from "@/components/FavoriteButton";
import TopicLegend from "@/components/TopicLegend";
import Sidebar from "@/components/Sidebar";
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
      <Sidebar topics={TOPIC_LINKS} activeSlug={slug} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-6 pt-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {TOPIC_EMOJI[name]} {name}
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Pick a country to read its latest {name.toLowerCase()} news.
        </p>
        <div className="pointer-events-auto mt-3 flex justify-center">
          <FavoriteButton kind="topic" id={slug} label={`${TOPIC_EMOJI[name]} ${name}`} size="sm" />
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

      <TopicLegend />

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 text-center text-xs text-muted">
        Hover to highlight a country · click for its {name.toLowerCase()} news
      </div>
    </main>
  );
}
