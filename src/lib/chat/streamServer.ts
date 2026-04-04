import { StreamChat } from 'stream-chat';
import type { User } from '@clerk/nextjs/server';

export type AppRole = 'user' | 'staff' | 'admin';
export type StreamUserRole = 'user' | 'admin';

const getEnv = (keys: string[]): string => {
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }
  throw new Error(`Variabile ambiente mancante: ${keys.join(' oppure ')}`);
};

export const getStreamApiKey = (): string =>
  getEnv(['NEXT_PUBLIC_STREAM_CHAT_API_KEY', 'STREAM_API_KEY']);

export const createStreamServerClient = (): StreamChat => {
  const apiKey = getStreamApiKey();
  const apiSecret = getEnv(['STREAM_CHAT_API_SECRET', 'STREAM_SECRET_KEY']);
  return StreamChat.getInstance(apiKey, apiSecret);
};

export const getChatUserIdFromClerkId = (clerkId: string): string => {
  return `clerk_${clerkId}`;
};

export const getRoleFromPublicMetadata = (metadata: unknown): AppRole => {
  const role = (metadata as { role?: string } | null)?.role;
  if (role === 'admin' || role === 'staff') {
    return role;
  }
  return 'user';
};

export const mapAppRoleToStreamRole = (role: AppRole): StreamUserRole => {
  if (role === 'admin' || role === 'staff') {
    return 'admin';
  }
  return 'user';
};

export const buildChatDisplayName = (user: User): string => {
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (fullName) return fullName;
  if (user.username) return user.username;
  const email = user.emailAddresses?.[0]?.emailAddress;
  if (email) return email;
  return `Utente ${user.id.slice(0, 8)}`;
};

export const getActiveOrCreateSupportChannelId = async (params: {
  streamClient: StreamChat;
  customerUserId: string;
  customerDisplayName: string;
}): Promise<string> => {
  const { streamClient, customerUserId, customerDisplayName } = params;

  const existingChannels = await streamClient.queryChannels(
    {
      type: 'messaging',
      support_chat: true,
      members: { $in: [customerUserId] },
    } as any,
    { created_at: -1 },
    { limit: 1, watch: false, state: true }
  );

  let activeChannelId: string | null = null;
  let activeChannel = null;

  if (existingChannels.length > 0) {
    activeChannel = existingChannels[0];
    const lastActivity = (activeChannel.state?.last_message_at || activeChannel.data?.created_at) as string | Date | null | undefined;
    const isRecent = lastActivity && (new Date().getTime() - new Date(lastActivity).getTime() < 30 * 60 * 1000);

    if (isRecent && activeChannel.id) {
      activeChannelId = activeChannel.id;
    }
  }

  if (activeChannelId && activeChannel) {
    const channelData = (activeChannel.data || {}) as Record<string, unknown>;
    const currentStatus = (channelData.support_status as string | undefined) || '';
    if (!currentStatus) {
      await activeChannel.updatePartial({
        set: {
          support_chat: true,
          support_status: 'pending',
        } as Record<string, unknown>,
      });
    }
    return activeChannelId;
  }

  const newChannelId = `support_${customerUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
  const channelData = {
    name: `Supporto · ${customerDisplayName}`,
    members: [customerUserId],
    support_chat: true,
    support_status: 'pending',
    created_by_id: customerUserId,
  } as Record<string, unknown>;

  const channel = streamClient.channel('messaging', newChannelId, channelData);
  await channel.create();

  return newChannelId;
};
