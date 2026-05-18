import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { itIT } from '@clerk/localizations';
import { Inter, Quicksand, Dancing_Script } from 'next/font/google';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';
import { getCmsBundle } from '@/lib/cms/server';
import { buildCssVarsBlock } from '@/lib/cms/cssVars';
import { buildFontFaceBlock } from '@/lib/cms/fonts';
import CopyProvider from '@/lib/cms/CopyProvider';
import BrandProvider from '@/lib/cms/BrandProvider';
import { resolveBrandAssetUrl } from '@/lib/cms/brandAssets';
import './globals.css';

// Font baseline (next/font Google + locale). Restano come fallback anche
// quando l'admin carica font custom via CMS in Fase 4.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-quicksand',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  variable: '--font-dancing-script',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const loveYou = localFont({
  src: '../../public/Love You.ttf',
  variable: '--font-loveyou',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getCmsBundle();
  const { app, og } = bundle.meta;
  const { assets } = bundle.brand;
  const favicon = resolveBrandAssetUrl(assets.favicon) || '/favicon.png';
  const appleTouch = resolveBrandAssetUrl(assets.apple_touch) || '/apple-touch-icon.png';
  const ogImage =
    resolveBrandAssetUrl(assets.og_image) || '/header-da-filo-a-trama_2-1.jpg';
  return {
    title: app.title,
    description: app.description,
    manifest: '/manifest.webmanifest',
    keywords: app.keywords,
    authors: app.authors,
    icons: {
      icon: favicon,
      shortcut: favicon,
      apple: appleTouch,
    },
    appleWebApp: {
      title: app.apple_web_app_title,
      statusBarStyle: 'default',
      capable: true,
    },
    openGraph: {
      title: og.title,
      description: og.description,
      images: [ogImage],
      type: og.type as 'website',
      locale: app.locale,
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const bundle = await getCmsBundle();
  return {
    themeColor: bundle.meta.pwa.theme_color,
    width: 'device-width',
    initialScale: 1,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bundle = await getCmsBundle();
  const cssVars = buildCssVarsBlock({
    colors: bundle.brand.colors,
    shadows: bundle.brand.shadows,
  });
  const fontFaces = buildFontFaceBlock(bundle.brand.fonts);

  return (
    <html lang="it" className={`${inter.variable} ${quicksand.variable} ${dancingScript.variable} ${loveYou.variable}`}>
      <head>
        {cssVars && <style id="cms-theme" dangerouslySetInnerHTML={{ __html: cssVars }} />}
        {fontFaces && <style id="cms-fonts" dangerouslySetInnerHTML={{ __html: fontFaces }} />}
        <Script
          id="Cookiebot"
          src="https://consent.cookiebot.com/uc.js"
          data-cbid="dfe926e5-9d83-49db-9a98-354d10731a44"
          data-blockingmode="auto"
          strategy="beforeInteractive"
        />
      </head>
      <body className="min-h-screen bg-scout-cream font-sans antialiased">
        <ClerkProvider localization={itIT}>
          <CopyProvider>
            <BrandProvider>{children}</BrandProvider>
          </CopyProvider>
          <Analytics />
        </ClerkProvider>
      </body>
    </html>
  );
}
