'use client';

import { useState } from 'react';
import type { NeckerchiefConfig } from '@/types/database';

interface NeckerchiefPickerProps {
  value: NeckerchiefConfig;
  onChange: (value: NeckerchiefConfig) => void;
}

// Colori scout comuni per i fazzolettoni
const SCOUT_COLORS = [
  { name: 'Rosso', hex: '#DC2626' },
  { name: 'Blu AGESCI', hex: '#1E6091' },
  { name: 'Blu Navy', hex: '#1E3A5F' },
  { name: 'Verde Bosco', hex: '#2D5016' },
  { name: 'Verde Chiaro', hex: '#4CAF50' },
  { name: 'Giallo', hex: '#FFDE00' },
  { name: 'Arancione', hex: '#F97316' },
  { name: 'Viola', hex: '#7C3AED' },
  { name: 'Rosa', hex: '#EC4899' },
  { name: 'Bianco', hex: '#FFFFFF' },
  { name: 'Nero', hex: '#1F2937' },
  { name: 'Marrone', hex: '#8B4513' },
  { name: 'Grigio', hex: '#6B7280' },
  { name: 'Celeste', hex: '#38BDF8' },
  { name: 'Bordeaux', hex: '#881337' },
  { name: 'Oro', hex: '#D4AF37' },
];

export default function NeckerchiefPicker({
  value,
  onChange,
}: NeckerchiefPickerProps) {
  const [showCustomPicker, setShowCustomPicker] = useState<1 | 2 | 3 | null>(null);

  const handleToggle = (enabled: boolean) => {
    onChange({ ...value, enabled });
  };

  const handleColorCountChange = (colorCount: 1 | 2 | 3) => {
    onChange({ ...value, colorCount });
  };

  const handleColorChange = (colorIndex: 1 | 2 | 3, color: string) => {
    const key = `color${colorIndex}` as 'color1' | 'color2' | 'color3';
    onChange({ ...value, [key]: color });
  };

  return (
    <div className="space-y-4">
      {/* Toggle abilitazione */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-agesci-yellow/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-agesci-blue"></div>
        </div>
        <span className="text-agesci-blue font-medium group-hover:text-agesci-blue-light transition-colors">
          Aggiungi fazzolettone scout
        </span>
      </label>

      {value.enabled && (
        <div className="pl-2 border-l-4 border-agesci-yellow space-y-4">
          {/* Preview piccolo del fazzolettone */}
          <div className="flex items-center gap-4">
            <NeckerchiefPreview config={value} />
            <p className="text-sm text-agesci-blue/70">
              Personalizza il fazzolettone del tuo gruppo scout
            </p>
          </div>

          {/* Selettore numero colori */}
          <div>
            <p className="text-sm font-medium text-agesci-blue mb-2">
              Quanti colori ha il tuo fazzolettone?
            </p>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    value.colorCount === n
                      ? 'bg-agesci-blue text-white shadow-playful'
                      : 'bg-agesci-blue/10 text-agesci-blue hover:bg-agesci-blue/20'
                  }`}
                  onClick={() => handleColorCountChange(n)}
                >
                  {n} {n === 1 ? 'colore' : 'colori'}
                </button>
              ))}
            </div>
          </div>

          {/* Color pickers */}
          <div className="space-y-3">
            <ColorSelector
              label="Colore principale"
              description="Il colore base del fazzolettone"
              value={value.color1}
              onChange={(c) => handleColorChange(1, c)}
              showCustom={showCustomPicker === 1}
              onToggleCustom={() => setShowCustomPicker(showCustomPicker === 1 ? null : 1)}
            />

            {value.colorCount >= 2 && (
              <ColorSelector
                label="Secondo colore"
                description="Il colore del bordo o della fascia"
                value={value.color2 || SCOUT_COLORS[3].hex}
                onChange={(c) => handleColorChange(2, c)}
                showCustom={showCustomPicker === 2}
                onToggleCustom={() => setShowCustomPicker(showCustomPicker === 2 ? null : 2)}
              />
            )}

            {value.colorCount >= 3 && (
              <ColorSelector
                label="Terzo colore"
                description="Dettaglio o punta del fazzolettone"
                value={value.color3 || SCOUT_COLORS[0].hex}
                onChange={(c) => handleColorChange(3, c)}
                showCustom={showCustomPicker === 3}
                onToggleCustom={() => setShowCustomPicker(showCustomPicker === 3 ? null : 3)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Componente selettore colore
function ColorSelector({
  label,
  description,
  value,
  onChange,
  showCustom,
  onToggleCustom,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (color: string) => void;
  showCustom: boolean;
  onToggleCustom: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-agesci-blue">{label}</p>
          <p className="text-xs text-agesci-blue/60">{description}</p>
        </div>
        <button
          type="button"
          onClick={onToggleCustom}
          className="text-xs text-agesci-blue/70 hover:text-agesci-blue underline"
        >
          {showCustom ? 'Palette colori' : 'Colore personalizzato'}
        </button>
      </div>

      {showCustom ? (
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 rounded-lg cursor-pointer border-2 border-agesci-blue/20"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#RRGGBB"
            className="input text-sm w-28"
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {SCOUT_COLORS.map((color) => (
            <button
              key={color.hex}
              type="button"
              onClick={() => onChange(color.hex)}
              className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                value === color.hex
                  ? 'border-agesci-blue ring-2 ring-agesci-yellow scale-110'
                  : 'border-gray-200 hover:border-agesci-blue/50'
              } ${color.hex === '#FFFFFF' ? 'bg-white' : ''}`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Preview del fazzolettone
function NeckerchiefPreview({ config }: { config: NeckerchiefConfig }) {
  return (
    <svg
      viewBox="0 0 60 40"
      className="w-16 h-12"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main triangle */}
      <path d="M 5 5 L 30 35 L 55 5 L 30 10 Z" fill={config.color1} />

      {/* Second color layer */}
      {config.colorCount >= 2 && config.color2 && (
        <path d="M 10 7 L 30 32 L 50 7 L 30 11 Z" fill={config.color2} />
      )}

      {/* Third color detail */}
      {config.colorCount >= 3 && config.color3 && (
        <path d="M 18 10 L 30 28 L 42 10 L 30 13 Z" fill={config.color3} />
      )}

      {/* Woggle */}
      <ellipse cx="30" cy="10" rx="4" ry="3" fill="#8B4513" />
      <ellipse cx="30" cy="10" rx="2.5" ry="2" fill="#A0522D" />
    </svg>
  );
}

// Export palette colori per riuso
export { SCOUT_COLORS };
