import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/scout-groups
 * Recupera tutti i gruppi
 */
export async function GET() {
    try {
        const supabase = createServiceRoleClient();
        const { data, error } = await supabase
            .from('scout_groups')
            .select('id, name')
            .order('name');

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Errore GET /api/admin/scout-groups:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero dei gruppi scout' },
            { status: 500 }
        );
    }
}
