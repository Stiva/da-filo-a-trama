'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { type AvatarConfig, DEFAULT_AVATAR_CONFIG } from '@/types/database';

type GuestStep = 'info' | 'complete';

interface GuestFormData {
  name: string;
  surname: string;
  avatar_config: AvatarConfig;
}

const generateRandomSeed = () => crypto.randomUUID().split('-')[0];

function GuestOnboardingInner() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [currentStep, setCurrentStep] = useState<GuestStep>('info');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<GuestFormData>({
    name: '',
    surname: '',
    avatar_config: { ...DEFAULT_AVATAR_CONFIG, seed: generateRandomSeed() },
  });

  useEffect(() => {
    if (isLoaded && user) {
      setFormData((prev) => ({
        ...prev,
        name: user.firstName || '',
        surname: user.lastName || '',
      }));
    }
  }, [isLoaded, user]);

  const steps: { id: GuestStep; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'complete', label: 'Fine' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    if (currentStep === 'info') {
      if (!formData.name || !formData.surname) {
        setError('Compila tutti i campi obbligatori.');
        return;
      }
    }
    setError(null);
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

  const saveProfileWithRetry = async (maxRetries = 3): Promise<boolean> => {
    const body = JSON.stringify({
      ...formData,
      is_guest: true,
      is_staff: false,
      is_nazionale: false,
      codice_socio: null,
      service_role: null,
      preferences: [],
      onboarding_completed: true,
      avatar_completed: false,
      preferences_set: false,
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('/api/profiles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
        });

        if (response.ok) return true;

        const data = await response.json();

        if (response.status === 404 && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }

        throw new Error(data.error || 'Errore durante il salvataggio');
      } catch (err) {
        if (attempt === maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    return false;
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await saveProfileWithRetry(3);
      if (success) {
        router.push('/dashboard');
      } else {
        throw new Error('Impossibile salvare il profilo. Riprova.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-scout-cream">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold text-agesci-blue">
            Benvenuto ospite!
          </h1>
          <p className="text-agesci-blue/60 mt-2">
            Registrazione rapida per gli ospiti dell'evento
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8 overflow-x-auto pb-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center flex-1 min-w-[60px]">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                  index <= currentStepIndex
                    ? 'bg-agesci-blue text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index < currentStepIndex ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span className="text-xs mt-2 text-agesci-blue/70 hidden sm:block">{step.label}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-body">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl">
                {error}
              </div>
            )}

            {currentStep === 'info' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-display font-semibold text-agesci-blue mb-4">
                  Informazioni personali
                </h2>

                <div>
                  <label className="block text-sm font-medium text-agesci-blue mb-1">Nome *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="input w-full"
                    placeholder="Il tuo nome"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-agesci-blue mb-1">Cognome *</label>
                  <input
                    type="text"
                    value={formData.surname}
                    onChange={(e) => setFormData((prev) => ({ ...prev, surname: e.target.value }))}
                    className="input w-full"
                    placeholder="Il tuo cognome"
                  />
                </div>

                <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                  <p className="text-sm text-agesci-blue/80">
                    🎟️ Stai completando la registrazione come <strong>ospite dell'evento</strong>.
                  </p>
                </div>
              </div>
            )}

            {currentStep === 'complete' && (
              <div className="text-center py-8">
                <div className="text-6xl mb-6">🎟️</div>

                <h2 className="text-3xl font-display font-semibold text-agesci-blue mb-2">
                  Tutto pronto!
                </h2>
                <p className="text-agesci-blue/60 mb-6">
                  Il tuo profilo ospite è stato configurato. Sei pronto per esplorare l'evento!
                </p>

                <div className="bg-agesci-blue/5 rounded-xl p-4 text-left mb-6">
                  <h3 className="font-medium text-agesci-blue mb-2">Riepilogo:</h3>
                  <ul className="text-sm text-agesci-blue/80 space-y-1">
                    <li>
                      <strong>Nome:</strong> {formData.name} {formData.surname}
                    </li>
                    <li>
                      <strong>Ruolo:</strong> Ospite dell'evento
                    </li>
                  </ul>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t border-agesci-blue/10">
              <button
                onClick={handleBack}
                disabled={currentStep === 'info'}
                className={`px-6 py-2 rounded-xl font-medium ${
                  currentStep === 'info'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'btn-outline'
                }`}
              >
                Indietro
              </button>

              {currentStep === 'complete' ? (
                <button onClick={handleComplete} disabled={isLoading} className="btn-primary px-8">
                  {isLoading ? 'Salvataggio...' : 'Inizia!'}
                </button>
              ) : (
                <button onClick={handleNext} className="btn-primary px-8">
                  Avanti
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function GuestOnboardingPage() {
  return (
    <Suspense>
      <GuestOnboardingInner />
    </Suspense>
  );
}
