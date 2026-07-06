"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

const initialState: AuthState = { error: null };

export default function AuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  const action = mode === "sign-in" ? signInAction : signUpAction;
  const state = mode === "sign-in" ? signInState : signUpState;
  const pending = mode === "sign-in" ? signInPending : signUpPending;

  return (
    <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setMode("sign-in")}
          aria-pressed={mode === "sign-in"}
          className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
            mode === "sign-in"
              ? "border-zinc-900 dark:border-zinc-100"
              : "border-transparent text-zinc-500 dark:text-zinc-400"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("sign-up")}
          aria-pressed={mode === "sign-up"}
          className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium ${
            mode === "sign-up"
              ? "border-zinc-900 dark:border-zinc-100"
              : "border-transparent text-zinc-500 dark:text-zinc-400"
          }`}
        >
          Create account
        </button>
      </div>

      <form action={action} className="flex flex-col gap-4">
        {mode === "sign-up" && (
          <label className="flex flex-col gap-1 text-sm">
            Display name
            <input
              name="displayName"
              type="text"
              autoComplete="name"
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
