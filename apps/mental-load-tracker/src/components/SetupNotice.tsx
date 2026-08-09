export default function SetupNotice() {
  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <p className="font-semibold">Supabase isn&apos;t configured yet.</p>
      <p>
        Noticed needs shared storage so both partners see the same board — it
        can&apos;t fall back to browser-only storage the way a single-user
        tool could. Run <code className="font-mono">supabase/schema.sql</code>{" "}
        against a Supabase project, then set{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
        <code className="font-mono">.env.local</code>.
      </p>
      <p>See the README for the full setup steps.</p>
    </div>
  );
}
