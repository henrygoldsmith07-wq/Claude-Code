import StudyApp from "@/components/StudyApp";
import UserMenu from "@/components/UserMenu";
import { createClient } from "@/lib/supabase/server";
import { loadInitialData } from "@/lib/supabase/loadInitialData";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const initialData = await loadInitialData(user!.id);

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--bg)] px-6 py-16">
      <main className="flex w-full max-w-4xl flex-col items-start gap-8">
        <div className="flex w-full items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">WJEC A-Level Study Hub</h1>
            <p className="max-w-xl text-ink2">
              Chemistry, Physics, Biology and Maths — reviewed with spaced repetition,
              active-recall quizzes and interleaved practice, the study techniques with the
              strongest evidence behind them.
            </p>
          </div>
          {user?.email && <UserMenu email={user.email} />}
        </div>
        <StudyApp userId={user!.id} initialData={initialData} />
      </main>
    </div>
  );
}
