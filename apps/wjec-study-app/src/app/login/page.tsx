import AuthForm from "./AuthForm";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-[#f3f0e9] px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">WJEC A-Level Study Hub</h1>
        <p className="max-w-xs text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to sync your progress across devices.
        </p>
      </div>
      <AuthForm />
    </div>
  );
}
