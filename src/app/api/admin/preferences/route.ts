import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
        }

        const supabase = createServiceRoleClient();
        const { data, error } = await supabase
            .from('profiles')
            .select('admin_ui_preferences')
            .eq('clerk_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ data: { tables: {} } });
            }
            throw error;
        }

        return NextResponse.json({ data: data.admin_ui_preferences || { tables: {} } });
    } catch (error) {
        console.error('Errore GET /api/admin/preferences:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
        }

        const body = await request.json();
        
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Payload non valido' }, { status: 400 });
        }

        const supabase = createServiceRoleClient();
        
        // Prima leggiamo le preferenze attuali (per evitare di sovrascrivere tutto)
        const { data: currentData } = await supabase
            .from('profiles')
            .select('admin_ui_preferences')
            .eq('clerk_id', userId)
            .single();
            
        const currentPrefs = currentData?.admin_ui_preferences || { tables: {} };
        
        // Eseguiamo un merge profondo per le tables
        const newPrefs = {
            ...currentPrefs,
            tables: {
                ...(currentPrefs.tables || {}),
                ...(body.tables || {})
            }
        };

        const { error } = await supabase
            .from('profiles')
            .update({ admin_ui_preferences: newPrefs, updated_at: new Date().toISOString() })
            .eq('clerk_id', userId);

        if (error) throw error;

        return NextResponse.json({ success: true, data: newPrefs });
    } catch (error) {
        console.error('Errore PUT /api/admin/preferences:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
