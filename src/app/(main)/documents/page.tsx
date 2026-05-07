'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sanitizeFolderPath, splitFolderPath, joinFolderPath } from '@/lib/folderPath';
import type { Asset } from '@/types/database';

const TYPE_ICONS: Record<string, string> = {
  pdf: '📄',
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  document: '📁',
};

const TYPE_LABELS: Record<string, string> = {
  all: 'Tutti',
  pdf: 'PDF',
  image: 'Immagini',
  video: 'Video',
  audio: 'Audio',
  document: 'Documenti',
};

interface Listing {
  path: string;
  folders: string[];
  files: Asset[];
}

interface DragData {
  kind: 'file' | 'folder';
  id: string; // asset id (file) o folder absolute path (folder)
  // per le cartelle, il path assoluto (es. "Canzoni/Con un filo")
  folderPath?: string;
}

interface DropData {
  // path destinazione assoluto (cartella che riceve)
  targetPath: string;
}

function readPathFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return sanitizeFolderPath(params.get('path'));
}

// ---------------------------------------------------------------------------
// Card components

function FileCard({ doc, draggable, isDragging }: { doc: Asset; draggable: boolean; isDragging: boolean }) {
  const data: DragData = { kind: 'file', id: doc.id };
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `file:${doc.id}`,
    data,
    disabled: !draggable,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const inner = (
    <div className="flex items-start gap-3">
      <span className="text-3xl flex-shrink-0">{TYPE_ICONS[doc.tipo] || '📁'}</span>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 line-clamp-2">
          {doc.title || doc.file_name}
        </h3>
        {doc.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mt-1">
            {doc.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
          <span className="bg-gray-100 px-2 py-1 rounded">{doc.tipo.toUpperCase()}</span>
          {doc.file_size_bytes && <span>{formatFileSize(doc.file_size_bytes)}</span>}
        </div>
      </div>
    </div>
  );

  const className = `block p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-agesci-blue hover:shadow-lg transition-all ${
    isDragging ? 'opacity-40' : ''
  } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`;

  if (draggable) {
    return (
      <div ref={setNodeRef} style={style} className={className} {...attributes} {...listeners}>
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // Evita apertura mentre stai trascinando
            if (isDragging) e.preventDefault();
          }}
          className="block"
        >
          {inner}
        </a>
      </div>
    );
  }

  return (
    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  );
}

