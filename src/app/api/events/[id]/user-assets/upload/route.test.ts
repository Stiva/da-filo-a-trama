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

describe('POST /api/events/[id]/user-assets/upload', () => {
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

    const fromMock = vi.fn((table) => {
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };

      if (table === 'profiles') {
        queryBuilder.single = vi.fn().mockResolvedValue(profileMock);
      } else if (table === 'events') {
        queryBuilder.single = vi.fn().mockResolvedValue(eventMock);
      } else if (table === 'enrollments') {
        queryBuilder.single = vi.fn().mockResolvedValue(enrollmentMock);
      }

      return queryBuilder;
    });

    mockSupabase.from.mockImplementation(fromMock as any);

    mockSupabase.storage.from.mockReturnValue({
      createSignedUploadUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed', token: 'tok', path: 'user-uploads/event_123/profile_123/123_file.pdf' },
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/public.pdf' } }),
    } as any);
  };

  it('rejects unauthenticated requests', async () => {
    const { auth } = await import('@clerk/nextjs/server');
    (auth as any).mockReturnValueOnce({ userId: null });

    const request = createJsonRequest({ fileName: 'a.pdf', fileSize: 100, mimeType: 'application/pdf' });
    const response = await POST(request, { params: Promise.resolve({ id: 'event_123' }) });

    expect(response.status).toBe(401);
  });

  it('rejects invalid extension/mime', async () => {
    setupSupabaseMocks();
    const request = createJsonRequest({ fileName: 'malicious.exe', fileSize: 1024, mimeType: 'application/x-msdownload' });
    const response = await POST(request, { params: Promise.resolve({ id: 'event_123' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Tipo di file non consentito. Formati supportati: documenti, immagini, video e audio comuni.');
  });

  it('rejects files larger than 250MB', async () => {
    setupSupabaseMocks();
    const request = createJsonRequest({
      fileName: 'large_video.mp4',
      fileSize: 251 * 1024 * 1024,
      mimeType: 'video/mp4',
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'event_123' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('File troppo grande. Massimo 250MB.');
  });

  it('rejects when check-in is missing', async () => {
    setupSupabaseMocks(true, null);
    const request = createJsonRequest({ fileName: 'a.pdf', fileSize: 100, mimeType: 'application/pdf' });
    const response = await POST(request, { params: Promise.resolve({ id: 'event_123' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('check-in');
  });

  it('rejects when user uploads are disabled for the event', async () => {
    setupSupabaseMocks(false);
    const request = createJsonRequest({ fileName: 'a.pdf', fileSize: 100, mimeType: 'application/pdf' });
    const response = await POST(request, { params: Promise.resolve({ id: 'event_123' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('non e abilitato');
  });

  it('returns a signed URL for a valid 2h audio recording', async () => {
    setupSupabaseMocks();
    const request = createJsonRequest({
      fileName: 'registrazione.m4a',
      fileSize: 150 * 1024 * 1024,
      mimeType: 'audio/mp4',
    });
    const response = await POST(request, { params: Promise.resolve({ id: 'event_123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.signed_url).toBe('https://example.com/signed');
    expect(data.data.token).toBe('tok');
    expect(data.data.file_url).toBe('https://example.com/public.pdf');
    expect(data.data.file_name).toBe('registrazione.m4a');
    expect(data.data.mime_type).toBe('audio/mp4');
  });
});
