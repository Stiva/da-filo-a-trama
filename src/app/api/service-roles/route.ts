import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse, ServiceRoleRecord } from '@/types/database';

/**
 * GET /api/service-roles
 * Recupera tutti i ruoli di servizio attivi
 * Questa API può essere chiamata da qualsiasi utente autenticato 
 * durante la fase di onboarding / modifica profilo.
 */
export async function GET(): Promise<NextResponse<ApiResponse<ServiceRoleRecord[]>>> {
    try {
        const supabase = createServiceRoleClient();

        // RLS Policy says everyone can read active roles
        const { data, error } = await supabase
            .from('service_roles')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) {
            throw error;
        }

        return NextResponse.json({ data: data as ServiceRoleRecord[] });
    } catch (error) {
        console.error('Errore GET /api/service-roles:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero dei ruoli di servizio' },
            { status: 500 }
        );
    }
}
