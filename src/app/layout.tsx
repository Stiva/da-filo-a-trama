import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { itIT } from '@clerk/localizations';
import { Inter, Quicksand, Dancing_Script } from 'next/font/google';
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

// Font per il brand (handwritten)
const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-dancing-script',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Da Filo a Trama - Evento Scout 2026',
  description: 'Piattaforma digitale per l\'evento nazionale scout AGESCI 2026',
  manifest: '/manifest.json',
  keywords: ['scout', 'agesci', 'evento', '2026', 'lupetti', 'coccinelle'],
  authors: [{ name: 'AGESCI' }],
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'Da Filo a Trama - Evento Scout 2026',
    description: 'Piattaforma digitale per l\'evento nazionale scout AGESCI 2026',
    images: ['/header-da-filo-a-trama_2-1.jpg'],
    type: 'website',
    locale: 'it_IT',
  },
};

export const viewport: Viewport = {
  themeColor: '#4b2c7f', // Agesci Purple
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
      <html lang="it" className={`${inter.variable} ${quicksand.variable} ${dancingScript.variable}`}>
        <body className="min-h-screen bg-scout-cream font-sans antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
