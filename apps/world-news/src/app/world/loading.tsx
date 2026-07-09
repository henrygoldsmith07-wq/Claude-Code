// Instant shell shown while the worldwide news summary is generated.
export default function WorldLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="text-sm text-accent">← Back to the globe</div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Around the World</h1>
      <p className="mt-1 text-sm text-muted">
        The most important news worldwide, summarised impartially and split by topic.
      </p>

      <p className="mt-6 text-xs text-muted">Gathering the latest world news…</p>

      <div className="mt-4 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-rule bg-panel p-5">
            <div className="h-5 w-40 animate-pulse rounded bg-panel-soft" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-panel-soft" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-panel-soft" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-panel-soft" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
