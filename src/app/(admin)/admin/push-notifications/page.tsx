import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, Bell, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default async function PushNotificationsHistoryPage() {
  const supabase = await createServerSupabaseClient();

  const { data: history, error } = await supabase
    .from('push_notifications_history')
    .select(`
      *,
      sender:profiles(name, surname),
      event:events(title)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Errore nel caricamento storico push:', error);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Notifiche Push
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Visualizza lo storico invii e crea nuove notifiche per l'app PWA.
          </p>
        </div>
        <Link
          href="/admin/push-notifications/create"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-agesci-blue hover:bg-agesci-blue/90 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Invia Nuova Notifica
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {history && history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notifica
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Esito
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data e Mittente
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((record: any) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          <Bell className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 line-clamp-1">{record.title}</div>
                          <div className="text-sm text-gray-500 line-clamp-2 mt-1 max-w-xs xl:max-w-md">
                            {record.body_text}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${record.target_type === 'all' ? 'bg-purple-100 text-purple-800' : 
                          record.target_type === 'staff' ? 'bg-red-100 text-red-800' : 
                          'bg-blue-100 text-blue-800'}
                      `}>
                        {record.target_type === 'all' && 'Tutti gli Utenti'}
                        {record.target_type === 'staff' && 'Solo Staff'}
                        {record.target_type === 'event' && `Evento`}
                      </span>
                      {record.target_type === 'event' && record.event && (
                        <div className="text-xs text-gray-500 mt-1 truncate max-w-[150px]">
                          {record.event.title}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-center gap-1.5 text-green-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{record.success_count} inviate</span>
                        </div>
                        {record.failure_count > 0 && (
                          <div className="flex items-center gap-1.5 text-red-600">
                            <XCircle className="w-4 h-4" />
                            <span>{record.failure_count} fallite (cancellate)</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        {format(new Date(record.created_at), "d MMMM yyyy, HH:mm", { locale: it })}
                      </div>
                      <div className="text-xs mt-1 text-gray-400">
                        da {record.sender ? `${record.sender.name || ''} ${record.sender.surname || ''}` : 'Sconosciuto'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 flex flex-col items-center justify-center min-h-[400px]">
            <Bell className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Nessuna notifica</h3>
            <p className="max-w-md text-center text-gray-500 mt-2">
              Non hai ancora inviato nessuna notifica push in broadcast dall'app.
              Clicca sul bottone in alto per crearne una nuova.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
