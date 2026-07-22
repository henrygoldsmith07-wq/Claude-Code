import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "WJEC A-Level Study Hub",
    template: "%s · WJEC Study Hub",
  },
  description:
    "Spaced repetition, active recall and interleaved practice for WJEC A-level Chemistry, Physics, Biology and Maths.",
  keywords: ["WJEC", "Eduqas", "A-level", "spaced repetition", "FSRS", "flashcards", "study"],
};

export const viewport: Viewport = {
  themeColor: "#f3f0e9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
