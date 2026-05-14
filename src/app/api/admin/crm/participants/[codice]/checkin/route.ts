import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * POST /api/admin/crm/participants/:codice/checkin
 *
 * Body: { is_checked_in: boolean }
 *
 * Imposta lo stato di check-in del partecipante in modo idempotente (SET, non
 * toggle). Questo evita una race condition quando piu' segreterie operano in
 * parallelo sullo stesso codice: due click "Accetta" simultanei diventano due
 * SET a true (stato finale corretto), invece di due toggle che si annullano.
 *
 * Per retrocompatibilita', se il body manca o non contiene is_checked_in,
 * l'endpoint risponde 400: il client deve aggiornare la propria UI.
 *
 * Ritorna la riga corrente dalla view participant_crm_view, cosi' il client
 * puo' riconciliare lo stato locale invece di affidarsi al solo optimistic
 * update.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ codice: string }> }
) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', session.userId)
      .single();

    if (
      !profile ||
      (profile.role !== 'admin' &&
        profile.role !== 'staff' &&
        profile.role !== 'segreteria')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { codice } = await params;

    let desiredStatus: boolean | undefined;
    try {
      const body = await request.json();
      if (typeof body?.is_checked_in === 'boolean') {
        desiredStatus = body.is_checked_in;
      }
    } catch {
      // body assente o non JSON: gestito sotto
    }

    if (typeof desiredStatus !== 'boolean') {
      return NextResponse.json(
        { error: 'Body richiesto: { is_checked_in: boolean }' },
        { status: 400 }
      );
    }

    // SET idempotente: aggiorna sempre allo stato desiderato.
    // Due richieste concorrenti con lo stesso desiredStatus producono lo stesso
    // risultato finale; richieste con desiredStatus opposto rappresentano un
    // disaccordo reale tra operatori e seguono "last write wins" (audit via
    // checked_in_by ricostruisce chi ha fatto cosa).
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('participants')
      .update({
        is_checked_in: desiredStatus,
        checked_in_at: desiredStatus ? nowIso : null,
        checked_in_by: desiredStatus ? profile.id : null,
      })
      .eq('codice', codice);

    if (updateError) throw updateError;

    // Rileggi dalla view per restituire al client lo stato completo,
    // includendo eventuali campi derivati dal profilo collegato.
    const { data: row, error: fetchError } = await supabase
      .from('participant_crm_view')
      .select('*')
      .eq('codice', codice)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    return NextResponse.json({ data: row });
  } catch (error) {
    console.error('Error setting check-in:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
