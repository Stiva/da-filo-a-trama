import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/database';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateAvatarDataUri } from '@/lib/avatar';
import {
  buildChatDisplayName,
  createStreamServerClient,
  getActiveOrCreateSupportChannelId,
  getChatUserIdFromClerkId,
  mapAppRoleToStreamRole,
  getRoleFromPublicMetadata,
  getStreamApiKey,
} from '@/lib/chat/streamServer';

interface ChatSessionPayload {
  apiKey: string;
  token: string;
  isAdmin: boolean;
  chatEnabled: boolean;
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

    const supabase = await createServerSupabaseClient();
    const [{ data: profile }, { data: chatSetting }] = await Promise.all([
      supabase.from('profiles').select('profile_image_url, avatar_config').eq('clerk_id', userId).single(),
      supabase.from('app_settings').select('value').eq('key', 'service_chat_enabled').single(),
    ]);

    const isAdminOrStaff = role === 'admin' || role === 'staff';
    const chatEnabled: boolean = isAdminOrStaff || (chatSetting?.value === true || chatSetting?.value === 'true');

    const streamClient = createStreamServerClient();
    const streamUserId = getChatUserIdFromClerkId(userId);
    const streamDisplayName = buildChatDisplayName(clerkUser);
    const streamRole = mapAppRoleToStreamRole(role);

    const appAvatar =
      profile?.profile_image_url ||
      (profile?.avatar_config ? generateAvatarDataUri(profile?.avatar_config) : undefined) ||
      clerkUser.imageUrl;

    await streamClient.upsertUser({
      id: streamUserId,
      name: streamDisplayName,
      image: appAvatar,
      role: streamRole,
    });

    const supportChannelId = chatEnabled
      ? await getActiveOrCreateSupportChannelId({
          streamClient,
          customerUserId: streamUserId,
          customerDisplayName: streamDisplayName,
        })
      : null;

    const token = streamClient.createToken(streamUserId);

    return NextResponse.json({
      data: {
        apiKey: getStreamApiKey(),
        token,
        isAdmin: isAdminOrStaff,
        chatEnabled,
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
