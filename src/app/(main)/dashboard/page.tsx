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
    .select('onboarding_completed, first_name')
    .eq('clerk_id', userId)
    .single();

  if (profile && !profile.onboarding_completed) {
    redirect('/onboarding');
  }

  const firstName = profile?.first_name || user?.firstName || 'Scout';

  const quickActions = [
    {
      title: 'Eventi Consigliati',
      description: 'Scopri gli eventi più adatti alle tue preferenze',
      href: '/events',
      icon: CalendarIcon,
      buttonText: 'Esplora Eventi',
      variant: 'primary' as const,
    },
    {
      title: 'Mappa Interattiva',
      description: "Trova punti di interesse e orientati nell'evento",
      href: '/map',
      icon: MapIcon,
      buttonText: 'Apri Mappa',
      variant: 'secondary' as const,
    },
    {
      title: 'Il Tuo Profilo',
      description: 'Gestisci il tuo avatar e le preferenze',
      href: '/profile',
      icon: UserIcon,
      buttonText: 'Modifica Profilo',
      variant: 'accent' as const,
    },
    {
      title: 'Le Tue Iscrizioni',
      description: 'Visualizza gli eventi a cui sei iscritto',
      href: '/my-events',
      icon: StarIcon,
      buttonText: 'Vedi Iscrizioni',
      variant: 'outline' as const,
    },
  ];

  return (
    <main className="py-8">
      <div className="container-scout">
        {/* Header con saluto */}
        <header className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="icon-playful">
              <span className="text-2xl">👋</span>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-agesci-blue">
                Ciao, {firstName}!
              </h1>
              <p className="text-agesci-blue/60 mt-1">
                Benvenuto nella tua dashboard personale
              </p>
            </div>
          </div>
        </header>

        {/* Quick Actions Grid */}
        <section className="mb-10">
          <h2 className="text-xl font-display font-bold text-agesci-blue mb-6">
            Azioni Rapide
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <div key={action.href} className="card-hover">
                  <div className="card-body">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        action.variant === 'primary' ? 'bg-agesci-yellow text-agesci-blue' :
                        action.variant === 'secondary' ? 'bg-agesci-blue text-white' :
                        action.variant === 'accent' ? 'bg-lc-green text-white' :
                        'bg-agesci-blue/10 text-agesci-blue'
                      }`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-display font-bold text-agesci-blue text-lg mb-1">
                          {action.title}
                        </h3>
                        <p className="text-agesci-blue/60 text-sm mb-4">
                          {action.description}
                        </p>
                        <Link
                          href={action.href}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                            action.variant === 'primary'
                              ? 'btn-primary'
                              : action.variant === 'secondary'
                              ? 'btn-secondary'
                              : action.variant === 'accent'
                              ? 'btn-accent'
                              : 'btn-outline'
                          }`}
                        >
                          {action.buttonText}
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Info Box */}
        <section className="card bg-gradient-to-r from-agesci-yellow/20 to-lc-green/20 border-agesci-yellow">
          <div className="card-body">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-agesci-yellow flex items-center justify-center text-2xl flex-shrink-0">
                🌟
              </div>
              <div>
                <h3 className="font-display font-bold text-agesci-blue text-lg mb-3">
                  Prossimi passi
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-agesci-blue/80">
                    <CheckCircle className="w-5 h-5 text-lc-green flex-shrink-0" />
                    <span>Completa il tuo profilo con gruppo scout e avatar</span>
                  </li>
                  <li className="flex items-center gap-2 text-agesci-blue/80">
                    <CheckCircle className="w-5 h-5 text-lc-green flex-shrink-0" />
                    <span>Imposta le tue preferenze per ricevere suggerimenti</span>
                  </li>
                  <li className="flex items-center gap-2 text-agesci-blue/80">
                    <CheckCircle className="w-5 h-5 text-lc-green flex-shrink-0" />
                    <span>Esplora il programma e iscriviti agli eventi</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

// Icon components
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
