import * as tus from 'tus-js-client';

/**
 * Upload TUS resumable verso Supabase Storage.
 *
 * iOS Safari interrompe le fetch monolitiche con body grandi (>~50 MB),
 * restituendo "Load failed" senza dettagli. TUS spezza il file in chunk
 * da 6 MB (richiesto da Supabase) inviati come richieste HTTP separate
 * con retry automatico sui chunk falliti.
 *
 * Auth: usa il JWT generato dal signing endpoint (firmato con
 * SUPABASE_JWT_SECRET). I JWT Clerk vengono rigettati dal servizio
 * Storage di Supabase con "signature verification failed" anche quando
 * sono accettati da PostgREST tramite integrazione third-party.
 */

const SUPABASE_CHUNK_SIZE = 6 * 1024 * 1024;

interface UploadFileOptions {
  file: File;
  bucket: string;
  path: string;
  authToken: string;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  contentType?: string;
}

export async function uploadFileResumable({
  file,
  bucket,
  path,
  authToken,
  onProgress,
  contentType,
}: UploadFileOptions): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Configurazione Supabase mancante');
  }

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      // authorization è settato solo in onBeforeRequest: XHR.setRequestHeader
      // concatena valori per lo stesso header, quindi settarlo qui
      // produrrebbe "Bearer X, Bearer Y" -> Invalid Compact JWS.
      headers: {
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
      onBeforeRequest: (req) => {
        req.setHeader('authorization', `Bearer ${authToken}`);
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
