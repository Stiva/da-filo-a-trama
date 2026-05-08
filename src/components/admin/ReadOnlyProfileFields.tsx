import type { Profile, ServiceRole } from '@/types/database';
import { SERVICE_ROLE_LABELS, FIRE_WARDEN_LABELS } from '@/types/database';

const ROLE_LABELS: Record<string, string> = {
  user: 'Utente',
  segreteria: 'Segreteria/Informazione',
  staff: 'Staff',
  admin: 'Admin',
  guest: 'Ospite',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>
      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-800 min-h-[40px] flex items-center">
        {value || <span className="text-gray-400 italic">non impostato</span>}
      </div>
    </div>
  );
}

export default function ReadOnlyProfileFields({ user }: { user: Profile }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Row label="Nome" value={user.name} />
        <Row label="Cognome" value={user.surname} />
      </div>

      <Row label="Codice Socio" value={user.codice_socio} />
      <Row label="Gruppo Scout" value={user.scout_group} />

      {user.service_role && (
        <Row
          label="Ruolo di Servizio"
          value={SERVICE_ROLE_LABELS[user.service_role as ServiceRole] || user.service_role}
        />
      )}

      {user.static_group && (
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">Gruppo Statico Assegnato</div>
          <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-md text-sm text-purple-700 font-bold inline-block">
            {user.static_group}
          </div>
        </div>
      )}

      <Row label="Ruolo" value={ROLE_LABELS[user.role] || user.role} />

      <div className="pt-4 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Sicurezza e Emergenza
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Row label="Medico / Infermiere" value={user.is_medical_staff ? '🩺 Sì' : 'No'} />
          <Row
            label="Addetto Antincendio"
            value={user.fire_warden_level ? FIRE_WARDEN_LABELS[user.fire_warden_level] : null}
          />
        </div>
      </div>

      <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700">
        Stai consultando questo profilo in sola lettura. Solo admin e staff possono modificare l'anagrafica.
      </div>
    </>
  );
}
