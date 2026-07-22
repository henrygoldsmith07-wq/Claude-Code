"use client";

import { useTransition } from "react";
import { signOut } from "@/app/login/actions";

export default function UserMenu({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 sm:gap-3">
      <span className="max-w-[120px] truncate sm:max-w-[200px]" title={email}>
        {email}
      </span>
      <button
        type="button"
        onClick={() => startTransition(() => signOut())}
        disabled={pending}
        className="shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
