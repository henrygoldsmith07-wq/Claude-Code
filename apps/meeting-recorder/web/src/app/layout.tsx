import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meeting Recorder",
  description: "Record meetings, transcribe with Groq, and chat over them with Claude. Evidence-linked, consent-aware.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
        <header className="border-b border-edge">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold" aria-label="Meeting Recorder home">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-sm" aria-hidden>●</span>
              Meeting Recorder
            </Link>
            <nav className="flex items-center gap-3" aria-label="Secondary">
              <Link href="/api/benchmarks" className="text-xs text-white/40 hover:text-white/70">Benchmarks</Link>
              <a href="https://groq.com" className="text-xs text-white/40 hover:text-white/70" target="_blank" rel="noreferrer">Groq · Anthropic · R2 · Consent-aware</a>
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
