import { Request, Response } from "express";
import { Prisma, prisma } from "@repo/db";
import * as z from "zod";
import { BASE_URL } from "../utils/constant";
import { responseHandler } from "../utils/responseHandler";
import {
  foundItemInCacheAndTryToUse,
  writeSlugIntoCache,
} from "../utils/redirectController.helper";
import { createShortenUrlWithRetries } from "../utils/shortenUrlController.helper";
import { shortenUrlCache } from "../cache/cache";
import { logger } from "../utils/logger";

const ShortenURLInputSchema = z.object({
  originalUrl: z.url().refine((val) => val.startsWith("https://"), {
    message: "Must be a secure URL (https)",
  }),
});

// data shape for response data - this will be different for each controller
type ShapeOfData = {
  shortenUrl: string;
};

export const shortenUrlController = async (req: Request, res: Response) => {
  // internal monirtoring variables
  let dbUsed = false;
  const startTime = Date.now();

  // zod validation first
  let validatedInputBody: z.infer<typeof ShortenURLInputSchema>;

  try {
    validatedInputBody = ShortenURLInputSchema.parse(req.body);
  } catch (e) {
    // zod validation error
    if (e instanceof z.ZodError) {
      logger.info({
        cacheUsed: false,
        dbUsed,
        event: "shortenUrlController.ZodValidation",
        latencyInMs: Date.now() - startTime,
        method: req.method,
        path: req.originalUrl,
        statusCode: 400,
      });
      return responseHandler({
        statusCode: 400,
        success: false,
        error: "Zod error - failed to validate input body scheam",
        data: null,
        res,
        errorDetails: e.issues,
      });
    }
    logger.error(
      {
        cacheUsed: false,
        dbUsed,
        event: "shortenUrlController.zodNonValidationErr",
        latencyInMs: Date.now() - startTime,
        method: req.method,
        path: req.originalUrl,
        statusCode: 500,
      },
      e,
    );
    return responseHandler<ShapeOfData>({
      statusCode: 500,
      success: false,
      error: "Invalid request processing failed (at zod validation)",
      data: null,
      res,
    });
  }

  try {
    dbUsed = true;
    const createShortenUrlResult = await createShortenUrlWithRetries(
      validatedInputBody.originalUrl,
    );

    if (createShortenUrlResult.kind === "retry_exhausted") {
      logger.info({
        cacheUsed: false,
        dbUsed,
        event: "shortenUrlController.slugCollision",
        latencyInMs: Date.now() - startTime,
        method: req.method,
        path: req.originalUrl,
        statusCode: 500,
      });
      return responseHandler<ShapeOfData>({
        statusCode: 500,
        success: false,
        error: "Timeout - due to slug collision",
        data: null,
        res,
      });
    }

    const resData = {
      shortenUrl: `${BASE_URL}/${createShortenUrlResult.slug}`,
    };
    // monirtoring
    let event;
    switch (createShortenUrlResult.kind) {
      case "created":
        event = "shortenUrlController.created";
        break;
      case "existing":
        event = "shortenUrlController.existingUsed";
        break;
    }
    logger.info({
      cacheUsed: false,
      dbUsed,
      event,
      latencyInMs: Date.now() - startTime,
      method: req.method,
      path: req.originalUrl,
      statusCode: 200,
    });
    return responseHandler<ShapeOfData>({
      statusCode: createShortenUrlResult.kind === "created" ? 201 : 200,
      success: true,
      error: null,
      data: resData,
      res,
    });
  } catch (e) {
    // prisma errors
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(
        {
          cacheUsed: false,
          dbUsed,
          event: "shortenUrlController.PrismaError",
          latencyInMs: Date.now() - startTime,
          method: req.method,
          path: req.originalUrl,
          statusCode: 500,
        },
        e,
      );

      return responseHandler<ShapeOfData>({
        statusCode: 500,
        success: false,
        error: "Some prisma error occured",
        data: null,
        res,
      });
    }

    // other normal error
    logger.error(
      {
        cacheUsed: false,
        dbUsed,
        event: "shortenUrlController.NonPrismaError",
        latencyInMs: Date.now() - startTime,
        method: req.method,
        path: req.originalUrl,
        statusCode: 500,
      },
      e,
    );
    return responseHandler<ShapeOfData>({
      statusCode: 500,
      success: false,
      error: "Something wrong happened",
      data: null,
      res,
    });
  }
};

export const redirectUrlController = async (
  req: Request<{ slug: string }>,
  res: Response,
) => {
  const startTime = Date.now();
  let dbUsed = false; // for internal monirtoring

  try {
    const { slug } = req.params;

    const cacheLookup = foundItemInCacheAndTryToUse(shortenUrlCache, slug);
    if (cacheLookup.cacheUsed) {
      res.setHeader("Location", cacheLookup.foundItemInCache.originalUrl);
      res.status(302).redirect(cacheLookup.foundItemInCache.originalUrl);
      logger.info({
        event: "redirectController.CacheFound",
        cacheUsed: true,
        dbUsed,
        latencyInMs: Date.now() - startTime,
        path: req.originalUrl,
        statusCode: 302,
        method: req.method,
      });
      return;
    }

    dbUsed = true;
    const existingShortenUrl = await prisma.shortenUrl.findUnique({
      where: {
        slug,
      },
    });

    // if not found in db -> 404 (that means no such slug in db, you have to shorten the url first )
    if (!existingShortenUrl) {
      logger.info({
        event: "redirectUrlController.DBUrlNotFound",
        cacheUsed: false,
        dbUsed,
        latencyInMs: Date.now() - startTime,
        path: req.originalUrl,
        statusCode: 404,
        method: req.method,
      });
      return responseHandler<ShapeOfData>({
        statusCode: 404,
        success: false,
        error:
          "No such url exist, you have to first shorten the url, check docs for that",
        data: null,
        res,
      });
    }

    // when we got the slug in db
    const originalUrl = existingShortenUrl.originalUrl;
    writeSlugIntoCache(shortenUrlCache, slug, originalUrl);
    res.setHeader("Location", originalUrl);
    logger.info({
      event: "redirectUrlController.FoundInDB",
      cacheUsed: false,
      dbUsed,
      latencyInMs: Date.now() - startTime,
      path: req.originalUrl,
      statusCode: 302,
      method: req.method,
    });
    res.status(302).redirect(originalUrl);
  } catch (error) {
    // if something wrong happened while db call and all
    logger.error(
      {
        event: "redirectUrlController.CatchError",
        cacheUsed: false,
        dbUsed,
        latencyInMs: Date.now() - startTime,
        path: req.originalUrl,
        statusCode: 500,
        method: req.method,
      },
      error,
    );
    return responseHandler<ShapeOfData>({
      statusCode: 500,
      success: false,
      error: "Someting went wrong",
      data: null,
      res,
    });
  }
};
