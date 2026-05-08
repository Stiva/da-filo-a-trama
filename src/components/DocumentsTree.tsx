'use client';

import { useCallback, useMemo } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Asset, AssetType } from '@/types/database';
import {
  buildTree,
  collectAllFolderPaths,
  filterTree,
  type FilterValue,
  type FolderNode,
} from '@/lib/buildTree';

const TYPE_ICONS: Record<AssetType, string> = {
  pdf: '📄',
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  document: '📝',
  link: '🔗',
};

interface DragData {
  kind: 'file' | 'folder';
  id: string;
  folderPath?: string;
}

interface DropData {
  targetPath: string;
}

interface DocumentsTreeProps {
  assets: Asset[];
  filter: FilterValue;
  isAdmin: boolean;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  activeDragId: string | null;
  overTargetPath: string | null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --------------------------------------------------------------------------
// File row

function FileRow({
  asset,
  depth,
  draggable,
  isDragging,
}: {
  asset: Asset;
  depth: number;
  draggable: boolean;
  isDragging: boolean;
}) {
  const data: DragData = { kind: 'file', id: asset.id };
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `file:${asset.id}`,
    data,
    disabled: !draggable,
  });

  const style: React.CSSProperties = {
    paddingLeft: `${depth * 16 + 8}px`,
  };
  if (transform) {
    style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0)`;
  }

  const icon = TYPE_ICONS[asset.tipo] || '📁';
  const label = asset.title || asset.file_name;
  const size = formatFileSize(asset.file_size_bytes);

  return (
    <a
      ref={setNodeRef}
      style={style}
      href={asset.file_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (isDragging) e.preventDefault();
      }}
      className={`flex items-center gap-2 py-1 pr-3 rounded text-sm hover:bg-gray-50 transition-colors ${
        isDragging ? 'opacity-40' : ''
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="w-4 flex-shrink-0" aria-hidden="true" />
      <span className="text-base flex-shrink-0">{icon}</span>
      <span className="flex-1 truncate text-gray-800">{label}</span>
      {asset.description && (
        <span className="hidden md:inline text-xs text-gray-400 truncate max-w-xs">
          {asset.description}
        </span>
      )}
      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] uppercase tracking-wide text-gray-500 flex-shrink-0">
        {asset.tipo}
      </span>
      {size && (
        <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">{size}</span>
      )}
    </a>
  );
}

// --------------------------------------------------------------------------
// Folder row

