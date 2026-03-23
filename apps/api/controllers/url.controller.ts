import { Request, Response } from "express";
import { Prisma, prisma } from "@repo/db";
import * as z from "zod";
import { BASE_URL } from "../utils/constant";
import { responseHandler } from "../utils/responseHandler";
import { CacheShape } from "../types/types";
import {
  foundItemInCacheAndTryToUse,
  writeSlugIntoCache,
} from "../utils/redirectController.helper";
import { createShortenUrlWithRetries } from "../utils/shortenUrlController.helper";

// in memory cache
export let shortenUrlCache: Map<string, CacheShape> = new Map();
// slug -> {originalUrl: "", usedIn: num, expiresIn: Date}

// zod schema
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
  // zod validation first
  let validatedInputBody: z.infer<typeof ShortenURLInputSchema>;

  try {
    validatedInputBody = ShortenURLInputSchema.parse(req.body);
  } catch (e) {
    // zod validation error
    if (e instanceof z.ZodError) {
      return responseHandler({
        statusCode: 400,
        success: false,
        error: "Zod error - failed to validate input body scheam",
        data: null,
        res,
        errorDetails: e.issues,
      });
    }
    return responseHandler<ShapeOfData>({
      statusCode: 500,
      success: false,
      error: "Invalid request processing failed (at zod validation)",
      data: null,
      res,
    });
  }

  try {
    const createShortenUrlResult = await createShortenUrlWithRetries(
      validatedInputBody.originalUrl,
    );

    if (createShortenUrlResult.kind === "retry_exhausted") {
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
      console.log(e);

      return responseHandler<ShapeOfData>({
        statusCode: 500,
        success: false,
        error: "Some prisma error occured",
        data: null,
        res,
      });
    }

    // other normal error
    console.log(e);
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

  try {
    const { slug } = req.params;

    const cacheLookup = foundItemInCacheAndTryToUse(shortenUrlCache, slug);
    if (cacheLookup.cacheUsed) {
      res.setHeader("Location", cacheLookup.foundItemInCache.originalUrl);
      console.log("Latency when using cache ", Date.now() - startTime);
      res.redirect(cacheLookup.foundItemInCache.originalUrl);
      return;
    }

    console.log("trying for db");
    const existingShortenUrl = await prisma.shortenUrl.findUnique({
      where: {
        slug,
      },
    });

    // if not found in db -> 404 (that means no such slug in db, you have to shorten the url first )
    if (!existingShortenUrl) {
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
    console.log("When using DB ", Date.now() - startTime);
    res.redirect(originalUrl);
  } catch (error) {
    // if something wrong happened while db call and all
    console.log(error);
    return responseHandler<ShapeOfData>({
      statusCode: 500,
      success: false,
      error: "Someting went wrong",
      errorDetails: error,
      data: null,
      res,
    });
  }
};
