'use client';

import { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import type { AvatarConfig } from '@/types/database';
import { DEFAULT_AVATAR_CONFIG } from '@/types/database';

interface AvatarPreviewProps {
  config?: Partial<AvatarConfig>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const sizeMap: Record<string, number> = {
  xs: 32,
  sm: 48,
  md: 96,
  lg: 128,
  xl: 192,
};

const isLegacyConfig = (config?: Partial<AvatarConfig>): boolean => {
  if (!config) return true;
  return 'hairStyle' in config && !('style' in config);
};

export default function AvatarPreview({
  config,
  size = 'md',
  className = '',
}: AvatarPreviewProps) {
  const dataUri = useMemo(() => {
    const cfg = isLegacyConfig(config)
      ? DEFAULT_AVATAR_CONFIG
      : { ...DEFAULT_AVATAR_CONFIG, ...config };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: Record<string, any> = {
      seed: cfg.seed || 'default',
    };

    if (cfg.backgroundColor) {
      options.backgroundColor = [cfg.backgroundColor.replace('#', '')];
    }
    if (cfg.skinColor) {
      options.skinColor = [cfg.skinColor.replace('#', '')];
    }
    if (cfg.hairColor) {
      options.hairColor = [cfg.hairColor.replace('#', '')];
    }
    if (cfg.eyes) {
      options.eyes = [cfg.eyes];
    }
    if (cfg.eyebrows) {
      options.eyebrows = [cfg.eyebrows];
    }
    if (cfg.mouth) {
      options.mouth = [cfg.mouth];
    }
    if (cfg.hair) {
      options.hair = [cfg.hair];
    }

    if (cfg.glasses) {
      options.glasses = [cfg.glasses];
      options.glassesProbability = 100;
    } else {
      options.glassesProbability = 0;
    }

    if (cfg.earrings) {
      options.earrings = [cfg.earrings];
      options.earringsProbability = 100;
    } else {
      options.earringsProbability = 0;
    }

    if (cfg.features && cfg.features.length > 0) {
      options.features = cfg.features;
      options.featuresProbability = 100;
    } else {
      options.featuresProbability = 0;
    }

    const avatar = createAvatar(adventurer, options);
    return avatar.toDataUri();
  }, [config]);

  const isFull = size === 'full';
  const px = sizeMap[size] || 96;

  return (
    <div
      className={`rounded-full overflow-hidden shadow-playful border-3 border-agesci-blue shrink-0 ${className}`}
      style={isFull ? { width: '100%', height: '100%' } : { width: px, height: px }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUri}
        alt="Avatar"
        width={isFull ? undefined : px}
        height={isFull ? undefined : px}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

