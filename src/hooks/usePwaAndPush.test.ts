import { renderHook, act } from '@testing-library/react';
import { usePwaAndPush } from './usePwaAndPush';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('usePwaAndPush', () => {
  let mockUnsubscribe: any;
  let mockGetSubscription: any;
  let mockReady: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock console methods
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock global fetch
    global.fetch = vi.fn();

    // Setup default PushManager and ServiceWorker mocks
    mockUnsubscribe = vi.fn().mockResolvedValue(true);
    mockGetSubscription = vi.fn().mockResolvedValue({
      endpoint: 'https://push.example.com/123',
      unsubscribe: mockUnsubscribe,
    });
    mockReady = Promise.resolve({
      pushManager: {
        getSubscription: mockGetSubscription,
        subscribe: vi.fn(),
      },
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      value: {
        register: vi.fn().mockResolvedValue({
          scope: '/',
          pushManager: {
            getSubscription: mockGetSubscription,
          }
        }),
        ready: mockReady,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize correctly', () => {
    const { result } = renderHook(() => usePwaAndPush());
    expect(result.current.isInstalled).toBe(false);
  });

  describe('unsubscribeFromPush', () => {
    it('should log a warning if the API call to delete subscription fails', async () => {
      // Mock the API response to be not ok
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() => usePwaAndPush());

      // Wait for service worker to register
      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.unsubscribeFromPush();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/push-subscriptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://push.example.com/123' }),
      });
      expect(console.warn).toHaveBeenCalledWith("L'eliminazione via API è fallita o restituito un errore");
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should catch and log an error if unsubscribe throws', async () => {
      // Setup mockUnsubscribe to throw an error
      const mockError = new Error('Unsubscribe failed');
      const rejectMockUnsubscribe = vi.fn().mockRejectedValueOnce(mockError);

      const newMockReady = Promise.resolve({
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue({
            endpoint: 'https://push.example.com/123',
            unsubscribe: rejectMockUnsubscribe,
          }),
          subscribe: vi.fn(),
        },
      });

      Object.defineProperty(navigator, 'serviceWorker', {
        writable: true,
        value: {
          register: vi.fn().mockResolvedValue({
            scope: '/',
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue({
                endpoint: 'https://push.example.com/123',
                unsubscribe: rejectMockUnsubscribe,
              }),
            }
          }),
          ready: newMockReady,
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
      });

      const { result } = renderHook(() => usePwaAndPush());

      // Wait for service worker to register
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let errorThrown = false;
      await act(async () => {
        try {
          await result.current.unsubscribeFromPush();
        } catch (e) {
          errorThrown = true;
          expect(e).toBe(mockError);
        }
      });

      expect(errorThrown).toBe(true);
      expect(console.error).toHaveBeenCalledWith("Errore durante l'unsubscribe:", mockError);
    });
  });
});
