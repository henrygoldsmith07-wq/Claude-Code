import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Omni-Life',
    template: '%s · Omni-Life',
  },
  description:
    'Autonomous personal operating system — calendar, health, finance, tasks, media, and automation loops in one command center.',
  keywords: ['personal OS', 'life dashboard', 'automation', 'productivity'],
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
