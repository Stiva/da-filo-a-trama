import type { Asset, AssetType } from '@/types/database';

export interface FolderNode {
  kind: 'folder';
  name: string;
  path: string;
  children: FolderNode[];
  files: Asset[];
}

const collator = new Intl.Collator('it', { sensitivity: 'base' });

/**
 * Costruisce l'albero delle cartelle a partire dalla lista flat di asset.
 * Ogni FolderNode contiene le sottocartelle dirette e i file diretti.
 * I nodi root sono le cartelle di primo livello + un eventuale folder
 * sintetico per i file al root path (gestito separatamente dal chiamante).
 */
export function buildTree(assets: Asset[]): {
  rootFiles: Asset[];
  rootFolders: FolderNode[];
} {
  const root: FolderNode = {
    kind: 'folder',
    name: '',
    path: '',
    children: [],
    files: [],
  };

  const folderMap = new Map<string, FolderNode>();
  folderMap.set('', root);

  const ensureFolder = (path: string): FolderNode => {
    const existing = folderMap.get(path);
    if (existing) return existing;
    const segments = path.split('/');
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join('/');
    const parent = ensureFolder(parentPath);
    const node: FolderNode = {
      kind: 'folder',
      name,
      path,
      children: [],
      files: [],
    };
    parent.children.push(node);
    folderMap.set(path, node);
    return node;
  };

  for (const asset of assets) {
    const path = asset.folder_path ?? '';
    const folder = ensureFolder(path);
    folder.files.push(asset);
  }

  // Ordina ricorsivamente: cartelle alfabetiche, file per sort_order poi nome.
  const sortNode = (node: FolderNode) => {
    node.children.sort((a, b) => collator.compare(a.name, b.name));
    node.files.sort((a, b) => {
      const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (so !== 0) return so;
      const an = (a.title || a.file_name) ?? '';
      const bn = (b.title || b.file_name) ?? '';
      return collator.compare(an, bn);
    });
    node.children.forEach(sortNode);
  };
  sortNode(root);

  return { rootFiles: root.files, rootFolders: root.children };
}

export type FilterValue = 'all' | AssetType;

/**
 * Filtra l'albero per tipo di file. Le cartelle vengono mantenute solo se
 * contengono (anche transitivamente) almeno un file matching. Restituisce
 * una nuova struttura, non muta l'input.
 */
export function filterTree(
  rootFiles: Asset[],
  rootFolders: FolderNode[],
  filter: FilterValue,
): { rootFiles: Asset[]; rootFolders: FolderNode[] } {
  if (filter === 'all') return { rootFiles, rootFolders };

  const matchFile = (a: Asset) => a.tipo === filter;

  const filterFolder = (node: FolderNode): FolderNode | null => {
    const files = node.files.filter(matchFile);
    const children = node.children
      .map(filterFolder)
      .filter((c): c is FolderNode => c !== null);
    if (files.length === 0 && children.length === 0) return null;
    return { ...node, files, children };
  };

  return {
    rootFiles: rootFiles.filter(matchFile),
    rootFolders: rootFolders
      .map(filterFolder)
      .filter((c): c is FolderNode => c !== null),
  };
}

/**
 * Tutti i path discendenti (incluso il folder stesso). Utile per forzare
 * l'expand di tutti i nodi quando un filtro e' attivo.
 */
export function collectAllFolderPaths(folders: FolderNode[]): string[] {
  const out: string[] = [];
  const walk = (n: FolderNode) => {
    out.push(n.path);
    n.children.forEach(walk);
  };
  folders.forEach(walk);
  return out;
}
