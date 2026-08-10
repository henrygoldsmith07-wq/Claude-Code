import Link from "next/link";
import { notFound } from "next/navigation";
import { getCountryName } from "@/lib/countries";
import { getCountryNews, getCountryArchiveDates, UnknownCountryError } from "@/lib/news";
import { MissingApiKeyError, RateLimitError, type CountryNews } from "@/lib/gemini";
import { getTopicBySlug, TOPIC_SLUGS } from "@/lib/topics";
import TopicSection from "@/components/TopicSection";
import SourceList from "@/components/SourceList";
import NewsGlobe from "@/components/NewsGlobe";
import FavoriteButton from "@/components/FavoriteButton";
import TimeAgo from "@/components/TimeAgo";
import PodcastPlayer from "@/components/PodcastPlayer";
import TimelineControl from "@/components/TimelineControl";
import StoryClusterCard from "@/components/StoryClusterCard";
import StoriesView from "@/components/StoriesView";
import StorySourceSummary from "@/components/StorySourceSummary";
import CoverageBiasPanel from "@/components/CoverageBiasPanel";
import GeopoliticsPanel from "@/components/GeopoliticsPanel";
import LiteNewsList from "@/components/LiteNewsList";
import LocationVerifyBadge from "@/components/LocationVerifyBadge";
import MethodologyPanel from "@/components/MethodologyPanel";
import {
  WhatChangedPanel,
  AgreedFactsPanel,
  UncertaintyPanel,
  CoverageGapsPanel,
  CorrectionsPanel,
} from "@/components/NewsMetaPanels";

// News is fetched live (with a short cache in getCountryNews), so never
// prerender this at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const name = getCountryName(code);
  return { title: name ? `${name} — World News Globe` : "World News Globe" };
}

interface BackTarget {
  href: string;
  label: string;
}

const POSITIONING_SUB =
  "Understand what happened, where it happened, who is reporting it and where accounts differ.";

function Shell({
  title,
  back,
  children,
}: {
  title: string;
  back: BackTarget;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href={back.href} className="text-sm text-accent underline-offset-2 hover:underline">
        {back.label}
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{POSITIONING_SUB}</p>
      <div className="mt-6">{children}</div>
    </main>
  );
}

function StoryBlocks({ news, topicName }: { news: CountryNews; topicName: string | null }) {
  const stories = topicName
    ? (news.stories ?? []).filter((s) => s.topic === topicName)
    : (news.stories ?? []);
  if (stories.length === 0) return null;
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Stories · {stories.length} {topicName ? `in ${topicName}` : "cluster" + (stories.length === 1 ? "" : "s")} · ranked by significance
      </p>
      <StoriesView stories={stories} />
    </div>
  );
}