function FolderRow({
  node,
  depth,
  expanded,
  onToggle,
  draggable,
  isDragging,
  isOver,
}: {
  node: FolderNode;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  draggable: boolean;
  isDragging: boolean;
  isOver: boolean;
}) {
  const dragData: DragData = { kind: 'folder', id: node.path, folderPath: node.path };
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
  } = useDraggable({
    id: `folder-drag:${node.path}`,
    data: dragData,
    disabled: !draggable,
  });
  const dropData: DropData = { targetPath: node.path };
  const { setNodeRef: setDropRef } = useDroppable({
    id: `folder-drop:${node.path}`,
    data: dropData,
  });

  const style: React.CSSProperties = {
    paddingLeft: `${depth * 16 + 4}px`,
  };
  if (transform) {
    style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0)`;
  }

  const setRefs = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const totalCount = node.files.length + node.children.length;

  return (
    <div
      ref={setRefs}
      style={style}
      className={`flex items-center gap-2 py-1 pr-3 rounded text-sm transition-colors ${
        isOver
          ? 'bg-agesci-blue/5 ring-2 ring-agesci-blue/40'
          : 'hover:bg-gray-50'
      } ${isDragging ? 'opacity-40' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 flex-shrink-0"
        aria-label={expanded ? 'Comprimi cartella' : 'Espandi cartella'}
        aria-expanded={expanded}
      >
        <span
          className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          ▶
        </span>
      </button>
      <span className="text-base flex-shrink-0">{expanded ? '📂' : '📁'}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-1 text-left truncate font-medium text-gray-900"
      >
        {node.name}
      </button>
      <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">
        {totalCount}
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------
// Root drop zone

function RootRow({
  isOver,
  isAdmin,
  hasActiveDrag,
}: {
  isOver: boolean;
  isAdmin: boolean;
  hasActiveDrag: boolean;
}) {
  const dropData: DropData = { targetPath: '' };
  const { setNodeRef } = useDroppable({
    id: 'folder-drop:__root__',
    data: dropData,
    disabled: !isAdmin,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 py-2 px-2 rounded text-sm font-semibold transition-colors ${
        isOver
          ? 'bg-agesci-blue/5 ring-2 ring-agesci-blue/40'
          : isAdmin && hasActiveDrag
            ? 'bg-agesci-blue/5 border border-dashed border-agesci-blue/30'
            : ''
      }`}
    >
      <span className="text-base">🏠</span>
      <span className="text-gray-900">Documenti</span>
    </div>
  );
}

// --------------------------------------------------------------------------
// Recursive renderer

function FolderBranch({
  node,
  depth,
  collapsed,
  onToggle,
  draggable,
  activeDragId,
  overTargetPath,
  forceExpand,
}: {
  node: FolderNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  draggable: boolean;
  activeDragId: string | null;
  overTargetPath: string | null;
  forceExpand: boolean;
}) {
  const expanded = forceExpand || !collapsed.has(node.path);
  const isDraggingThis = activeDragId === `folder-drag:${node.path}`;
  const isOver = overTargetPath === node.path && !isDraggingThis && activeDragId !== null;

  return (
    <>
      <FolderRow
        node={node}
        depth={depth}
        expanded={expanded}
        onToggle={() => onToggle(node.path)}
        draggable={draggable}
        isDragging={isDraggingThis}
        isOver={isOver}
      />
      {expanded && (
        <>
          {node.children.map((child) => (
            <FolderBranch
              key={child.path}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              draggable={draggable}
              activeDragId={activeDragId}
              overTargetPath={overTargetPath}
              forceExpand={forceExpand}
            />
          ))}
          {node.files.map((asset) => {
            const draggingThis = activeDragId === `file:${asset.id}`;
            return (
              <FileRow
                key={asset.id}
                asset={asset}
                depth={depth + 1}
                draggable={draggable}
                isDragging={draggingThis}
              />
            );
          })}
        </>
      )}
    </>
  );
}

// --------------------------------------------------------------------------
// Main

export default function DocumentsTree({
  assets,
  filter,
  isAdmin,
  collapsed,
  onToggle,
  activeDragId,
  overTargetPath,
}: DocumentsTreeProps) {
  const tree = useMemo(() => buildTree(assets), [assets]);
  const filtered = useMemo(
    () => filterTree(tree.rootFiles, tree.rootFolders, filter),
    [tree, filter],
  );

  // Quando il filtro e' attivo, espandiamo tutti i folder visibili (override
  // del collapsed state, senza mutarlo).
  const forceExpand = filter !== 'all';

  const isRootOver = overTargetPath === '' && activeDragId !== null;
  const handleToggle = useCallback((path: string) => onToggle(path), [onToggle]);

  if (filtered.rootFiles.length === 0 && filtered.rootFolders.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">
          {filter === 'all'
            ? 'Nessun documento disponibile al momento'
            : `Nessun documento di tipo "${filter.toUpperCase()}" disponibile`}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-gray-100 p-2">
      <RootRow isOver={isRootOver} isAdmin={isAdmin} hasActiveDrag={activeDragId !== null} />
      {filtered.rootFolders.map((node) => (
        <FolderBranch
          key={node.path}
          node={node}
          depth={1}
          collapsed={collapsed}
          onToggle={handleToggle}
          draggable={isAdmin}
          activeDragId={activeDragId}
          overTargetPath={overTargetPath}
          forceExpand={forceExpand}
        />
      ))}
      {filtered.rootFiles.map((asset) => {
        const draggingThis = activeDragId === `file:${asset.id}`;
        return (
          <FileRow
            key={asset.id}
            asset={asset}
            depth={1}
            draggable={isAdmin}
            isDragging={draggingThis}
          />
        );
      })}
    </div>
  );
}

export { collectAllFolderPaths };
