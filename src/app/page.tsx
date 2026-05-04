import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import FooterSponsors from '@/components/FooterSponsors';
import FooterSupporter from '@/components/FooterSupporter';

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
            Convegno Nazionale sull'Ambiente Fantastico - AGESCI Branca L/C 2026
          </p>

          {/* Descrizione in a stylized card */}
          <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-black/5 mb-12 text-gray-700 w-full">
            <p className="text-lg md:text-xl font-medium mb-3">
              Unisciti a <b className="text-agesci-blue">800 Capi Scout</b> da tutta Italia per un&apos;esperienza unica.
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

          {/* Guest link */}
          <p className="mt-6 text-sm text-gray-500">
            Sei un ospite dell&apos;evento?{' '}
            <Link
              href="/sign-up?mode=guest"
              className="font-semibold underline underline-offset-2 hover:text-gray-700 transition-colors"
              style={{ color: 'var(--scout-azure)' }}
            >
              Registrati come ospite
            </Link>
          </p>
        </div>
      </main>

      {/* Footer (allineato al main layout) */}
      <footer className="bg-agesci-blue text-white py-12 mt-auto w-full border-t border-agesci-blue/20">
        <div className="container-scout mx-auto px-6 space-y-8 flex flex-col">
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
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
