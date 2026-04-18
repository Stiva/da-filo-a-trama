import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auth } from '@clerk/nextjs/server';
import { 
  CheckCircle, XCircle, ArrowLeft, User, Mail, MapPin, Tag, 
  HeartPulse, AlertTriangle, Leaf, Target, Lightbulb, Utensils, Users, ShieldAlert, Stethoscope
} from 'lucide-react';
import type { ParticipantCrmView } from '@/types/database';

interface CRMDetailPageProps {
  params: Promise<{ codice: string }>;
}

export default async function CRMDetailPage({ params }: CRMDetailPageProps) {
  const { codice } = await params;
  const decodedCodice = decodeURIComponent(codice);
  
  // Verify Admin manually since we are using service role to bypass restrictive RLS on participants
  const session = await auth();
  if (!session.userId) notFound();
  
  const supabase = createServiceRoleClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', session.userId)
    .single();

  if (!profile || profile.role !== 'admin') {
    notFound();
  }

  // Fetch participant from view USING service role
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
                {participant.static_group && (
                  <Link href={`/admin/static-groups/${encodeURIComponent(participant.static_group)}`} className="inline-flex hover:bg-purple-100 transition-colors items-center px-3 py-1 rounded-full text-sm font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    Gruppo: {participant.static_group}
                  </Link>
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
               <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2"></div>
               <div>
                  <dt className="text-sm font-bold text-agesci-blue mb-1 flex items-center gap-1.5"><Users className="w-4 h-4" /> Gruppo Statico Eventi</dt>
                  <dd className="text-gray-900">
                    {participant.static_group ? (
                       <Link href={`/admin/static-groups/${encodeURIComponent(participant.static_group)}`} className="text-purple-700 font-bold hover:underline">
                         {participant.static_group}
                       </Link>
                    ) : (
                       <span className="text-gray-400 italic">Nessun gruppo assegnato</span>
                    )}
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
      
      {/* Second Row: Sanitario & Sostenibilità */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        
        {/* Left Column - Informazioni Sanitarie e Alimentari */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-red-50/50">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-red-500" />
              Area Prevenzione e Alimentazione
            </h3>
          </div>
          <div className="p-6 space-y-6">
            
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
               <dt className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                 <Utensils className="w-4 h-4 text-orange-500" /> Esigenze Alimentari
               </dt>
               <dd className="text-gray-900 leading-relaxed font-medium">
                 {participant.esigenze_alimentari && participant.esigenze_alimentari.toLowerCase() !== 'nessuna' && participant.esigenze_alimentari.toLowerCase() !== 'no' 
                   ? participant.esigenze_alimentari
                   : <span className="text-gray-400 font-normal italic">Nessuna esigenza segnalata</span>
                 }
               </dd>
            </div>

            <div>
               <dt className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                 <AlertTriangle className="w-4 h-4 text-red-500" /> Allergie & Reazioni
               </dt>
               <dd className="text-gray-900 leading-relaxed bg-white border border-red-100 rounded-lg p-3">
                 {participant.allergie && participant.allergie.toLowerCase() !== 'nessuna' && participant.allergie.toLowerCase() !== 'no'
                   ? <span className="text-red-700 font-medium">{participant.allergie}</span>
                   : <span className="text-gray-400 italic">Nessuna allergia segnalata</span>
                 }
               </dd>
            </div>
            
            </div>
            
            {/* Campi Sicurezza (v053) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
               <div>
                  <dt className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-red-600" /> Personale Medico
                  </dt>
                  <dd>
                     {participant.is_medical_staff ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                           MEDICO / INFERMIERE
                        </span>
                     ) : (
                        <span className="text-gray-400 text-sm italic">Nessuna qualifica medica</span>
                     )}
                  </dd>
               </div>
               <div>
                  <dt className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-orange-600" /> Addetto Antincendio
                  </dt>
                  <dd>
                     {participant.fire_warden_level ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200 uppercase">
                           LIVELLO {participant.fire_warden_level}
                        </span>
                     ) : (
                        <span className="text-gray-400 text-sm italic">Nessun incarico</span>
                     )}
                  </dd>
               </div>
            </div>

          </div>
        </div>

        {/* Right Column - Questionario Avventure Sostenibili */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-green-50/50">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-green-600" />
              Questionario "Avventure Sostenibili"
            </h3>
          </div>
          <div className="p-6 space-y-6">
            
            <div>
               <dt className="text-sm font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                 <Target className="w-4 h-4" /> Qual è la principale aspettativa all'evento?
               </dt>
               <dd className="text-gray-900 font-medium bg-green-50/30 border border-green-100 px-4 py-3 rounded-xl border-l-4 border-l-green-400">
                 {participant.aspettativa_evento || <span className="text-gray-400 italic">Non compilato</span>}
               </dd>
            </div>

            <div>
               <dt className="text-sm font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                 <Lightbulb className="w-4 h-4 text-yellow-500" /> Competenza percepita in sostenibilità
               </dt>
               <dd className="text-gray-900">
                 {participant.competenza_sostenibilita ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100/50 text-yellow-800 border border-yellow-200">
                      {participant.competenza_sostenibilita.toUpperCase()}
                    </span>
                 ) : (
                    <span className="text-gray-400 italic text-sm">Non compilato</span>
                 )}
               </dd>
            </div>

            <div className="pt-4 border-t border-gray-100">
               <dt className="text-sm font-medium text-gray-500 mb-3">Temi di sviluppo sostenibile d'interesse</dt>
               <dd className="flex flex-wrap gap-2 text-sm">
                 {participant.temi_sostenibilita ? (
                    // Parse comma-separated array from CSV format 
                    participant.temi_sostenibilita.split(',').map((tema: string, i: number) => (
                      <span key={i} className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-agesci-blue border border-blue-100 font-medium">
                        {tema.trim()}
                      </span>
                    ))
                 ) : (
                    <span className="text-gray-400 italic">Nessun tema selezionato</span>
                 )}
               </dd>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
