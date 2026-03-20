import { Request, Response } from "express";
import { Prisma, prisma } from "@repo/db";
import * as z from "zod";
import { nanoid } from "nanoid";
import { BASE_URL, SLUG_CACHE_EXPIRES_IN } from "../utils/constant";
import { responseHandler } from "../utils/responseHandler";
import { CacheShape } from "../types/types";
import { removeLeastUsedCache } from "../utils/removeLeastUsedCache";
import { expiredSlugCacheCleanUP } from "../utils/expiredSlugCacheCleanUp";

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

  for (let i = 1; i <= 3; i++) {
    // console.log("loop on");

    try {
      // create slug
      const slug = nanoid(5);
      // const slug = "abc123";

      // create in db
      await prisma.shortenUrl.create({
        data: {
          slug,
          originalUrl: validatedInputBody.originalUrl,
        },
      });

      const resData = {
        shortenUrl: `${BASE_URL}/${slug}`,
      };
      return responseHandler<ShapeOfData>({
        statusCode: 201,
        success: true,
        error: null,
        data: resData,
        res,
      });
    } catch (e) {
      // prisma errors
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        const prismaError = e as Prisma.PrismaClientKnownRequestError;

        // prisma unique constraint errors
        if (prismaError.code === "P2002") {
          // console.log(JSON.stringify(e, null, 2));

          // first check for original url duplication
          const foundShortenUrlWithSameOriginalUrl =
            await prisma.shortenUrl.findUnique({
              where: {
                originalUrl: validatedInputBody.originalUrl,
              },
            });

          if (foundShortenUrlWithSameOriginalUrl) {
            const resData = {
              shortenUrl: `${BASE_URL}/${foundShortenUrlWithSameOriginalUrl.slug}`,
            };
            return responseHandler<ShapeOfData>({
              statusCode: 200,
              success: true,
              error: null,
              data: resData,
              res,
            });
          }

          // else -> slug duplication error occurs
          continue;
        }

        // other prisma error
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
  }

  // after loop -> means times
  return responseHandler<ShapeOfData>({
    statusCode: 500,
    success: false,
    error: "Timeout - due to slug collision",
    data: null,
    res,
  });
};

export const redirectUrlController = async (
  req: Request<{ slug: string }>,
  res: Response,
) => {
  let starTime = Date.now();

  try {
    const { slug } = req.params;

    // finding slug in cache first
    const foundItemInCache = shortenUrlCache.get(slug); // O(1)

    // if found in cache - no db call -> redirect
    if (foundItemInCache) {
      // console.log("using cache");
      // check if the cache is expired already
      if (foundItemInCache.expiresAt <= Date.now()) {
        // we will not use the cache and delete the cache
        shortenUrlCache.delete(slug);
      } else {
        // using the cache
        foundItemInCache.usedIn++; // using this cache
        res.setHeader("Location", foundItemInCache.originalUrl);
        console.log("Latency when using cache ", Date.now() - starTime);
        res.redirect(foundItemInCache.originalUrl);
        return;
      }
    }

    // else find the slug in db
    console.log("trying for db");
    const existingShortenUrl = await prisma.shortenUrl.findFirst({
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

    // if slug existed in db -> redirect and store it in cache for future use
    else {
      const originalUrl = existingShortenUrl.originalUrl;
      res.setHeader("Location", originalUrl);
      console.log("When using DB ", Date.now() - starTime);
      res.redirect(originalUrl);

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
        originalUrl: existingShortenUrl.originalUrl,
        usedIn: 0,
        expiresAt: Date.now() + SLUG_CACHE_EXPIRES_IN,
      }); // it has not used yet from cache so 0})
    }
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