function FolderCard({
  name,
  absolutePath,
  onOpen,
  draggable,
  isDragging,
  isOver,
}: {
  name: string;
  absolutePath: string;
  onOpen: () => void;
  draggable: boolean;
  isDragging: boolean;
  isOver: boolean;
}) {
  const dragData: DragData = { kind: 'folder', id: absolutePath, folderPath: absolutePath };
  const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({
    id: `folder-drag:${absolutePath}`,
    data: dragData,
    disabled: !draggable,
  });
  const dropData: DropData = { targetPath: absolutePath };
  const { setNodeRef: setDropRef } = useDroppable({
    id: `folder-drop:${absolutePath}`,
    data: dropData,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const className = `text-left p-4 bg-white rounded-xl border-2 transition-all w-full ${
    isOver ? 'border-agesci-blue ring-2 ring-agesci-blue/40 shadow-lg' : 'border-gray-100 hover:border-agesci-blue hover:shadow-lg'
  } ${isDragging ? 'opacity-40' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`;

  const setRefs = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  return (
    <div ref={setRefs} style={style} className={className} {...attributes} {...listeners}>
      <button type="button" onClick={onOpen} className="text-left w-full">
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-shrink-0">📂</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 line-clamp-2">{name}</h3>
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
              <span className="bg-gray-100 px-2 py-1 rounded">CARTELLA</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function BreadcrumbDrop({
  label,
  targetPath,
  isCurrent,
  onClick,
  enableDrop,
  isOver,
}: {
  label: string;
  targetPath: string;
  isCurrent: boolean;
  onClick: () => void;
  enableDrop: boolean;
  isOver: boolean;
}) {
  const dropData: DropData = { targetPath };
  const { setNodeRef } = useDroppable({
    id: `breadcrumb-drop:${targetPath || '__root__'}`,
    data: dropData,
    disabled: !enableDrop,
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={onClick}
      className={`px-2 py-1 rounded transition-colors ${
        isCurrent ? 'font-semibold text-agesci-blue' : 'text-gray-700'
      } ${isOver ? 'bg-agesci-blue/10 ring-2 ring-agesci-blue/40' : 'hover:bg-gray-100'}`}
      aria-current={isCurrent ? 'page' : undefined}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page

export default function DocumentsPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const role = (user?.publicMetadata as { role?: string } | undefined)?.role;
  const isAdmin = userLoaded && (role === 'admin' || role === 'staff');

  const [currentPath, setCurrentPath] = useState<string>('');
  const [listing, setListing] = useState<Listing>({ path: '', folders: [], files: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null); // targetPath ('' = root)
  const [isMutating, setIsMutating] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    setCurrentPath(readPathFromUrl());
    const onPop = () => setCurrentPath(readPathFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const fetchListing = useCallback(async (path: string, signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const url = path
        ? `/api/documents?path=${encodeURIComponent(path)}`
        : '/api/documents';
      const response = await fetch(url, { signal });
      const result = await response.json();
      if (response.ok && result.data) {
        setListing(result.data as Listing);
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
    fetchListing(currentPath, ctrl.signal);
    return () => ctrl.abort();
  }, [currentPath, fetchListing]);

  const navigate = useCallback((nextPath: string) => {
    const clean = sanitizeFolderPath(nextPath);
    const url = clean ? `?path=${encodeURIComponent(clean)}` : window.location.pathname;
    window.history.pushState({}, '', url);
    setCurrentPath(clean);
    setFilter('all');
  }, []);

  // ---- Drag & drop handlers --------------------------------------------------

  const segments = useMemo(() => splitFolderPath(currentPath), [currentPath]);

  const showToast = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 3000);
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
        await fetchListing(currentPath);
      } catch (err) {
        showToast('err', err instanceof Error ? err.message : 'Errore');
      } finally {
        setIsMutating(false);
      }
    },
    [currentPath, fetchListing, showToast],
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
        await fetchListing(currentPath);
      } catch (err) {
        showToast('err', err instanceof Error ? err.message : 'Errore');
      } finally {
        setIsMutating(false);
      }
    },
    [currentPath, fetchListing, showToast],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDrag((event.active.data.current as DragData) ?? null);
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
      setActiveDrag(null);
      setOverTarget(null);
      if (!drag || !drop) return;

      const target = drop.targetPath;

      if (drag.kind === 'file') {
        // No-op se già nella cartella target
        const file = listing.files.find((f) => f.id === drag.id);
        if (file && (file.folder_path ?? '') === target) return;
        void moveFile(drag.id, target);
      } else if (drag.kind === 'folder' && drag.folderPath) {
        if (drag.folderPath === target) return;
        // Drop su se stessa: skip
        if (target === drag.folderPath || target.startsWith(drag.folderPath + '/')) {
          showToast('err', 'Non puoi spostare una cartella dentro se stessa');
          return;
        }
        // No-op se la cartella e' gia' figlia diretta del target
        const currentParent = drag.folderPath.includes('/')
          ? drag.folderPath.slice(0, drag.folderPath.lastIndexOf('/'))
          : '';
        if (currentParent === target) return;
        void moveFolder(drag.folderPath, target);
      }
    },
    [listing.files, moveFile, moveFolder, showToast],
  );

  // ---- Rendering -------------------------------------------------------------

  const filteredFiles = filter === 'all'
    ? listing.files
    : listing.files.filter((d) => d.tipo === filter);

  const availableTypes = ['all', ...new Set(listing.files.map((d) => d.tipo))];

  const dndEnabled = isAdmin;

  const content = (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-4xl font-display font-bold text-agesci-blue mb-2">Documenti</h1>
        <p className="text-gray-600">
          Materiali, guide e documenti utili per l&apos;evento
        </p>
        {dndEnabled && (
          <p className="mt-2 text-xs text-gray-500">
            Suggerimento admin: trascina una card su una cartella (o sul breadcrumb) per spostarla.
          </p>
        )}
      </div>

      {/* Breadcrumb */}
      <nav className="flex items-center flex-wrap gap-1 text-sm mb-6" aria-label="Breadcrumb">
        <BreadcrumbDrop
          label="🏠 Documenti"
          targetPath=""
          isCurrent={currentPath === ''}
          onClick={() => navigate('')}
          enableDrop={dndEnabled && !!activeDrag}
          isOver={dndEnabled && overTarget === ''}
        />
        {segments.map((seg, i) => {
          const target = joinFolderPath(segments.slice(0, i + 1));
          const isLast = i === segments.length - 1;
          return (
            <span key={target} className="flex items-center gap-1">
              <span className="text-gray-400">/</span>
              <BreadcrumbDrop
                label={seg}
                targetPath={target}
                isCurrent={isLast}
                onClick={() => navigate(target)}
                enableDrop={dndEnabled && !!activeDrag}
                isOver={dndEnabled && overTarget === target}
              />
            </span>
          );
        })}
      </nav>

      {/* Filtri tipo */}
      {listing.files.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {availableTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === type
                  ? 'bg-agesci-blue text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type !== 'all' && TYPE_ICONS[type]} {TYPE_LABELS[type] || type.toUpperCase()}
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
      ) : listing.folders.length === 0 && filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {filter === 'all'
              ? 'Cartella vuota'
              : `Nessun documento di tipo "${TYPE_LABELS[filter] || filter}" in questa cartella`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listing.folders.map((name) => {
            const target = currentPath ? `${currentPath}/${name}` : name;
            const isDraggingThis =
              activeDrag?.kind === 'folder' && activeDrag.folderPath === target;
            return (
              <FolderCard
                key={`folder-${target}`}
                name={name}
                absolutePath={target}
                onOpen={() => navigate(target)}
                draggable={dndEnabled}
                isDragging={isDraggingThis}
                isOver={dndEnabled && overTarget === target && activeDrag != null && !isDraggingThis}
              />
            );
          })}
          {filteredFiles.map((doc) => {
            const isDraggingThis = activeDrag?.kind === 'file' && activeDrag.id === doc.id;
            return (
              <FileCard
                key={doc.id}
                doc={doc}
                draggable={dndEnabled}
                isDragging={isDraggingThis}
              />
            );
          })}
        </div>
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

  if (!dndEnabled) return content;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveDrag(null);
        setOverTarget(null);
      }}
    >
      {content}
    </DndContext>
  );
}
