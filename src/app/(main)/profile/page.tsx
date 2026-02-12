'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  PREFERENCE_TAGS,
  AVATAR_STYLES,
  DEFAULT_AVATAR_CONFIG,
  type PreferenceTag,
  type AvatarConfig,
  type AvatarStyle,
  type Profile,
} from '@/types/database';
import AvatarPreview from '@/components/AvatarPreview';

// Colori sfondo per avatar
const BG_COLORS = [
  { name: 'Verde chiaro', hex: '#E8F4E8' },
  { name: 'Azzurro', hex: '#E3F2FD' },
  { name: 'Giallo', hex: '#FFF9E6' },
  { name: 'Rosa', hex: '#FCE4EC' },
  { name: 'Lavanda', hex: '#F3E5F5' },
  { name: 'Crema', hex: '#FDFAF0' },
];

// Colori pelle
const SKIN_COLORS = [
  { name: 'Chiaro', hex: '#FFDBB4' },
  { name: 'Medio chiaro', hex: '#EDB98A' },
  { name: 'Medio', hex: '#D08B5B' },
  { name: 'Olivastro', hex: '#AE8A63' },
  { name: 'Medio scuro', hex: '#8D5524' },
  { name: 'Scuro', hex: '#614335' },
];

// Colori capelli
const HAIR_COLORS = [
  { name: 'Nero', hex: '#1a1a1a' },
  { name: 'Castano scuro', hex: '#3d2314' },
  { name: 'Castano', hex: '#6B4423' },
  { name: 'Biondo scuro', hex: '#8B7355' },
  { name: 'Biondo', hex: '#D4A76A' },
  { name: 'Rosso', hex: '#8B2500' },
  { name: 'Grigio', hex: '#808080' },
];

const generateRandomSeed = () => Math.random().toString(36).substring(2, 10);

/** Converte un vecchio avatar_config (legacy) nel nuovo formato DiceBear */
const migrateAvatarConfig = (config: Record<string, unknown>): AvatarConfig => {
  // Se ha gia' il nuovo formato, restituiscilo
  if (config && 'style' in config && 'seed' in config) {
    return config as unknown as AvatarConfig;
  }
  // Config legacy → usa default DiceBear con seed casuale
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

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    scout_group: '',
    preferences: [] as PreferenceTag[],
    avatar_config: { ...DEFAULT_AVATAR_CONFIG, seed: generateRandomSeed() } as AvatarConfig,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

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
        scout_group: result.data.scout_group || '',
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
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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

  const updateAvatarConfig = (updates: Partial<AvatarConfig>) => {
    setFormData(prev => ({
      ...prev,
      avatar_config: { ...prev.avatar_config, ...updates },
    }));
  };

  const handleRandomize = () => {
    updateAvatarConfig({ seed: generateRandomSeed() });
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
          <h1 className="text-3xl font-bold text-agesci-blue">
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
              {formData.scout_group && (
                <p className="text-sm text-gray-400">Gruppo: {formData.scout_group}</p>
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
                className={`flex-1 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gruppo Scout
                  </label>
                  <input
                    type="text"
                    value={formData.scout_group}
                    onChange={(e) => setFormData(prev => ({ ...prev, scout_group: e.target.value }))}
                    className="input w-full"
                    placeholder="es. Roma 123"
                  />
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
                <p className="text-gray-600 mb-4">
                  Seleziona i temi che ti interessano. Useremo queste preferenze per consigliarti gli eventi piu adatti a te.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PREFERENCE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => togglePreference(tag)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                        formData.preferences.includes(tag)
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

                {/* Avatar Preview + Randomize */}
                <div className="flex flex-col items-center mb-8">
                  <AvatarPreview config={formData.avatar_config} size="xl" />
                  <button
                    onClick={handleRandomize}
                    className="mt-4 btn-outline px-6 py-2 text-sm"
                    type="button"
                    aria-label="Genera avatar casuale"
                  >
                    <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Randomizza
                  </button>
                </div>

                {/* Avatar Options */}
                <div className="space-y-6">
                  {/* Stile avatar */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Stile
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {AVATAR_STYLES.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => updateAvatarConfig({ style: s.value as AvatarStyle })}
                          className={`p-3 rounded-xl border-2 transition-all text-center ${
                            formData.avatar_config.style === s.value
                              ? 'border-agesci-blue bg-agesci-blue/5 shadow-playful-sm'
                              : 'border-gray-200 hover:border-agesci-blue/30'
                          }`}
                        >
                          <div className="flex justify-center mb-2">
                            <AvatarPreview
                              config={{ ...formData.avatar_config, style: s.value as AvatarStyle }}
                              size="sm"
                            />
                          </div>
                          <span className="text-xs font-medium text-agesci-blue">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Colore sfondo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Sfondo
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {BG_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          onClick={() => updateAvatarConfig({ backgroundColor: color.hex })}
                          className={`w-12 h-12 rounded-full border-3 transition-transform hover:scale-110 ${
                            formData.avatar_config.backgroundColor === color.hex
                              ? 'border-agesci-blue ring-2 ring-agesci-yellow'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                          aria-label={`Sfondo ${color.name}`}
                          tabIndex={0}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Colore pelle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Colore pelle
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {SKIN_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          onClick={() => updateAvatarConfig({ skinColor: color.hex })}
                          className={`w-12 h-12 rounded-full border-3 transition-transform hover:scale-110 ${
                            formData.avatar_config.skinColor === color.hex
                              ? 'border-agesci-blue ring-2 ring-agesci-yellow'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                          aria-label={`Pelle ${color.name}`}
                          tabIndex={0}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Colore capelli */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Colore capelli
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {HAIR_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          onClick={() => updateAvatarConfig({ hairColor: color.hex })}
                          className={`w-12 h-12 rounded-full border-3 transition-transform hover:scale-110 ${
                            formData.avatar_config.hairColor === color.hex
                              ? 'border-agesci-blue ring-2 ring-agesci-yellow'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                          aria-label={`Capelli ${color.name}`}
                          tabIndex={0}
                        />
                      ))}
                    </div>
                  </div>
                </div>
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
