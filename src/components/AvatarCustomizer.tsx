'use client';

import AvatarPreview from '@/components/AvatarPreview';
import { ADVENTURER_OPTIONS, type AvatarConfig } from '@/types/database';

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

// Labels italiane per le features
const FEATURE_LABELS: Record<string, string> = {
  mustache: 'Baffi',
  blush: 'Blush',
  birthmark: 'Neo',
  freckles: 'Lentiggini',
};

interface AvatarCustomizerProps {
  config: AvatarConfig;
  onChange: (updates: Partial<AvatarConfig>) => void;
}

const generateRandomSeed = () => Math.random().toString(36).substring(2, 10);

// Stepper per navigare tra varianti
const FeatureStepper = ({
  label,
  options,
  value,
  onChangeValue,
}: {
  label: string;
  options: string[];
  value: string | undefined;
  onChangeValue: (val: string) => void;
}) => {
  const currentIndex = value ? options.indexOf(value) : -1;
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

  const handlePrev = () => {
    if (currentIndex <= 0) {
      onChangeValue(options[options.length - 1]);
    } else {
      onChangeValue(options[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex >= options.length - 1 || currentIndex < 0) {
      onChangeValue(options[0]);
    } else {
      onChangeValue(options[currentIndex + 1]);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-agesci-blue w-28 shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePrev}
          className="w-9 h-9 rounded-full border-2 border-agesci-blue/20 flex items-center justify-center hover:bg-agesci-blue/5 transition-colors"
          aria-label={`${label} precedente`}
        >
          <ChevronLeftIcon />
        </button>
        <span className="text-sm text-agesci-blue/70 w-12 text-center tabular-nums">
          {displayIndex}/{options.length}
        </span>
        <button
          type="button"
          onClick={handleNext}
          className="w-9 h-9 rounded-full border-2 border-agesci-blue/20 flex items-center justify-center hover:bg-agesci-blue/5 transition-colors"
          aria-label={`${label} successivo`}
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
};

// Toggle per accessori opzionali (occhiali, orecchini)
const AccessoryToggle = ({
  label,
  options,
  value,
  onChangeValue,
}: {
  label: string;
  options: string[];
  value: string | undefined;
  onChangeValue: (val: string | undefined) => void;
}) => {
  const isEnabled = !!value;
  const currentIndex = value ? options.indexOf(value) : -1;
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

  const handleToggle = () => {
    if (isEnabled) {
      onChangeValue(undefined);
    } else {
      onChangeValue(options[0]);
    }
  };

  const handlePrev = () => {
    if (!isEnabled) return;
    if (currentIndex <= 0) {
      onChangeValue(options[options.length - 1]);
    } else {
      onChangeValue(options[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (!isEnabled) return;
    if (currentIndex >= options.length - 1 || currentIndex < 0) {
      onChangeValue(options[0]);
    } else {
      onChangeValue(options[currentIndex + 1]);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 w-28 shrink-0">
        <button
          type="button"
          onClick={handleToggle}
          className={`w-10 h-6 rounded-full transition-colors relative ${
            isEnabled ? 'bg-agesci-blue' : 'bg-gray-300'
          }`}
          role="switch"
          aria-checked={isEnabled}
          aria-label={`${label} ${isEnabled ? 'attivo' : 'disattivo'}`}
        >
          <span
            className={`absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              isEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className="text-sm font-medium text-agesci-blue">{label}</span>
      </div>
      {isEnabled && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            className="w-9 h-9 rounded-full border-2 border-agesci-blue/20 flex items-center justify-center hover:bg-agesci-blue/5 transition-colors"
            aria-label={`${label} precedente`}
          >
            <ChevronLeftIcon />
          </button>
          <span className="text-sm text-agesci-blue/70 w-12 text-center tabular-nums">
            {displayIndex}/{options.length}
          </span>
          <button
            type="button"
            onClick={handleNext}
            className="w-9 h-9 rounded-full border-2 border-agesci-blue/20 flex items-center justify-center hover:bg-agesci-blue/5 transition-colors"
            aria-label={`${label} successivo`}
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}
    </div>
  );
};

export default function AvatarCustomizer({ config, onChange }: AvatarCustomizerProps) {
  const handleRandomize = () => {
    onChange({
      seed: generateRandomSeed(),
      eyes: undefined,
      eyebrows: undefined,
      mouth: undefined,
      hair: undefined,
      glasses: undefined,
      earrings: undefined,
      features: undefined,
    });
  };

  const handleToggleFeature = (feature: string) => {
    const current = config.features || [];
    const updated = current.includes(feature)
      ? current.filter((f) => f !== feature)
      : [...current, feature];
    onChange({ features: updated.length > 0 ? updated : undefined });
  };

  return (
    <div>
      {/* Avatar Preview + Randomize */}
      <div className="flex flex-col items-center mb-6">
        <AvatarPreview config={config} size="xl" />
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

      <div className="space-y-6">
        {/* Aspetto */}
        <div>
          <h3 className="text-sm font-semibold text-agesci-blue/50 uppercase tracking-wider mb-3">
            Aspetto
          </h3>
          <div className="space-y-3">
            <FeatureStepper
              label="Occhi"
              options={ADVENTURER_OPTIONS.eyes}
              value={config.eyes}
              onChangeValue={(val) => onChange({ eyes: val })}
            />
            <FeatureStepper
              label="Sopracciglia"
              options={ADVENTURER_OPTIONS.eyebrows}
              value={config.eyebrows}
              onChangeValue={(val) => onChange({ eyebrows: val })}
            />
            <FeatureStepper
              label="Bocca"
              options={ADVENTURER_OPTIONS.mouth}
              value={config.mouth}
              onChangeValue={(val) => onChange({ mouth: val })}
            />
            <FeatureStepper
              label="Capelli"
              options={ADVENTURER_OPTIONS.hair}
              value={config.hair}
              onChangeValue={(val) => onChange({ hair: val })}
            />
          </div>
        </div>

        {/* Accessori */}
        <div>
          <h3 className="text-sm font-semibold text-agesci-blue/50 uppercase tracking-wider mb-3">
            Accessori
          </h3>
          <div className="space-y-3">
            <AccessoryToggle
              label="Occhiali"
              options={ADVENTURER_OPTIONS.glasses}
              value={config.glasses}
              onChangeValue={(val) => onChange({ glasses: val })}
            />
            <AccessoryToggle
              label="Orecchini"
              options={ADVENTURER_OPTIONS.earrings}
              value={config.earrings}
              onChangeValue={(val) => onChange({ earrings: val })}
            />
          </div>
        </div>

        {/* Lineamenti */}
        <div>
          <h3 className="text-sm font-semibold text-agesci-blue/50 uppercase tracking-wider mb-3">
            Lineamenti
          </h3>
          <div className="flex flex-wrap gap-3">
            {ADVENTURER_OPTIONS.features.map((feature) => {
              const isActive = config.features?.includes(feature) || false;
              return (
                <button
                  key={feature}
                  type="button"
                  onClick={() => handleToggleFeature(feature)}
                  className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'border-agesci-blue bg-agesci-blue/10 text-agesci-blue'
                      : 'border-gray-200 hover:border-agesci-blue/30 text-gray-600'
                  }`}
                  aria-pressed={isActive}
                  aria-label={FEATURE_LABELS[feature] || feature}
                >
                  {FEATURE_LABELS[feature] || feature}
                </button>
              );
            })}
          </div>
        </div>

        {/* Colori */}
        <div>
          <h3 className="text-sm font-semibold text-agesci-blue/50 uppercase tracking-wider mb-3">
            Colori
          </h3>
          <div className="space-y-4">
            {/* Colore pelle */}
            <div>
              <label className="block text-sm font-medium text-agesci-blue mb-2">
                Colore pelle
              </label>
              <div className="flex flex-wrap gap-2">
                {SKIN_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => onChange({ skinColor: color.hex })}
                    className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${
                      config.skinColor === color.hex
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
              <label className="block text-sm font-medium text-agesci-blue mb-2">
                Colore capelli
              </label>
              <div className="flex flex-wrap gap-2">
                {HAIR_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => onChange({ hairColor: color.hex })}
                    className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${
                      config.hairColor === color.hex
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

            {/* Sfondo */}
            <div>
              <label className="block text-sm font-medium text-agesci-blue mb-2">
                Sfondo
              </label>
              <div className="flex flex-wrap gap-2">
                {BG_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => onChange({ backgroundColor: color.hex })}
                    className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${
                      config.backgroundColor === color.hex
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
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon components
function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4 text-agesci-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4 text-agesci-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
