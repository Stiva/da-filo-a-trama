'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, TOGGLE_LINK_COMMAND, $isLinkNode } from '@lexical/link';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { $patchStyleText, $getSelectionStyleValueForProperty } from '@lexical/selection';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $insertNodes,
  FORMAT_TEXT_COMMAND,
  EditorState,
  LexicalEditor,
  COMMAND_PRIORITY_CRITICAL,
  SELECTION_CHANGE_COMMAND,
  $createParagraphNode,
  $createTextNode,
  TextNode,
  $isTextNode,
  $applyNodeReplacement,
  FORMAT_ELEMENT_COMMAND,
  type ElementFormatType,
  type DOMConversionMap,
  type DOMConversionOutput,
  type NodeKey,
  type SerializedTextNode,
  type LexicalNode,
  type DOMConversion,
} from 'lexical';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text';
import { $createImageNode, ImageNode } from '@/components/editor/ImageNode';

// ==========================================
// ExtendedTextNode: preserves inline styles
// (font-family, etc.) during HTML import/export
// ==========================================
class ExtendedTextNode extends TextNode {
  constructor(text: string, key?: NodeKey) {
    super(text, key);
  }

  static getType(): string {
    return 'extended-text';
  }

  static clone(node: ExtendedTextNode): ExtendedTextNode {
    return new ExtendedTextNode(node.__text, node.__key);
  }

  static importDOM(): DOMConversionMap | null {
    const importers = TextNode.importDOM();
    return {
      ...importers,
      span: () => ({
        conversion: patchStyleConversion(importers?.span),
        priority: 1,
      }),
      strong: () => ({
        conversion: patchStyleConversion(importers?.strong),
        priority: 1,
      }),
      em: () => ({
        conversion: patchStyleConversion(importers?.em),
        priority: 1,
      }),
      code: () => ({
        conversion: patchStyleConversion(importers?.code),
        priority: 1,
      }),
    };
  }

  static importJSON(serializedNode: SerializedTextNode): TextNode {
    return $createExtendedTextNode().updateFromJSON(serializedNode);
  }

  isSimpleText() {
    return this.__type === 'extended-text' && this.__mode === 0;
  }
}

const $createExtendedTextNode = (text: string = ''): ExtendedTextNode => {
  return $applyNodeReplacement(new ExtendedTextNode(text));
};

function patchStyleConversion(
  originalDOMConverter?: (node: HTMLElement) => DOMConversion | null
): (node: HTMLElement) => DOMConversionOutput | null {
  return (node) => {
    const original = originalDOMConverter?.(node);
    if (!original) {
      return null;
    }
    const originalOutput = original.conversion(node);
    if (!originalOutput) {
      return originalOutput;
    }

    const fontFamily = node.style.fontFamily;
    const fontSize = node.style.fontSize;
    const color = node.style.color;
    const backgroundColor = node.style.backgroundColor;

    return {
      ...originalOutput,
      forChild: (lexicalNode: LexicalNode, parentLexicalNode: LexicalNode | null | undefined) => {
        const originalForChild = originalOutput?.forChild ?? ((x: LexicalNode) => x);
        const result = originalForChild(lexicalNode, parentLexicalNode);
        if ($isTextNode(result)) {
          const style = [
            fontFamily ? `font-family: ${fontFamily}` : null,
            fontSize ? `font-size: ${fontSize}` : null,
            color ? `color: ${color}` : null,
            backgroundColor ? `background-color: ${backgroundColor}` : null,
          ]
            .filter((value) => value != null)
            .join('; ');
          if (style.length) {
            return result.setStyle(style);
          }
        }
        return result;
      },
    };
  };
}

// ==========================================
// Font options
// ==========================================
const FONT_FAMILY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default' },
  { value: 'var(--font-loveyou), cursive', label: 'Love You' },
  { value: 'var(--font-quicksand), sans-serif', label: 'Quicksand' },
  { value: 'Georgia, serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
];

const FONT_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default size' },
  { value: '14px', label: '14px' },
  { value: '16px', label: '16px' },
  { value: '20px', label: '20px' },
  { value: '24px', label: '24px' },
];

// ==========================================
// Lexical Theme
// ==========================================
const theme = {
  heading: {
    h2: 'lexical-h2',
    h3: 'lexical-h3',
  },
  list: {
    ul: 'lexical-ul',
    ol: 'lexical-ol',
    listitem: 'lexical-li',
  },
  link: 'lexical-link',
  text: {
    bold: 'lexical-bold',
    italic: 'lexical-italic',
    underline: 'lexical-underline',
    strikethrough: 'lexical-strikethrough',
  },
};

