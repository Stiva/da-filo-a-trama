import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import type { ReactElement } from 'react';

export type SerializedImageNode = Spread<
  {
    type: 'image';
    version: 1;
    src: string;
    altText: string;
    width?: number;
    height?: number;
  },
  SerializedLexicalNode
>;

type ImagePayload = {
  src: string;
  altText?: string;
  width?: number;
  height?: number;
  key?: NodeKey;
};

export class ImageNode extends DecoratorNode<ReactElement> {
  __src: string;
  __altText: string;
  __width?: number;
  __height?: number;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__key
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      width: serializedNode.width,
      height: serializedNode.height,
    });
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: (node: HTMLElement) => ({
        conversion: () => {
          const img = node as HTMLImageElement;
          const src = img.getAttribute('src');
          if (!src) return null;

          const widthAttr = img.getAttribute('width');
          const heightAttr = img.getAttribute('height');

          return {
            node: $createImageNode({
              src,
              altText: img.getAttribute('alt') || '',
              width: widthAttr ? Number(widthAttr) : undefined,
              height: heightAttr ? Number(heightAttr) : undefined,
            }),
          } satisfies DOMConversionOutput;
        },
        priority: 1,
      }),
    };
  }

  constructor(
    src: string,
    altText: string,
    width?: number,
    height?: number,
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width;
    this.__height = height;
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
    };
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement('img');
    element.setAttribute('src', this.__src);
    element.setAttribute('alt', this.__altText || 'Immagine caricata');
    if (this.__width) {
      element.setAttribute('width', String(this.__width));
    }
    if (this.__height) {
      element.setAttribute('height', String(this.__height));
    }
    return { element };
  }

  createDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'lexical-image-wrapper';
    return wrapper;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): ReactElement {
    return (
      <img
        src={this.__src}
        alt={this.__altText || 'Immagine caricata'}
        width={this.__width}
        height={this.__height}
        className="lexical-image"
      />
    );
  }
}

export const $createImageNode = (payload: ImagePayload): ImageNode => {
  return $applyNodeReplacement(
    new ImageNode(
      payload.src,
      payload.altText || '',
      payload.width,
      payload.height,
      payload.key
    )
  );
};

export const $isImageNode = (node: LexicalNode | null | undefined): node is ImageNode => {
  return node instanceof ImageNode;
};
