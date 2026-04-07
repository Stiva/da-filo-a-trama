import { createServiceRoleClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import StaticGroupDetail from '@/components/admin/StaticGroupDetail';

export const metadata = {
  title: 'Dettaglio Gruppo Statico | Admin',
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function StaticGroupPage({ params }: PageProps) {
  const { slug } = await params;
  const groupName = decodeURIComponent(slug);

  const supabase = createServiceRoleClient();
  
  // Fetch all active participants to allow adding/removing
  const { data: participants } = await supabase
    .from('participant_crm_view')
    .select('codice, nome, cognome, ruolo, regione, static_group, is_app_registered')
    .eq('is_active_in_list', true)
    .order('cognome');

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4">
        <Link href="/admin/static-groups" className="text-sm font-medium text-agesci-blue hover:underline flex items-center gap-1 w-fit">
          <ArrowLeft className="w-4 h-4" /> Torna a Gruppi Statici
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Composizione Gruppo: {groupName}</h1>
          <p className="text-gray-600">
            Gestisci i membri assegnati a questo gruppo. Puoi rimuovere iscritti o aggiungerne di nuovi pescandoli dagli iscritti non assegnati o da altri gruppi.
          </p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg border border-gray-200">
        <StaticGroupDetail 
            groupName={groupName}
            allParticipants={participants || []} 
        />
      </div>
    </div>
  );
}
