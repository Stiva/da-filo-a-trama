'use client';

import { useEffect, useCallback, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
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
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text';

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
  const [blockType, setBlockType] = useState('paragraph');
  const [fontFamily, setFontFamily] = useState('');

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    setIsBold(selection.hasFormat('bold'));
    setIsItalic(selection.hasFormat('italic'));
    setIsUnderline(selection.hasFormat('underline'));

    const anchorNode = selection.anchor.getNode();
    const element = anchorNode.getKey() === 'root'
      ? anchorNode
      : anchorNode.getTopLevelElementOrThrow();

    if ($isHeadingNode(element)) {
      setBlockType(element.getTag());
    } else {
      setBlockType(element.getType());
    }

    const currentFontFamily = $getSelectionStyleValueForProperty(selection, 'font-family', '');
    setFontFamily(currentFontFamily);
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
        <InitialContentPlugin initialHtml={initialHtml} />
        <HtmlSerializerPlugin onChange={onChange} />
      </div>
    </LexicalComposer>
  );
};

export default RichTextEditor;
