import type { BrandFonts, FontSlot } from './types';

const SLOT_TO_VAR: Record<keyof BrandFonts, string> = {
  sans: '--font-inter',
  display: '--font-loveyou',
  brand: '--font-dancing-script',
  loveyou: '--font-loveyou',
};

const FORMAT_MAP: Record<NonNullable<FontSlot>['format'] & string, string> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
};

function fontFaceFor(slot: NonNullable<FontSlot>): string | null {
  if (!slot.url || !slot.family) return null;
  const format = slot.format ? FORMAT_MAP[slot.format] : 'woff2';
  const weights = slot.weights?.length ? slot.weights : [400];
  return weights
    .map(
      (w) =>
        `@font-face{font-family:"${slot.family}";src:url("${slot.url}") format("${format}");font-display:swap;font-weight:${w};}`,
    )
    .join('');
}

/**
 * Build a <style> block to inject in <head>: a list of `@font-face` and CSS
 * variable overrides so the design system swaps to the uploaded font.
 * Returns the inner CSS only (caller wraps in <style>).
 */
export function buildFontFaceBlock(fonts: BrandFonts): string {
  const faces: string[] = [];
  const varOverrides: string[] = [];

  for (const [slotKey, slot] of Object.entries(fonts) as Array<
    [keyof BrandFonts, FontSlot]
  >) {
    if (!slot) continue;
    const face = fontFaceFor(slot);
    if (!face) continue;
    faces.push(face);
    const cssVar = SLOT_TO_VAR[slotKey];
    varOverrides.push(`${cssVar}: "${slot.family}";`);
  }

  if (faces.length === 0) return '';
  return `${faces.join('')}:root{${varOverrides.join('')}}`;
}
