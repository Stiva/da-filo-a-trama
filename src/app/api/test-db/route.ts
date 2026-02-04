// src/app/api/test-db/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Query di test per verificare la connessione
    const { data, error } = await supabase.rpc('now');

    if (error) {
      // Fallback: prova una query diretta
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (testError && testError.code !== 'PGRST116') {
        // PGRST116 = tabella non trovata (ok in fase di setup)
        throw testError;
      }

      return NextResponse.json({
        message: 'Connessione a Supabase riuscita!',
        note: 'La tabella profiles potrebbe non esistere ancora',
      });
    }

    return NextResponse.json({
      message: 'Connessione a Supabase riuscita!',
      databaseTime: data,
    });
  } catch (error) {
    console.error('Errore durante la connessione a Supabase:', error);

    let errorMessage = 'Si è verificato un errore sconosciuto.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        message: 'Errore durante la connessione a Supabase.',
        error: errorMessage,
        hint: 'Controlla che le variabili NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY siano configurate in .env.local',
      },
      { status: 500 }
    );
  }
}
