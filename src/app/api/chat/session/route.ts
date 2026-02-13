import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/database';
import {
  buildChatDisplayName,
  createStreamServerClient,
  ensureSupportChannel,
  getChatUserIdFromClerkId,
  mapAppRoleToStreamRole,
  getRoleFromPublicMetadata,
  getStreamApiKey,
  getSupportChannelIdFromClerkId,
} from '@/lib/chat/streamServer';

interface ChatSessionPayload {
  apiKey: string;
  token: string;
  isAdmin: boolean;
  supportChannelId: string | null;
  user: {
    id: string;
    name: string;
    image?: string;
    role: 'user' | 'staff' | 'admin';
  };
}

/**
 * GET /api/chat/session
 * Crea sessione chat autenticata (Stream) per utente corrente.
 */
export async function GET(): Promise<NextResponse<ApiResponse<ChatSessionPayload>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = getRoleFromPublicMetadata(clerkUser.publicMetadata);

    const streamClient = createStreamServerClient();
    const streamUserId = getChatUserIdFromClerkId(userId);
    const streamDisplayName = buildChatDisplayName(clerkUser);
    const streamRole = mapAppRoleToStreamRole(role);

    await streamClient.upsertUser({
      id: streamUserId,
      name: streamDisplayName,
      image: clerkUser.imageUrl,
      role: streamRole,
    });

    let supportChannelId: string | null = null;

    if (role === 'user') {
      supportChannelId = getSupportChannelIdFromClerkId(userId);

      await ensureSupportChannel({
        streamClient,
        channelId: supportChannelId,
        customerUserId: streamUserId,
        customerDisplayName: streamDisplayName,
      });
    }

    const token = streamClient.createToken(streamUserId);

    return NextResponse.json({
      data: {
        apiKey: getStreamApiKey(),
        token,
        isAdmin: role === 'admin' || role === 'staff',
        supportChannelId,
        user: {
          id: streamUserId,
          name: streamDisplayName,
          image: clerkUser.imageUrl,
          role,
        },
      },
    });
  } catch (error) {
    console.error('Errore GET /api/chat/session:', error);
    const details = error instanceof Error ? error.message : 'Errore sconosciuto';
    return NextResponse.json(
      { error: `Errore durante la creazione della sessione chat: ${details}` },
      { status: 500 }
    );
  }
}
