import { Request, Response } from "express";
import { Prisma, prisma } from "@repo/db";
import * as z from "zod";
import { nanoid } from "nanoid";
import "dotenv/config";
import { BASE_URL } from "../utils/constant";
import { responseHandler } from "../utils/responseHandler";

// zod schema
const ShortenURLInputSchema = z.object({
  originalUrl: z.url().refine((val) => val.startsWith("https://"), {
    message: "Must be a secure URL (https)",
  }),
});

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
        // prisma unique constraint errors
        if (e.code === "P2002") {
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
  try {
    const { slug } = req.params;

    // find the slug in db
    const existingShortenUrl = await prisma.shortenUrl.findFirst({
      where: {
        slug,
      },
    });

    // if not existed -> 404
    if (!existingShortenUrl) {
      return responseHandler<ShapeOfData>({
        statusCode: 404,
        success: false,
        error: "No such url exist",
        data: null,
        res,
      });
      // return res.status(404).json({
      //   error: "No such url exists",
      // });
    }
    // if existed -> redirect
    else {
      const originalUrl = existingShortenUrl.originalUrl;
      res.setHeader("Location", originalUrl);

      res.redirect(originalUrl);
    }
  } catch (error) {
    console.log(error);
    return responseHandler<ShapeOfData>({
      statusCode: 500,
      success: false,
      error: "Someting went wrong",
      data: null,
      res,
    });
    // res.status(500).json({ error: "Something went wrong" });
  }
};
