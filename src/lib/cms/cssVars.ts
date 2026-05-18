import type { BrandColors, BrandShadows, ColorScale } from './types';

const COLOR_VAR_MAP: Record<string, (variant: 'DEFAULT' | 'light' | 'dark') => string> = {
  'agesci-purple': (v) =>
    v === 'DEFAULT' ? '--agesci-purple' : `--agesci-purple-${v}`,
  'agesci-yellow': (v) =>
    v === 'DEFAULT' ? '--agesci-yellow' : `--agesci-yellow-${v}`,
  'agesci-blue': (v) =>
    v === 'DEFAULT' ? '--agesci-blue' : `--agesci-blue-${v}`,
  'lc-green': (v) => (v === 'DEFAULT' ? '--lc-green' : `--lc-green-${v}`),
  'scout-cream': () => '--scout-cream',
  'brand-cyan': () => '--brand-cyan',
  'brand-red': () => '--brand-red',
};

function isColorScale(value: unknown): value is ColorScale {
  return (
    typeof value === 'object' &&
    value !== null &&
    'DEFAULT' in (value as Record<string, unknown>) &&
    typeof (value as Record<string, unknown>).DEFAULT === 'string'
  );
}

/**
 * Converte un colore in stringa `r g b` (formato Tailwind alpha modifier).
 * Supporta `#RGB`, `#RRGGBB`, `rgb(r,g,b)` e `rgb(r g b)`. Restituisce null
 * se non riesce a parsare.
 */
function toRgbTriplet(input: string): string | null {
  const value = input.trim();
  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r} ${g} ${b}`;
  }
  const rgb = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) return `${rgb[1]} ${rgb[2]} ${rgb[3]}`;
  return null;
}

function pushColorVars(
  declarations: string[],
  key: string,
  value: BrandColors[string],
): void {
  const mapper = COLOR_VAR_MAP[key];
  if (!mapper) return;

  const emit = (variant: 'DEFAULT' | 'light' | 'dark', color: string) => {
    declarations.push(`${mapper(variant)}: ${color};`);
    const triplet = toRgbTriplet(color);
    if (triplet) {
      declarations.push(`${mapper(variant)}-rgb: ${triplet};`);
    }
  };

  if (typeof value === 'string') {
    emit('DEFAULT', value);
    return;
  }
  if (isColorScale(value)) {
    emit('DEFAULT', value.DEFAULT);
    if (value.light) emit('light', value.light);
    if (value.dark) emit('dark', value.dark);
  }
}

function pushShadowVars(declarations: string[], shadows: BrandShadows): void {
  for (const [name, css] of Object.entries(shadows)) {
    declarations.push(`--shadow-${name}: ${css};`);
  }
}

/**
 * Build a <style> block to inject into <head> that overrides the CSS variables
 * already declared in globals.css. Returned string is the inner CSS — caller
 * wraps it in <style dangerouslySetInnerHTML>.
 */
export function buildCssVarsBlock(input: {
  colors: BrandColors;
  shadows: BrandShadows;
}): string {
  const declarations: string[] = [];

  for (const [key, value] of Object.entries(input.colors)) {
    pushColorVars(declarations, key, value);
  }
  pushShadowVars(declarations, input.shadows);

  if (declarations.length === 0) return '';
  return `:root{${declarations.join('')}}`;
}
