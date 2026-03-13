import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  getStreamApiKey,
  getChatUserIdFromClerkId,
  getRoleFromPublicMetadata,
  mapAppRoleToStreamRole,
  buildChatDisplayName
} from './streamServer';
import type { User } from '@clerk/nextjs/server';

describe('streamServer', () => {
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
