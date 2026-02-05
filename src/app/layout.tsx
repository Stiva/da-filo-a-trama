import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { itIT } from '@clerk/localizations';
import { Inter, Quicksand } from 'next/font/google';
import './globals.css';

// Font per il corpo del testo
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Font per i titoli (arrotondato, giocoso)
const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-quicksand',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Da Filo a Trama - Evento Scout 2026',
  description: 'Piattaforma digitale per l\'evento nazionale scout AGESCI 2026',
  manifest: '/manifest.json',
  keywords: ['scout', 'agesci', 'evento', '2026', 'lupetti', 'coccinelle'],
  authors: [{ name: 'AGESCI' }],
};

export const viewport: Viewport = {
  themeColor: '#00417b', // Agesci Blue
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider localization={itIT}>
      <html lang="it" className={`${inter.variable} ${quicksand.variable}`}>
        <body className="min-h-screen bg-scout-cream font-sans antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
