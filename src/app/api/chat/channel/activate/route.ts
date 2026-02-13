import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/database';
import { createStreamServerClient, getRoleFromPublicMetadata } from '@/lib/chat/streamServer';

/**
 * POST /api/chat/channel/activate
 * Segna una richiesta supporto come "active" quando un admin apre la chat.
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ ok: true }>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = getRoleFromPublicMetadata(clerkUser.publicMetadata);

    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as { channelId?: string };
    const channelId = body?.channelId;

    if (!channelId) {
      return NextResponse.json({ error: 'channelId mancante' }, { status: 400 });
    }

    const streamClient = createStreamServerClient();
    const channel = streamClient.channel('messaging', channelId);
    await channel.updatePartial({
      set: {
        support_status: 'active',
      } as Record<string, unknown>,
    });

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    console.error('Errore POST /api/chat/channel/activate:', error);
    return NextResponse.json(
      { error: 'Errore durante attivazione chat' },
      { status: 500 }
    );
  }
}
