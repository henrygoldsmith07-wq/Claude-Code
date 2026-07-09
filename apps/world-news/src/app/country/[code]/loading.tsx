// Shown instantly while the country's news is fetched/generated, so clicking a
// country on the globe gives immediate feedback instead of a blank page.
export default function CountryLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="text-sm text-accent">← Back to the globe</div>
      <div className="mt-4 h-9 w-56 animate-pulse rounded-md bg-panel" />
      <div className="mt-2 h-3 w-40 animate-pulse rounded bg-panel" />

      <p className="mt-6 text-xs text-muted">Gathering the latest news…</p>

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
