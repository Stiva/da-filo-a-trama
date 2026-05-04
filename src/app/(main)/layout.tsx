import Navbar from '@/components/Navbar';
import Image from 'next/image';
import UserSupportChatWidget from '@/components/chat/UserSupportChatWidget';
import InstallBanner from '@/components/pwa/InstallBanner';
import FooterSponsors from '@/components/FooterSponsors';
import FooterSupporter from '@/components/FooterSupporter';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-scout-cream main-content">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-agesci-blue text-white py-12 mt-16 border-t border-agesci-blue/20">
        <div className="container-scout space-y-8 flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-white/10 pb-8">
            <div className="flex flex-col gap-8 w-full md:flex-1">
              <FooterSponsors />
              <FooterSupporter />
            </div>

            <div className="flex items-center justify-center shrink-0 self-center">
              <Image
                src="/Logo completo.png"
                alt="Da Filo a Trama"
                width={160}
                height={63}
                className="h-16 w-auto brightness-0 invert opacity-90"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-white/60">
            <div className="text-center md:text-left">
              <p className="font-semibold text-white/80">&copy; 2026 AGESCI - Tutti i diritti riservati</p>
            </div>
            <div className="text-center md:text-right flex flex-col items-center md:items-end gap-2">
              <p>Branca L/C - Lupetti e Coccinelle</p>
              <div className="flex items-center gap-4 mt-2">
                <a href="https://dafiloatrama.agesci.it/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" title="Sito Istituzionale dell'evento">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                </a>
                <a href="https://www.instagram.com/agesci.nazionale/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" title="Instagram Ufficiale">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <UserSupportChatWidget />
      <InstallBanner />
    </div>
  );
}
