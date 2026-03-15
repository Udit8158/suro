import { Request, Response } from "express";
import { Prisma, prisma } from "@repo/db";
import * as z from "zod";
import { nanoid } from "nanoid";
import "dotenv/config";
import { BASE_URL, PORT } from "../utils/constant";

// zod schema
const ShortenURLInputSchema = z.object({
  originalUrl: z.url().refine((val) => val.startsWith("https://"), {
    message: "Must be a secure URL (https)",
  }),
});

export const shortenUrlController = async (req: Request, res: Response) => {
  // zod validation first
  let validatedInputBody: z.infer<typeof ShortenURLInputSchema>;

  try {
    validatedInputBody = ShortenURLInputSchema.parse(req.body);
  } catch (e) {
    // zod validation error
    if (e instanceof z.ZodError) {
      return res.status(400).json({
        error: e.issues,
      });
    }
    return res
      .status(500)
      .json({ error: "Invalid request processing failed (at zod valiation)" });
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

      return res.status(201).json({
        shortenUrl: `${BASE_URL}/${slug}`,
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
            return res.status(200).json({
              shortenUrl: `${BASE_URL}/${foundShortenUrlWithSameOriginalUrl.slug}`,
            });
          }

          // else -> slug duplication error occurs
          continue;
        }

        // other prisma error
        console.log(e);
        return res.status(500).json({
          error: "Some prisma error occured",
        });
      }

      // other normal error
      console.log(e);
      return res.status(500).json({
        error: "Something wrong happened",
      });
    }
  }

  // after loop -> means times
  return res.status(503).json({
    error: "Timeout - due to slug collision",
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
      return res.status(404).json({
        error: "No such url exists",
      });
    }
    // if existed -> redirect
    else {
      const originalUrl = existingShortenUrl.originalUrl;
      res.setHeader("Location", originalUrl);

      res.redirect(originalUrl);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Something went wrong" });
  }
};
