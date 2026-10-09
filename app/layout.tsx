import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { ClientLayout } from "./client";
import { Suspense } from 'react';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"] });
// Authenticated pages read cookies; do not prerender against external services at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "One Fin Solution",
  description: "AI chat by ONE FIN SOLUTION COMPANY LIMITED",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Suspense fallback={<p className="p-6">Loading…</p>}><ClientLayout>{children}</ClientLayout></Suspense>
        <Toaster richColors />
      </body>
    </html>
  );
}
