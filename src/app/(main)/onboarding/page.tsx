'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { PREFERENCE_TAGS, type PreferenceTag, type AvatarConfig } from '@/types/database';

type OnboardingStep = 'info' | 'preferences' | 'avatar' | 'complete';

interface FormData {
  name: string;
  surname: string;
  scout_group: string;
  preferences: PreferenceTag[];
  avatar_config: AvatarConfig;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('info');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    surname: '',
    scout_group: '',
    preferences: [],
    avatar_config: {
      skinTone: '#f5d0c5',
      hairStyle: 'short',
      hairColor: '#3d2314',
      background: '#e8f5e9',
    },
  });

  // Pre-popola con dati Clerk
  useEffect(() => {
    if (isLoaded && user) {
      setFormData(prev => ({
        ...prev,
        name: user.firstName || '',
        surname: user.lastName || '',
      }));
    }
  }, [isLoaded, user]);

  const steps: { id: OnboardingStep; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'preferences', label: 'Preferenze' },
    { id: 'avatar', label: 'Avatar' },
    { id: 'complete', label: 'Fine' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
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

  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          onboarding_completed: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Errore durante il salvataggio');
      }

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--scout-green)' }}>
            Completa il tuo profilo
          </h1>
          <p className="text-gray-600 mt-2">
            Aiutaci a personalizzare la tua esperienza
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex flex-col items-center flex-1"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white ${
                  index <= currentStepIndex
                    ? 'bg-green-600'
                    : 'bg-gray-300'
                }`}
              >
                {index + 1}
              </div>
              <span className="text-sm mt-2 text-gray-600">{step.label}</span>
              {index < steps.length - 1 && (
                <div
                  className={`hidden md:block absolute h-1 w-full top-5 left-1/2 ${
                    index < currentStepIndex ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                  style={{ zIndex: -1 }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {/* Step 1: Personal Info */}
          {currentStep === 'info' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Informazioni personali</h2>

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
            </div>
          )}

          {/* Step 2: Preferences */}
          {currentStep === 'preferences' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Le tue preferenze</h2>
              <p className="text-gray-600 mb-4">
                Seleziona i temi che ti interessano di piu. Ti consiglieremo eventi in base alle tue scelte.
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
                  Selezionati: {formData.preferences.length}
                </p>
              )}
            </div>
          )}

          {/* Step 3: Avatar */}
          {currentStep === 'avatar' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Crea il tuo avatar</h2>
              <p className="text-gray-600 mb-6">
                Personalizza il tuo avatar scout. Potrai modificarlo in seguito dal profilo.
              </p>

              {/* Avatar Preview Placeholder */}
              <div className="flex justify-center mb-6">
                <div
                  className="w-40 h-40 rounded-full flex items-center justify-center text-6xl"
                  style={{ backgroundColor: formData.avatar_config.background }}
                >
                  <svg
                    viewBox="0 0 100 100"
                    className="w-32 h-32"
                  >
                    {/* Simple avatar placeholder */}
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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Colore pelle
                  </label>
                  <div className="flex gap-2">
                    {['#f5d0c5', '#e8beac', '#d4a574', '#a67c52', '#6b4423'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          avatar_config: { ...prev.avatar_config, skinTone: color },
                        }))}
                        className={`w-10 h-10 rounded-full border-2 ${
                          formData.avatar_config.skinTone === color
                            ? 'border-green-500'
                            : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Colore capelli
                  </label>
                  <div className="flex gap-2">
                    {['#3d2314', '#1a1a1a', '#8b4513', '#daa520', '#a52a2a'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          avatar_config: { ...prev.avatar_config, hairColor: color },
                        }))}
                        className={`w-10 h-10 rounded-full border-2 ${
                          formData.avatar_config.hairColor === color
                            ? 'border-green-500'
                            : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sfondo
                  </label>
                  <div className="flex gap-2">
                    {['#e8f5e9', '#e3f2fd', '#fff3e0', '#fce4ec', '#f3e5f5'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          avatar_config: { ...prev.avatar_config, background: color },
                        }))}
                        className={`w-10 h-10 rounded-full border-2 ${
                          formData.avatar_config.background === color
                            ? 'border-green-500'
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

          {/* Step 4: Complete */}
          {currentStep === 'complete' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">
                <svg className="w-20 h-20 mx-auto text-green-500\" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--scout-green)' }}>
                Tutto pronto!
              </h2>
              <p className="text-gray-600 mb-6">
                Il tuo profilo e stato configurato. Sei pronto per esplorare gli eventi e iniziare la tua avventura!
              </p>

              <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
                <h3 className="font-medium mb-2">Riepilogo:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li><strong>Nome:</strong> {formData.name} {formData.surname}</li>
                  <li><strong>Gruppo:</strong> {formData.scout_group || 'Non specificato'}</li>
                  <li><strong>Interessi:</strong> {formData.preferences.length > 0 ? formData.preferences.join(', ') : 'Nessuno selezionato'}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              onClick={handleBack}
              disabled={currentStep === 'info'}
              className={`px-6 py-2 rounded-md ${
                currentStep === 'info'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Indietro
            </button>

            {currentStep === 'complete' ? (
              <button
                onClick={handleComplete}
                disabled={isLoading}
                className="px-6 py-2 rounded-md text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--scout-green)' }}
              >
                {isLoading ? 'Salvataggio...' : 'Inizia!'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2 rounded-md text-white"
                style={{ backgroundColor: 'var(--scout-green)' }}
              >
                Avanti
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
