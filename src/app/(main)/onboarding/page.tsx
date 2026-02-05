'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  PREFERENCE_TAGS,
  type PreferenceTag,
  type AvatarConfig,
  DEFAULT_AVATAR_CONFIG,
} from '@/types/database';
import AvatarPreview from '@/components/AvatarPreview';
import NeckerchiefPicker from '@/components/NeckerchiefPicker';

type OnboardingStep = 'info' | 'preferences' | 'gender' | 'avatar' | 'neckerchief' | 'complete';

interface FormData {
  name: string;
  surname: string;
  scout_group: string;
  preferences: PreferenceTag[];
  avatar_config: AvatarConfig;
}

// Skin tone options
const SKIN_TONES = [
  { name: 'Chiaro', hex: '#FFDBB4' },
  { name: 'Medio chiaro', hex: '#EDB98A' },
  { name: 'Medio', hex: '#D08B5B' },
  { name: 'Olivastro', hex: '#AE8A63' },
  { name: 'Medio scuro', hex: '#8D5524' },
  { name: 'Scuro', hex: '#614335' },
];

// Hair colors
const HAIR_COLORS = [
  { name: 'Nero', hex: '#1a1a1a' },
  { name: 'Castano scuro', hex: '#3d2314' },
  { name: 'Castano', hex: '#6B4423' },
  { name: 'Biondo scuro', hex: '#8B7355' },
  { name: 'Biondo', hex: '#D4A76A' },
  { name: 'Rosso', hex: '#8B2500' },
  { name: 'Grigio', hex: '#808080' },
];

// Hair styles per gender
const HAIR_STYLES = {
  male: [
    { id: 'short', name: 'Corto classico' },
    { id: 'buzz', name: 'Rasato' },
    { id: 'spiky', name: 'A cresta' },
    { id: 'wavy', name: 'Mosso' },
  ],
  female: [
    { id: 'short', name: 'Corto bob' },
    { id: 'long', name: 'Lungo' },
    { id: 'ponytail', name: 'Coda' },
    { id: 'curly', name: 'Ricci' },
  ],
};

// Eye colors
const EYE_COLORS = [
  { name: 'Marrone', hex: '#5D4E37' },
  { name: 'Nocciola', hex: '#8B7355' },
  { name: 'Verde', hex: '#3D8B3D' },
  { name: 'Azzurro', hex: '#5D9BCC' },
  { name: 'Grigio', hex: '#6B7280' },
];

