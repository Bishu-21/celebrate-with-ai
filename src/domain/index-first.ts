/** Keeps the first item for each key. A later duplicate does not hide the earlier match. */
export function indexFirst<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T> {
  const map = new Map<K, T>();
  for (const item of items) {
    const id = key(item);
    if (!map.has(id)) map.set(id, item);
  }
  return map;
}
