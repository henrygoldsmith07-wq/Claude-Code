import EpisodeForm from "@/components/EpisodeForm";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-start gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Podcast Repurposer</h1>
          <p className="max-w-xl text-zinc-600 dark:text-zinc-400">
            Paste an episode transcript and get a blog post, show notes, social
            snippets, and chapter markers generated in one pass.
          </p>
        </div>
        <EpisodeForm />
      </main>
    </div>
  );
}
