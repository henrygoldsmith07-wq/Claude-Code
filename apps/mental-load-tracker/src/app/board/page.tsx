"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Board from "@/components/Board";
import { useAuth } from "@/lib/auth";
import { useCurrentMembership } from "@/lib/membership";

export default function BoardPage() {
  const router = useRouter();
  const { session, loading: authLoading, signOut } = useAuth();
  const [preferredHouseholdId, setPreferredHouseholdId] = useState<string | null>(null);
  const [urlLoaded, setUrlLoaded] = useState(false);
  const { membership, loading: membershipLoading } = useCurrentMembership(preferredHouseholdId);

  useEffect(() => {
    const householdId = new URLSearchParams(window.location.search).get("household");
    // Browser-only URL state is initialized after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferredHouseholdId(householdId);
    setUrlLoaded(true);
  }, []);

  useEffect(() => {
    if (urlLoaded && !authLoading && !session) {
      router.replace("/");
    }
  }, [authLoading, router, session, urlLoaded]);

  useEffect(() => {
    if (urlLoaded && !authLoading && session && !membershipLoading && !membership) {
      router.replace("/");
    }
  }, [authLoading, membership, membershipLoading, router, session, urlLoaded]);

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  if (!urlLoaded || authLoading || membershipLoading || !session || !membership) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-10 dark:bg-black">
      <main className="flex w-full flex-col items-center">
        <Board membership={membership} onSignOut={handleSignOut} />
      </main>
    </div>
  );
}
