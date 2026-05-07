'use client';

import { useCallback, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { mergeRegister } from '@lexical/utils';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type NodeKey,
} from 'lexical';
import { $isImageNode } from './ImageNode';

interface ImageComponentProps {
  nodeKey: NodeKey;
  src: string;
  altText: string;
  width?: number;
  height?: number;
  linkUrl?: string;
}

const ImageComponent = ({ nodeKey, src, altText, width, height, linkUrl }: ImageComponentProps) => {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const handleClick = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) {
        setSelected(!isSelected);
      } else {
        clearSelection();
        setSelected(true);
      }
    },
    [isSelected, setSelected, clearSelection]
  );

  const handleDelete = useCallback(
    (event: KeyboardEvent) => {
      if (!isSelected) return false;
      const selection = $getSelection();
      if (!$isNodeSelection(selection)) return false;
      event.preventDefault();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) node.remove();
      });
      return true;
    },
    [editor, isSelected, nodeKey]
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(KEY_BACKSPACE_COMMAND, handleDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_DELETE_COMMAND, handleDelete, COMMAND_PRIORITY_LOW)
    );
  }, [editor, handleDelete]);

  const handleEditLink = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const current = linkUrl || '';
      const url = window.prompt(
        "URL del link per l'immagine (lascia vuoto per rimuovere)",
        current
      );
      if (url === null) return;
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setLinkUrl(url || undefined);
        }
      });
    },
    [editor, nodeKey, linkUrl]
  );

  const handleRemoveLink = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setLinkUrl(undefined);
        }
      });
    },
    [editor, nodeKey]
  );

  const buttonStyle: React.CSSProperties = {
    background: 'rgba(0, 0, 0, 0.75)',
    color: 'white',
    border: 'none',
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1.2,
  };

  return (
    <span
      className="lexical-image-wrapper-inner"
      style={{ position: 'relative', display: 'inline-block', verticalAlign: 'middle' }}
    >
      <img
        src={src}
        alt={altText || 'Immagine caricata'}
        width={width}
        height={height}
        onClick={handleClick}
        className="lexical-image"
        draggable={false}
        style={{
          cursor: 'pointer',
          outline: isSelected ? '2px solid #003D7A' : 'none',
          outlineOffset: 2,
          display: 'block',
        }}
      />
      {linkUrl ? (
        <span
          aria-hidden="true"
          title={linkUrl}
          style={{
            position: 'absolute',
            bottom: 4,
            left: 4,
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 11,
            pointerEvents: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            maxWidth: 'calc(100% - 8px)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3.9 12a5 5 0 0 1 5-5h3v2h-3a3 3 0 1 0 0 6h3v2h-3a5 5 0 0 1-5-5zm11.1-5h-3v2h3a3 3 0 1 1 0 6h-3v2h3a5 5 0 0 0 0-10zm-7.1 6h8v-2H7.9v2z" />
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{linkUrl}</span>
        </span>
      ) : null}
      {isSelected ? (
        <span
          contentEditable={false}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            gap: 4,
          }}
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleEditLink}
            title={linkUrl ? 'Modifica link' : 'Aggiungi link'}
            style={buttonStyle}
          >
            {linkUrl ? 'Modifica link' : 'Aggiungi link'}
          </button>
          {linkUrl ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleRemoveLink}
              title="Rimuovi link"
              style={buttonStyle}
              aria-label="Rimuovi link"
            >
              Rimuovi
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
};

export default ImageComponent;
