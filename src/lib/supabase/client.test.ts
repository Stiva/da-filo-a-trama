import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock the Supabase client creation
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('Supabase Client Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear the cache for the module so the singleton state is reset
    vi.resetModules();

    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createBrowserSupabaseClient', () => {
    it('should create a client when environment variables are set', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-url.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const mockClient = { auth: {} };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      // Re-import dynamic to ensure fresh environment evaluation
      const { createBrowserSupabaseClient } = await import('./client');

      const client = createBrowserSupabaseClient();

      expect(createClient).toHaveBeenCalledWith(
        'https://test-url.supabase.co',
        'test-anon-key'
      );
      expect(client).toBe(mockClient);
    });

    it('should throw an error if NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const { createBrowserSupabaseClient } = await import('./client');

      expect(() => createBrowserSupabaseClient()).toThrow(
        'Variabili ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY richieste'
      );
    });

    it('should throw an error if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-url.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const { createBrowserSupabaseClient } = await import('./client');

      expect(() => createBrowserSupabaseClient()).toThrow(
        'Variabili ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY richieste'
      );
    });
  });

  describe('getSupabaseClient', () => {
    it('should initialize the client on the first call', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-url.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const mockClient = { auth: {} };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      const { getSupabaseClient } = await import('./client');

      const client = getSupabaseClient();

      expect(createClient).toHaveBeenCalledTimes(1);
      expect(client).toBe(mockClient);
    });

    it('should return the same client instance on subsequent calls (singleton)', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-url.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const mockClient = { auth: {} };
      vi.mocked(createClient).mockReturnValue(mockClient as any);

      const { getSupabaseClient } = await import('./client');

      const client1 = getSupabaseClient();
      const client2 = getSupabaseClient();

      expect(createClient).toHaveBeenCalledTimes(1);

      expect(client1).toBe(mockClient);
      expect(client2).toBe(mockClient);
      expect(client1).toBe(client2);
    });
  });
});
