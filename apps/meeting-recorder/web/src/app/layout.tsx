import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Inter is the canonical Le Studio font (packages/theme/le-studio.css); Next 14
// can't load Geist, so this app uses Inter directly.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meeting Recorder",
  description: "Record meetings, transcribe with Groq, and chat over them with Claude. Evidence-linked, consent-aware.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-onaccent">Skip to content</a>
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold" aria-label="Meeting Recorder home">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-onaccent text-sm" aria-hidden>●</span>
              Meeting Recorder
            </Link>
            <nav className="flex items-center gap-3" aria-label="Secondary">
              <Link href="/api/benchmarks" className="text-xs text-ink3 hover:text-ink">Benchmarks</Link>
              <a href="https://groq.com" className="text-xs text-ink3 hover:text-ink" target="_blank" rel="noreferrer">Groq · Anthropic · R2 · Consent-aware</a>
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-5 py-8 flex-1">{children}</main>
      </body>
    </html>
  );
}
