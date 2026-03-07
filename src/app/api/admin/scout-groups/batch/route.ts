import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/scout-groups/batch
 * Aggiorna l'elenco dei gruppi scout (admin only)
 */
export async function POST(request: Request) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verifica ruolo admin via Clerk
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const role = (clerkUser.publicMetadata as { role?: string })?.role;

        if (role !== 'admin' && role !== 'staff') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { groups } = body;

        if (!Array.isArray(groups)) {
            return NextResponse.json(
                { error: 'Formato non valido, atteso un array di stringhe' },
                { status: 400 }
            );
        }

        const uniqueGroups = Array.from(new Set(groups.map(g => g.trim()).filter(Boolean)));

        const supabase = createServiceRoleClient();

        // Inizia una transazione per rimpiazzare i gruppi
        // In Supabase REST API non c'è una transazione esplicita facilmente accessibile,
        // quindi eliminiamo tutti e ricreiamo, oppure facciamo upsert e delete.
        // Facciamo una semplice delete all e insert all per i gruppi scout.

        const { error: deleteError } = await supabase
            .from('scout_groups')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything

        if (deleteError) {
            throw deleteError;
        }

        if (uniqueGroups.length > 0) {
            const recordsToInsert = uniqueGroups.map(name => ({ name }));
            const { error: insertError } = await supabase
                .from('scout_groups')
                .insert(recordsToInsert);

            if (insertError) {
                throw insertError;
            }
        }

        return NextResponse.json({
            success: true,
            message: `${uniqueGroups.length} gruppi aggiornati con successo.`,
        });
    } catch (error) {
        console.error('Errore POST /api/admin/scout-groups/batch:', error);
        return NextResponse.json(
            { error: 'Errore nell\'aggiornamento dei gruppi scout' },
            { status: 500 }
        );
    }
}
