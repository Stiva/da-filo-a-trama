import Navbar from '@/components/Navbar';
import Image from 'next/image';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-scout-cream">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-agesci-blue text-white py-8 mt-16">
        <div className="container-scout">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/favicon.png"
                alt="Da Filo a Trama"
                width={40}
                height={40}
                className="rounded-xl"
              />
              <div>
                <span className="font-display font-bold text-lg">Da Filo a Trama</span>
                <span className="block text-xs text-white/60">Evento Scout AGESCI 2026</span>
              </div>
            </div>
            <div className="text-sm text-white/60 text-center md:text-right">
              <p>&copy; 2026 AGESCI - Tutti i diritti riservati</p>
              <p className="mt-1">
                Branca L/C - Lupetti e Coccinelle
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
