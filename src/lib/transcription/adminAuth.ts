import { auth, clerkClient } from '@clerk/nextjs/server';

export interface AdminAuthOk {
  ok: true;
  userId: string;
  role: 'admin' | 'staff';
}

export interface AdminAuthFail {
  ok: false;
  status: 401 | 403;
  error: string;
}

export async function requireAdmin(): Promise<AdminAuthOk | AdminAuthFail> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = (user.publicMetadata as { role?: string })?.role;

  if (role !== 'admin' && role !== 'staff') {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true, userId, role };
}
