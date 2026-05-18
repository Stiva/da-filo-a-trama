import { getCopy } from './copy';
import { CopyClientProvider } from './CopyContext';

/**
 * Server Component wrapper that fetches the copy map and seeds the client
 * context. Use it once near the root layout so every Client Component below
 * can call `useCopy()`.
 */
export default async function CopyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const map = await getCopy();
  const initial: Record<string, string> = {};
  for (const [k, v] of map.entries()) initial[k] = v;
  return <CopyClientProvider initial={initial}>{children}</CopyClientProvider>;
}
