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
import ImageComponent from './ImageComponent';

export type SerializedImageNode = Spread<
  {
    type: 'image';
    version: 1;
    src: string;
    altText: string;
    width?: number;
    height?: number;
    linkUrl?: string;
  },
  SerializedLexicalNode
>;

type ImagePayload = {
  src: string;
  altText?: string;
  width?: number;
  height?: number;
  linkUrl?: string;
  key?: NodeKey;
};

const isMeaningfulChild = (node: ChildNode): boolean => {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').trim().length > 0;
  }
  return node.nodeType === Node.ELEMENT_NODE;
};

export class ImageNode extends DecoratorNode<ReactElement> {
  __src: string;
  __altText: string;
  __width?: number;
  __height?: number;
  __linkUrl?: string;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__linkUrl,
      node.__key
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      width: serializedNode.width,
      height: serializedNode.height,
      linkUrl: serializedNode.linkUrl,
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
      a: (node: HTMLElement) => {
        const anchor = node as HTMLAnchorElement;
        const meaningfulChildren = Array.from(anchor.childNodes).filter(isMeaningfulChild);
        if (meaningfulChildren.length !== 1) return null;
        const onlyChild = meaningfulChildren[0];
        if (!(onlyChild instanceof HTMLImageElement)) return null;

        return {
          conversion: () => {
            const img = onlyChild;
            const src = img.getAttribute('src');
            if (!src) return null;

            const widthAttr = img.getAttribute('width');
            const heightAttr = img.getAttribute('height');
            const href = anchor.getAttribute('href') || undefined;

            return {
              node: $createImageNode({
                src,
                altText: img.getAttribute('alt') || '',
                width: widthAttr ? Number(widthAttr) : undefined,
                height: heightAttr ? Number(heightAttr) : undefined,
                linkUrl: href,
              }),
              forChild: () => null,
            } satisfies DOMConversionOutput;
          },
          priority: 2,
        };
      },
    };
  }

  constructor(
    src: string,
    altText: string,
    width?: number,
    height?: number,
    linkUrl?: string,
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width;
    this.__height = height;
    this.__linkUrl = linkUrl;
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
      linkUrl: this.__linkUrl,
    };
  }

  exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const img = document.createElement('img');
    img.setAttribute('src', this.__src);
    img.setAttribute('alt', this.__altText || 'Immagine caricata');
    if (this.__width) {
      img.setAttribute('width', String(this.__width));
    }
    if (this.__height) {
      img.setAttribute('height', String(this.__height));
    }

    if (this.__linkUrl) {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', this.__linkUrl);
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
      anchor.appendChild(img);
      return { element: anchor };
    }

    return { element: img };
  }

  createDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'lexical-image-wrapper';
    return wrapper;
  }

  updateDOM(): false {
    return false;
  }

  getLinkUrl(): string | undefined {
    return this.getLatest().__linkUrl;
  }

  setLinkUrl(linkUrl: string | undefined): void {
    const writable = this.getWritable();
    writable.__linkUrl = linkUrl && linkUrl.trim().length > 0 ? linkUrl.trim() : undefined;
  }

  decorate(): ReactElement {
    return (
      <ImageComponent
        nodeKey={this.__key}
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        linkUrl={this.__linkUrl}
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
      payload.linkUrl,
      payload.key
    )
  );
};

export const $isImageNode = (node: LexicalNode | null | undefined): node is ImageNode => {
  return node instanceof ImageNode;
};
