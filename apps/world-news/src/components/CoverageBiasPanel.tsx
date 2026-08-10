"use client";
import type { CountryNews } from "@/lib/gemini";

export default function CoverageBiasPanel({ news }: { news: CountryNews }) {
  const stories = news.stories ?? [];
  if (stories.length === 0) return null;
  // Aggregate: count stories per countryCode from locations + source mix
  const counts = new Map<string, number>();
  for (const s of stories) {
    const cc = s.location?.countryCode ?? s.sources[0]?.countryCode ?? "unknown";
    counts.set(cc, (counts.get(cc) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a,b)=>b[1]-a[1]);
  const total = stories.length;
  const top = sorted.slice(0, 5).map(([code, n])=>({ code, share: Math.round(n/total*100)}));
  const undercovered = sorted.filter(([c])=>c!=="unknown").slice(-3).map(([code])=>code);
  const englishBias = top.some(t=>["US","GB"].includes(t.code)) ? "Coverage leans Anglophone — non-English sources under-represented." : "Coverage spans multiple regions.";
  return (
    <section className="rounded-xl border border-rule bg-panel p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Regional coverage</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {top.map(t=> (
          <span key={t.code} className="rounded-full border border-rule bg-panel-soft px-2.5 py-1 text-xs">{t.code} · {t.share}%</span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{englishBias} {undercovered.length ? `Sparse: ${undercovered.join(", ")}.` : ""}</p>
      <p className="mt-1 text-[11px] text-muted">Under-covered context: areas with thin English-language wire presence. Use topic + country filters to surface them.</p>
    </section>
  );
}
