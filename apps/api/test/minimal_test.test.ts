import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeLeastUsedCache } from "../utils/removeLeastUsedCache";
import type { CacheShape } from "../types/types";
import request from "supertest";
import { Prisma, prisma } from "@repo/db";
import { app } from "../app";
import { shortenUrlCache } from "../controllers/url.controller";
import { BASE_URL, SLUG_CACHE_EXPIRES_IN } from "../utils/constant";
import { expiredSlugCacheCleanUP } from "../utils/expiredSlugCacheCleanUp";

// mock db seup
vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");

  return {
    ...actual,
    prisma: {
      shortenUrl: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };
});
const mockedPrisma = vi.mocked(prisma, { deep: true });

// before each call clearup the db
beforeEach(() => {
  vi.clearAllMocks();
  shortenUrlCache.clear();
});

// utility func for test
function createPrismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("test prisma error", {
    code,
    clientVersion: "test",
  });
}

// utility functions test
describe("testing removeLeastUsedCache function", () => {
  const timeNow = Date.now();
  const testCache: Map<string, CacheShape> = new Map();
  testCache.set("abc1", {
    originalUrl: "https://abc1.com",
    usedIn: 2,
    expiresAt: timeNow + SLUG_CACHE_EXPIRES_IN,
  });
  testCache.set("abc2", {
    originalUrl: "https://abc2.com",
    usedIn: 3,
    expiresAt: timeNow + SLUG_CACHE_EXPIRES_IN,
  });
  testCache.set("abc3", {
    originalUrl: "https://abc3.com",
    usedIn: 1,
    expiresAt: timeNow + SLUG_CACHE_EXPIRES_IN,
  });

  it("removes the least used url", () => {
    removeLeastUsedCache(testCache);

    expect(testCache.get("abc3")).toBe(undefined);

    expect(testCache.size).toBe(2);
  });
  it("shouldn't change any other cache", () => {
    expect(testCache.get("abc2")).toStrictEqual({
      originalUrl: "https://abc2.com",
      usedIn: 3,
      expiresAt: timeNow + SLUG_CACHE_EXPIRES_IN,
    });
  });
});

describe("testing expiredSlugCacheCleanUp function", () => {
  it("removes the expired cache", () => {
    const timeNow = Date.now();

    const testCache: Map<string, CacheShape> = new Map();
    testCache.set("abc1", {
      originalUrl: "https://abc1.com",
      usedIn: 2,
      expiresAt: timeNow + SLUG_CACHE_EXPIRES_IN,
    });
    testCache.set("abc2", {
      originalUrl: "https://abc2.com",
      usedIn: 3,
      expiresAt: timeNow + SLUG_CACHE_EXPIRES_IN,
    });
    testCache.set("abc3", {
      originalUrl: "https://abc3.com",
      usedIn: 1,
      expiresAt: timeNow - SLUG_CACHE_EXPIRES_IN, // expired
    });

    expiredSlugCacheCleanUP(testCache);

    expect(testCache.get("abc3")).toBe(undefined); // main one
    expect(testCache.size).toBe(2);
    expect(testCache.get("abc2")).toStrictEqual({
      originalUrl: "https://abc2.com",
      usedIn: 3,
      expiresAt: timeNow + SLUG_CACHE_EXPIRES_IN,
    });
  });
});

