import StaticGroupsManager from '@/components/admin/StaticGroupsManager';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { SERVICE_ROLE_LABELS } from '@/types/database';

export const metadata = {
  title: 'Gruppi Statici | Admin',
};

export default async function StaticGroupsPage() {
  const supabase = createServiceRoleClient();
  
  // Fetch initial participants
  const { data: participants } = await supabase
    .from('participant_crm_view')
    .select('codice, nome, cognome, ruolo, regione, static_group, is_app_registered')
    .eq('is_active_in_list', true)
    .order('cognome');

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gruppi Statici</h1>
        <p className="text-gray-600">
          Gestisci i gruppi di lavoro permanenti in modalita' statica, calcolando bilanciamenti per ruolo e per regione dal CRM Iscritti.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg border border-gray-200">
        <StaticGroupsManager 
            initialParticipants={participants || []} 
            availableRoles={Object.keys(SERVICE_ROLE_LABELS)} 
        />
      </div>
    </div>
  );
}
