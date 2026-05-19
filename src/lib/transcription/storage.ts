import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Genera un signed URL per il bucket "assets" partendo da un file_url
 * (public URL) o da uno storage path. AssemblyAI deve poter scaricare
 * l'audio senza autenticazione: il signed URL e' valido per pochi minuti.
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 4; // 4h: il provider potrebbe accodare per qualche tempo

const BUCKET = 'assets';
const PUBLIC_PREFIX_PATTERN = /\/storage\/v1\/object\/(?:public|sign)\/assets\/([^?]+)/;

export function extractStoragePath(fileUrl: string): string | null {
  try {
    const match = fileUrl.match(PUBLIC_PREFIX_PATTERN);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export async function createSignedAudioUrl(fileUrl: string): Promise<string> {
  const path = extractStoragePath(fileUrl);
  if (!path) {
    throw new Error(
      `Impossibile estrarre storage path da file_url: ${fileUrl}`,
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(
      `createSignedUrl fallito per ${path}: ${error?.message ?? 'no data'}`,
    );
  }

  return data.signedUrl;
}
