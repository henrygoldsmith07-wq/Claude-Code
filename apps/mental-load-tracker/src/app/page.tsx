"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import OnboardingForm from "@/components/OnboardingForm";
import SetupNotice from "@/components/SetupNotice";
import { useStoredIdentity } from "@/lib/identity";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const { code, identity, loaded, join } = useStoredIdentity();

  useEffect(() => {
    if (loaded && code && identity) {
      router.replace("/board");
    }
  }, [loaded, code, identity, router]);

  if (!loaded || (code && identity)) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo.svg" alt="" width={48} height={48} className="rounded-xl" aria-hidden="true" />
          <h1 className="text-3xl font-semibold tracking-tight">Noticed</h1>
          <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
            A shared board for the invisible labor of running a household —
            log what you noticed needs doing, see it side by side with what
            your partner noticed.
          </p>
        </div>
        {isSupabaseConfigured ? (
          <OnboardingForm
            onJoin={(householdCode, name, color) => join(householdCode, { name, color })}
          />
        ) : (
          <SetupNotice />
        )}
      </main>
    </div>
  );
}
