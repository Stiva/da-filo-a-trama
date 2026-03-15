import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getActiveOrCreateSupportChannelId,
  getStreamApiKey,
  getChatUserIdFromClerkId,
  getRoleFromPublicMetadata,
  mapAppRoleToStreamRole,
  buildChatDisplayName
} from './streamServer';
import { StreamChat } from 'stream-chat';
import type { User } from '@clerk/nextjs/server';

describe('getActiveOrCreateSupportChannelId', () => {
  const mockCustomerUserId = 'user_123';
  const mockCustomerDisplayName = 'Test User';

  let mockStreamClient: Partial<StreamChat>;
  let mockQueryChannels: ReturnType<typeof vi.fn>;
  let mockChannel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));

    mockQueryChannels = vi.fn();
    mockChannel = vi.fn();

    mockStreamClient = {
      queryChannels: mockQueryChannels as unknown as StreamChat['queryChannels'],
      channel: mockChannel as unknown as StreamChat['channel'],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should return the existing channel ID if there is a recent active channel', async () => {
    const mockChannelId = 'existing_channel_123';

    mockQueryChannels.mockResolvedValueOnce([
      {
        id: mockChannelId,
        state: { last_message_at: new Date('2024-01-01T11:45:00.000Z') }, // 15 mins ago
        data: { support_status: 'pending' },
      }
    ]);

    const result = await getActiveOrCreateSupportChannelId({
      streamClient: mockStreamClient as StreamChat,
      customerUserId: mockCustomerUserId,
      customerDisplayName: mockCustomerDisplayName,
    });

    expect(result).toBe(mockChannelId);
    expect(mockQueryChannels).toHaveBeenCalledWith(
      {
        type: 'messaging',
        support_chat: true,
        created_by_id: mockCustomerUserId,
      },
      { created_at: -1 },
      { limit: 1, watch: false, state: true }
    );
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it('should update channel status to pending if recent active channel has no status', async () => {
    const mockChannelId = 'existing_channel_456';
    const mockUpdatePartial = vi.fn().mockResolvedValueOnce({});

    mockQueryChannels.mockResolvedValueOnce([
      {
        id: mockChannelId,
        state: { last_message_at: new Date('2024-01-01T11:55:00.000Z') }, // 5 mins ago
        data: { support_status: '' }, // No status
        updatePartial: mockUpdatePartial,
      }
    ]);

    const result = await getActiveOrCreateSupportChannelId({
      streamClient: mockStreamClient as StreamChat,
      customerUserId: mockCustomerUserId,
      customerDisplayName: mockCustomerDisplayName,
    });

    expect(result).toBe(mockChannelId);
    expect(mockUpdatePartial).toHaveBeenCalledWith({
      set: {
        support_chat: true,
        support_status: 'pending',
      }
    });
  });

  it('should create a new channel if no existing channel is found', async () => {
    const mockCreate = vi.fn().mockResolvedValueOnce({});
    mockChannel.mockReturnValueOnce({ create: mockCreate });
    mockQueryChannels.mockResolvedValueOnce([]); // No channels

    // Fake Date.now() for predictable channel ID
    const fakeNow = new Date('2024-01-01T12:00:00.000Z').getTime();
    const expectedNewChannelId = `support_${mockCustomerUserId}_${fakeNow}`;

    const result = await getActiveOrCreateSupportChannelId({
      streamClient: mockStreamClient as StreamChat,
      customerUserId: mockCustomerUserId,
      customerDisplayName: mockCustomerDisplayName,
    });

    expect(result).toBe(expectedNewChannelId);
    expect(mockChannel).toHaveBeenCalledWith('messaging', expectedNewChannelId, {
      name: `Supporto · ${mockCustomerDisplayName}`,
      members: [mockCustomerUserId],
      support_chat: true,
      support_status: 'pending',
      created_by_id: mockCustomerUserId,
    });
    expect(mockCreate).toHaveBeenCalled();
  });

  it('should create a new channel if existing channel is too old (> 30 mins)', async () => {
    const mockChannelId = 'old_channel_789';
    const mockCreate = vi.fn().mockResolvedValueOnce({});
    mockChannel.mockReturnValueOnce({ create: mockCreate });

    mockQueryChannels.mockResolvedValueOnce([
      {
        id: mockChannelId,
        state: { last_message_at: new Date('2024-01-01T11:00:00.000Z') }, // 60 mins ago
        data: { support_status: 'pending' },
      }
    ]);

    const fakeNow = new Date('2024-01-01T12:00:00.000Z').getTime();
    const expectedNewChannelId = `support_${mockCustomerUserId}_${fakeNow}`;

    const result = await getActiveOrCreateSupportChannelId({
      streamClient: mockStreamClient as StreamChat,
      customerUserId: mockCustomerUserId,
      customerDisplayName: mockCustomerDisplayName,
    });

    expect(result).toBe(expectedNewChannelId);
    expect(mockChannel).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
  });

  it('should handle channels with no state.last_message_at falling back to data.created_at', async () => {
    const mockChannelId = 'fallback_channel';

    mockQueryChannels.mockResolvedValueOnce([
      {
        id: mockChannelId,
        state: {}, // No last_message_at
        data: {
          created_at: new Date('2024-01-01T11:45:00.000Z'), // 15 mins ago
          support_status: 'pending'
        },
      }
    ]);

    const result = await getActiveOrCreateSupportChannelId({
      streamClient: mockStreamClient as StreamChat,
      customerUserId: mockCustomerUserId,
      customerDisplayName: mockCustomerDisplayName,
    });

    expect(result).toBe(mockChannelId);
  });
});