// ==========================================
// Toolbar Plugin
// ==========================================
const ToolbarPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [blockType, setBlockType] = useState('paragraph');
  const [fontFamily, setFontFamily] = useState('');
  const [fontSize, setFontSize] = useState('');
  const [alignment, setAlignment] = useState<ElementFormatType>('left');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    setIsBold(selection.hasFormat('bold'));
    setIsItalic(selection.hasFormat('italic'));
    setIsUnderline(selection.hasFormat('underline'));
    setIsStrikethrough(selection.hasFormat('strikethrough'));

    const anchorNode = selection.anchor.getNode();
    const parentNode = anchorNode.getParent();
    const element =
      anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();

    if ($isHeadingNode(element)) {
      setBlockType(element.getTag());
    } else {
      setBlockType(element.getType());
    }

    const formatType =
      'getFormatType' in element && typeof element.getFormatType === 'function'
        ? element.getFormatType()
        : 'left';
    setAlignment((formatType || 'left') as ElementFormatType);

    const linkActive = $isLinkNode(anchorNode) || $isLinkNode(parentNode);
    setIsLink(linkActive);

    const currentFontFamily = $getSelectionStyleValueForProperty(selection, 'font-family', '');
    const currentFontSize = $getSelectionStyleValueForProperty(selection, 'font-size', '');
    setFontFamily(currentFontFamily);
    setFontSize(currentFontSize);
  }, []);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
  }, [editor, updateToolbar]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  const handleFormatBold = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  };

  const handleFormatItalic = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  };

  const handleFormatUnderline = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
  };

  const handleFormatStrikethrough = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
  };

  const handleBlockType = (type: string) => {
    if (type === 'paragraph') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    } else if (type === 'h2' || type === 'h3') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(type));
        }
      });
    } else if (type === 'ul') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else if (type === 'ol') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  const handleFontFamily = (value: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-family': value || null });
      }
    });
  };

  const handleFontSize = (value: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-size': value || null });
      }
    });
  };

  const handleAlignment = (value: ElementFormatType) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, value);
  };

  const handleToggleLink = () => {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }

    const url = window.prompt('Inserisci URL del link (es: https://example.com)');
    if (!url || !url.trim()) return;

    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim());
  };

  const handleOpenImagePicker = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Seleziona un file immagine valido.');
      event.target.value = '';
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/assets/upload', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        const message = payload?.error || 'Errore durante il caricamento dell\'immagine';
        throw new Error(message);
      }

      const imageUrl = payload?.data?.file_url as string | undefined;
      if (!imageUrl) {
        throw new Error('Upload completato ma URL immagine non disponibile');
      }

      editor.update(() => {
        const imageNode = $createImageNode({
          src: imageUrl,
          altText: file.name,
        });
        const paragraph = $createParagraphNode();
        $insertNodes([imageNode, paragraph]);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      window.alert(message);
    } finally {
      setIsUploadingImage(false);
      event.target.value = '';
    }
  };

  return (
    <div className="lexical-toolbar flex flex-wrap items-center gap-1 p-2 border-b-2 border-agesci-blue/20 bg-gray-50 rounded-t-lg">
      {/* Block type */}
      <select
        value={blockType}
        onChange={(e) => handleBlockType(e.target.value)}
        className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white min-h-[36px]"
        aria-label="Tipo blocco"
      >
        <option value="paragraph">Paragrafo</option>
        <option value="h2">Titolo 2</option>
        <option value="h3">Titolo 3</option>
        <option value="ul">Elenco puntato</option>
        <option value="ol">Elenco numerato</option>
      </select>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Font family */}
      <select
        value={fontFamily}
        onChange={(e) => handleFontFamily(e.target.value)}
        className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white min-h-[36px]"
        aria-label="Font"
      >
        {FONT_FAMILY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={fontSize}
        onChange={(e) => handleFontSize(e.target.value)}
        className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white min-h-[36px]"
        aria-label="Dimensione testo"
      >
        {FONT_SIZE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Text format */}
      <button
        type="button"
        onClick={handleFormatBold}
        className={`p-2 rounded min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors ${
          isBold ? 'bg-agesci-blue text-white' : 'hover:bg-gray-200 text-gray-700'
        }`}
        aria-label="Grassetto"
        title="Grassetto"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handleFormatItalic}
        className={`p-2 rounded min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors ${
          isItalic ? 'bg-agesci-blue text-white' : 'hover:bg-gray-200 text-gray-700'
        }`}
        aria-label="Corsivo"
        title="Corsivo"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handleFormatUnderline}
        className={`p-2 rounded min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors ${
          isUnderline ? 'bg-agesci-blue text-white' : 'hover:bg-gray-200 text-gray-700'
        }`}
        aria-label="Sottolineato"
        title="Sottolineato"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handleFormatStrikethrough}
        className={`p-2 rounded min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors ${
          isStrikethrough ? 'bg-agesci-blue text-white' : 'hover:bg-gray-200 text-gray-700'
        }`}
        aria-label="Barrato"
        title="Barrato"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 19h4v-2h-4v2zm-4-6h12v-2H6v2zm2-8v2h8V5H8z" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <button
        type="button"
        onClick={() => handleAlignment('left')}
        className={`p-2 rounded min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors ${
          alignment === 'left' ? 'bg-agesci-blue text-white' : 'hover:bg-gray-200 text-gray-700'
        }`}
        aria-label="Allinea a sinistra"
        title="Allinea a sinistra"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 5h18v2H3V5zm0 4h12v2H3V9zm0 4h18v2H3v-2zm0 4h12v2H3v-2z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => handleAlignment('center')}
        className={`p-2 rounded min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors ${
          alignment === 'center' ? 'bg-agesci-blue text-white' : 'hover:bg-gray-200 text-gray-700'
        }`}
        aria-label="Allinea al centro"
        title="Allinea al centro"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 5h18v2H3V5zm3 4h12v2H6V9zm-3 4h18v2H3v-2zm3 4h12v2H6v-2z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => handleAlignment('right')}
        className={`p-2 rounded min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors ${
          alignment === 'right' ? 'bg-agesci-blue text-white' : 'hover:bg-gray-200 text-gray-700'
        }`}
        aria-label="Allinea a destra"
        title="Allinea a destra"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 5h18v2H3V5zm6 4h12v2H9V9zm-6 4h18v2H3v-2zm6 4h12v2H9v-2z" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      <button
        type="button"
        onClick={handleToggleLink}
        className={`p-2 rounded min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors ${
          isLink ? 'bg-agesci-blue text-white' : 'hover:bg-gray-200 text-gray-700'
        }`}
        aria-label="Aggiungi o rimuovi link"
        title="Link"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3.9 12a5 5 0 0 1 5-5h3v2h-3a3 3 0 1 0 0 6h3v2h-3a5 5 0 0 1-5-5zm7.1 1h2v-2h-2v2zm4-6h-3v2h3a3 3 0 1 1 0 6h-3v2h3a5 5 0 0 0 0-10z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handleOpenImagePicker}
        disabled={isUploadingImage}
        className={`p-2 rounded min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors ${
          isUploadingImage
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'hover:bg-gray-200 text-gray-700'
        }`}
        aria-label="Carica immagine"
        title="Carica immagine"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 11.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM5 19l4.5-6 3.5 4.5 2.5-3L19 19H5z" />
        </svg>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelected}
      />
    </div>
  );
};

