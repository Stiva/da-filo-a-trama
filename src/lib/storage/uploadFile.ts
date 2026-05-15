import * as tus from 'tus-js-client';

/**
 * Upload TUS resumable verso Supabase Storage.
 *
 * iOS Safari interrompe le fetch monolitiche con body grandi (>~50 MB),
 * restituendo "Load failed" senza dettagli. TUS spezza il file in chunk
 * da 6 MB (richiesto da Supabase) inviati come richieste HTTP separate
 * con retry automatico sui chunk falliti.
 *
 * Auth: usa il JWT Clerk con template 'supabase'. Il token Clerk dura
 * ~60 secondi quindi viene rifatto prima di ogni richiesta via
 * onBeforeRequest, evitando 401 a metà upload.
 */

const SUPABASE_CHUNK_SIZE = 6 * 1024 * 1024;

interface UploadFileOptions {
  file: File;
  bucket: string;
  path: string;
  getAuthToken: () => Promise<string | null>;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  contentType?: string;
}

export async function uploadFileResumable({
  file,
  bucket,
  path,
  getAuthToken,
  onProgress,
  contentType,
}: UploadFileOptions): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Configurazione Supabase mancante');
  }

  const initialToken = await getAuthToken();
  if (!initialToken) {
    throw new Error('Sessione non valida. Effettua di nuovo il login.');
  }

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${initialToken}`,
        'x-upsert': 'false',
        apikey: anonKey,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: contentType || file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: SUPABASE_CHUNK_SIZE,
      onBeforeRequest: async (req) => {
        const fresh = await getAuthToken();
        if (fresh) {
          req.setHeader('authorization', `Bearer ${fresh}`);
        }
      },
      onError: (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
      onProgress: onProgress,
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    }).catch(reject);
  });
}
