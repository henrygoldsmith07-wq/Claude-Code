"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import AuthForm from "@/components/AuthForm";
import OnboardingForm from "@/components/OnboardingForm";
import SetupNotice from "@/components/SetupNotice";
import { useAuth } from "@/lib/auth";
import { useCurrentMembership } from "@/lib/membership";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const { membership, loading: membershipLoading } = useCurrentMembership();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [urlLoaded, setUrlLoaded] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const token =
      new URLSearchParams(hash).get("invite") ??
      new URLSearchParams(window.location.search).get("invite");
    // Browser-only URL state is initialized after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInviteToken(token);
    setUrlLoaded(true);
  }, []);

  useEffect(() => {
    if (!authLoading && session && !membershipLoading && membership) {
      router.replace(`/board?household=${encodeURIComponent(membership.household_id)}`);
    }
  }, [authLoading, membership, membershipLoading, router, session]);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
        <main className="flex w-full max-w-md flex-col items-center gap-8">
          <Brand />
          <SetupNotice />
        </main>
      </div>
    );
  }

  if (!urlLoaded || authLoading || (session && membershipLoading) || (session && membership)) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8">
        <Brand />
        {!session ? (
          <AuthForm hasInvitation={Boolean(inviteToken)} />
        ) : (
          <OnboardingForm
            initialInvitationToken={inviteToken}
            onComplete={(householdId) =>
              router.replace(`/board?household=${encodeURIComponent(householdId)}`)
            }
          />
        )}
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Image src="/logo.svg" alt="" width={48} height={48} className="rounded-xl" aria-hidden="true" />
      <h1 className="text-3xl font-semibold tracking-tight">Noticed</h1>
      <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
        A shared board for the invisible labor of running a household — log
        what you noticed needs doing, see it side by side with what your
        partner noticed.
      </p>
    </div>
  );
}
