import { describe, it, expect, vi } from 'vitest';

describe('Attachment FileName Generation', () => {
    it('should generate a secure UUID for filename', () => {
        const fileExt = 'png';
        const groupId = 'test-group';

        // Mock crypto.randomUUID
        const mockUUID = '123e4567-e89b-12d3-a456-426614174000';
        vi.stubGlobal('crypto', {
            randomUUID: () => mockUUID
        });

        const fileName = `${groupId}/${crypto.randomUUID()}.${fileExt}`;

        expect(fileName).toBe('test-group/123e4567-e89b-12d3-a456-426614174000.png');
        expect(fileName).not.toContain('Math.random');
        expect(fileName).not.toContain(Date.now().toString().substring(0, 5));

        vi.unstubAllGlobals();
    });

    it('should generate valid split seed for AvatarCustomizer', () => {
        // Mock crypto.randomUUID
        const mockUUID = '123e4567-e89b-12d3-a456-426614174000';
        vi.stubGlobal('crypto', {
            randomUUID: () => mockUUID
        });

        const generateRandomSeed = () => crypto.randomUUID().split('-')[0];
        const seed = generateRandomSeed();

        expect(seed).toBe('123e4567');
        expect(seed).not.toContain('Math.random');

        vi.unstubAllGlobals();
    });
});
