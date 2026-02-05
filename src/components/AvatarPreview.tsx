'use client';

import type { AvatarConfig } from '@/types/database';
import { DEFAULT_AVATAR_CONFIG } from '@/types/database';

interface AvatarPreviewProps {
  config?: Partial<AvatarConfig>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  xs: 'w-8 h-8',
  sm: 'w-12 h-12',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-48 h-48',
};

export default function AvatarPreview({
  config,
  size = 'md',
  className = '',
}: AvatarPreviewProps) {
  // Merge with defaults
  const avatarConfig: AvatarConfig = {
    ...DEFAULT_AVATAR_CONFIG,
    ...config,
    neckerchief: {
      ...DEFAULT_AVATAR_CONFIG.neckerchief,
      ...config?.neckerchief,
    },
  };

  const {
    gender,
    skinTone,
    hairStyle,
    hairColor,
    eyeColor,
    neckerchief,
    clothing,
    background,
  } = avatarConfig;

  return (
    <div
      className={`${sizeMap[size]} rounded-full overflow-hidden shadow-playful border-3 border-agesci-blue ${className}`}
      style={{ backgroundColor: background }}
    >
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        {/* Background circle */}
        <circle cx="50" cy="50" r="50" fill={background} />

        {/* Body/Uniform */}
        <ellipse cx="50" cy="95" rx="40" ry="30" fill={clothing} />

        {/* Neck */}
        <rect x="42" y="55" width="16" height="15" fill={skinTone} />

        {/* Neckerchief Scout */}
        {neckerchief?.enabled && (
          <g className="neckerchief">
            {/* Main triangle (fazzolettone) */}
            <path
              d="M 25 60 L 50 85 L 75 60 L 50 65 Z"
              fill={neckerchief.color1}
            />
            {/* Second color layer (if 2+ colors) */}
            {neckerchief.colorCount >= 2 && neckerchief.color2 && (
              <path
                d="M 30 62 L 50 80 L 70 62 L 50 66 Z"
                fill={neckerchief.color2}
              />
            )}
            {/* Third color detail (if 3 colors) */}
            {neckerchief.colorCount >= 3 && neckerchief.color3 && (
              <>
                <path
                  d="M 35 64 L 50 75 L 65 64 L 50 67 Z"
                  fill={neckerchief.color3}
                />
              </>
            )}
            {/* Woggle (nodo/fermafazzolettone) */}
            <ellipse cx="50" cy="62" rx="5" ry="4" fill="#8B4513" />
            <ellipse cx="50" cy="62" rx="3" ry="2.5" fill="#A0522D" />
          </g>
        )}

        {/* Head */}
        <ellipse
          cx="50"
          cy="38"
          rx="25"
          ry={gender === 'female' ? 26 : 25}
          fill={skinTone}
        />

        {/* Ears */}
        <ellipse cx="25" cy="40" rx="4" ry="6" fill={skinTone} />
        <ellipse cx="75" cy="40" rx="4" ry="6" fill={skinTone} />

        {/* Hair - different styles based on gender and hairStyle */}
        {gender === 'female' ? (
          <FemaleHair hairStyle={hairStyle} hairColor={hairColor} />
        ) : (
          <MaleHair hairStyle={hairStyle} hairColor={hairColor} />
        )}

        {/* Eyes */}
        <g className="eyes">
          {/* Eye whites */}
          <ellipse cx="40" cy="38" rx="6" ry="5" fill="white" />
          <ellipse cx="60" cy="38" rx="6" ry="5" fill="white" />
          {/* Irises */}
          <circle cx="40" cy="38" r="3.5" fill={eyeColor} />
          <circle cx="60" cy="38" r="3.5" fill={eyeColor} />
          {/* Pupils */}
          <circle cx="40" cy="38" r="1.5" fill="#1a1a1a" />
          <circle cx="60" cy="38" r="1.5" fill="#1a1a1a" />
          {/* Eye shine */}
          <circle cx="41" cy="37" r="1" fill="white" opacity="0.8" />
          <circle cx="61" cy="37" r="1" fill="white" opacity="0.8" />
        </g>

        {/* Eyebrows */}
        <path
          d="M 34 32 Q 40 30 46 32"
          stroke={hairColor}
          strokeWidth="1.5"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M 54 32 Q 60 30 66 32"
          stroke={hairColor}
          strokeWidth="1.5"
          fill="none"
          opacity="0.7"
        />

        {/* Nose */}
        <path
          d="M 50 40 L 48 48 Q 50 50 52 48 L 50 40"
          fill={skinTone}
          stroke={skinTone}
          strokeWidth="0.5"
          filter="brightness(0.95)"
        />

        {/* Smile */}
        <path
          d="M 42 52 Q 50 58 58 52"
          stroke="#c9967a"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Blush */}
        <ellipse cx="32" cy="48" rx="5" ry="3" fill="#FFB6C1" opacity="0.3" />
        <ellipse cx="68" cy="48" rx="5" ry="3" fill="#FFB6C1" opacity="0.3" />
      </svg>
    </div>
  );
}

