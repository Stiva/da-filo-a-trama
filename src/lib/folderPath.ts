const SEGMENT_BLOCKLIST = new Set(['', '.', '..']);

export function sanitizeFolderPath(input: unknown): string {
  if (typeof input !== 'string') return '';
  const segments = input
    .split('/')
    .map((s) => s.trim())
    .filter((s) => !SEGMENT_BLOCKLIST.has(s));
  return segments.join('/');
}

export function splitFolderPath(path: string): string[] {
  return path === '' ? [] : path.split('/');
}

export function joinFolderPath(segments: string[]): string {
  return segments.filter((s) => !SEGMENT_BLOCKLIST.has(s)).join('/');
}

/**
 * Ritorna i nomi delle sottocartelle dirette di `currentPath`,
 * derivati da una lista di path completi (es. quelli salvati su `assets.folder_path`).
 */
export function directSubfolders(
  allPaths: Iterable<string>,
  currentPath: string,
): string[] {
  const prefix = currentPath === '' ? '' : currentPath + '/';
  const names = new Set<string>();
  for (const p of allPaths) {
    if (p === currentPath) continue;
    if (currentPath !== '' && !p.startsWith(prefix)) continue;
    const rest = currentPath === '' ? p : p.slice(prefix.length);
    if (!rest) continue;
    const slash = rest.indexOf('/');
    names.add(slash === -1 ? rest : rest.slice(0, slash));
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'it'));
}
