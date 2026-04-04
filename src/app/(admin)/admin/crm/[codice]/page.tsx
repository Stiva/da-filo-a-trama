import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CheckCircle, XCircle, ArrowLeft, User, Mail, MapPin, Tag } from 'lucide-react';
import type { ParticipantCrmView } from '@/types/database';

interface CRMDetailPageProps {
  params: Promise<{ codice: string }>;
}

export default async function CRMDetailPage({ params }: CRMDetailPageProps) {
  const { codice } = await params;
  const decodedCodice = decodeURIComponent(codice);
  const supabase = await createServerSupabaseClient();

  // Fetch participant from view
  const { data: participant } = await supabase
    .from('participant_crm_view')
    .select('*')
    .eq('codice', decodedCodice)
    .single();

  if (!participant) {
    notFound();
  }

  // Get initials for Avatar
  const getInitials = (n = '', s = '') => {
    return `${n.charAt(0)}${s.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header / Breadcrumb */}
      <div className="mb-6">
        <Link href="/admin/crm" className="text-gray-500 hover:text-gray-900 flex items-center gap-2 text-sm font-medium w-fit">
          <ArrowLeft className="w-4 h-4" />
          Torna alla Lista BC
        </Link>
      </div>

      {/* Main CRM Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            {/* Avatar */}
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-agesci-blue to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-inner flex-shrink-0">
               {participant.profile_avatar_url ? (
                  <img src={participant.profile_avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
               ) : (
                  getInitials(participant.nome, participant.cognome)
               )}
            </div>
            {/* Titolo e Info Rapide */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {participant.nome} {participant.cognome}
              </h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                  <Tag className="w-4 h-4" /> C.S. {participant.codice}
                </span>
                {participant.ruolo && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    {participant.ruolo}
                  </span>
                )}
                {!participant.is_active_in_list && (
                   <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
                     RIMOSSO
                   </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions / Link if App Registered */}
          <div className="w-full md:w-auto flex justify-center md:justify-end">
            {participant.linked_profile_id ? (
               <Link href={`/admin/users/${participant.linked_profile_id}`} className="btn bg-agesci-blue hover:bg-agesci-blue-light text-white shadow-sm flex items-center gap-2">
                 <User className="w-4 h-4" />
                 Apri Profilo App
               </Link>
            ) : (
               <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed">
                 Non registrato in App
               </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Anagrafica (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                 Dettagli Anagrafica
               </h3>
             </div>
             <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1.5"><User className="w-4 h-4" /> Nome</dt>
                  <dd className="text-gray-900 font-medium">{participant.nome}</dd>
               </div>
               <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1.5"><User className="w-4 h-4" /> Cognome</dt>
                  <dd className="text-gray-900 font-medium">{participant.cognome}</dd>
               </div>
               <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2"></div>
               <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1.5"><Mail className="w-4 h-4" /> Email Principale</dt>
                  <dd className="text-gray-900 font-medium">{participant.email_contatto || 'Nessuna'}</dd>
               </div>
               <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1.5"><Mail className="w-4 h-4" /> Email Referente</dt>
                  <dd className="text-gray-900">{participant.email_referente || '-'}</dd>
               </div>
               <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2"></div>
               <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Gruppo Scout</dt>
                  <dd className="text-gray-900 font-medium">{participant.gruppo || 'N/D'}</dd>
               </div>
               <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Regione / Zona</dt>
                  <dd className="text-gray-900">
                    {participant.regione || '-'} {participant.zona ? `(${participant.zona})` : ''}
                  </dd>
               </div>
             </div>
          </div>
        </div>

        {/* Right Column - Status & Desk (1/3 width) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="px-6 py-5 border-b border-gray-200 bg-gray-50/50">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                 Stato Iscrizione
               </h3>
             </div>
             <div className="p-6 space-y-5">
                {/* App Registration Status */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Registrazione App</p>
                    <p className="text-xs text-gray-500 mt-0.5">Codice legato ad un profilo</p>
                  </div>
                  {participant.is_app_registered ? (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  ) : (
                    <XCircle className="w-6 h-6 text-gray-300" />
                  )}
                </div>

                {/* Desk Check-in Status */}
                <div className={`flex flex-col gap-3 p-4 rounded-xl border ${participant.is_checked_in ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Desk Check-in</p>
                      <p className="text-xs text-gray-500 mt-0.5">Presenza all'evento</p>
                    </div>
                    {participant.is_checked_in ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                        PRESENTE
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-700">
                        ASSENTE
                      </span>
                    )}
                  </div>
                  
                  {participant.is_checked_in && participant.check_in_at && (
                    <div className="text-xs text-green-700 bg-green-100/50 px-3 py-2 rounded-lg">
                      Registrato il {new Date(participant.check_in_at).toLocaleDateString('it-IT')} alle {new Date(participant.check_in_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
             </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
