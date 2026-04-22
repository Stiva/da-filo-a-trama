'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Profile, ServiceRole } from '@/types/database';
import { SERVICE_ROLE_LABELS } from '@/types/database';
import AvatarPreview from '@/components/AvatarPreview';
import Autocomplete from '@/components/Autocomplete';

interface ProfileWithEnrollments extends Profile {
  enrollments_count?: number;
  events_enrolled?: Array<{
    id: string;
    title: string;
    start_time: string;
    status: string;
  }>;
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [user, setUser] = useState<ProfileWithEnrollments | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    codice_socio: '',
    scout_group: '',
    role: 'user' as 'user' | 'staff' | 'admin' | 'guest',
    onboarding_completed: false,
    avatar_completed: false,
    preferences_set: false,
    is_medical_staff: false,
    fire_warden_level: '',
  });
  const [scoutGroups, setScoutGroups] = useState<{ id: string, name: string }[]>([]);

  useEffect(() => {
    fetchUser();
    fetchScoutGroups();
  }, [id]);

  const fetchScoutGroups = async () => {
    try {
      const res = await fetch('/api/scout-groups');
      const json = await res.json();
      if (res.ok && json.data) setScoutGroups(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUser = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      const userData = result.data as ProfileWithEnrollments;
      setUser(userData);
      setFormData({
        name: userData.name || '',
        surname: userData.surname || '',
        codice_socio: userData.codice_socio || '',
        scout_group: userData.scout_group || '',
        role: userData.role,
        onboarding_completed: userData.onboarding_completed,
        avatar_completed: userData.avatar_completed,
        preferences_set: userData.preferences_set,
        is_medical_staff: userData.is_medical_staff || false,
        fire_warden_level: userData.fire_warden_level || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Update profile data
      const profileResponse = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          surname: formData.surname,
          codice_socio: formData.codice_socio || null,
          scout_group: formData.scout_group,
          onboarding_completed: formData.onboarding_completed,
          avatar_completed: formData.avatar_completed,
          preferences_set: formData.preferences_set,
          is_medical_staff: formData.is_medical_staff,
          fire_warden_level: formData.fire_warden_level || null,
        }),
      });

      if (!profileResponse.ok) {
        const result = await profileResponse.json();
        throw new Error(result.error || 'Errore nell\'aggiornamento');
      }

      // Update role if changed
      if (user && formData.role !== user.role) {
        const roleResponse = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: id,
            newRole: formData.role,
          }),
        });

        if (!roleResponse.ok) {
          const result = await roleResponse.json();
          throw new Error(result.error || 'Errore nell\'aggiornamento del ruolo');
        }
      }

      fetchUser();
      alert('Modifiche salvate con successo');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    const userName = `${user.name || ''} ${user.surname || ''}`.trim() || user.email;
    if (!confirm(`Sei sicuro di voler eliminare l'utente "${userName}"?\n\nQuesta azione eliminerà anche tutte le iscrizioni associate e non può essere annullata.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Errore nell\'eliminazione');
      }

      router.push('/admin/users');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'waitlist':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-agesci-blue border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-600">Caricamento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded-lg">
        {error}
        <Link href="/admin/users" className="block mt-2 underline">
          Torna alla lista utenti
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12 text-gray-500">
        Utente non trovato
        <Link href="/admin/users" className="block mt-2 text-agesci-blue underline">
          Torna alla lista utenti
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/users"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {user.name || user.first_name || 'N/D'} {user.surname || ''}
            </h1>
            <p className="text-gray-500 flex items-center gap-2">
              {user.email}
              {user.codice_socio && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  C.S. {user.codice_socio}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user.codice_socio && (
            <Link
              href={`/admin/crm/${encodeURIComponent(user.codice_socio)}`}
              className="px-4 py-2 bg-agesci-blue/10 text-agesci-blue hover:bg-agesci-blue/20 rounded-lg transition-colors font-medium border border-transparent"
            >
              Vedi in CRM
            </Link>
          )}
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Elimina Utente
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Avatar & Basic Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informazioni Profilo</h2>

            <div className="flex items-start gap-6 mb-6">
              <AvatarPreview config={user.avatar_config} size="lg" />
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                    <input
                      type="text"
                      value={formData.surname}
                      onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                      className="input w-full"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codice Socio</label>
                  <input
                    type="text"
                    value={formData.codice_socio}
                    onChange={(e) => setFormData({ ...formData, codice_socio: e.target.value })}
                    className="input w-full"
                    placeholder="Es. 123456"
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gruppo Scout</label>
                  <Autocomplete
                    value={formData.scout_group}
                    onChange={(val) => setFormData({ ...formData, scout_group: val })}
                    options={scoutGroups}
                    placeholder="Es. Roma 123 o lascia vuoto"
                  />
                </div>

                {user.service_role && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo di Servizio</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 font-medium inline-block">
                      {SERVICE_ROLE_LABELS[user.service_role as ServiceRole] || user.service_role}
                    </div>
                  </div>
                )}
                
                {user.static_group && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gruppo Statico Assegnato</label>
                    <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-md text-sm text-purple-700 font-bold inline-block">
                      {user.static_group}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'user' | 'staff' | 'admin' | 'guest' })}
                    className="input w-full"
                  >
                    <option value="user">Utente</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    <option value="guest">Ospite</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Sicurezza e Emergenza
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <input 
                        type="checkbox" 
                        id="is_medical_staff_admin"
                        checked={formData.is_medical_staff}
                        onChange={(e) => setFormData({ ...formData, is_medical_staff: e.target.checked })}
                        className="w-5 h-5 text-agesci-blue rounded border-gray-300 focus:ring-agesci-blue"
                      />
                      <label htmlFor="is_medical_staff_admin" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                        🩺 Medico / Infermiere
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Addetto Antincendio</label>
                      <select
                        value={formData.fire_warden_level}
                        onChange={(e) => setFormData({ ...formData, fire_warden_level: e.target.value })}
                        className="input w-full text-sm"
                      >
                        <option value="">Nessuno / Non addetto</option>
                        <option value="basso">Rischio Basso (Livello 1)</option>
                        <option value="medio">Rischio Medio (Livello 2)</option>
                        <option value="alto">Rischio Alto (Livello 3)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-agesci-blue text-white rounded-lg hover:bg-agesci-blue-light transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Salvataggio...' : 'Salva Modifiche'}
              </button>
            </div>
          </div>

          {/* Enrollments */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Iscrizioni Eventi ({user.enrollments_count || 0})
            </h2>

            {user.events_enrolled && user.events_enrolled.length > 0 ? (
              <div className="space-y-3">
                {user.events_enrolled.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{event.title}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(event.start_time).toLocaleDateString('it-IT', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeColor(event.status)}`}>
                      {event.status === 'confirmed' ? 'Confermato' :
                        event.status === 'waitlist' ? 'Lista attesa' :
                          event.status === 'cancelled' ? 'Cancellato' : event.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Nessuna iscrizione</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Stato Account</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Onboarding</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.onboarding_completed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                  {user.onboarding_completed ? 'Si' : 'No'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Avatar</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.avatar_completed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                  {user.avatar_completed ? 'Si' : 'No'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Preferenze</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.preferences_set ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                  {user.preferences_set ? 'Si' : 'No'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Profilo Completo</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.profile_setup_complete ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                  {user.profile_setup_complete ? 'Si' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferenze</h2>

            {user.preferences && user.preferences.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.preferences.map((pref) => (
                  <span
                    key={pref}
                    className="px-3 py-1 bg-agesci-yellow/20 text-agesci-blue rounded-full text-sm"
                  >
                    {pref}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Nessuna preferenza impostata</p>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Info Tecniche</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ID</span>
                <span className="text-gray-900 font-mono text-xs">{user.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Clerk ID</span>
                <span className="text-gray-900 font-mono text-xs">{user.clerk_id.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Registrato</span>
                <span className="text-gray-900">
                  {new Date(user.created_at).toLocaleDateString('it-IT')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ultimo aggiornamento</span>
                <span className="text-gray-900">
                  {new Date(user.updated_at).toLocaleDateString('it-IT')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
