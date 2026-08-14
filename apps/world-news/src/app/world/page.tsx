import Link from "next/link";
import { getWorldNews, getWorldArchiveDates } from "@/lib/news";
import { MissingApiKeyError, RateLimitError, type CountryNews } from "@/lib/gemini";
import TopicSection from "@/components/TopicSection";
import SourceList from "@/components/SourceList";
import TimeAgo from "@/components/TimeAgo";
import PodcastPlayer from "@/components/PodcastPlayer";
import TimelineControl from "@/components/TimelineControl";
import StoriesView from "@/components/StoriesView";
import StorySourceSummary from "@/components/StorySourceSummary";
import CoverageBiasPanel from "@/components/CoverageBiasPanel";
import StoryAnalysisPanel from "@/components/StoryAnalysisPanel";
import { analysePage } from "@/lib/storyPipeline";
import LiteNewsList from "@/components/LiteNewsList";
import LocationVerifyBadge from "@/components/LocationVerifyBadge";
import MethodologyPanel from "@/components/MethodologyPanel";
import SearchStories from "@/components/SearchStories";
import StoryScreenReader from "@/components/StoryScreenReader";
import DiversityNudge from "@/components/DiversityNudge";
import KnowledgeGraphPanel from "@/components/KnowledgeGraphPanel";
import CoverageCompare from "@/components/CoverageCompare";
import SavedTopics from "@/components/SavedTopics";
import { buildEntityGraph, buildCountryGraph, buildEventGraph } from "@/lib/knowledgeGraph";
import { buildCoverageMatrix, detectGaps } from "@/lib/coverageMatrix";
import { TOPICS } from "@/lib/gemini";
import {
  WhatChangedPanel,
  AgreedFactsPanel,
  UncertaintyPanel,
  CoverageGapsPanel,
  CorrectionsPanel,
} from "@/components/NewsMetaPanels";

// News is fetched live (with a short cache in getWorldNews), so never
// prerender this at build time.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Around the World — World News Globe",
};

const POSITIONING_SUB =
  "Understand what happened, where it happened, who is reporting it and where accounts differ.";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-accent underline-offset-2 hover:underline">
        ← Back to the globe
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Around the World</h1>
      <p className="mt-1 text-sm text-muted">{POSITIONING_SUB}</p>
      <div className="mt-6">{children}</div>
    </main>
  );
}

export default async function WorldPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string; lite?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const dateParam = typeof sp.date === "string" ? sp.date : undefined;
  const liteMode = sp.lite === "1";

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
        {!archived || (archived.topics.length === 0 && (archived.stories?.length ?? 0) === 0) ? (
          <div className="mt-4 rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
            No archived world news for this date.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted">
              Archived snapshot · <TimeAgo iso={archived.generatedAt} prefix="generated " />
            </p>
            {liteMode ? (
              <LiteNewsList news={archived} />
            ) : (
              (archived.stories ?? []).length > 0 && (
                <StoriesView stories={archived.stories!} />
              )
            )}
            {archived.topics.map((topic) => (
              <TopicSection key={topic.topic} topic={topic} />
            ))}
            <SourceList sources={archived.sources} />
            <LocationVerifyBadge news={archived} />
            <CoverageBiasPanel news={archived} />
            <AgreedFactsPanel news={archived} />
            <UncertaintyPanel news={archived} />
            <CoverageGapsPanel news={archived} />
            <CorrectionsPanel news={archived} />
            <MethodologyPanel provenanceNote={archived.meta?.provenanceNote} />
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
      <div className="-mt-4 mb-4 flex items-center justify-between gap-2 text-xs text-muted">
        <TimeAgo iso={news.generatedAt} />
        <Link
          href={liteMode ? "/world" : "/world?lite=1"}
          className="rounded-full border border-rule bg-panel px-2.5 py-1 text-xs hover:border-accent"
        >
          {liteMode ? "Globe view" : "Lite mode (low-bandwidth)"}
        </Link>
      </div>

      {news.topics.length === 0 && (news.stories?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
          No significant news surfaced right now. Try again later.
        </div>
      ) : liteMode ? (
        <div className="space-y-4">
          <PodcastPlayer scope="world" title="Around the World" />
          {archiveDates.length >= 2 && timeline}
          <WhatChangedPanel news={news} />
          <LiteNewsList news={news} />
          <SourceList sources={news.sources} />
          <MethodologyPanel provenanceNote={news.meta?.provenanceNote} />
        </div>
      ) : (
        <div className="space-y-4">
          <PodcastPlayer scope="world" title="Around the World" />
          {archiveDates.length >= 2 && timeline}
          <WhatChangedPanel news={news} />
          {(news.stories?.length ?? 0) > 0 && (
            <>
              <StorySourceSummary news={news} />
              <StoryAnalysisPanel analysis={analysePage(news)} />
              <CoverageBiasPanel news={news} />
              <LocationVerifyBadge news={news} />
              <DiversityNudge sources={news.stories![0]?.sources ?? []} />
              <SearchStories stories={news.stories!} />
              <StoriesView stories={news.stories!} />
              <StoryScreenReader stories={news.stories!} />
              <KnowledgeGraphPanel entity={buildEntityGraph([news])} country={buildCountryGraph([news])} event={buildEventGraph([news])} />
              <CoverageCompare matrix={buildCoverageMatrix([news])} />
              {detectGaps([news], [...TOPICS]).length>0 && <p className="text-xs text-muted">Gaps: {detectGaps([news], [...TOPICS]).map(g=>`${g.key} — ${g.reason}`).join(" · ")}</p>}
              <SavedTopics />
              <p className="text-xs text-muted"><Link href="/benchmark" className="text-accent hover:underline">Public benchmark</Link> · <Link href="/?lite=1" className="text-accent hover:underline">Lite / offline-ready</Link> · Keyboard: Tab through stories, / to search</p>
            </>
          )}
          {news.topics.map((topic) => (
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
    </Shell>
  );
}
