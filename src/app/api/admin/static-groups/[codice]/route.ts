import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ codice: string }>;
}

async function checkAdminRole(userId: string | null): Promise<{ isAuthorized: boolean; role?: string }> {
  if (!userId) return { isAuthorized: false };
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = (clerkUser.publicMetadata as { role?: string })?.role;
  return { isAuthorized: role === 'admin' || role === 'staff', role };
}

export async function PUT(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<any>>> {
  try {
    const { userId } = await auth();
    const { isAuthorized } = await checkAdminRole(userId);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { codice } = await params;
    const body = await request.json();
    const static_group = body.static_group; // CAN BE NULL IF REMOVING

    const supabase = createServiceRoleClient();

    // UPDATE participants table
    const { error: participantsError } = await supabase
      .from('participants')
      .update({ static_group, updated_at: new Date().toISOString() })
      .eq('codice', codice);

    if (participantsError) throw participantsError;

    // UPDATE profiles table
    await supabase
      .from('profiles')
      .update({ static_group, updated_at: new Date().toISOString() })
      .eq('codice_socio', codice);

    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    console.error(`Errore PUT /api/admin/static-groups/[codice]:`, error);
    return NextResponse.json(
      { error: 'Errore durante l\'aggiornamento del gruppo' },
      { status: 500 }
    );
  }
}
