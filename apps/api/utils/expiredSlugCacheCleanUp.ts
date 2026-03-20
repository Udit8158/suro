import { CacheShape } from "../types/types";

// it will change the given map directly
// it will remove the expired items from the given map
export function expiredSlugCacheCleanUP(cache: Map<string, CacheShape>) {
  cache.forEach((val, key) => {
    if (val.expiresAt <= Date.now()) {
      cache.delete(key);
    }
  });
}
