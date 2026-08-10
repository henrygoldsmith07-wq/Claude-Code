import NewsGlobe from "@/components/NewsGlobe";
import Sidebar from "@/components/Sidebar";
import { TOPIC_LINKS } from "@/lib/topics";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ lite?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const lite = sp?.lite === "1";
  if (lite) {
    const { getWorldNews } = await import("@/lib/news");
    const news = await getWorldNews().catch(() => null);
    const LiteNewsList = (await import("@/components/LiteNewsList")).default;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-6 py-8">
        <Sidebar topics={TOPIC_LINKS} />
        <div className="mt-10 space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">World News — Lite</h1>
          <p className="text-sm text-muted">Low-bandwidth list. No globe, no WebGL — stories ranked by significance.</p>
          <a href="/?" className="inline-block rounded-full border border-rule bg-panel px-3 py-1 text-xs hover:border-accent">
            Globe view →
          </a>
          {news ? <LiteNewsList news={news} /> : <p className="text-sm text-muted">News unavailable right now.</p>}
        </div>
      </main>
    );
  }
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <Sidebar topics={TOPIC_LINKS} />

      <div className="absolute inset-0">
        <NewsGlobe worldPoints searchable />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2 px-4">
        <span className="rounded-full border border-rule bg-panel/80 px-3 py-1 text-xs text-muted backdrop-blur">
          Hover to highlight · click a country · Ctrl/⌘+B sidebar
        </span>
        <a href="/?lite=1" className="pointer-events-auto rounded-full border border-rule bg-panel/90 px-3 py-1 text-xs hover:border-accent">
          Lite mode
        </a>
      </div>
    </main>
  );
}
