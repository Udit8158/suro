import "dotenv/config";

export const PORT = process.env.PORT || 3000;
export const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// slug cache expiry
export const SLUG_CACHE_EXPIRES_IN = 5 * 60 * 1000; // in ms - 5min
// export const SLUG_CACHE_EXPIRES_IN = 10 * 1000; // in ms - 10s (for mannual test purpsose)
