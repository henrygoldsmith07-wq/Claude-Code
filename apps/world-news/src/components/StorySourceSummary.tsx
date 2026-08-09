import type { CountryNews } from "@/lib/gemini";
import { sourceMixFromCountry } from "@/lib/storyAnalysis";

export default function StorySourceSummary({ news }: { news: CountryNews }) {
  const mix = sourceMixFromCountry(news);
  if ((news.stories ?? []).length === 0) return null;
  return (
    <section className="rounded-xl border border-rule bg-panel-soft p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Reporting mix — all stories</p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {mix.byCountry.map((c) => (
          <span key={c.code} className="rounded-full border border-rule bg-panel px-2 py-0.5 text-muted">
            {c.label} · {c.count}
          </span>
        ))}
        {mix.byCountry.length === 0 && <span className="text-muted">No source mix yet</span>}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {news.stories!.length} {news.stories!.length === 1 ? "story" : "stories"} · {mix.total} source{mix.total === 1 ? "" : "s"} · {mix.primaryCount} primary
      </p>
    </section>
  );
}
