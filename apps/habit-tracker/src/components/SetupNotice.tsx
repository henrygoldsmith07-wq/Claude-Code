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
        Habit keeps your log in Supabase with per-user RLS. Anonymous access is denied — sign in to isolate your data. Without env vars the app shows this notice instead of failing silently.
      </p>
      <ol className="list-inside list-decimal space-y-2">
        <li>
          Create a Supabase project, enable email auth, then copy <code className="rounded bg-line px-1">.env.example</code> to{" "}
          <code className="rounded bg-line px-1">.env.local</code> and fill in{" "}
          <code className="rounded bg-line px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-line px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </li>
        <li>
          Run <code className="rounded bg-line px-1">supabase/schema.sql</code> in the project&apos;s SQL editor. Existing installs run{" "}
          <code className="rounded bg-line px-1">supabase/migrations/20260821000000_secure_habit_isolation.sql</code> first.
        </li>
        <li>Restart the dev server and sign in (or create account).</li>
      </ol>
      {isSupabaseConfigured ? <p className="mt-3 text-success">Configured — reload to see your habits.</p> : null}
    </div>
  );
}
