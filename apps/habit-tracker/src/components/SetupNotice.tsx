import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Shown when the Supabase env vars are missing. The app deliberately runs in
 * this degraded state so setup is visible rather than a silent failure.
 */
export function SetupNotice() {
  return (
    <div className="w-full rounded-xl border border-line bg-surface p-5 text-sm text-ink2">
      <h2 className="mb-2 font-medium text-ink">Connect a database to get started</h2>
      <p className="mb-3">
        Habit keeps your log in Supabase. It works without it — you just can&apos;t save
        anything yet.
      </p>
      <ol className="list-inside list-decimal space-y-2">
        <li>
          Create a Supabase project, then copy <code className="rounded bg-line px-1">.env.example</code> to{" "}
          <code className="rounded bg-line px-1">.env.local</code> and fill in{" "}
          <code className="rounded bg-line px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-line px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </li>
        <li>
          Run <code className="rounded bg-line px-1">supabase/schema.sql</code> in the project&apos;s SQL editor.
        </li>
        <li>Restart the dev server.</li>
      </ol>
      {isSupabaseConfigured ? <p className="mt-3 text-success">Configured — reload to see your habits.</p> : null}
    </div>
  );
}