// Female hair styles
function FemaleHair({
  hairStyle,
  hairColor,
}: {
  hairStyle: string;
  hairColor: string;
}) {
  switch (hairStyle) {
    case 'long':
      return (
        <g className="hair-female-long">
          {/* Long flowing hair */}
          <path
            d="M 20 35 Q 15 20 30 10 Q 50 0 70 10 Q 85 20 80 35 L 82 70 Q 80 85 70 90 L 65 60 L 60 90 Q 55 95 50 90 L 50 60 L 45 90 Q 40 95 35 90 L 30 60 L 25 90 Q 20 85 18 70 Z"
            fill={hairColor}
          />
          {/* Bangs */}
          <path
            d="M 28 25 Q 35 15 50 15 Q 65 15 72 25 Q 60 22 50 24 Q 40 22 28 25"
            fill={hairColor}
          />
        </g>
      );
    case 'short':
      return (
        <g className="hair-female-short">
          {/* Short bob */}
          <path
            d="M 22 35 Q 18 20 30 12 Q 50 2 70 12 Q 82 20 78 35 Q 80 50 72 55 Q 65 45 50 45 Q 35 45 28 55 Q 20 50 22 35"
            fill={hairColor}
          />
          {/* Side bangs */}
          <path
            d="M 26 28 Q 32 18 45 20 L 38 32 Q 30 32 26 28"
            fill={hairColor}
          />
        </g>
      );
    case 'ponytail':
      return (
        <g className="hair-female-ponytail">
          {/* Base hair */}
          <path
            d="M 22 35 Q 18 20 30 12 Q 50 2 70 12 Q 82 20 78 35 Q 78 45 70 48 Q 60 40 50 40 Q 40 40 30 48 Q 22 45 22 35"
            fill={hairColor}
          />
          {/* Ponytail */}
          <path
            d="M 65 20 Q 80 15 85 25 Q 90 40 82 60 Q 78 70 75 65 Q 80 50 78 35 Q 76 25 65 20"
            fill={hairColor}
          />
          {/* Hair tie */}
          <ellipse cx="72" cy="22" rx="3" ry="4" fill="#FF69B4" />
        </g>
      );
    case 'curly':
    default:
      return (
        <g className="hair-female-curly">
          {/* Curly volume */}
          <ellipse cx="50" cy="22" rx="32" ry="20" fill={hairColor} />
          {/* Curls around face */}
          <circle cx="22" cy="35" r="8" fill={hairColor} />
          <circle cx="78" cy="35" r="8" fill={hairColor} />
          <circle cx="25" cy="48" r="6" fill={hairColor} />
          <circle cx="75" cy="48" r="6" fill={hairColor} />
        </g>
      );
  }
}

// Male hair styles
function MaleHair({
  hairStyle,
  hairColor,
}: {
  hairStyle: string;
  hairColor: string;
}) {
  switch (hairStyle) {
    case 'buzz':
      return (
        <g className="hair-male-buzz">
          {/* Very short buzz cut */}
          <path
            d="M 25 30 Q 25 12 50 10 Q 75 12 75 30 Q 70 20 50 18 Q 30 20 25 30"
            fill={hairColor}
            opacity="0.8"
          />
        </g>
      );
    case 'spiky':
      return (
        <g className="hair-male-spiky">
          {/* Spiky top */}
          <path
            d="M 28 25 L 32 8 L 38 22 L 44 5 L 50 20 L 56 3 L 62 22 L 68 8 L 72 25 Q 75 15 75 28 Q 70 15 50 13 Q 30 15 25 28 Q 25 15 28 25"
            fill={hairColor}
          />
        </g>
      );
    case 'wavy':
      return (
        <g className="hair-male-wavy">
          {/* Wavy styled hair */}
          <path
            d="M 25 32 Q 22 15 35 10 Q 50 5 65 10 Q 78 15 75 32 Q 72 22 60 20 Q 50 22 40 20 Q 28 22 25 32"
            fill={hairColor}
          />
          {/* Wave detail */}
          <path
            d="M 30 25 Q 40 20 50 22 Q 60 20 70 25"
            stroke={hairColor}
            strokeWidth="4"
            fill="none"
          />
        </g>
      );
    case 'short':
    default:
      return (
        <g className="hair-male-short">
          {/* Classic short cut */}
          <path
            d="M 25 30 Q 22 15 35 10 Q 50 5 65 10 Q 78 15 75 30 Q 70 18 50 15 Q 30 18 25 30"
            fill={hairColor}
          />
        </g>
      );
  }
}
