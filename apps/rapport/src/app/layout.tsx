import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { StoreProvider } from "@/state/store";
import { ThemeShell } from "@/components/theme-shell";

export const metadata: Metadata = {
  title: "Rapport — social skills training",
  description:
    "A personal training system for practical communication skills: assess, learn, rehearse, practise for real, reflect, adapt.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#131311" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body>
        <StoreProvider>
          <ThemeShell>
            <a href="#main" className="skip-link">
              Skip to content
            </a>
            <Nav />
            <div className="md:pl-56">
              <main id="main" className="mx-auto w-full max-w-3xl px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-16">
                {children}
              </main>
            </div>
          </ThemeShell>
        </StoreProvider>
      </body>
    </html>
  );
}
