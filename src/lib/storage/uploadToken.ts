import { SignJWT } from 'jose';

/**
 * Firma un JWT di upload usando SUPABASE_JWT_SECRET.
 *
 * Necessario perché il flusso TUS resumable di Supabase Storage verifica
 * la firma del Bearer token con il JWT secret locale del progetto: i token
 * Clerk (che Postgres accetta via JWKS/integrazione third-party) vengono
 * rigettati da Storage con "signature verification failed".
 *
 * Il token è short-lived e contiene solo `sub` (clerk user id) + `role`.
 * Le RLS storage (migration 073) accettano `TO authenticated`.
 */

const DEFAULT_TTL_SECONDS = 60 * 60 * 2; // 2 ore

export async function signUploadToken(
  userId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET non configurato');
  }

  const secretKey = new TextEncoder().encode(secret);

  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey);
}
