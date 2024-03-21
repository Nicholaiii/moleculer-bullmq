export const mapOver = <K, T>(map: Map<K,T>) =>
  <T2>(fn: (e: [K, T]) => T2) => [...map.entries()].map(fn)
