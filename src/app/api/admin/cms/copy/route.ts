import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidateCmsCopy } from '@/lib/cms/revalidate';

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId) return { error: 'Unauthorized', status: 401 as const };
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = (user.publicMetadata as { role?: string })?.role;
  if (role !== 'admin' && role !== 'staff') {
    return { error: 'Forbidden', status: 403 as const };
  }
  return { userId };
}

function namespaceFromKey(key: string): string | null {
  const dot = key.indexOf('.');
  return dot === -1 ? null : key.slice(0, dot);
}

export async function GET(request: Request) {
  const guard = await assertAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { searchParams } = new URL(request.url);
  const namespace = searchParams.get('namespace');
  const locale = searchParams.get('locale');

  const supabase = createServiceRoleClient();
  let query = supabase.from('cms_copy').select('*').order('key', { ascending: true });
  if (namespace) query = query.eq('namespace', namespace);
  if (locale) query = query.eq('locale', locale);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const guard = await assertAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: {
    key?: string;
    locale?: string;
    value?: string;
    description?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const key = body.key?.trim();
  const value = body.value;
  const locale = body.locale?.trim() || 'it';

  if (!key || typeof value !== 'string') {
    return NextResponse.json(
      { error: 'key e value sono obbligatori' },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9_]+(\.[a-z0-9_]+)*$/.test(key)) {
    return NextResponse.json(
      { error: "key non valida (usa segmenti lowercase separati da punto)" },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();

  // updated_by → profile id dall'utente Clerk corrente
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', guard.userId)
    .maybeSingle();

  const { data, error } = await supabase
    .from('cms_copy')
    .upsert(
      {
        key,
        locale,
        value,
        namespace: namespaceFromKey(key),
        description: body.description ?? null,
        updated_by: profile?.id ?? null,
      },
      { onConflict: 'key,locale' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidateCmsCopy();
  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const guard = await assertAdmin();
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const locale = searchParams.get('locale') || 'it';

  if (!key) {
    return NextResponse.json({ error: 'key obbligatoria' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('cms_copy')
    .delete()
    .eq('key', key)
    .eq('locale', locale);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidateCmsCopy();
  return NextResponse.json({ ok: true });
}