describe('streamServer functions', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset process.env to original state
    for (const key in process.env) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    // Final restore
    for (const key in process.env) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  describe('getStreamApiKey', () => {
    it('should return NEXT_PUBLIC_STREAM_CHAT_API_KEY if present', () => {
      process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY = 'public-key';
      process.env.STREAM_API_KEY = 'private-key';
      expect(getStreamApiKey()).toBe('public-key');
    });

    it('should return STREAM_API_KEY if NEXT_PUBLIC_STREAM_CHAT_API_KEY is missing', () => {
      delete process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY;
      process.env.STREAM_API_KEY = 'private-key';
      expect(getStreamApiKey()).toBe('private-key');
    });

    it('should throw an error if both environment variables are missing', () => {
      delete process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY;
      delete process.env.STREAM_API_KEY;
      expect(() => getStreamApiKey()).toThrow('Variabile ambiente mancante: NEXT_PUBLIC_STREAM_CHAT_API_KEY oppure STREAM_API_KEY');
    });
  });

  describe('getChatUserIdFromClerkId', () => {
    it('should return prefixed clerk ID', () => {
      expect(getChatUserIdFromClerkId('123')).toBe('clerk_123');
    });
  });

  describe('getRoleFromPublicMetadata', () => {
    it('should return "admin" if role is admin', () => {
      expect(getRoleFromPublicMetadata({ role: 'admin' })).toBe('admin');
    });

    it('should return "staff" if role is staff', () => {
      expect(getRoleFromPublicMetadata({ role: 'staff' })).toBe('staff');
    });

    it('should return "user" for other roles', () => {
      expect(getRoleFromPublicMetadata({ role: 'other' })).toBe('user');
    });

    it('should return "user" if role is missing', () => {
      expect(getRoleFromPublicMetadata({})).toBe('user');
      expect(getRoleFromPublicMetadata(null)).toBe('user');
    });
  });

  describe('mapAppRoleToStreamRole', () => {
    it('should return "admin" for admin role', () => {
      expect(mapAppRoleToStreamRole('admin')).toBe('admin');
    });

    it('should return "admin" for staff role', () => {
      expect(mapAppRoleToStreamRole('staff')).toBe('admin');
    });

    it('should return "user" for user role', () => {
      expect(mapAppRoleToStreamRole('user')).toBe('user');
    });
  });

  describe('buildChatDisplayName', () => {
    it('should use full name if present', () => {
      const user = { firstName: 'Mario', lastName: 'Rossi' } as User;
      expect(buildChatDisplayName(user)).toBe('Mario Rossi');
    });

    it('should use firstName if lastName is missing', () => {
      const user = { firstName: 'Mario' } as User;
      expect(buildChatDisplayName(user)).toBe('Mario');
    });

    it('should use username if full name is missing', () => {
      const user = { username: 'mariorossi' } as User;
      expect(buildChatDisplayName(user)).toBe('mariorossi');
    });

    it('should use email if name and username are missing', () => {
      const user = { emailAddresses: [{ emailAddress: 'mario@example.com' }] } as User;
      expect(buildChatDisplayName(user)).toBe('mario@example.com');
    });

    it('should fallback to User + ID if everything else is missing', () => {
      const user = { id: 'user_1234567890' } as User;
      expect(buildChatDisplayName(user)).toBe('Utente user_123');
    });
  });
});
