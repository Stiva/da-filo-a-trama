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

export const getSupportChannelIdFromClerkId = (clerkId: string): string => {
  const safeId = clerkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `support_${safeId}`;
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

export const ensureSupportChannel = async (params: {
  streamClient: StreamChat;
  channelId: string;
  customerUserId: string;
  customerDisplayName: string;
  adminUserIds: string[];
}): Promise<void> => {
  const { streamClient, channelId, customerUserId, customerDisplayName, adminUserIds } = params;

  const existingChannels = await streamClient.queryChannels(
    {
      type: 'messaging',
      id: { $eq: channelId },
    },
    { created_at: -1 },
    { limit: 1, watch: false, state: true }
  );

  const members = Array.from(new Set([customerUserId, ...adminUserIds]));

  if (existingChannels.length === 0) {
    const channelData = {
      name: `Supporto · ${customerDisplayName}`,
      members,
      support_chat: true,
      support_status: 'pending',
      created_by_id: customerUserId,
    } as Record<string, unknown>;

    const channel = streamClient.channel('messaging', channelId, channelData);
    await channel.create();
    return;
  }

  const channel = existingChannels[0];
  const memberIds = Object.keys(channel.state?.members || {});
  const missingMembers = members.filter((memberId) => !memberIds.includes(memberId));

  if (missingMembers.length > 0) {
    await channel.addMembers(missingMembers);
  }

  const channelData = (channel.data || {}) as Record<string, unknown>;
  const currentStatus = (channelData.support_status as string | undefined) || '';
  if (!currentStatus) {
    await channel.updatePartial({
      set: {
        support_chat: true,
        support_status: 'pending',
      } as Record<string, unknown>,
    });
  }
};
