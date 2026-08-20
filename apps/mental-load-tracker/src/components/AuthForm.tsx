"use client";

import { useState } from "react";
import { signInWithPassword, signUpWithPassword } from "@/lib/auth";

type Props = {
  hasInvitation: boolean;
};

export default function AuthForm({ hasInvitation }: Props) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);
    setSubmitting(true);

    const result =
      mode === "sign-in"
        ? await signInWithPassword(email.trim(), password)
        : await signUpWithPassword(email.trim(), password);

    setSubmitting(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "sign-up" && !result.data?.session) {
      setNotice("Check your email to confirm your account, then come back to sign in.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div>
        <h2 className="text-lg font-semibold">
          {hasInvitation ? "Accept your household invitation" : "Sign in to Noticed"}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your account is the access boundary for every household you join.
        </p>
      </div>

      <div className="flex rounded-lg bg-zinc-100 p-1 text-sm font-medium dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setMode("sign-in")}
          className={`flex-1 rounded-md py-2 transition ${
            mode === "sign-in" ? "bg-white shadow-sm dark:bg-zinc-800" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("sign-up")}
          className={`flex-1 rounded-md py-2 transition ${
            mode === "sign-up" ? "bg-white shadow-sm dark:bg-zinc-800" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          Create account
        </button>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 focus:border-zinc-500 focus:outline-none dark:border-zinc-700"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          minLength={8}
          required
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 focus:border-zinc-500 focus:outline-none dark:border-zinc-700"
        />
      </label>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}

      <button
        type="submit"
        disabled={submitting || !email.trim() || password.length < 8}
        className="rounded-md bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting ? "One sec…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
