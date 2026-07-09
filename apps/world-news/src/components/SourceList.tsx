import type { NewsSource } from "@/lib/gemini";

export default function SourceList({ sources }: { sources: NewsSource[] }) {
  if (sources.length === 0) return null;
  return (
    <section className="rounded-xl border border-rule bg-panel-soft p-5">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
        Sources ({sources.length})
      </h2>
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
