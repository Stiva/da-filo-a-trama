'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import DocumentsTree from '@/components/DocumentsTree';
import type { Asset, AssetType } from '@/types/database';
import type { FilterValue } from '@/lib/buildTree';

const TYPE_ICONS: Record<AssetType, string> = {
  pdf: '📄',
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  document: '📝',
  link: '🔗',
};

const TYPE_LABELS: Record<FilterValue, string> = {
  all: 'Tutti',
  pdf: 'PDF',
  image: 'Immagini',
  video: 'Video',
  audio: 'Audio',
  document: 'Documenti',
  link: 'Link',
};

interface DragData {
  kind: 'file' | 'folder';
  id: string;
  folderPath?: string;
}

interface DropData {
  targetPath: string;
}

const COLLAPSED_STORAGE_KEY = 'documents-tree-collapsed-v1';

function readCollapsed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((p) => typeof p === 'string'));
  } catch {
    /* ignore */
  }
  return new Set();
}

export default function DocumentsPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const role = (user?.publicMetadata as { role?: string } | undefined)?.role;
  const isAdmin = userLoaded && (role === 'admin' || role === 'staff');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // Hydrate collapsed state from localStorage
  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  // Persist collapsed state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        COLLAPSED_STORAGE_KEY,
        JSON.stringify([...collapsed]),
      );
    } catch {
      /* ignore quota */
    }
  }, [collapsed]);

  const fetchAssets = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/documents', { signal });
      const result = await response.json();
      if (response.ok && result.data) {
        setAssets(result.data.assets ?? []);
      } else {
        setError(result.error || 'Errore nel caricamento');
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      console.error('Errore caricamento documenti:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchAssets(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchAssets]);

  const toggleCollapsed = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // ---- Drag & drop -------------------------------------------------------

  const showToast = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const expandFolder = useCallback((path: string) => {
    setCollapsed((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const moveFile = useCallback(
    async (assetId: string, targetPath: string) => {
      setIsMutating(true);
      try {
        const res = await fetch(`/api/admin/assets/${assetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder_path: targetPath }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Errore spostamento');
        showToast('ok', `File spostato in /${targetPath || ''}`);
        expandFolder(targetPath);
        await fetchAssets();
      } catch (err) {
        showToast('err', err instanceof Error ? err.message : 'Errore');
      } finally {
        setIsMutating(false);
      }
    },
    [expandFolder, fetchAssets, showToast],
  );

  const moveFolder = useCallback(
    async (fromPath: string, targetParent: string) => {
      const name = fromPath.split('/').pop() ?? fromPath;
      const toPath = targetParent ? `${targetParent}/${name}` : name;
      if (toPath === fromPath) return;
      if (toPath === fromPath || toPath.startsWith(fromPath + '/')) {
        showToast('err', 'Non puoi spostare una cartella dentro se stessa');
        return;
      }
      setIsMutating(true);
      try {
        const res = await fetch('/api/admin/folders/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: fromPath, to: toPath }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Errore spostamento');
        showToast('ok', `Cartella spostata: ${result.data?.moved ?? 0} file aggiornati`);
        expandFolder(targetParent);
        expandFolder(toPath);
        await fetchAssets();
      } catch (err) {
        showToast('err', err instanceof Error ? err.message : 'Errore');
      } finally {
        setIsMutating(false);
      }
    },
    [expandFolder, fetchAssets, showToast],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
    setOverTarget(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const target = (event.over?.data.current as DropData | undefined)?.targetPath;
    setOverTarget(target ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const drag = event.active.data.current as DragData | undefined;
      const drop = event.over?.data.current as DropData | undefined;
      setActiveDragId(null);
      setOverTarget(null);
      if (!drag || !drop) return;

      const target = drop.targetPath;

      if (drag.kind === 'file') {
        const file = assets.find((f) => f.id === drag.id);
        if (file && (file.folder_path ?? '') === target) return;
        void moveFile(drag.id, target);
      } else if (drag.kind === 'folder' && drag.folderPath !== undefined) {
        if (drag.folderPath === target) return;
        if (target === drag.folderPath || target.startsWith(drag.folderPath + '/')) {
          showToast('err', 'Non puoi spostare una cartella dentro se stessa');
          return;
        }
        const currentParent = drag.folderPath.includes('/')
          ? drag.folderPath.slice(0, drag.folderPath.lastIndexOf('/'))
          : '';
        if (currentParent === target) return;
        void moveFolder(drag.folderPath, target);
      }
    },
    [assets, moveFile, moveFolder, showToast],
  );

  // ---- Render ------------------------------------------------------------

  const availableFilters: FilterValue[] = [
    'all',
    ...(Array.from(new Set(assets.map((a) => a.tipo))) as AssetType[]),
  ];

  const tree = (
    <DocumentsTree
      assets={assets}
      filter={filter}
      isAdmin={isAdmin}
      collapsed={collapsed}
      onToggle={toggleCollapsed}
      activeDragId={activeDragId}
      overTargetPath={overTarget}
    />
  );

  const content = (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-4xl font-display font-bold text-agesci-blue mb-2">Documenti</h1>
        <p className="text-gray-600">
          Materiali, guide e documenti utili per l&apos;evento
        </p>
        {isAdmin && (
          <p className="mt-2 text-xs text-gray-500">
            Suggerimento admin: trascina una riga su una cartella (o sulla riga
            &quot;Documenti&quot;) per spostarla.
          </p>
        )}
      </div>

      {assets.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {availableFilters.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === type
                  ? 'bg-agesci-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type !== 'all' && TYPE_ICONS[type as AssetType]}{' '}
              {TYPE_LABELS[type] || type.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-agesci-blue"></div>
          <p className="mt-4 text-gray-500">Caricamento documenti...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
        </div>
      ) : (
        tree
      )}

      {(isMutating || toast) && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg text-sm ${
            toast?.kind === 'err'
              ? 'bg-red-600 text-white'
              : toast?.kind === 'ok'
                ? 'bg-green-600 text-white'
                : 'bg-gray-900 text-white'
          }`}
          role="status"
        >
          {toast?.text ?? 'Spostamento in corso...'}
        </div>
      )}
    </div>
  );

  if (!isAdmin) return content;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveDragId(null);
        setOverTarget(null);
      }}
    >
      {content}
    </DndContext>
  );
}
