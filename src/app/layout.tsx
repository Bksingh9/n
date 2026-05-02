import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'DateOps Live — Real-time singles events with AI matching',
  description:
    'Run real-time singles events with AI-powered matching, live check-in, mutual matches, and consent-based intros.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
