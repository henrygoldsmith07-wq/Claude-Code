import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meeting Recorder",
  description: "Record meetings, transcribe with Groq, and chat over them with Claude.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-edge">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-sm">
                ●
              </span>
              Meeting Recorder
            </Link>
            <a
              href="https://groq.com"
              className="text-xs text-white/40 hover:text-white/70"
              target="_blank"
              rel="noreferrer"
            >
              Groq · Anthropic · R2
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
