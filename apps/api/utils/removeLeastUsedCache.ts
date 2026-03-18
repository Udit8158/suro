import type { CacheShape } from "../types/types";

// This is will remove the least used cached url
export function removeLeastUsedCache(shortenUrlCache: Map<string, CacheShape>) {
  if (shortenUrlCache.size === 0) {
    return;
  }

  let leastUsedInValue = Infinity;
  let leastUsedInSlug = "";

  shortenUrlCache.forEach((slugValue, slug) => {
    if (slugValue.usedIn < leastUsedInValue) {
      leastUsedInValue = slugValue.usedIn;
      leastUsedInSlug = slug;
    }
  });

  shortenUrlCache.delete(leastUsedInSlug);
}
