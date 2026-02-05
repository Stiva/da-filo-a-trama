import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DashboardContent, ApiResponse, UserState } from '@/types/database';

/**
 * GET /api/content
 * Recupera contenuti dashboard per lo stato utente
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<DashboardContent[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const targetState = searchParams.get('state') as UserState | null;

    const supabase = await createServerSupabaseClient();
    const { userId } = await auth();

    // Se l'utente è autenticato, ottieni il suo stato
    let userState: UserState = 'new_user';

    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, profile_setup_complete')
        .eq('clerk_id', userId)
        .single();

      if (profile) {
        // Conta le iscrizioni
        const { count } = await supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'confirmed');

        if ((count || 0) > 0) {
          userState = 'enrolled';
        } else if (profile.profile_setup_complete) {
          userState = 'profile_complete';
        } else if (profile.onboarding_completed) {
          userState = 'onboarding_done';
        }
      }
    }

    // Usa lo stato passato come parametro o quello calcolato
    const state = targetState || userState;

    // Query per contenuti attivi che matchano lo stato o sono per tutti
    const { data, error } = await supabase
      .from('dashboard_content')
      .select('*')
      .eq('is_active', true)
      .or(`target_state.eq.${state},target_state.eq.all`)
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data as DashboardContent[] });
  } catch (error) {
    console.error('Errore GET /api/content:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei contenuti' },
      { status: 500 }
    );
  }
}
