'use client';

import { createContext, useContext, useMemo } from 'react';
import type { CopyKey } from './defaults';

type CopyOpts = { vars?: Record<string, string | number> };

type CopyMap = Record<string, string>;

const CopyContext = createContext<CopyMap>({});

function substitute(value: string, vars?: CopyOpts['vars']): string {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) =>
    name in vars ? String(vars[name as keyof typeof vars]) : `{${name}}`,
  );
}

export function CopyClientProvider({
  initial,
  children,
}: {
  initial: CopyMap;
  children: React.ReactNode;
}) {
  return <CopyContext.Provider value={initial}>{children}</CopyContext.Provider>;
}

export type CopyKeyLike = CopyKey | (string & {});

export function useCopy() {
  const map = useContext(CopyContext);
  return useMemo(
    () => (key: CopyKeyLike, opts: CopyOpts = {}) =>
      substitute(map[key] ?? key, opts.vars),
    [map],
  );
}
