import type { NewsSource } from "@/lib/gemini";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function SourceList({ sources }: { sources: NewsSource[] }) {
  if (sources.length === 0) return null;

  const domains = new Set(sources.map((s) => domainOf(s.url)));
  const uniqueCount = domains.size;
  const isCorroborated = uniqueCount >= 3;

  return (
    <section className="rounded-xl border border-rule bg-panel-soft p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
          Sources ({sources.length})
        </h2>
        {isCorroborated && (
          <span
            className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400"
            title={`${uniqueCount} distinct domains"}
          >
            Widely reported · {uniqueCount} sources
          </span>
        )}
        {!isCorroborated && uniqueCount >= 2 && (
          <span className="rounded-full border border-rule bg-panel px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
            {uniqueCount} sources
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {sources.map((source, i) => (
          <li key={i}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              {source.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
