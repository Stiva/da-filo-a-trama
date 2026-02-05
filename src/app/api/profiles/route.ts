import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { Profile, ProfileUpdate, ApiResponse } from '@/types/database';

/**
 * GET /api/profiles
 * Recupera il profilo dell'utente autenticato
 */
export async function GET(): Promise<NextResponse<ApiResponse<Profile>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // Usa service role per bypassare RLS (piu' affidabile)
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('clerk_id', userId)
      .single();

    if (error) {
      console.error('Errore GET /api/profiles - Supabase error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      if (error.code === 'PGRST116') {
        // Profilo non trovato - potrebbe essere in creazione dal webhook
        return NextResponse.json(
          { error: 'Profilo non trovato. Riprova tra qualche secondo.' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data: data as Profile });
  } catch (error) {
    console.error('Errore GET /api/profiles:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profiles
 * Aggiorna il profilo dell'utente autenticato
 * Usa upsert per gestire race condition con webhook
 */
export async function PUT(request: Request): Promise<NextResponse<ApiResponse<Profile>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const body = await request.json() as ProfileUpdate;

    // Validazione base
    if (body.name !== undefined && typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Nome non valido' },
        { status: 400 }
      );
    }

    if (body.preferences !== undefined && !Array.isArray(body.preferences)) {
      return NextResponse.json(
        { error: 'Preferenze non valide' },
        { status: 400 }
      );
    }

    // Usa service role client per bypassare RLS
    // Necessario perche' il JWT template potrebbe non essere configurato correttamente
    // o il profilo potrebbe non esistere ancora (race condition con webhook)
    const supabase = createServiceRoleClient();

    // Costruisci l'oggetto di aggiornamento
    const updateData: Record<string, unknown> = {
      clerk_id: userId, // Necessario per upsert
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.surname !== undefined) updateData.surname = body.surname;
    if (body.scout_group !== undefined) updateData.scout_group = body.scout_group;
    if (body.preferences !== undefined) updateData.preferences = body.preferences;
    if (body.avatar_config !== undefined) updateData.avatar_config = body.avatar_config;
    if (body.onboarding_completed !== undefined) updateData.onboarding_completed = body.onboarding_completed;

    // Prima prova update
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    let data;
    let error;

    if (existingProfile) {
      // Profilo esiste, fai update normale
      const result = await supabase
        .from('profiles')
        .update(updateData)
        .eq('clerk_id', userId)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Profilo non esiste, recupera email da Clerk e crea
      console.log('Profilo non trovato, creazione fallback per userId:', userId);

      const user = await currentUser();
      const email = user?.emailAddresses?.[0]?.emailAddress || '';

      const result = await supabase
        .from('profiles')
        .insert({
          ...updateData,
          email,
          role: 'user',
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Errore PUT /api/profiles - Supabase error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId,
      });

      // Errore specifico per chiave duplicata (profilo creato nel frattempo)
      if (error.code === '23505') {
        // Riprova con update
        const retryResult = await supabase
          .from('profiles')
          .update(updateData)
          .eq('clerk_id', userId)
          .select()
          .single();

        if (retryResult.data) {
          return NextResponse.json({
            data: retryResult.data as Profile,
            message: 'Profilo aggiornato con successo',
          });
        }
      }

      throw error;
    }

    return NextResponse.json({
      data: data as Profile,
      message: 'Profilo aggiornato con successo',
    });
  } catch (error) {
    console.error('Errore PUT /api/profiles - Exception:', error);
    return NextResponse.json(
      { error: 'Errore interno del server. Controlla i log per dettagli.' },
      { status: 500 }
    );
  }
}
