import type { CacheShape } from "../types/types";

// This is will remove the least used cached url
export function removeLeastUsedCache(shortenUrlCache: CacheShape[]) {
  let leastUsedInIndex = 0;

  for (let i = 1; i < shortenUrlCache.length; i++) {
    if (shortenUrlCache[i].usedIn < shortenUrlCache[leastUsedInIndex].usedIn) {
      leastUsedInIndex = i;
    }
  }

  shortenUrlCache.splice(leastUsedInIndex, 1);
}
