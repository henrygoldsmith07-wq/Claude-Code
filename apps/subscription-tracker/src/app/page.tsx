import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col items-start gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Subscription Tracker</h1>
          <p className="max-w-xl text-zinc-600 dark:text-zinc-400">
            Track recurring subscriptions, catch price hikes, budget by category, and
            keep tabs on pending refunds — all in one place.
          </p>
        </div>
        <Dashboard />
      </main>
    </div>
  );
}
