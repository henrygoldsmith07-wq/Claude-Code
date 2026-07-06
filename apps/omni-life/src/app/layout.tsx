import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Omni-Life - Autonomous Personal Operating System',
  description: 'Centralized orchestrator for your entire digital life',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
