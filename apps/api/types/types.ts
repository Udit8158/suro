// export type CacheShape = {
//   slug: string;
//   originalUrl: string;
//   usedIn: number;
// };
export type CacheShape = {
  originalUrl: string;
  usedIn: number;
  expiresAt: number; // some in ms unix date format
};
