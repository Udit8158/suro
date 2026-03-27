import { CacheShape } from "../types/types";
import { expiredSlugCacheCleanUP } from "../utils/expiredSlugCacheCleanUp";

// in memory cache
export let shortenUrlCache: Map<string, CacheShape> = new Map();
// slug -> {originalUrl: "", usedIn: num, expiresIn: Date}

/**
  pass the time in sec - which will be the interval in which you want to cleanup the expired items from cache
*/
export const startCacheCleanUp = (timeInSec: number) => {
  return setInterval(() => {
    expiredSlugCacheCleanUP(shortenUrlCache);
  }, timeInSec * 1000);
};

// cache metrix for internal use
export const cacheStats = {
  hits: 0, // how many times a cache is getting hit and served
  misses: 0, // how many times it hit but didn't get response from cache
  expiredHits: 0, // if cache hit but that was expired
  writes: 0, // written to cache
  evictions: 0, // TTL base clean up, or size based or LFU
  size: 0, // Size of the cache
};
