import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import Papa from 'papaparse';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('clerk_id', session.userId)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 });
    }

    const fileContent = await file.text();

    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';', // Based on Evento23854.csv format
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json({ error: 'Errore nel parsing del CSV' }, { status: 400 });
    }

    const rows = parsed.data as Record<string, string>[];
    
    // Map to DB schema
    const participants = rows.map(row => {
      // Safely access fields in case headers differ slightly
      return {
        codice: row['Codice'] || null,
        nome: row['Nome'] || '',
        cognome: row['Cognome'] || '',
        email_contatto: row['EmailContatto'] || null,
        email_referente: row['EmailReferente'] || null,
        regione: row['Regione'] || null,
        gruppo: row['Gruppo'] || null,
        zona: row['Zona'] || null,
        ruolo: row['Partecipo in qualità di:'] || null,
        allergie: row['Allergie? (indicare il grado di reazione)'] || null,
        esigenze_mediche: row['Eventuali esigenze mediche?'] || null,
        segnalazioni: row['Ulteriori segnalazioni?'] || null,
        esigenze_alimentari: row['Esigenze alimentari?'] || null,
        competenza_sostenibilita: row['Quanto ti senti competente sui temi della sostenibilità ambientale/sociale/economica?'] || null,
        aspettativa_evento: row['Qual è la tua principale aspettativa rispetto all’evento?'] || null,
        temi_sostenibilita: row['Su quale tema dello sviluppo sostenibile sei più interessato a lavorare nel tuo ruolo educativo?'] || null,
        is_active_in_list: true,
      };
    }).filter(p => p.codice); // Filtering out rows without 'Codice'

    if (participants.length === 0) {
      return NextResponse.json({ error: 'Nessun partecipante valido trovato. Verifica che la colonna "Codice" via presente e il separatore sia un punto e virgola (;)' }, { status: 400 });
    }

    const uploadedCodices = new Set(participants.map(p => p.codice));

    // Upsert in batches of 100 to avoid request size limits
    const BATCH_SIZE = 100;
    for (let i = 0; i < participants.length; i += BATCH_SIZE) {
      const batch = participants.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from('participants')
        .upsert(batch, { onConflict: 'codice' });
      
      if (upsertError) {
        console.error('Error upserting batch:', upsertError);
        throw upsertError;
      }
    }

    // Now, find all participants currently active in DB but NOT in this upload
    // and mark them as inactive
    const { data: currentActive } = await supabase
      .from('participants')
      .select('codice')
      .eq('is_active_in_list', true);

    if (currentActive) {
      const toBeDeactivated = currentActive
        .filter(c => !uploadedCodices.has(c.codice))
        .map(c => c.codice);

      if (toBeDeactivated.length > 0) {
        for (let i = 0; i < toBeDeactivated.length; i += BATCH_SIZE) {
          const batch = toBeDeactivated.slice(i, i + BATCH_SIZE);
          await supabase
            .from('participants')
            .update({ is_active_in_list: false })
            .in('codice', batch);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: participants.length,
      message: 'Lista sincronizzata con successo'
    });
  } catch (error) {
    console.error('Error uploading CRM data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
