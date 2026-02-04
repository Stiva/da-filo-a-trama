import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await currentUser();

  // Verifica se l'onboarding e' completato
  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('clerk_id', userId)
    .single();

  if (profile && !profile.onboarding_completed) {
    redirect('/onboarding');
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--scout-green)' }}>
            Ciao, {user?.firstName || 'Scout'}!
          </h1>
          <p className="text-gray-600 mt-2">
            Benvenuto nella tua dashboard personale
          </p>
        </header>

        {/* Quick Actions Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Eventi Consigliati */}
          <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--scout-azure)' }}>
              Eventi Consigliati
            </h2>
            <p className="text-gray-500 mb-4">
              Scopri gli eventi piu&apos; adatti alle tue preferenze
            </p>
            <Link
              href="/events"
              className="inline-block px-4 py-2 text-white rounded-md"
              style={{ backgroundColor: 'var(--scout-green)' }}
            >
              Esplora Eventi
            </Link>
          </div>

          {/* Mappa */}
          <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--scout-azure)' }}>
              Mappa Interattiva
            </h2>
            <p className="text-gray-500 mb-4">
              Trova punti di interesse e orientati nell&apos;evento
            </p>
            <Link
              href="/map"
              className="inline-block px-4 py-2 text-white rounded-md"
              style={{ backgroundColor: 'var(--scout-azure)' }}
            >
              Apri Mappa
            </Link>
          </div>

          {/* Profilo */}
          <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--scout-wood)' }}>
              Il Tuo Profilo
            </h2>
            <p className="text-gray-500 mb-4">
              Gestisci il tuo avatar e le preferenze
            </p>
            <Link
              href="/profile"
              className="inline-block px-4 py-2 text-white rounded-md"
              style={{ backgroundColor: 'var(--scout-wood)' }}
            >
              Modifica Profilo
            </Link>
          </div>

          {/* Iscrizioni */}
          <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--scout-green-light)' }}>
              Le Tue Iscrizioni
            </h2>
            <p className="text-gray-500 mb-4">
              Visualizza gli eventi a cui sei iscritto
            </p>
            <Link
              href="/my-events"
              className="inline-block px-4 py-2 text-white rounded-md"
              style={{ backgroundColor: 'var(--scout-green-light)' }}
            >
              Vedi Iscrizioni
            </Link>
          </div>
        </div>

        {/* Info Box */}
        <div
          className="p-6 rounded-lg"
          style={{ backgroundColor: 'var(--scout-cream)' }}
        >
          <h3 className="font-semibold mb-2">Prossimi passi</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Completa il tuo profilo con gruppo scout e avatar</li>
            <li>Imposta le tue preferenze per ricevere suggerimenti personalizzati</li>
            <li>Esplora il programma e iscriviti agli eventi</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