// Background colors
const BACKGROUND_COLORS = [
  { name: 'Verde chiaro', hex: '#E8F4E8' },
  { name: 'Azzurro', hex: '#E3F2FD' },
  { name: 'Giallo', hex: '#FFF9E6' },
  { name: 'Rosa', hex: '#FCE4EC' },
  { name: 'Lavanda', hex: '#F3E5F5' },
  { name: 'Crema', hex: '#FDFAF0' },
];

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
    avatar_config: { ...DEFAULT_AVATAR_CONFIG },
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

  const steps: { id: OnboardingStep; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'preferences', label: 'Preferenze' },
    { id: 'gender', label: 'Genere' },
    { id: 'avatar', label: 'Avatar' },
    { id: 'neckerchief', label: 'Fazzolettone' },
    { id: 'complete', label: 'Fine' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

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
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('/api/profiles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            onboarding_completed: true,
            avatar_completed: true,
            preferences_set: formData.preferences.length > 0,
          }),
        });

        if (response.ok) {
          return true;
        }

        const data = await response.json();

        // Se 404, il profilo non esiste ancora - attendi e riprova
        if (response.status === 404 && attempt < maxRetries) {
          console.log(`Profilo non trovato, tentativo ${attempt}/${maxRetries}. Riprovo...`);
          await new Promise((r) => setTimeout(r, 1000 * attempt)); // Exponential backoff
          continue;
        }

        throw new Error(data.error || 'Errore durante il salvataggio');
      } catch (err) {
        if (attempt === maxRetries) {
          throw err;
        }
        // Attendi prima di riprovare
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
          <h1 className="text-3xl font-display font-bold text-agesci-blue">
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
                <h2 className="text-xl font-display font-semibold text-agesci-blue mb-4">
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

                <div>
                  <label className="block text-sm font-medium text-agesci-blue mb-1">Gruppo Scout</label>
                  <input
                    type="text"
                    value={formData.scout_group}
                    onChange={(e) => setFormData((prev) => ({ ...prev, scout_group: e.target.value }))}
                    className="input w-full"
                    placeholder="es. Roma 123"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Preferences */}
            {currentStep === 'preferences' && (
              <div>
                <h2 className="text-xl font-display font-semibold text-agesci-blue mb-4">
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
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        formData.preferences.includes(tag)
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

            {/* Step 3: Gender */}
            {currentStep === 'gender' && (
              <div>
                <h2 className="text-xl font-display font-semibold text-agesci-blue mb-4">
                  Il tuo avatar
                </h2>
                <p className="text-agesci-blue/60 mb-6">
                  Scegli la base per il tuo avatar scout.
                </p>

                <div className="flex justify-center gap-8">
                  <button
                    onClick={() => updateAvatarConfig({ gender: 'male', hairStyle: 'short' })}
                    className={`p-6 rounded-2xl border-3 transition-all ${
                      formData.avatar_config.gender === 'male'
                        ? 'border-agesci-blue bg-agesci-blue/5 shadow-playful'
                        : 'border-gray-200 hover:border-agesci-blue/30'
                    }`}
                  >
                    <AvatarPreview
                      config={{ ...formData.avatar_config, gender: 'male', hairStyle: 'short' }}
                      size="lg"
                    />
                    <p className="mt-4 font-medium text-agesci-blue">Ragazzo</p>
                  </button>

                  <button
                    onClick={() => updateAvatarConfig({ gender: 'female', hairStyle: 'long' })}
                    className={`p-6 rounded-2xl border-3 transition-all ${
                      formData.avatar_config.gender === 'female'
                        ? 'border-agesci-blue bg-agesci-blue/5 shadow-playful'
                        : 'border-gray-200 hover:border-agesci-blue/30'
                    }`}
                  >
                    <AvatarPreview
                      config={{ ...formData.avatar_config, gender: 'female', hairStyle: 'long' }}
                      size="lg"
                    />
                    <p className="mt-4 font-medium text-agesci-blue">Ragazza</p>
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Avatar Customization */}
            {currentStep === 'avatar' && (
              <div>
                <h2 className="text-xl font-display font-semibold text-agesci-blue mb-4">
                  Personalizza il tuo avatar
                </h2>

                {/* Avatar Preview */}
                <div className="flex justify-center mb-6">
                  <AvatarPreview config={formData.avatar_config} size="xl" />
                </div>

                {/* Customization Options */}
                <div className="space-y-6">
                  {/* Skin Tone */}
                  <div>
                    <label className="block text-sm font-medium text-agesci-blue mb-2">
                      Colore pelle
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SKIN_TONES.map((tone) => (
                        <button
                          key={tone.hex}
                          onClick={() => updateAvatarConfig({ skinTone: tone.hex })}
                          className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${
                            formData.avatar_config.skinTone === tone.hex
                              ? 'border-agesci-blue ring-2 ring-agesci-yellow'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: tone.hex }}
                          title={tone.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Hair Style */}
                  <div>
                    <label className="block text-sm font-medium text-agesci-blue mb-2">
                      Taglio capelli
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {HAIR_STYLES[formData.avatar_config.gender].map((style) => (
                        <button
                          key={style.id}
                          onClick={() => updateAvatarConfig({ hairStyle: style.id })}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            formData.avatar_config.hairStyle === style.id
                              ? 'bg-agesci-blue text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {style.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hair Color */}
                  <div>
                    <label className="block text-sm font-medium text-agesci-blue mb-2">
                      Colore capelli
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {HAIR_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          onClick={() => updateAvatarConfig({ hairColor: color.hex })}
                          className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${
                            formData.avatar_config.hairColor === color.hex
                              ? 'border-agesci-blue ring-2 ring-agesci-yellow'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Eye Color */}
                  <div>
                    <label className="block text-sm font-medium text-agesci-blue mb-2">
                      Colore occhi
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {EYE_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          onClick={() => updateAvatarConfig({ eyeColor: color.hex })}
                          className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${
                            formData.avatar_config.eyeColor === color.hex
                              ? 'border-agesci-blue ring-2 ring-agesci-yellow'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Background */}
                  <div>
                    <label className="block text-sm font-medium text-agesci-blue mb-2">Sfondo</label>
                    <div className="flex flex-wrap gap-2">
                      {BACKGROUND_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          onClick={() => updateAvatarConfig({ background: color.hex })}
                          className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${
                            formData.avatar_config.background === color.hex
                              ? 'border-agesci-blue ring-2 ring-agesci-yellow'
                              : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Neckerchief */}
            {currentStep === 'neckerchief' && (
              <div>
                <h2 className="text-xl font-display font-semibold text-agesci-blue mb-4">
                  Il tuo fazzolettone
                </h2>
                <p className="text-agesci-blue/60 mb-6">
                  Personalizza il fazzolettone del tuo gruppo scout con i colori corretti.
                </p>

                {/* Avatar Preview */}
                <div className="flex justify-center mb-6">
                  <AvatarPreview config={formData.avatar_config} size="xl" />
                </div>

                {/* Neckerchief Picker */}
                <NeckerchiefPicker
                  value={formData.avatar_config.neckerchief}
                  onChange={(neckerchief) => updateAvatarConfig({ neckerchief })}
                />
              </div>
            )}

            {/* Step 6: Complete */}
            {currentStep === 'complete' && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-6">
                  <AvatarPreview config={formData.avatar_config} size="xl" />
                </div>

                <h2 className="text-2xl font-display font-semibold text-agesci-blue mb-2">
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
                      <strong>Gruppo:</strong> {formData.scout_group || 'Non specificato'}
                    </li>
                    <li>
                      <strong>Interessi:</strong>{' '}
                      {formData.preferences.length > 0
                        ? formData.preferences.join(', ')
                        : 'Nessuno selezionato'}
                    </li>
                    <li>
                      <strong>Fazzolettone:</strong>{' '}
                      {formData.avatar_config.neckerchief.enabled
                        ? `${formData.avatar_config.neckerchief.colorCount} ${
                            formData.avatar_config.neckerchief.colorCount === 1 ? 'colore' : 'colori'
                          }`
                        : 'Non configurato'}
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
