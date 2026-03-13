type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  staleUntil: number;
  refreshing?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function getCached<T>(
  key: string,
  options: { ttlMs: number; staleMs?: number },
  loader: () => Promise<T> | T
): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry?.value !== undefined && now < entry.expiresAt) {
    return entry.value;
  }

  if (entry?.value !== undefined && now < entry.staleUntil) {
    if (!entry.refreshing) {
      entry.refreshing = Promise.resolve(loader())
        .then((value) => {
          cache.set(key, {
            value,
            expiresAt: Date.now() + options.ttlMs,
            staleUntil: Date.now() + options.ttlMs + (options.staleMs ?? 0),
          });
          return value;
        })
        .catch(() => entry.value as T)
        .finally(() => {
          const latest = cache.get(key) as CacheEntry<T> | undefined;
          if (latest) latest.refreshing = undefined;
        });
    }
    return entry.value;
  }

  const value = await loader();
  cache.set(key, {
    value,
    expiresAt: now + options.ttlMs,
    staleUntil: now + options.ttlMs + (options.staleMs ?? 0),
  });
  return value;
}
