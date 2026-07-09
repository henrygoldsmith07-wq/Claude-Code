import Link from "next/link";
import NewsGlobe from "@/components/NewsGlobe";
import { TOPIC_LINKS } from "@/lib/topics";

export default function HomePage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-6 pt-8 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Impartial · AI-summarised · Grounded in real sources
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          World News Globe
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Spin the globe and pick any country to read what&apos;s happening there,
          split by topic and written to stay neutral.
        </p>
        <Link
          href="/world"
          className="pointer-events-auto mt-4 inline-block rounded-full border border-rule bg-panel/80 px-5 py-2 text-sm font-medium text-foreground backdrop-blur transition-colors hover:border-accent hover:text-accent"
        >
          🌍 Top news around the world →
        </Link>

        <div className="pointer-events-auto mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-2">
          <span className="w-full text-xs uppercase tracking-wide text-muted">
            Or explore a topic on its own globe
          </span>
          {TOPIC_LINKS.map((t) => (
            <Link
              key={t.slug}
              href={`/topic/${t.slug}`}
              className="rounded-full border border-rule bg-panel/70 px-3 py-1 text-xs text-muted backdrop-blur transition-colors hover:border-accent hover:text-accent"
            >
              {t.emoji} {t.topic}
            </Link>
          ))}
        </div>
      </div>

      <div className="absolute inset-0">
        <NewsGlobe />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 text-center text-xs text-muted">
        Hover to highlight a country · click to open its news
      </div>
    </main>
  );
}
