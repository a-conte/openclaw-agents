const locks = new Map<string, Promise<void>>();

export async function withFileLock<T>(filePath: string, fn: () => T | Promise<T>): Promise<T> {
  const previous = locks.get(filePath) ?? Promise.resolve();

  let resolve: () => void;
  const current = new Promise<void>((r) => { resolve = r; });
  locks.set(filePath, current);

  try {
    await previous;
    return await fn();
  } finally {
    resolve!();
    if (locks.get(filePath) === current) {
      locks.delete(filePath);
    }
  }
}
