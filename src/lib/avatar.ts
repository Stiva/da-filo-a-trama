import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import { AvatarConfig, DEFAULT_AVATAR_CONFIG } from '@/types/database';

export const isLegacyConfig = (config?: Partial<AvatarConfig> | null): boolean => {
    if (!config) return true;
    return 'hairStyle' in config && !('style' in config);
};

export const generateAvatarDataUri = (config?: Partial<AvatarConfig> | null): string => {
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
};
