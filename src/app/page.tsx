import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Image from 'next/image';

export default async function HomePage() {
  const { userId } = await auth();

  // Se l'utente e' autenticato, redirect alla dashboard
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-scout-cream flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8">
        <div className="text-center max-w-2xl w-full flex flex-col items-center">
          {/* Logo/Header */}
          <div className="relative w-64 h-28 md:w-80 md:h-36 mb-4">
            <Image 
              src="/Logo completo.png"
              alt="Da Filo a Trama"
              fill
              className="object-contain"
              priority
            />
          </div>
          <p className="text-xl md:text-2xl mb-10 font-semibold" style={{ color: 'var(--scout-azure)' }}>
            Evento Nazionale Scout 2026
          </p>

          {/* Descrizione in a stylized card */}
          <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-black/5 mb-12 text-gray-700 w-full">
            <p className="text-lg md:text-xl font-medium mb-3">
              Unisciti a <b className="text-agesci-blue">1.500 scout</b> da tutta Italia per un&apos;esperienza unica.
            </p>
            <p className="text-base text-gray-500">
              Esplora gli eventi, partecipa ai laboratori e scopri le attivita&apos; pensate per te.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md">
            <Link
              href="/sign-up"
              className="flex-1 flex items-center justify-center px-8 py-4 text-lg font-bold text-white rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 active:translate-y-0"
              style={{ backgroundColor: 'var(--scout-green)' }}
            >
              Registrati
            </Link>
            <Link
              href="/sign-in"
              className="flex-1 flex items-center justify-center px-8 py-4 text-lg font-bold rounded-2xl border-[3px] transition-all hover:bg-white active:scale-95"
              style={{ borderColor: 'var(--scout-azure)', color: 'var(--scout-azure)' }}
            >
              Accedi
            </Link>
          </div>
        </div>
      </main>

      {/* Footer (allineato al main layout) */}
      <footer className="bg-agesci-blue text-white py-8 mt-auto w-full">
        <div className="container-scout mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Image
                src="/Logo completo.png"
                alt="Da Filo a Trama"
                width={160}
                height={63}
                className="h-10 w-auto brightness-0 invert"
              />
            </div>
            <div className="text-sm text-white/70 text-center md:text-right">
              <p className="font-semibold text-white">&copy; 2026 AGESCI - Tutti i diritti riservati</p>
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
