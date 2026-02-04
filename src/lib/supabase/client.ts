import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase per il browser.
 * Usare nei Client Components con 'use client'.
 * Per operazioni autenticate, usare useSession() di Clerk
 * e passare il token nelle richieste API.
 */
export function createBrowserSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Variabili ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY richieste'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// Singleton per evitare multiple istanze nel browser
let browserClient: ReturnType<typeof createBrowserSupabaseClient> | null = null;

export function getSupabaseClient() {
  if (!browserClient) {
    browserClient = createBrowserSupabaseClient();
  }
  return browserClient;
}
