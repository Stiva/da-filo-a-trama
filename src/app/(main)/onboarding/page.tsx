'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  PREFERENCE_TAGS,
  type PreferenceTag,
  type AvatarConfig,
  DEFAULT_AVATAR_CONFIG,
  type ServiceRoleRecord,
} from '@/types/database';
import AvatarPreview from '@/components/AvatarPreview';
import AvatarCustomizer from '@/components/AvatarCustomizer';
import Autocomplete from '@/components/Autocomplete';

type OnboardingStep = 'info' | 'safety' | 'preferences' | 'avatar' | 'complete';

interface FormData {
  name: string;
  surname: string;
  codice_socio: string;
  scout_group: string;
  service_role: string;
  preferences: PreferenceTag[];
  avatar_config: AvatarConfig;
  is_staff: boolean;
  is_nazionale: boolean;
  staff_secret: string;
  is_medical_staff: boolean;
  fire_warden_level: string;
}

const generateRandomSeed = () => crypto.randomUUID().split('-')[0];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('info');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceRoles, setServiceRoles] = useState<ServiceRoleRecord[]>([]);
  const [scoutGroups, setScoutGroups] = useState<{ id: string, name: string }[]>([]);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    surname: '',
    codice_socio: '',
    scout_group: '',
    service_role: '',
    preferences: [],
    avatar_config: { ...DEFAULT_AVATAR_CONFIG, seed: generateRandomSeed() },
    is_staff: false,
    is_nazionale: false,
    staff_secret: '',
    is_medical_staff: false,
    fire_warden_level: '',
  });

  // Pre-popola con dati Clerk
  useEffect(() => {
    if (isLoaded && user) {
      setFormData((prev) => ({
        ...prev,
        name: user.firstName || '',
        surname: user.lastName || '',
      }));
    }
  }, [isLoaded, user]);

  // Carica ruoli di servizio e gruppi dinamicamente
  useEffect(() => {
    fetch('/api/service-roles')
      .then(res => res.json())
      .then(result => { if (result.data) setServiceRoles(result.data); })
      .catch(console.error);

    fetch('/api/scout-groups')
      .then(res => res.json())
      .then(result => { if (result.data) setScoutGroups(result.data); })
      .catch(console.error);
  }, []);

  const steps: { id: OnboardingStep; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'safety', label: 'Sicurezza' },
    { id: 'preferences', label: 'Preferenze' },
    { id: 'avatar', label: 'Avatar' },
    { id: 'complete', label: 'Fine' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    if (currentStep === 'info') {
      if (!formData.name || !formData.surname || (!formData.is_staff && !formData.is_nazionale && !formData.codice_socio)) {
        setError('Compila tutti i campi obbligatori.');
        return;
      }
      if ((formData.is_staff || formData.is_nazionale) && formData.staff_secret !== 'grumbiotto') {
        setError('La parola chiave Segreta non è valida.');
        return;
      }
      if (!formData.is_staff && !formData.is_nazionale && !/^[0-9]{4,8}$/.test(formData.codice_socio)) {
        setError('Il Codice Socio deve essere un numero composto da 4 a 8 cifre.');
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

  const togglePreference = (tag: PreferenceTag) => {
    setFormData((prev) => ({
      ...prev,
      preferences: prev.preferences.includes(tag)
        ? prev.preferences.filter((t) => t !== tag)
        : [...prev.preferences, tag],
    }));
  };

  const updateAvatarConfig = (updates: Partial<AvatarConfig>) => {
    setFormData((prev) => ({
      ...prev,
      avatar_config: { ...prev.avatar_config, ...updates },
    }));
  };

  // Funzione per salvare con retry (gestisce race condition con webhook)
  const saveProfileWithRetry = async (maxRetries = 3): Promise<boolean> => {
    const body = JSON.stringify({
      ...formData,
      service_role: formData.service_role || null, // Converti in null se vuoto
      onboarding_completed: true,
      avatar_completed: true,
      preferences_set: formData.preferences.length > 0,
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('/api/profiles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
        });

        if (response.ok) {
          return true;
        }

        const data = await response.json();

        // Se 404, il profilo non esiste ancora - attendi e riprova
        if (response.status === 404 && attempt < maxRetries) {
          console.log(`Profilo non trovato, tentativo ${attempt}/${maxRetries}. Riprovo...`);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }

        throw new Error(data.error || 'Errore durante il salvataggio');
      } catch (err) {
        if (attempt === maxRetries) {
          throw err;
        }
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
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold text-agesci-blue">
            Completa il tuo profilo
          </h1>
          <p className="text-agesci-blue/60 mt-2">
            Aiutaci a personalizzare la tua esperienza
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8 overflow-x-auto pb-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center flex-1 min-w-[60px]">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${index <= currentStepIndex
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

        {/* Step Content */}
        <div className="card">
          <div className="card-body">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl">
                {error}
              </div>
            )}

            {/* Step 1: Personal Info */}
            {currentStep === 'info' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-display font-semibold text-agesci-blue mb-4">
                  Informazioni personali
                </h2>

                <div>
                  <label className="block text-sm font-medium text-agesci-blue mb-1">Nome</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="input w-full"
                    placeholder="Il tuo nome"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-agesci-blue mb-1">Cognome</label>
                  <input
                    type="text"
                    value={formData.surname}
                    onChange={(e) => setFormData((prev) => ({ ...prev, surname: e.target.value }))}
                    className="input w-full"
                    placeholder="Il tuo cognome"
                  />
                </div>

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                  <div className="pt-0.5">
                    <input 
                      type="checkbox" 
                      id="is_staff"
                      checked={formData.is_staff}
                      onChange={(e) => setFormData(prev => ({...prev, is_staff: e.target.checked, is_nazionale: false}))}
                      className="w-5 h-5 text-agesci-blue rounded border-gray-300 focus:ring-agesci-blue"
                    />
                  </div>
                  <div>
                    <label htmlFor="is_staff" className="font-semibold text-agesci-blue cursor-pointer select-none text-base">
                      🙋‍♂️ Sono un membro dello Staff dell'Evento
                    </label>
                    <p className="text-xs text-agesci-blue/70 mt-1">
                      Seleziona questa opzione se fai parte dell'organizzazione centrale dell'evento Nazionale.
                    </p>
                  </div>
                </div>

                <div className="bg-yellow-50/50 p-4 rounded-xl border border-yellow-100 flex items-start gap-3">
                  <div className="pt-0.5">
                    <input 
                      type="checkbox" 
                      id="is_nazionale"
                      checked={formData.is_nazionale}
                      onChange={(e) => setFormData(prev => ({...prev, is_nazionale: e.target.checked, is_staff: false}))}
                      className="w-5 h-5 text-agesci-blue rounded border-gray-300 focus:ring-agesci-blue"
                    />
                  </div>
                  <div>
                    <label htmlFor="is_nazionale" className="font-semibold text-agesci-blue cursor-pointer select-none text-base">
                      🎪 Gomitolo Team
                    </label>
                    <p className="text-xs text-agesci-blue/70 mt-1">
                      Seleziona se fai parte del Gomitolo Team e sei stato invitato come ospite o referente (non in elenco BC).
                    </p>
                  </div>
                </div>

                {(formData.is_staff || formData.is_nazionale) && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-agesci-blue mb-1">
                      Parola Segreta Organizzazione *
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={formData.staff_secret}
                      onChange={(e) => setFormData((prev) => ({ ...prev, staff_secret: e.target.value.toLowerCase() }))}
                      className="input w-full border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Inserisci il codice segreto"
                      required={formData.is_staff || formData.is_nazionale}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-agesci-blue mb-1">
                    Codice Socio {!(formData.is_staff || formData.is_nazionale) && '*'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={formData.codice_socio}
                    onChange={(e) => setFormData((prev) => ({ ...prev, codice_socio: e.target.value.replace(/[^0-9]/g, '') }))}
                    className="input w-full"
                    placeholder="Da 6 a 8 cifre"
                    required={!(formData.is_staff || formData.is_nazionale)}
                  />
                  <p className="text-xs text-agesci-blue/60 mt-1">
                    {(formData.is_staff || formData.is_nazionale) 
                      ? "Facoltativo per staff/esterni."
                      : "Il tuo identificativo numerico AGESCI univoco."
                    }
                  </p>
                </div>



              </div>
            )}

            {/* Step: Safety */}
            {currentStep === 'safety' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-display font-semibold text-agesci-blue mb-4">
                  Informazioni di Sicurezza
                </h2>
                <p className="text-agesci-blue/60 mb-6 text-sm">
                  Queste informazioni sono necessarie per garantire la massima sicurezza durante l'evento.
                </p>

                <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 flex items-start gap-3">
                  <div className="pt-0.5">
                    <input 
                      type="checkbox" 
                      id="is_medical_staff"
                      checked={formData.is_medical_staff}
                      onChange={(e) => setFormData(prev => ({...prev, is_medical_staff: e.target.checked}))}
                      className="w-5 h-5 text-agesci-blue rounded border-gray-300 focus:ring-agesci-blue"
                    />
                  </div>
                  <div>
                    <label htmlFor="is_medical_staff" className="font-semibold text-agesci-blue cursor-pointer select-none text-base">
                      🩺 Sono Medico o Infermiere
                    </label>
                    <p className="text-xs text-agesci-blue/70 mt-1">
                      Seleziona se hai una qualifica professionale in ambito sanitario.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-agesci-blue mb-1">
                    🔥 Addetto Antincendio
                  </label>
                  <select
                    value={formData.fire_warden_level}
                    onChange={(e) => setFormData(prev => ({...prev, fire_warden_level: e.target.value}))}
                    className="input w-full"
                  >
                    <option value="">Nessuno / Non addetto</option>
                    <option value="basso">Rischio Basso (Livello 1)</option>
                    <option value="medio">Rischio Medio (Livello 2)</option>
                    <option value="alto">Rischio Alto (Livello 3)</option>
                  </select>
                  <p className="text-xs text-agesci-blue/60 mt-1">
                    Indica il livello di formazione antincendio in tuo possesso, se applicabile.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Preferences */}
            {currentStep === 'preferences' && (
              <div>
                <h2 className="text-2xl font-display font-semibold text-agesci-blue mb-4">
                  Le tue preferenze
                </h2>
                <p className="text-agesci-blue/60 mb-4">
                  Seleziona i temi che ti interessano di piu. Ti consiglieremo eventi in base alle tue scelte.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PREFERENCE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => togglePreference(tag)}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${formData.preferences.includes(tag)
                        ? 'border-agesci-blue bg-agesci-blue/10 text-agesci-blue'
                        : 'border-gray-200 hover:border-agesci-blue/30 text-gray-600'
                        }`}
                    >
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </button>
                  ))}
                </div>

                {formData.preferences.length > 0 && (
                  <p className="mt-4 text-sm text-agesci-blue/70">
                    Selezionati: {formData.preferences.length}
                  </p>
                )}
              </div>
            )}

            {/* Step 3: Avatar */}
            {currentStep === 'avatar' && (
              <div>
                <h2 className="text-2xl font-display font-semibold text-agesci-blue mb-4">
                  Crea il tuo avatar
                </h2>
                <AvatarCustomizer
                  config={formData.avatar_config}
                  onChange={updateAvatarConfig}
                />
              </div>
            )}

            {/* Step 4: Complete */}
            {currentStep === 'complete' && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-6">
                  <AvatarPreview config={formData.avatar_config} size="xl" />
                </div>

                <h2 className="text-3xl font-display font-semibold text-agesci-blue mb-2">
                  Tutto pronto!
                </h2>
                <p className="text-agesci-blue/60 mb-6">
                  Il tuo profilo e stato configurato. Sei pronto per esplorare gli eventi e iniziare la
                  tua avventura!
                </p>

                <div className="bg-agesci-blue/5 rounded-xl p-4 text-left mb-6">
                  <h3 className="font-medium text-agesci-blue mb-2">Riepilogo:</h3>
                  <ul className="text-sm text-agesci-blue/80 space-y-1">
                    <li>
                      <strong>Nome:</strong> {formData.name} {formData.surname}
                    </li>

                    <li>
                      <strong>Interessi:</strong>{' '}
                      {formData.preferences.length > 0
                        ? formData.preferences.join(', ')
                        : 'Nessuno selezionato'}
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-agesci-blue/10">
              <button
                onClick={handleBack}
                disabled={currentStep === 'info'}
                className={`px-6 py-2 rounded-xl font-medium ${currentStep === 'info'
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
