import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { itIT } from '@clerk/localizations';
import './globals.css';

export const metadata: Metadata = {
  title: 'Da Filo a Trama - Evento Scout 2026',
  description: 'Piattaforma digitale per l\'evento nazionale scout',
  manifest: '/manifest.json',
  themeColor: '#2D5016',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider localization={itIT}>
      <html lang="it">
        <body className="min-h-screen bg-background font-sans antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
