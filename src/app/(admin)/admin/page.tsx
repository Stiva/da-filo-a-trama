import { createServiceRoleClient } from '@/lib/supabase/server';
import Link from 'next/link';

// Force dynamic rendering (no static generation at build time)
export const dynamic = 'force-dynamic';

async function getStats() {
  const supabase = createServiceRoleClient();

  // Conta eventi
  const { count: eventsCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });

  // Conta eventi pubblicati
  const { count: publishedEventsCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true);

  // Conta utenti
  const { count: usersCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  // Conta iscrizioni confermate
  const { count: enrollmentsCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'confirmed');

  // Conta POI
  const { count: poiCount } = await supabase
    .from('poi')
    .select('*', { count: 'exact', head: true });

  // Eventi recenti
  const { data: recentEvents } = await supabase
    .from('events')
    .select('id, title, category, start_time, is_published')
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    eventsCount: eventsCount || 0,
    publishedEventsCount: publishedEventsCount || 0,
    usersCount: usersCount || 0,
    enrollmentsCount: enrollmentsCount || 0,
    poiCount: poiCount || 0,
    recentEvents: recentEvents || [],
  };
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  const statCards = [
    {
      label: 'Eventi Totali',
      value: stats.eventsCount,
      subtext: `${stats.publishedEventsCount} pubblicati`,
      color: 'bg-blue-500',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Utenti Registrati',
      value: stats.usersCount,
      subtext: 'Profili attivi',
      color: 'bg-green-500',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      label: 'Iscrizioni',
      value: stats.enrollmentsCount,
      subtext: 'Confermate',
      color: 'bg-purple-500',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'Punti di Interesse',
      value: stats.poiCount,
      subtext: 'Sulla mappa',
      color: 'bg-orange-500',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Panoramica dell&apos;evento Da Filo a Trama</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`${stat.color} text-white p-3 rounded-lg`}>
                  {stat.icon}
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-400">{stat.subtext}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Eventi Recenti</h2>
          <Link
            href="/admin/events"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Vedi tutti
          </Link>
        </div>

        <div className="divide-y divide-gray-100">
          {stats.recentEvents.length === 0 ? (
            <div className="p-5 text-center text-gray-500">
              Nessun evento creato
            </div>
          ) : (
            stats.recentEvents.map((event) => (
              <div key={event.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <h3 className="font-medium text-gray-900">{event.title}</h3>
                  <p className="text-sm text-gray-500">
                    {event.category} - {new Date(event.start_time).toLocaleDateString('it-IT')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    event.is_published
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {event.is_published ? 'Pubblicato' : 'Bozza'}
                  </span>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <Link
            href="/admin/events/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuovo Evento
          </Link>
        </div>
      </div>
    </div>
  );
}