// ==========================================
// InitialContentPlugin: loads HTML content
// ==========================================
const InitialContentPlugin = ({ initialHtml }: { initialHtml?: string }) => {
  const [editor] = useLexicalComposerContext();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (isLoaded || !initialHtml) return;

    editor.update(() => {
      const root = $getRoot();
      // Only set initial content if editor is empty
      if (root.getTextContent().trim().length > 0) return;

      root.clear();

      const isHtml = /<[a-z][\s\S]*>/i.test(initialHtml);
      if (isHtml) {
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialHtml, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        if (nodes.length > 0) {
          $getRoot().select();
          $insertNodes(nodes);
        }
      } else {
        // Plain text: split by newlines into paragraphs
        const lines = initialHtml.split('\n');
        for (const line of lines) {
          const paragraph = $createParagraphNode();
          if (line.trim()) {
            paragraph.append($createTextNode(line));
          }
          root.append(paragraph);
        }
      }
    });

    setIsLoaded(true);
  }, [editor, initialHtml, isLoaded]);

  return null;
};

// ==========================================
// HtmlSerializerPlugin: converts state to HTML
// ==========================================
const HtmlSerializerPlugin = ({
  onChange,
}: {
  onChange: (html: string) => void;
}) => {
  const [editor] = useLexicalComposerContext();

  const handleChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const root = $getRoot();
        const isEmpty = root.getTextContent().trim().length === 0;
        if (isEmpty) {
          onChange('');
          return;
        }
        const html = $generateHtmlFromNodes(editor);
        onChange(html);
      });
    },
    [editor, onChange]
  );

  return <OnChangePlugin onChange={handleChange} />;
};

// ==========================================
// RichTextEditor Component
// ==========================================
interface RichTextEditorProps {
  initialHtml?: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const RichTextEditor = ({ initialHtml, onChange, placeholder = 'Inizia a scrivere...' }: RichTextEditorProps) => {
  const initialConfig = {
    namespace: 'RichTextEditor',
    theme,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      LinkNode,
      ImageNode,
      ExtendedTextNode,
      { replace: TextNode, with: (node: TextNode) => new ExtendedTextNode(node.__text) },
    ],
    onError: (error: Error) => {
      console.error('Lexical error:', error);
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="lexical-editor border-2 border-agesci-blue/30 rounded-lg overflow-hidden focus-within:border-agesci-blue focus-within:ring-2 focus-within:ring-agesci-blue/20 transition-all">
        <ToolbarPlugin />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="lexical-content min-h-[120px] px-4 py-3 outline-none text-agesci-blue"
                aria-placeholder={placeholder}
                placeholder={
                  <div className="lexical-placeholder absolute top-3 left-4 text-agesci-blue/40 pointer-events-none">
                    {placeholder}
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <InitialContentPlugin initialHtml={initialHtml} />
        <HtmlSerializerPlugin onChange={onChange} />
      </div>
    </LexicalComposer>
  );
};

export default RichTextEditor;
