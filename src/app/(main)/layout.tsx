import Navbar from '@/components/Navbar';
import Image from 'next/image';
import UserSupportChatWidget from '@/components/chat/UserSupportChatWidget';
import InstallBanner from '@/components/pwa/InstallBanner';

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
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-white/10 pb-8">
            <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4">
              <p className="text-sm text-white/80 font-medium">Evento realizzato con il patrocinio di:</p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <a href="https://www.comune.castelfranco-emilia.mo.it/" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105 bg-white p-2 rounded-xl h-16 sm:h-20 flex items-center justify-center shadow-lg">
                  <Image src="/stemma città di Castelfranco.jpg" alt="Comune di Castelfranco Emilia" width={100} height={100} className="max-h-full w-auto object-contain" />
                </a>
                <a href="https://agesci.it/" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105 bg-white p-2 rounded-xl h-16 sm:h-20 flex items-center justify-center shadow-lg">
                  <Image src="/AGESCI.png" alt="AGESCI" width={100} height={100} className="max-h-full w-auto object-contain" />
                </a>
              </div>
            </div>
            
            <div className="flex items-center justify-center shrink-0">
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
            <div className="text-center md:text-right">
              <p>Branca L/C - Lupetti e Coccinelle</p>
            </div>
          </div>
        </div>
      </footer>

      <UserSupportChatWidget />
      <InstallBanner />
    </div>
  );
}
