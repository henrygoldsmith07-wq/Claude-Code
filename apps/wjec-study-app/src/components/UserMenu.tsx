"use client";

import { useTransition } from "react";
import { signOut } from "@/app/login/actions";

export default function UserMenu({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
      <span>{email}</span>
      <button
        onClick={() => startTransition(() => signOut())}
        disabled={pending}
        className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
