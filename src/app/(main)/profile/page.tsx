'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  PREFERENCE_TAGS,
  DEFAULT_AVATAR_CONFIG,
  type PreferenceTag,
  type AvatarConfig,
  type Profile,
  type ServiceRole,
  SERVICE_ROLE_LABELS,
} from '@/types/database';
import AvatarPreview from '@/components/AvatarPreview';
import AvatarCustomizer from '@/components/AvatarCustomizer';
import Autocomplete from '@/components/Autocomplete';
import { usePwaAndPush } from '@/hooks/usePwaAndPush';
import { Bell, BellOff } from 'lucide-react';

const generateRandomSeed = () => crypto.randomUUID().split('-')[0];

/** Converte un vecchio avatar_config (legacy) nel nuovo formato DiceBear */
const migrateAvatarConfig = (config: Record<string, unknown>): AvatarConfig => {
  if (config && 'style' in config && 'seed' in config) {
    return config as unknown as AvatarConfig;
  }
  return { ...DEFAULT_AVATAR_CONFIG, seed: generateRandomSeed() };
};

export default function ProfilePage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'preferences' | 'avatar'>('info');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [scoutGroups, setScoutGroups] = useState<{ id: string, name: string }[]>([]);

  // Push notifications hook
  const { isSubscribed, subscribeToPush, unsubscribeFromPush } = usePwaAndPush();
  const [isPushLoading, setIsPushLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    codice_socio: '',
    scout_group: '',
    service_role: '' as ServiceRole | '',
    preferences: [] as PreferenceTag[],
    avatar_config: { ...DEFAULT_AVATAR_CONFIG, seed: generateRandomSeed() } as AvatarConfig,
  });

  useEffect(() => {
    fetchProfile();
    fetchScoutGroups();
  }, []);

  const fetchScoutGroups = async () => {
    try {
      const res = await fetch('/api/scout-groups');
      const json = await res.json();
      if (res.ok && json.data) setScoutGroups(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profiles');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      setProfile(result.data);
      setFormData({
        name: result.data.name || '',
        surname: result.data.surname || '',
        codice_socio: result.data.codice_socio || '',
        scout_group: result.data.scout_group || '',
        service_role: result.data.service_role || '',
        preferences: result.data.preferences || [],
        avatar_config: migrateAvatarConfig(result.data.avatar_config || {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.codice_socio || !/^[0-9]{6,8}$/.test(formData.codice_socio)) {
      setError('Il Codice Socio deve essere un numero composto da 6 a 8 cifre.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          service_role: formData.service_role || null, // convert empty to null
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel salvataggio');
      }

      setProfile(result.data);
      setSuccess('Profilo aggiornato con successo!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = (tag: PreferenceTag) => {
    setFormData(prev => ({
      ...prev,
      preferences: prev.preferences.includes(tag)
        ? prev.preferences.filter(t => t !== tag)
        : [...prev.preferences, tag],
    }));
  };

  const handlePushToggle = async () => {
    setIsPushLoading(true);
    setError(null);
    try {
      if (isSubscribed) {
        await unsubscribeFromPush();
        setSuccess('Notifiche push disattivate con successo su questo dispositivo.');
      } else {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) throw new Error("Chiave di sicurezza Push non configurata nel server");
        await subscribeToPush(vapidKey);
        setSuccess('Notifiche push attivate con successo su questo dispositivo!');
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Non è stato possibile aggiornare lo stato notifiche");
    } finally {
      setIsPushLoading(false);
    }
  };

  const updateAvatarConfig = (updates: Partial<AvatarConfig>) => {
    setFormData(prev => ({
      ...prev,
      avatar_config: { ...prev.avatar_config, ...updates },
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('File troppo grande. Massimo 5MB.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setPhotoError('Formato non supportato. Usa JPG, PNG, WEBP o GIF.');
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoError(null);
    setError(null);

    try {
      const uploadData = new FormData();
      uploadData.append('photo', file);

      const response = await fetch('/api/profiles/photo', {
        method: 'POST',
        body: uploadData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nel caricamento');
      }

      setProfile(prev => prev ? { ...prev, profile_image_url: result.data.url } : prev);
      setSuccess('Foto profilo caricata con successo!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handlePhotoRemove = async () => {
    if (!confirm('Rimuovere la foto profilo?')) return;

    setIsUploadingPhoto(true);
    setPhotoError(null);

    try {
      const response = await fetch('/api/profiles/photo', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nella rimozione');
      }

      setProfile(prev => prev ? { ...prev, profile_image_url: null } : prev);
      setSuccess('Foto profilo rimossa');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-gray-600">Caricamento profilo...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-display font-bold text-agesci-blue">
            Il Tuo Profilo
          </h1>
          <p className="text-gray-600 mt-2">
            Gestisci le tue informazioni, preferenze e avatar
          </p>
        </header>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Profile Header */}
          <div className="p-6 border-b border-gray-100 flex items-center gap-4">
            {profile?.profile_image_url ? (
              <div className="w-24 h-24 rounded-full overflow-hidden border-3 border-green-500 shadow-md flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.profile_image_url}
                  alt="Foto profilo"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <AvatarPreview config={formData.avatar_config} size="md" />
            )}

            <div>
              <h2 className="text-xl font-semibold text-agesci-blue">
                {formData.name || user?.firstName} {formData.surname || user?.lastName}
              </h2>
              <p className="text-gray-500">{user?.primaryEmailAddress?.emailAddress}</p>
              {formData.service_role && (
                <p className="text-sm font-medium text-agesci-blue mt-1 border border-agesci-blue/20 bg-agesci-blue/5 inline-block px-2 py-0.5 rounded-md">
                  {SERVICE_ROLE_LABELS[formData.service_role as ServiceRole] || formData.service_role}
                </p>
              )}
              {formData.scout_group && (
                <p className="text-sm text-gray-400 mt-0.5">Gruppo: {formData.scout_group}</p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {[
              { id: 'info' as const, label: 'Informazioni' },
              { id: 'preferences' as const, label: 'Preferenze' },
              { id: 'avatar' as const, label: 'Avatar' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id
                  ? 'border-agesci-blue text-agesci-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Info Tab */}
            {activeTab === 'info' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="input w-full"
                      placeholder="Il tuo nome"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cognome
                    </label>
                    <input
                      type="text"
                      value={formData.surname}
                      onChange={(e) => setFormData(prev => ({ ...prev, surname: e.target.value }))}
                      className="input w-full"
                      placeholder="Il tuo cognome"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ruolo di Servizio
                    </label>
                    <select
                      value={formData.service_role}
                      onChange={(e) => setFormData(prev => ({ ...prev, service_role: e.target.value as ServiceRole | '' }))}
                      className="input w-full"
                    >
                      <option value="">Nessun ruolo specificato</option>
                      {Object.entries(SERVICE_ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Codice Socio *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      value={formData.codice_socio}
                      onChange={(e) => setFormData(prev => ({ ...prev, codice_socio: e.target.value.replace(/[^0-9]/g, '') }))}
                      className="input w-full"
                      placeholder="Da 6 a 8 cifre"
                      required
                    />
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gruppo Scout
                    </label>
                    <Autocomplete
                      value={formData.scout_group}
                      onChange={(val) => setFormData(prev => ({ ...prev, scout_group: val }))}
                      options={scoutGroups}
                      placeholder="Es. Roma 123 o lascia vuoto"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Email</h3>
                  <p className="text-gray-600">{user?.primaryEmailAddress?.emailAddress}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    L&apos;email e gestita da Clerk e non puo essere modificata qui
                  </p>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div>
                <div className="mb-8 p-6 border border-gray-200 rounded-lg bg-gray-50/50">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-agesci-blue flex items-center gap-2">
                        {isSubscribed ? <Bell className="w-5 h-5 text-green-600" /> : <BellOff className="w-5 h-5 text-gray-500" />}
                        Notifiche Push
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Ricevi aggiornamenti in tempo reale su attività ed eventi su questo dispositivo.
                      </p>
                    </div>
                    <button
                      onClick={handlePushToggle}
                      disabled={isPushLoading}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-agesci-blue focus:ring-offset-2 disabled:opacity-50 ${isSubscribed ? 'bg-green-500' : 'bg-gray-300'}`}
                      role="switch"
                      aria-checked={isSubscribed}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isSubscribed ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <p className="text-gray-600 mb-4">
                  Seleziona i temi che ti interessano. Useremo queste preferenze per consigliarti gli eventi piu adatti a te.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PREFERENCE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => togglePreference(tag)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${formData.preferences.includes(tag)
                        ? 'border-agesci-blue bg-agesci-blue/10 text-agesci-blue'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </button>
                  ))}
                </div>

                {formData.preferences.length > 0 && (
                  <p className="mt-4 text-sm text-gray-500">
                    Selezionati: {formData.preferences.length} interessi
                  </p>
                )}
              </div>
            )}

            {/* Avatar Tab */}
            {activeTab === 'avatar' && (
              <div>
                <p className="text-gray-600 mb-6">
                  Carica una foto o personalizza il tuo avatar.
                </p>

                {/* Photo Upload Section */}
                <div className="mb-8 p-6 border-2 border-dashed border-gray-200 rounded-lg">
                  <h3 className="text-lg font-semibold text-agesci-blue mb-4">Foto Profilo</h3>

                  {photoError && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                      {photoError}
                    </div>
                  )}

                  {profile?.profile_image_url ? (
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={profile.profile_image_url}
                          alt="Foto profilo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 mb-2">Hai caricato una foto profilo</p>
                        <button
                          onClick={handlePhotoRemove}
                          disabled={isUploadingPhoto}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50 text-sm font-medium"
                        >
                          {isUploadingPhoto ? 'Rimozione...' : 'Rimuovi foto'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-4">
                        Carica una tua foto (max 5MB, JPG/PNG/WEBP/GIF)
                      </p>
                      <label className="inline-block cursor-pointer">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handlePhotoUpload}
                          disabled={isUploadingPhoto}
                          className="hidden"
                          aria-label="Carica foto profilo"
                        />
                        <span className="inline-flex items-center gap-2 px-4 py-2 btn-accent rounded-md">
                          {isUploadingPhoto ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Caricamento...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Scegli foto
                            </>
                          )}
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="relative border-t border-gray-200 my-8">
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 bg-white text-sm text-gray-500">
                    oppure personalizza l&apos;avatar
                  </span>
                </div>

                {/* Avatar Customizer */}
                <AvatarCustomizer
                  config={formData.avatar_config}
                  onChange={updateAvatarConfig}
                />
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full md:w-auto btn-primary px-6"
            >
              {isSaving ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
