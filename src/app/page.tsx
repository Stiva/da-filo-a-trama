import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const { userId } = await auth();

  // Se l'utente e' autenticato, redirect alla dashboard
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        {/* Logo/Header */}
        <h1 className="text-4xl md:text-6xl font-bold mb-4" style={{ color: 'var(--scout-green)' }}>
          Da Filo a Trama
        </h1>
        <p className="text-xl md:text-2xl mb-8" style={{ color: 'var(--scout-azure)' }}>
          Evento Nazionale Scout 2026
        </p>

        {/* Descrizione */}
        <p className="text-lg mb-12 text-gray-600">
          Unisciti a 1.500 scout da tutta Italia per un&apos;esperienza unica.
          Esplora eventi, laboratori e attivita&apos; pensate per te.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/sign-up"
            className="px-8 py-4 text-lg font-semibold text-white rounded-lg shadow-lg transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--scout-green)' }}
          >
            Registrati
          </Link>
          <Link
            href="/sign-in"
            className="px-8 py-4 text-lg font-semibold rounded-lg border-2 transition-all hover:bg-gray-50"
            style={{ borderColor: 'var(--scout-azure)', color: 'var(--scout-azure)' }}
          >
            Accedi
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-16 text-sm text-gray-500">
          AGESCI - Associazione Guide e Scout Cattolici Italiani
        </p>
      </div>
    </main>
  );
}
