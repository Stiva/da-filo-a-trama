import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextResponse } from 'next/server';

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => ({ userId: 'user_123' })),
}));

const mockSupabase = {
  from: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/asset.png' } })),
    })),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => mockSupabase),
}));

describe('POST /api/events/[id]/user-assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (name: string, type: string, size: number) => {
    const file = new File(['dummy content'], name, { type });
    Object.defineProperty(file, 'size', { value: size });

    // Mock formData to avoid Next.js / Undici issues in Node.js test environment
    const formDataMock = new FormData();
    formDataMock.append('file', file);

    return {
      formData: vi.fn().mockResolvedValue(formDataMock),
      headers: new Headers({
        'content-type': 'multipart/form-data; boundary=---boundary',
      }),
    } as unknown as Request;
  };

  const setupSupabaseMocks = (
    userCanUploadAssets: boolean = true,
    checkedInAt: string | null = '2024-01-01T10:00:00Z'
  ) => {
    // 1. mock per 'profiles'
    const profileMock = { data: { id: 'profile_123' }, error: null };
    // 2. mock per 'events'
    const eventMock = { data: { id: 'event_123', user_can_upload_assets: userCanUploadAssets }, error: null };
    // 3. mock per 'enrollments'
    const enrollmentMock = { data: { id: 'enrollment_123', checked_in_at: checkedInAt }, error: null };
    // 4. mock per 'user_event_assets' insert
    const insertMock = { data: { id: 'asset_123', url: 'https://example.com/asset.png' }, error: null };

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

    mockSupabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'path/to/file' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/asset.png' } }),
    } as any);
  };

  it('should reject a file with an invalid extension and mime type', async () => {
    setupSupabaseMocks();
    const request = createMockRequest('malicious.exe', 'application/x-msdownload', 1024);

    const params = Promise.resolve({ id: 'event_123' });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Tipo di file non consentito. Formati supportati: documenti, immagini, video e audio comuni.');
  });

  it('should allow a file with a valid extension and mime type (e.g., pdf)', async () => {
    setupSupabaseMocks();
    const request = createMockRequest('document.pdf', 'application/pdf', 1024);

    const params = Promise.resolve({ id: 'event_123' });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('File caricato con successo');
  });

  it('should allow a file with a valid extension and mime type (e.g., png)', async () => {
    setupSupabaseMocks();
    const request = createMockRequest('image.png', 'image/png', 1024);

    const params = Promise.resolve({ id: 'event_123' });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('File caricato con successo');
  });

  it('should reject files that are too large (>50MB)', async () => {
    setupSupabaseMocks();
    const request = createMockRequest('large_video.mp4', 'video/mp4', 51 * 1024 * 1024); // 51MB

    const params = Promise.resolve({ id: 'event_123' });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('File troppo grande. Massimo 50MB.');
  });
});
