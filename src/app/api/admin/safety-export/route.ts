import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

const FIRE_WARDEN_LABELS: Record<string, string> = {
  basso: 'Rischio Basso (Livello 1)',
  medio: 'Rischio Medio (Livello 2)',
  alto: 'Rischio Alto (Livello 3)',
};

export async function GET(): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('codice_socio, name, surname, scout_group, service_role, is_medical_staff, fire_warden_level, static_group')
      .or('fire_warden_level.not.is.null,is_medical_staff.eq.true')
      .order('surname', { ascending: true });

    if (error) throw error;

    const rows = (data || []).map((p) => ({
      'Codice Socio': p.codice_socio || '',
      'Nome': p.name || '',
      'Cognome': p.surname || '',
      'Gruppo Scout': p.scout_group || '',
      'Ruolo Servizio': p.service_role || '',
      'Medico / Infermiere': p.is_medical_staff ? 'Sì' : 'No',
      'Addetto Antincendio': p.fire_warden_level ? (FIRE_WARDEN_LABELS[p.fire_warden_level] ?? p.fire_warden_level) : '',
      'Gruppo Statico': p.static_group || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 14 }, // Codice Socio
      { wch: 18 }, // Nome
      { wch: 22 }, // Cognome
      { wch: 25 }, // Gruppo Scout
      { wch: 22 }, // Ruolo Servizio
      { wch: 20 }, // Medico
      { wch: 30 }, // Antincendio
      { wch: 18 }, // Gruppo Statico
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Sicurezza');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Sicurezza_${date}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Errore GET /api/admin/safety-export:', error);
    return NextResponse.json({ error: 'Errore export' }, { status: 500 });
  }
}
