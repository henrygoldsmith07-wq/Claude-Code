import StudyApp from "@/components/StudyApp";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col items-start gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">WJEC A-Level Study Hub</h1>
          <p className="max-w-xl text-zinc-600 dark:text-zinc-400">
            Chemistry, Physics, Biology and Maths — reviewed with spaced repetition,
            active-recall quizzes and interleaved practice, the study techniques with the
            strongest evidence behind them.
          </p>
        </div>
        <StudyApp />
      </main>
    </div>
  );
}
