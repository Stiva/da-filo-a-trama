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

function pushColorVars(
  declarations: string[],
  key: string,
  value: BrandColors[string],
): void {
  const mapper = COLOR_VAR_MAP[key];
  if (!mapper) return;

  if (typeof value === 'string') {
    declarations.push(`${mapper('DEFAULT')}: ${value};`);
    return;
  }

  if (isColorScale(value)) {
    declarations.push(`${mapper('DEFAULT')}: ${value.DEFAULT};`);
    if (value.light) declarations.push(`${mapper('light')}: ${value.light};`);
    if (value.dark) declarations.push(`${mapper('dark')}: ${value.dark};`);
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
