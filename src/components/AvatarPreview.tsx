'use client';

import { useMemo } from 'react';
import type { AvatarConfig } from '@/types/database';
import { generateAvatarDataUri } from '@/lib/avatar';

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

export default function AvatarPreview({
  config,
  size = 'md',
  className = '',
}: AvatarPreviewProps) {
  const dataUri = useMemo(() => generateAvatarDataUri(config), [config]);

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

