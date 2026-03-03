import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ServiceRoleRecord, ApiResponse } from '@/types/database';

/**
 * GET /api/admin/service-roles
 * Lista tutti i ruoli di servizio inclusi i non attivi (admin only)
 */
export async function GET(): Promise<NextResponse<ApiResponse<ServiceRoleRecord[]>>> {
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
            .from('service_roles')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) {
            throw error;
        }

        return NextResponse.json({ data: data as ServiceRoleRecord[] });
    } catch (error) {
        console.error('Errore GET /api/admin/service-roles:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero dei ruoli' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/service-roles
 * Crea un nuovo ruolo di servizio (admin only)
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<ServiceRoleRecord>>> {
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

        const body = await request.json();

        if (!body.name) {
            return NextResponse.json(
                { error: 'Nome richiesto' },
                { status: 400 }
            );
        }

        const supabase = createServiceRoleClient();

        const newRoleData = {
            name: body.name,
            display_order: body.display_order || 0,
            is_active: body.is_active !== false,
        };

        const { data, error } = await supabase
            .from('service_roles')
            .insert(newRoleData)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: 'Esiste già un ruolo con questo nome' },
                    { status: 400 }
                );
            }
            throw error;
        }

        return NextResponse.json({
            data: data as ServiceRoleRecord,
            message: 'Ruolo creato con successo',
        });
    } catch (error) {
        console.error('Errore POST /api/admin/service-roles:', error);
        return NextResponse.json(
            { error: 'Errore nella creazione del ruolo' },
            { status: 500 }
        );
    }
}
