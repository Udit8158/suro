import { CacheShape } from "../types/types";
import { SLUG_CACHE_EXPIRES_IN } from "./constant";
import { expiredSlugCacheCleanUP } from "./expiredSlugCacheCleanUp";
import { removeLeastUsedCache } from "./removeLeastUsedCache";

type CacheLookupResult =
  | { cacheUsed: true; foundItemInCache: CacheShape }
  | { cacheUsed: false; foundItemInCache?: CacheShape };

export function foundItemInCacheAndTryToUse(
  shortenUrlCache: Map<string, CacheShape>,
  slug: string,
): CacheLookupResult {
  // finding slug in cache first
  const foundItemInCache = shortenUrlCache.get(slug); // O(1)

  // if found in cache
  if (foundItemInCache) {
    // check if the cache is expired already
    // we will not use the cache and delete the cache
    if (foundItemInCache.expiresAt <= Date.now()) {
      shortenUrlCache.delete(slug);
      // then flow will go the found the slug in db
      return { cacheUsed: false, foundItemInCache };
    } else {
      // using the cache
      foundItemInCache.usedIn++; // using this cache
      return { cacheUsed: true, foundItemInCache };
    }
  }
  // if not found cache
  return { cacheUsed: false };
}

export function writeSlugIntoCache(
  shortenUrlCache: Map<string, CacheShape>,
  slug: string,
  originalUrl: string,
) {
  // before storing the url in cache
  // cleanup the expired cache
  expiredSlugCacheCleanUP(shortenUrlCache);
  // remove an element based on size of cache and (least used one) (maintaining the cache)
  if (shortenUrlCache.size >= 100) {
    // we will delete the least used cache
    removeLeastUsedCache(shortenUrlCache);
  }
  // now add the url in cache for later use
  shortenUrlCache.set(slug, {
    originalUrl,
    usedIn: 0,
    expiresAt: Date.now() + SLUG_CACHE_EXPIRES_IN,
  }); // it has not used yet from cache so 0})
}
