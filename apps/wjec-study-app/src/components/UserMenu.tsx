"use client";

import { useTransition } from "react";
import { signOut } from "@/app/login/actions";

export default function UserMenu({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3 text-sm text-ink2">
      <span>{email}</span>
      <button
        onClick={() => startTransition(() => signOut())}
        disabled={pending}
        className="rounded-full border border-line px-3 py-1 text-xs hover:bg-surface2 disabled:opacity-40 dark:hover:bg-surface"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