export default async function CountryPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<{ topic?: string; date?: string; lite?: string }>;
}) {
  const { code } = await params;
  const sp = searchParams ? await searchParams : {};
  const topicSlug = typeof sp.topic === "string" ? sp.topic : undefined;
  const topicName = topicSlug ? getTopicBySlug(topicSlug) : null;
  const dateParam = typeof sp.date === "string" ? sp.date : undefined;
  const liteMode = sp.lite === "1";

  // When a topic filter is active, the back link returns to that topic's globe.
  const back: BackTarget = topicName
    ? { href: `/topic/${TOPIC_SLUGS[topicName]}`, label: `← Back to ${topicName} globe` }
    : { href: "/", label: "← Back to the globe" };

  // Archive dates power the timeline slider (empty when Supabase isn't set up).
  const archiveDates = await getCountryArchiveDates(code).catch(() => []);
  const timeline = (
    <TimelineControl
      dates={archiveDates}
      current={dateParam}
      basePath={`/country/${code.toLowerCase()}`}
      extraQuery={topicSlug ? `topic=${topicSlug}` : ""}
    />
  );

  // Historical view: load the archived snapshot for the requested date.
  if (dateParam) {
    let archived: CountryNews | null;
    try {
      archived = await getCountryNews(code, dateParam);
    } catch (error) {
      if (error instanceof UnknownCountryError) notFound();
      throw error;
    }
    const name = getCountryName(code) ?? "News";
    if (!archived) {
      return (
        <Shell title={name} back={back}>
          {timeline}
          <div className="mt-4 rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
            No archived news for {name} on this date.
          </div>
        </Shell>
      );
    }
    const arcTopics = topicName
      ? archived.topics.filter((t) => t.topic === topicName)
      : archived.topics;
    const arcStories = topicName
      ? (archived.stories ?? []).filter((s) => s.topic === topicName)
      : (archived.stories ?? []);
    return (
      <Shell title={name} back={back}>
        {timeline}
        <p className="mt-4 mb-4 text-xs text-muted">
          Archived snapshot · <TimeAgo iso={archived.generatedAt} prefix="generated " />
        </p>
        {arcStories.length > 0 && (
          <div className="mb-4 space-y-4">
            {arcStories.map((s) => (
              <StoryClusterCard key={s.id} story={s} />
            ))}
          </div>
        )}
        {arcTopics.length === 0 && arcStories.length === 0 ? (
          <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
            No news recorded for {name} on this date.
          </div>
        ) : (
          <div className="space-y-4">
            {arcTopics.map((topic) => (
              <TopicSection key={topic.topic} topic={topic} />
            ))}
            <SourceList sources={archived.sources} />
            <LocationVerifyBadge news={archived} />
            {(archived.meta?.widelyAgreedFacts?.length ?? 0) > 0 && <AgreedFactsPanel news={archived} />}
            {(archived.meta?.uncertainty?.length ?? 0) > 0 && <UncertaintyPanel news={archived} />}
            <CoverageGapsPanel news={archived} />
            <CorrectionsPanel news={archived} />
            <GeopoliticsPanel code={code} />
            <MethodologyPanel provenanceNote={archived.meta?.provenanceNote} />
          </div>
        )}
      </Shell>
    );
  }

  let news: CountryNews;
  try {
    news = await getCountryNews(code);
  } catch (error) {
    if (error instanceof UnknownCountryError) notFound();
    if (error instanceof MissingApiKeyError) {
      const name = getCountryName(code) ?? "This country";
      return (
        <Shell title={name} back={back}>
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
        <Shell title={getCountryName(code) ?? "News"} back={back}>
          <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
            <p className="font-medium text-foreground">Free-tier limit reached.</p>
            <p className="mt-2">
              Gemini&apos;s free tier caps how much news can be generated in a short
              window. Please wait a minute and try again — already-loaded countries stay
              cached. To lift the limit, enable billing on your Google AI Studio key.
            </p>
          </div>
        </Shell>
      );
    }
    console.error("Failed to load country news:", error);
    return (
      <Shell title={getCountryName(code) ?? "News"} back={back}>
        <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
          Couldn&apos;t load the news right now. Please try again in a moment.
        </div>
      </Shell>
    );
  }

  // Filter to a single topic when the page was opened from a topic globe.
  const shownTopics = topicName
    ? news.topics.filter((t) => t.topic === topicName)
    : news.topics;
  const shownPoints = topicName
    ? news.points.filter((p) => p.topic === topicName)
    : news.points;
  const showArcs = topicName ? topicName === "World & Conflict" : true;

  return (
    <>
      {/* Lite mode: skip the heavy globe for low-bandwidth/mobile. */}
      {liteMode ? (
        <div className="mx-auto w-full max-w-2xl px-6 pt-6">
          <Link
            href={`/country/${code.toLowerCase()}${topicSlug ? `?topic=${topicSlug}` : ""}`}
            className="rounded-full border border-rule bg-panel px-3 py-1.5 text-xs hover:border-accent"
          >
            ← Back to globe view
          </Link>
        </div>
      ) : (
        <div className="relative h-[52vh] min-h-[320px] w-full border-b border-rule">
          <NewsGlobe
            focusCode={code}
            topicSlug={topicSlug}
            points={shownPoints}
            arcs={news.conflicts}
            showArcs={showArcs}
            autoRotate={false}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 p-4 text-center">
            <span className="rounded-full border border-rule bg-panel/80 px-4 py-1.5 text-sm font-medium backdrop-blur">
              {news.country}
              {topicName ? ` · ${topicName}` : ""} · {shownPoints.length} news points
              {(news.stories?.length ?? 0) > 0 ? ` · ${news.stories!.length} stories` : ""}
            </span>
          </div>
        </div>
      )}

      <Shell title={news.country} back={back}>
        <div className="-mt-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <TimeAgo iso={news.generatedAt} />
            {(() => {
              const base = `/country/${code.toLowerCase()}`;
              const qs = new URLSearchParams();
              if (topicSlug) qs.set("topic", topicSlug);
              if (!liteMode) qs.set("lite", "1");
              const href = qs.toString() ? `${base}?${qs.toString()}` : base;
              // When already in lite mode, link back without lite param
              const liteHref = liteMode
                ? topicSlug ? `${base}?topic=${topicSlug}` : base
                : href;
              return (
                <Link href={liteHref} className="rounded-full border border-rule bg-panel px-2.5 py-1 text-xs hover:border-accent">
                  {liteMode ? "Globe view" : "Lite mode"}
                </Link>
              );
            })()}
          </div>
          <div className="flex items-center gap-3">
            {topicName && (
              <Link href={`/country/${code}`} className="text-xs text-accent hover:underline">
                View all topics →
              </Link>
            )}
            <FavoriteButton kind="country" id={code.toLowerCase()} label={news.country} size="sm" />
          </div>
        </div>

        {shownTopics.length > 0 && (
          <PodcastPlayer scope="country" code={code.toLowerCase()} title={news.country} />
        )}

        {archiveDates.length >= 2 && <div className="mt-4">{timeline}</div>}

        {topicName && (
          <p className="mb-4 mt-4 text-sm font-medium text-foreground">{topicName}</p>
        )}

        <WhatChangedPanel news={news} />
        <CoverageBiasPanel news={news} />
        <LocationVerifyBadge news={news} />
        <GeopoliticsPanel code={code} />

        {liteMode ? (
          <div className="mt-4">
            <LiteNewsList news={{ ...news, stories: topicName ? (news.stories ?? []).filter((s) => s.topic === topicName) : news.stories, points: shownPoints } as CountryNews} />
          </div>
        ) : (
          <>
            {(news.stories?.length ?? 0) > 0 && (
              <div className="mt-4">
                <StorySourceSummary news={news} />
                <div className="mt-4">
                  <StoryBlocks news={news} topicName={topicName} />
                </div>
              </div>
            )}

            {shownTopics.length === 0 && (news.stories?.length ?? 0) === 0 ? (
              <div className="mt-4 rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
                {topicName
                  ? `No significant recent ${topicName.toLowerCase()} news surfaced for ${news.country}.`
                  : `No significant recent news surfaced for ${news.country}. Try again later.`}
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {shownTopics.map((topic) => (
                  <TopicSection key={topic.topic} topic={topic} />
                ))}
                <SourceList sources={news.sources} />
                <AgreedFactsPanel news={news} />
                <UncertaintyPanel news={news} />
                <CoverageGapsPanel news={news} />
                <CorrectionsPanel news={news} />
                <MethodologyPanel provenanceNote={news.meta?.provenanceNote} />
              </div>
            )}
          </>
        )}
      </Shell>
    </>
  );
}
