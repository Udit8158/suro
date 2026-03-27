import { NextFunction, Request, Response } from "express";
import { responseHandler } from "../utils/responseHandler";

type RouteName = "shorten" | "redirect";

type RateLimitEntry = {
  hitCount: number;
  windowEndAt: number;
};

const RATE_LIMIT_RULES: Record<RouteName, { limit: number; windowMs: number }> =
  {
    shorten: { limit: 10, windowMs: 10000 },
    redirect: { limit: 50, windowMs: 60000 },
  };

export const rateLimitStore: Map<string, RateLimitEntry> = new Map();

function resolveRouteName(req: Request): RouteName | null {
  if (req.method === "POST" && req.originalUrl === "/api/url/shorten") {
    return "shorten";
  }

  if (req.method === "GET" && typeof req.params.slug === "string") {
    return "redirect";
  }

  return null;
}

export function clearRateLimitStore() {
  rateLimitStore.clear();
}

export const rateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const routeName = resolveRouteName(req);
  if (!routeName) {
    next();
    return;
  }

  const { limit, windowMs } = RATE_LIMIT_RULES[routeName];
  const key = `${routeName}:${req.ip}`;
  const now = Date.now();
  const existingEntry = rateLimitStore.get(key);

  if (!existingEntry || existingEntry.windowEndAt <= now) {
    rateLimitStore.set(key, {
      hitCount: 1,
      windowEndAt: now + windowMs,
    });
    next();
    return;
  }

  if (existingEntry.hitCount >= limit) {
    responseHandler({
      statusCode: 429,
      success: false,
      error: "Too many requests",
      data: null,
      res,
    });
    return;
  }

  existingEntry.hitCount++;
  next();
};
