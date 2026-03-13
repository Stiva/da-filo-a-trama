import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getActiveOrCreateSupportChannelId } from './streamServer';
import { StreamChat } from 'stream-chat';

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
