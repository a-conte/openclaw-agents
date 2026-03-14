import { useEffect, useState } from 'react';

/**
 * Returns a stable timestamp that is 0 during SSR and updates to Date.now()
 * on the client. Prevents hydration mismatches from time-dependent rendering.
 * Refreshes whenever `deps` change (e.g. pass SWR data to re-sync on fetch).
 */
export function useNow(deps: unknown[] = []): { now: number; hydrated: boolean } {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { now, hydrated: now > 0 };
}
