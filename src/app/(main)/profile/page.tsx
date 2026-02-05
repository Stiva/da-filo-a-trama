'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { PREFERENCE_TAGS, type PreferenceTag, type AvatarConfig, type Profile } from '@/types/database';

export default function ProfilePage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'preferences' | 'avatar'>('info');

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
            {/* Avatar Preview */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: formData.avatar_config.background }}
            >
              <svg viewBox="0 0 100 100" className="w-16 h-16">
                <circle cx="50" cy="35" r="25" fill={formData.avatar_config.skinTone} />
                <ellipse cx="50" cy="85" rx="35" ry="25" fill="#2e7d32" />
                <circle cx="42" cy="32" r="3" fill="#333" />
                <circle cx="58" cy="32" r="3" fill="#333" />
                <path d="M 45 42 Q 50 47 55 42" stroke="#333" strokeWidth="2" fill="none" />
                <ellipse cx="50" cy="15" rx="20" ry="12" fill={formData.avatar_config.hairColor} />
              </svg>
            </div>

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
                  Personalizza il tuo avatar scout.
                </p>

                {/* Avatar Preview */}
                <div className="flex justify-center mb-8">
                  <div
                    className="w-40 h-40 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: formData.avatar_config.background }}
                  >
                    <svg viewBox="0 0 100 100" className="w-32 h-32">
                      <circle cx="50" cy="35" r="25" fill={formData.avatar_config.skinTone} />
                      <ellipse cx="50" cy="85" rx="35" ry="25" fill="#2e7d32" />
                      <circle cx="42" cy="32" r="3" fill="#333" />
                      <circle cx="58" cy="32" r="3" fill="#333" />
                      <path d="M 45 42 Q 50 47 55 42" stroke="#333" strokeWidth="2" fill="none" />
                      <ellipse cx="50" cy="15" rx="20" ry="12" fill={formData.avatar_config.hairColor} />
                    </svg>
                  </div>
                </div>

                {/* Avatar Options */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Colore pelle
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['#f5d0c5', '#e8beac', '#d4a574', '#a67c52', '#6b4423'].map((color) => (
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
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Colore capelli
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['#3d2314', '#1a1a1a', '#8b4513', '#daa520', '#a52a2a', '#d4d4d4'].map((color) => (
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
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Sfondo
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['#e8f5e9', '#e3f2fd', '#fff3e0', '#fce4ec', '#f3e5f5', '#e0f7fa'].map((color) => (
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
