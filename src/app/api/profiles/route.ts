import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
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

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('clerk_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Profilo non trovato
        return NextResponse.json(
          { error: 'Profilo non trovato' },
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

    const supabase = await createServerSupabaseClient();

    // Costruisci l'oggetto di aggiornamento
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.surname !== undefined) updateData.surname = body.surname;
    if (body.scout_group !== undefined) updateData.scout_group = body.scout_group;
    if (body.preferences !== undefined) updateData.preferences = body.preferences;
    if (body.avatar_config !== undefined) updateData.avatar_config = body.avatar_config;
    if (body.onboarding_completed !== undefined) updateData.onboarding_completed = body.onboarding_completed;

    // Aggiungi timestamp aggiornamento
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('clerk_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Profilo non trovato' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      data: data as Profile,
      message: 'Profilo aggiornato con successo',
    });
  } catch (error) {
    console.error('Errore PUT /api/profiles:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}
