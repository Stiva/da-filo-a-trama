import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';
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
    if (body.codice_socio !== undefined) {
      const cod = body.codice_socio === '' ? null : body.codice_socio;
      if (cod && !/^[0-9]{4,8}$/.test(cod)) {
        return NextResponse.json(
          { error: 'Formato codice socio non valido (deve contenere 4–8 cifre numeriche).' },
          { status: 400 }
        );
      }
      updateData.codice_socio = cod;
    }
    if (body.scout_group !== undefined) updateData.scout_group = body.scout_group;
    if (body.preferences !== undefined) {
      updateData.preferences = body.preferences;
      updateData.preferences_set = body.preferences.length > 0;
    }
    if (body.avatar_config !== undefined) updateData.avatar_config = body.avatar_config;
    if (body.onboarding_completed !== undefined) {
      updateData.onboarding_completed = body.onboarding_completed;
      // Se l'onboarding è completato, segna anche il profilo come completo
      if (body.onboarding_completed === true) {
        updateData.profile_setup_complete = true;
        updateData.avatar_completed = true;
      }
    }

    // Safety fields
    if (body.is_medical_staff !== undefined) updateData.is_medical_staff = body.is_medical_staff;
    if (body.fire_warden_level !== undefined) updateData.fire_warden_level = body.fire_warden_level || null;

    // Fetch existing profile
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, service_role, codice_socio')
      .eq('clerk_id', userId)
      .single();

    const futureCodice = body.codice_socio !== undefined ? body.codice_socio : existingProfile?.codice_socio;
    const isStaff = body.is_staff === true;
    const isNazionale = body.is_nazionale === true;
    const isGuest = body.is_guest === true;

    if (isGuest) {
      updateData.role = 'guest';
      // No CRM check, no codice_socio required
      if (body.codice_socio) {
        updateData.codice_socio = body.codice_socio;
      }
    } else if (isStaff || isNazionale) {
      if (body.staff_secret !== 'grumbiotto') {
        return NextResponse.json(
          { error: 'Codice segreto non valido.' },
          { status: 400 }
        );
      }

      if (isNazionale) {
        updateData.service_role = 'Gomitolo Team';
        updateData.role = 'user'; // Assicuriamo che rimanga utente per gli esterni
      } else {
        updateData.service_role = 'Staff evento';
        updateData.role = 'staff'; // Assure database role is set to staff

        // Update Clerk metadata synchronously to grant admin panel access
        try {
          const client = await clerkClient();
          await client.users.updateUserMetadata(userId, {
            publicMetadata: { role: 'staff' }
          });
        } catch (clerkError) {
          console.error('Non sono riuscito ad aggiornare i metadata su Clerk:', clerkError);
        }
      }

      // Bypass CRM check but allow them to save their codice_socio if they typed one
      if (body.codice_socio) {
        updateData.codice_socio = body.codice_socio;
      }
    } else if (futureCodice) {
      const { data: crmData } = await supabase
        .from('participants')
        .select('ruolo, gruppo, static_group')
        .eq('codice', futureCodice)
        .single();

      if (!crmData) {
        return NextResponse.json(
          { error: 'Codice socio non trovato nella lista iscritti BC.' },
          { status: 400 }
        );
      }

      // Override using exclusively CRM values
      updateData.service_role = crmData.ruolo || null;
      updateData.scout_group = crmData.gruppo || null;
      if (crmData.static_group) {
        updateData.static_group = crmData.static_group;
      }
    } else if (body.onboarding_completed) {
      return NextResponse.json(
        { error: 'Il Codice Socio è obbligatorio per l\'onboarding.' },
        { status: 400 }
      );
    }

    let data;
    let error;

    // Recupera email da Clerk (serve sia per insert che per recovery da 23505)
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress || '';

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
      // Profilo non esiste, crea
      console.log('Profilo non trovato, creazione fallback per userId:', userId);

      const result = await supabase
        .from('profiles')
        .insert({
          email,
          role: 'user', // Default fallback, can be overridden by updateData
          ...updateData,
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

      // Errore specifico per chiave duplicata (profilo creato nel frattempo o vecchio clerk_id)
      if (error.code === '23505') {
        // 1. Riprova con update matching clerk_id (caso webhook concorrente)
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
        
        // 2. Se fallisce, l'errore 23505 è sull'EMAIL!
        // Un profilo con questa email ha un VECCHIO clerk_id. Trasferiamo la proprietà del profilo!
        if (email) {
          const emailRetryResult = await supabase
            .from('profiles')
            .update(updateData)
            .eq('email', email)
            .select()
            .single();

          if (emailRetryResult.data) {
            return NextResponse.json({
              data: emailRetryResult.data as Profile,
              message: 'Profilo ricollegato e aggiornato con successo',
            });
          }
        }
      }

      // 23514 = check constraint violation (es. service_role non presente nella lista valida)
      // Ritenta senza service_role per salvare comunque il profilo
      if (error.code === '23514') {
        console.warn('Check constraint su service_role, ritento senza service_role:', (updateData as any).service_role);
        delete (updateData as any).service_role;

        const fallbackResult = existingProfile
          ? await supabase.from('profiles').update(updateData).eq('clerk_id', userId).select().single()
          : await supabase.from('profiles').insert({ email, role: 'user', ...updateData }).select().single();

        if (fallbackResult.data) {
          return NextResponse.json({
            data: fallbackResult.data as Profile,
            message: 'Profilo aggiornato con successo',
          });
        }
        if (fallbackResult.error) throw fallbackResult.error;
      }

      throw error;
    }

    return NextResponse.json({
      data: data as Profile,
      message: 'Profilo aggiornato con successo',
    });
  } catch (error: any) {
    console.error('Errore PUT /api/profiles - Exception:', error);
    return NextResponse.json(
      { 
        error: 'Errore interno del server.',
        debug: {
          message: error?.message || String(error),
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
        }
      },
      { status: 500 }
    );
  }
}
