"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Board from "@/components/Board";
import { useStoredIdentity } from "@/lib/identity";

export default function BoardPage() {
  const router = useRouter();
  const { code, identity, loaded, leave } = useStoredIdentity();

  useEffect(() => {
    if (loaded && (!code || !identity)) {
      router.replace("/");
    }
  }, [loaded, code, identity, router]);

  if (!loaded || !code || !identity) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-10 dark:bg-black">
      <main className="flex w-full flex-col items-center">
        <Board code={code} identity={identity} onLeave={leave} />
      </main>
    </div>
  );
}
