'use client';

import { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import {
  adventurer,
  avataaars,
  lorelei,
  openPeeps,
} from '@dicebear/collection';
import type { AvatarConfig, AvatarStyle } from '@/types/database';
import { DEFAULT_AVATAR_CONFIG } from '@/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STYLE_MODULES: Record<AvatarStyle, any> = {
  adventurer,
  avataaars,
  lorelei,
  openPeeps,
};

interface AvatarPreviewProps {
  config?: Partial<AvatarConfig>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
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
  // Vecchio formato aveva hairStyle ma non style
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

    const styleModule = STYLE_MODULES[cfg.style as AvatarStyle] || adventurer;

    const options: Record<string, unknown> = {
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

    const avatar = createAvatar(styleModule, options);
    return avatar.toDataUri();
  }, [config]);

  const px = sizeMap[size] || 96;

  return (
    <div
      className={`rounded-full overflow-hidden shadow-playful border-3 border-agesci-blue ${className}`}
      style={{ width: px, height: px }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUri}
        alt="Avatar"
        width={px}
        height={px}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
