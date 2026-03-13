import express, { Request, Response } from "express";
import { prisma } from "@repo/db/index";
import { Prisma, ShortenUrl } from "packages/db/generated/prisma/client";
import * as z from "zod";
import { nanoid } from "nanoid";
import "dotenv/config";
import createSlug from "./createSlug";

import extractTargetFields from "./utils/extractTargetFieldsPrisma";

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const app = express();
app.use(express.json());

// zod schema
const ShortenURLInputSchema = z.object({
  originalUrl: z.url().refine((val) => val.startsWith("https://"), {
    message: "Must be a secure URL (https)",
  }),
});

// health checking
app.get("/health", (req, res) => {
  res.json("OKAY");
});

// main routes
// app.post("/shorten", async (req: Request, res: Response) => {
//   try {
//     const validatedInputBody = ShortenURLInputSchema.parse(req.body);

//     // create a slug for this url and store in db
//     // const slug = nanoid(5);

//     // const dbRes = await prisma.shortenUrl.create({
//     //   data: {
//     //     originalUrl: validatedInputBody.originalUrl,
//     //     slug,
//     //   },
//     // });

//     const generatedSlug = await createSlug(async (slug) => {
//       await prisma.shortenUrl.create({
//         data: {
//           originalUrl: validatedInputBody.originalUrl,
//           slug,
//         },
//       });
//     });

//     return res.status(201).json({
//       shortenUrl: `http://localhost:${PORT}/${generatedSlug}`,
//     });
//   } catch (error) {
//     if (error instanceof z.ZodError) {
//       return res.status(400).json(error.issues);
//     }

//     // prisma error catching
//     if (error instanceof Prisma.PrismaClientKnownRequestError) {
//       // The .code property can be accessed in the `catch` block
//       // console.log(error.meta);s
//       if (error.code === "P2002") {
//         // You can also access the violating field(s)

//         const targetFields =
//           error.meta?.driverAdapterError?.cause?.constraint?.fields.map((f) =>
//             f.replace(/"/g, ""),
//           ) as string[];

//         // if originalUrl is in db already
//         if (targetFields.includes("originalUrl")) {
//           // find and give that
//           const existedShortenUrl = await prisma.shortenUrl.findUnique({
//             where: {
//               originalUrl: req.body.originalUrl,
//             },
//           });

//           return res.status(200).json({
//             shortenUrl: `http://localhost:${PORT}/${existedShortenUrl.slug}`,
//           });
//         }
//       }
//     }

//     console.log(error);
//     return res.status(500).json({ error: "Something went wrong" });
//   }
// });

app.post("/shorten", async (req, res) => {
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
    console.log("loop on");

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

          const targetFields = extractTargetFields(e);

          // original url already present in db
          if (targetFields?.includes("originalUrl")) {
            // get back that slug and return
            const foundShortenUrl = await prisma.shortenUrl.findUnique({
              where: {
                originalUrl: validatedInputBody.originalUrl,
              },
            });

            return res.status(201).json({
              shortenUrl: `${BASE_URL}/${foundShortenUrl?.slug}`,
            });
          }

          // slug collision
          if (targetFields?.includes("slug")) {
            continue;
          }
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
});

// redirect
app.get("/:slug", async (req, res) => {
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
});

// 404 handler for undefined routes (place before the error handler)
app.use((req, res) => {
  res.status(404).json("Sorry, can't find that!");
});

app.listen(PORT, () => {
  console.log("Server is running");
});
