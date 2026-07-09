import NewsGlobe from "@/components/NewsGlobe";

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
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
      </div>

      <div className="relative flex-1">
        <NewsGlobe />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 text-center text-xs text-muted">
        Hover to highlight a country · click to open its news
      </div>
    </main>
  );
}
