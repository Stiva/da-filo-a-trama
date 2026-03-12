import { createServiceRoleClient } from '@/lib/supabase/server';
import PushNotificationForm from './PushNotificationForm';

// Metadata opzionale per tab browser
export const metadata = {
  title: 'Invia Notifica Push | Da Filo a Trama',
};

export default async function CreatePushNotificationPage() {
  const supabase = createServiceRoleClient();

  // Recupera eventi imminenti/presenti a cui indirizzare i push in base agli iscritti
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title')
    .order('start_time', { ascending: false })
    .limit(50); // Mantiene le prestazioni ragionevoli

  if (error) {
    console.error('Errore nel caricamento eventi per Notifiche Push:', error);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Invia Nuova Notifica
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Componi e invia un broadcast personalizzato push agli utenti dell'app.
        </p>
      </div>

      <PushNotificationForm events={events || []} />
    </div>
  );
}
