"use client";

import { useState } from "react";
import { signInWithPassword, signUpWithPassword } from "@/lib/auth";

export function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fn = mode === "signin" ? signInWithPassword : signUpWithPassword;
    const { error } = await fn(email.trim(), password);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSuccess?.();
  };

  return (
    <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
      <h2 className="mb-1 text-lg font-semibold">{mode === "signin" ? "Sign in" : "Create account"}</h2>
      <p className="mb-4 text-sm text-ink3">Your habits are private to your account. The anon key is public — RLS keeps them isolated.</p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="auth-email" className="mb-1 block text-sm font-medium">Email</label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="mb-1 block text-sm font-medium">Password</label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="••••••••"
          />
        </div>
        {error ? <p className="rounded-lg bg-dangersoft p-2 text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-onaccent hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-3 w-full text-sm text-ink3 hover:text-ink"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