// routes test
describe("/api/health", () => {
  it("should return 200", async () => {
    const res = await request(app).get("/api/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("OKAY");
    expect(res.headers["content-type"]).toMatch(/json/);
  });
});

describe("/api/unknown", () => {
  it("should return 404", async () => {
    const res = await request(app).get("/api/unknown");
    expect(res.statusCode).toBe(404);
  });
});

describe("/api/url/shorten", () => {
  it("should return 400 for invalid input", async () => {
    const res = await request(app).post("/api/url/shorten").send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("should return 400 for non https url", async () => {
    const res = await request(app).post("/api/url/shorten").send({
      originalUrl: "http://example.com",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("should return 201 for valid url", async () => {
    mockedPrisma.shortenUrl.create.mockResolvedValueOnce({
      id: "1",
      slug: "abcde",
      originalUrl: "https://example.com",
    } as never);

    const res = await request(app).post("/api/url/shorten").send({
      originalUrl: "https://example.com",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shortenUrl.startsWith(`${BASE_URL}/`)).toBe(true);
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("should return 200 when url already exists", async () => {
    mockedPrisma.shortenUrl.create.mockRejectedValueOnce(
      createPrismaError("P2002"),
    );
    mockedPrisma.shortenUrl.findUnique.mockResolvedValueOnce({
      id: "1",
      slug: "taken1",
      originalUrl: "https://example.com",
    } as never);

    const res = await request(app).post("/api/url/shorten").send({
      originalUrl: "https://example.com",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shortenUrl).toBe(`${BASE_URL}/taken1`);
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("should return 500 when something goes wrong", async () => {
    mockedPrisma.shortenUrl.create.mockRejectedValueOnce(
      new Error("boom TEST ERROR TEST ERROR"),
    );

    const res = await request(app).post("/api/url/shorten").send({
      originalUrl: "https://example.com",
    });

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.headers["content-type"]).toMatch(/json/);
  });
});

describe("/:slug", () => {
  it("should return 404 when slug does not exist", async () => {
    mockedPrisma.shortenUrl.findFirst.mockResolvedValueOnce(null);

    const res = await request(app).get("/missing-slug");

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("should redirect when slug exists in db and add that in cache", async () => {
    mockedPrisma.shortenUrl.findFirst.mockResolvedValueOnce({
      id: "1",
      slug: "abc12",
      originalUrl: "https://example.com",
    } as never);

    const beforeRequest = Date.now();
    const res = await request(app).get("/abc12").redirects(0);
    const afterRequest = Date.now();
    const cachedUrl = shortenUrlCache.get("abc12");

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com");
    expect(cachedUrl?.originalUrl).toBe("https://example.com");
    expect(cachedUrl?.usedIn).toBe(0);
    expect(cachedUrl?.expiresAt).toBeGreaterThanOrEqual(
      beforeRequest + SLUG_CACHE_EXPIRES_IN,
    );
    expect(cachedUrl?.expiresAt).toBeLessThanOrEqual(
      afterRequest + SLUG_CACHE_EXPIRES_IN,
    );
  });

  it("should redirect from cache when slug exists in cache", async () => {
    shortenUrlCache.set("cache1", {
      originalUrl: "https://cached-example.com",
      usedIn: 0,
      expiresAt: Date.now() + SLUG_CACHE_EXPIRES_IN,
    });

    const res = await request(app).get("/cache1").redirects(0);

    expect(mockedPrisma.shortenUrl.findFirst).not.toHaveBeenCalled(); // should not call the db
    expect(mockedPrisma.shortenUrl.findUnique).not.toHaveBeenCalled(); // should not call the db
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://cached-example.com");
    expect(shortenUrlCache.get("cache1")?.usedIn).toBe(1); // using the cache for first time
  });

  it("should fail to redirect from cache when slug exists in cache but expired", async () => {
    shortenUrlCache.set("cache-expired", {
      originalUrl: "https://old-cached-example.com",
      usedIn: 4,
      expiresAt: Date.now() - 1000, // already expired
    });

    mockedPrisma.shortenUrl.findFirst.mockResolvedValueOnce({
      id: "1",
      slug: "cache-expired",
      originalUrl: "https://db-example.com",
    } as never);

    const res = await request(app).get("/cache-expired").redirects(0);

    expect(mockedPrisma.shortenUrl.findFirst).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.shortenUrl.findFirst).toHaveBeenCalledWith({
      where: {
        slug: "cache-expired",
      },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://db-example.com");

    expect(shortenUrlCache.get("cache-expired")?.originalUrl).toBe(
      "https://db-example.com",
    );
  });

  it("should return 500 when db call fails", async () => {
    mockedPrisma.shortenUrl.findFirst.mockRejectedValueOnce(
      new Error("boom TEST ERROR"),
    );

    const res = await request(app).get("/broken-slug");

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.headers["content-type"]).toMatch(/json/);
  });
});
