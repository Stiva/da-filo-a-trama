import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => ({ userId: 'user_123' })),
}));

const mockSupabase = {
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => mockSupabase),
}));

describe('POST /api/events/[id]/user-assets (commit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createJsonRequest = (body: Record<string, unknown>) =>
    ({
      json: vi.fn().mockResolvedValue(body),
    } as unknown as Request);

  const setupSupabaseMocks = (
    userCanUploadAssets: boolean = true,
    checkedInAt: string | null = '2024-01-01T10:00:00Z'
  ) => {
    const profileMock = { data: { id: 'profile_123' }, error: null };
    const eventMock = { data: { id: 'event_123', user_can_upload_assets: userCanUploadAssets }, error: null };
    const enrollmentMock = { data: { id: 'enrollment_123', checked_in_at: checkedInAt }, error: null };
    const insertMock = { data: { id: 'asset_123', url: 'https://example.com/asset.m4a' }, error: null };

    const fromMock = vi.fn((table) => {
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        insert: vi.fn().mockReturnThis(),
      };

      if (table === 'profiles') {
        queryBuilder.single = vi.fn().mockResolvedValue(profileMock);
      } else if (table === 'events') {
        queryBuilder.single = vi.fn().mockResolvedValue(eventMock);
      } else if (table === 'enrollments') {
        queryBuilder.single = vi.fn().mockResolvedValue(enrollmentMock);
      } else if (table === 'user_event_assets') {
        queryBuilder.single = vi.fn().mockResolvedValue(insertMock);
      }

      return queryBuilder;
    });

    mockSupabase.from.mockImplementation(fromMock as any);
  };

  it('commits a file asset (post-upload) with valid metadata', async () => {
    setupSupabaseMocks();
    const request = createJsonRequest({
      type: 'file',
      url: 'https://example.com/asset.m4a',
      file_name: 'registrazione.m4a',
      file_size_bytes: 150 * 1024 * 1024,
      mime_type: 'audio/mp4',
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'event_123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('File caricato con successo');
  });

  it('rejects a file commit missing required metadata', async () => {
    setupSupabaseMocks();
    const request = createJsonRequest({ type: 'file', url: 'https://example.com/x' });
    const response = await POST(request, { params: Promise.resolve({ id: 'event_123' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('file_name');
  });

  it('commits a link asset', async () => {
    setupSupabaseMocks();
    const request = createJsonRequest({
      url: 'https://youtube.com/watch?v=x',
      title: 'Workshop',
      link_type: 'web',
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'event_123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Link aggiunto con successo');
  });

  it('rejects when check-in is missing', async () => {
    setupSupabaseMocks(true, null);
    const request = createJsonRequest({
      type: 'file',
      url: 'https://example.com/x',
      file_name: 'a.pdf',
      mime_type: 'application/pdf',
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'event_123' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('check-in');
  });
});
