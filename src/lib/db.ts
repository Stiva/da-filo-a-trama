/**
 * @deprecated Questo file è stato deprecato.
 * Usare invece i client Supabase in ./supabase/server.ts e ./supabase/client.ts
 *
 * I client Supabase offrono:
 * - Integrazione JWT con Clerk per RLS
 * - Tipo sicuro con tipi generati
 * - Supporto per Realtime e Storage
 */

// Re-export dei nuovi client per retrocompatibilità
export { createServerSupabaseClient } from './supabase/server';
export { createBrowserSupabaseClient, getSupabaseClient } from './supabase/client';
