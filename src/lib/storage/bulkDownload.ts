import JSZip from 'jszip';
import type { Asset } from '@/types/database';

export interface EnrichedAsset extends Asset {
  uploader_name?: string | null;
  uploader_email?: string | null;
  event_title?: string | null;
  poi_name?: string | null;
}

export interface BulkDownloadProgress {
  phase: 'fetching' | 'zipping' | 'done';
  done: number;
  total: number;
  currentName?: string;
}

export interface BulkDownloadOptions {
  assets: EnrichedAsset[];
  zipName?: string;
  onProgress?: (progress: BulkDownloadProgress) => void;
  signal?: AbortSignal;
}

export interface BulkDownloadFailure {
  id: string;
  file_name: string;
  reason: string;
}

export interface BulkDownloadResult {
  blob: Blob;
  filename: string;
  totalCount: number;
  successCount: number;
  failures: BulkDownloadFailure[];
}

const CSV_HEADERS = [
  'percorso_zip',
  'id',
  'nome_file_originale',
  'titolo',
  'descrizione',
  'tipo',
  'visibilita',
  'evento',
  'punto_di_interesse',
  'cartella',
  'uploader',
  'uploader_email',
  'data_caricamento',
  'dimensione_bytes',
  'mime_type',
  'file_url',
  'stato_download',
  'errore',
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(rows: Array<Record<string, unknown>>): string {
  const header = CSV_HEADERS.join(',');
  const body = rows
    .map((row) => CSV_HEADERS.map((h) => csvEscape(row[h])).join(','))
    .join('\r\n');
  // UTF-8 BOM per compatibilita Excel
  return `﻿${header}\r\n${body}\r\n`;
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || '_';
}

function buildZipPath(asset: EnrichedAsset, taken: Set<string>): string {
  const folder = (asset.folder_path || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(sanitizeSegment)
    .join('/');
  const baseName = sanitizeSegment(asset.file_name || `${asset.id}`);
  const candidate = folder ? `${folder}/${baseName}` : baseName;
  if (!taken.has(candidate)) {
    taken.add(candidate);
    return candidate;
  }
  const dot = baseName.lastIndexOf('.');
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot > 0 ? baseName.slice(dot) : '';
  const suffix = asset.id.slice(0, 8);
  const unique = folder
    ? `${folder}/${stem}__${suffix}${ext}`
    : `${stem}__${suffix}${ext}`;
  taken.add(unique);
  return unique;
}

function buildReadme(
  total: number,
  success: number,
  failures: BulkDownloadFailure[]
): string {
  const lines: string[] = [];
  lines.push('Da Filo a Trama - Esportazione massiva asset');
  lines.push(`Data generazione: ${new Date().toISOString()}`);
  lines.push(`Totale asset richiesti: ${total}`);
  lines.push(`Scaricati con successo: ${success}`);
  lines.push(`Falliti: ${failures.length}`);
  lines.push('');
  lines.push(
    'Il file manifest.csv contiene tutti i metadati associati ai documenti.'
  );
  lines.push(
    'I file sono organizzati secondo la cartella logica (folder_path) configurata in piattaforma.'
  );
  if (failures.length > 0) {
    lines.push('');
    lines.push('Asset NON scaricati:');
    for (const f of failures) {
      lines.push(`  - [${f.id}] ${f.file_name}: ${f.reason}`);
    }
  }
  return lines.join('\r\n');
}

async function fetchAsBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(url, { signal, credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.blob();
}

/**
 * Costruisce uno ZIP con i file degli asset forniti + un manifest.csv con
 * tutti i metadati (uploader, evento, POI, visibilita, ecc.).
 *
 * Gli asset di tipo `link` non hanno un file da scaricare: vengono comunque
 * elencati nel manifest con il loro URL e segnati come "solo_link".
 */
export async function buildAssetsZip(
  options: BulkDownloadOptions
): Promise<BulkDownloadResult> {
  const { assets, onProgress, signal } = options;
  const zip = new JSZip();
  const failures: BulkDownloadFailure[] = [];
  const manifestRows: Array<Record<string, unknown>> = [];
  const takenPaths = new Set<string>();
  let success = 0;

  const total = assets.length;
  onProgress?.({ phase: 'fetching', done: 0, total });

  for (let i = 0; i < assets.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const asset = assets[i];
    const isLink = asset.tipo === 'link';
    let zipPath = '';
    let status = 'ok';
    let errorMsg = '';

    if (isLink) {
      status = 'solo_link';
    } else {
      zipPath = buildZipPath(asset, takenPaths);
      try {
        const blob = await fetchAsBlob(asset.file_url, signal);
        zip.file(zipPath, blob);
        success += 1;
      } catch (err) {
        status = 'errore';
        errorMsg = err instanceof Error ? err.message : String(err);
        failures.push({
          id: asset.id,
          file_name: asset.file_name,
          reason: errorMsg,
        });
      }
    }

    manifestRows.push({
      percorso_zip: zipPath,
      id: asset.id,
      nome_file_originale: asset.file_name,
      titolo: asset.title,
      descrizione: asset.description,
      tipo: asset.tipo,
      visibilita: asset.visibilita,
      evento: asset.event_title ?? '',
      punto_di_interesse: asset.poi_name ?? '',
      cartella: asset.folder_path ?? '',
      uploader: asset.uploader_name ?? '',
      uploader_email: asset.uploader_email ?? '',
      data_caricamento: asset.created_at,
      dimensione_bytes: asset.file_size_bytes ?? '',
      mime_type: asset.mime_type ?? '',
      file_url: asset.file_url,
      stato_download: status,
      errore: errorMsg,
    });

    onProgress?.({
      phase: 'fetching',
      done: i + 1,
      total,
      currentName: asset.file_name,
    });
  }

  zip.file('manifest.csv', buildCsv(manifestRows));
  zip.file('README.txt', buildReadme(total, success, failures));

  onProgress?.({ phase: 'zipping', done: total, total });
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  onProgress?.({ phase: 'done', done: total, total });

  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filename = `${options.zipName ?? 'assets'}_${ts}.zip`;

  return {
    blob,
    filename,
    totalCount: total,
    successCount: success,
    failures,
  };
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
