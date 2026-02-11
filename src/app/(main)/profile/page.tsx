'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { PREFERENCE_TAGS, DEFAULT_AVATAR_CONFIG, type PreferenceTag, type AvatarConfig, type Profile } from '@/types/database';
import AvatarPreview from '@/components/AvatarPreview';

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
    avatar_config: {
      skinTone: '#f5d0c5',
      hairStyle: 'short',
      hairColor: '#3d2314',
      background: '#e8f5e9',
    } as AvatarConfig,
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
        avatar_config: result.data.avatar_config || formData.avatar_config,
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
      const formData = new FormData();
      formData.append('photo', file);

      const response = await fetch('/api/profiles/photo', {
        method: 'POST',
        body: formData,
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
          <h1 className="text-3xl font-bold" style={{ color: 'var(--scout-green)' }}>
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
              <h2 className="text-xl font-semibold">
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
                    ? 'border-green-500 text-green-600'
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
                          ? 'border-green-500 bg-green-50 text-green-700'
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
                  Carica una foto o personalizza il tuo avatar scout.
                </p>

                {/* Photo Upload Section */}
                <div className="mb-8 p-6 border-2 border-dashed border-gray-200 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Foto Profilo</h3>

                  {photoError && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                      {photoError}
                    </div>
                  )}

                  {profile?.profile_image_url ? (
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
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
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
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

                {/* Avatar Preview */}
                <div className="flex justify-center mb-8">
                  <AvatarPreview config={formData.avatar_config} size="xl" />
                </div>

                {/* Avatar Options */}
                <div className="space-y-6">
                  {/* Genere */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Genere
                    </label>
                    <div className="flex gap-3">
                      {[
                        { value: 'male' as const, label: 'Maschile' },
                        { value: 'female' as const, label: 'Femminile' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            avatar_config: {
                              ...prev.avatar_config,
                              gender: option.value,
                              hairStyle: option.value === 'female' ? 'long' : 'short',
                            },
                          }))}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                            formData.avatar_config.gender === option.value
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stile capelli */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Stile capelli
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(formData.avatar_config.gender === 'female'
                        ? [
                            { value: 'long', label: 'Lunghi' },
                            { value: 'short', label: 'Corti' },
                            { value: 'ponytail', label: 'Coda' },
                            { value: 'curly', label: 'Ricci' },
                          ]
                        : [
                            { value: 'short', label: 'Corti' },
                            { value: 'buzz', label: 'Rasati' },
                            { value: 'spiky', label: 'Spettinati' },
                            { value: 'wavy', label: 'Ondulati' },
                          ]
                      ).map((style) => (
                        <button
                          key={style.value}
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            avatar_config: { ...prev.avatar_config, hairStyle: style.value },
                          }))}
                          className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                            formData.avatar_config.hairStyle === style.value
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Colore pelle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Colore pelle
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['#f5d0c5', '#e8beac', '#DEB887', '#d4a574', '#a67c52', '#6b4423'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            avatar_config: { ...prev.avatar_config, skinTone: color },
                          }))}
                          className={`w-12 h-12 rounded-full border-3 transition-transform hover:scale-110 ${
                            formData.avatar_config.skinTone === color
                              ? 'border-green-500 ring-2 ring-green-200'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Colore pelle ${color}`}
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
                      {['#3d2314', '#1a1a1a', '#4A3728', '#8b4513', '#daa520', '#a52a2a', '#d4d4d4'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            avatar_config: { ...prev.avatar_config, hairColor: color },
                          }))}
                          className={`w-12 h-12 rounded-full border-3 transition-transform hover:scale-110 ${
                            formData.avatar_config.hairColor === color
                              ? 'border-green-500 ring-2 ring-green-200'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Colore capelli ${color}`}
                          tabIndex={0}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Colore occhi */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Colore occhi
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['#5D4E37', '#2E4057', '#8B7355', '#4A7C59', '#6B8E23'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            avatar_config: { ...prev.avatar_config, eyeColor: color },
                          }))}
                          className={`w-12 h-12 rounded-full border-3 transition-transform hover:scale-110 ${
                            formData.avatar_config.eyeColor === color
                              ? 'border-green-500 ring-2 ring-green-200'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Colore occhi ${color}`}
                          tabIndex={0}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Fazzolettone Scout */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Fazzolettone Scout
                    </label>
                    <div className="space-y-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.avatar_config.neckerchief?.enabled ?? true}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            avatar_config: {
                              ...prev.avatar_config,
                              neckerchief: {
                                ...(prev.avatar_config.neckerchief ?? DEFAULT_AVATAR_CONFIG.neckerchief),
                                enabled: e.target.checked,
                              },
                            },
                          }))}
                          className="w-4 h-4 text-green-600 rounded"
                        />
                        <span className="text-sm">Mostra fazzolettone</span>
                      </label>

                      {(formData.avatar_config.neckerchief?.enabled ?? true) && (
                        <>
                          <div>
                            <label className="block text-xs text-gray-500 mb-2">Colore principale</label>
                            <div className="flex flex-wrap gap-2">
                              {['#1E6091', '#8B0000', '#2E7D32', '#FFDE00', '#4B0082', '#FF6B35'].map((color) => (
                                <button
                                  key={color}
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    avatar_config: {
                                      ...prev.avatar_config,
                                      neckerchief: {
                                        ...(prev.avatar_config.neckerchief ?? DEFAULT_AVATAR_CONFIG.neckerchief),
                                        color1: color,
                                      },
                                    },
                                  }))}
                                  className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                                    formData.avatar_config.neckerchief?.color1 === color
                                      ? 'border-green-500 ring-2 ring-green-200'
                                      : 'border-gray-200'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  aria-label={`Colore fazzolettone ${color}`}
                                  tabIndex={0}
                                />
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-500 mb-2">Colore bordo</label>
                            <div className="flex flex-wrap gap-2">
                              {['#FFDE00', '#FFFFFF', '#1E6091', '#8B0000', '#2E7D32', '#4B0082'].map((color) => (
                                <button
                                  key={color}
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    avatar_config: {
                                      ...prev.avatar_config,
                                      neckerchief: {
                                        ...(prev.avatar_config.neckerchief ?? DEFAULT_AVATAR_CONFIG.neckerchief),
                                        color2: color,
                                      },
                                    },
                                  }))}
                                  className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                                    formData.avatar_config.neckerchief?.color2 === color
                                      ? 'border-green-500 ring-2 ring-green-200'
                                      : 'border-gray-200'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  aria-label={`Colore bordo fazzolettone ${color}`}
                                  tabIndex={0}
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Colore uniforme */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Colore uniforme
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['#2D5016', '#1B4332', '#2F4538', '#4A5D23'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            avatar_config: { ...prev.avatar_config, clothing: color },
                          }))}
                          className={`w-12 h-12 rounded-full border-3 transition-transform hover:scale-110 ${
                            formData.avatar_config.clothing === color
                              ? 'border-green-500 ring-2 ring-green-200'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Colore uniforme ${color}`}
                          tabIndex={0}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Sfondo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Sfondo
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['#e8f5e9', '#E8F4E8', '#e3f2fd', '#fff3e0', '#fce4ec', '#f3e5f5', '#e0f7fa'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            avatar_config: { ...prev.avatar_config, background: color },
                          }))}
                          className={`w-12 h-12 rounded-full border-3 transition-transform hover:scale-110 ${
                            formData.avatar_config.background === color
                              ? 'border-green-500 ring-2 ring-green-200'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Colore sfondo ${color}`}
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
              className="w-full md:w-auto px-6 py-2 rounded-md text-white font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--scout-green)' }}
            >
              {isSaving ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
