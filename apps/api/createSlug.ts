import * as z from "zod";
import { nanoid } from "nanoid";
import { Prisma } from "../../packages/db/generated/prisma/client";

export default async function createSlug(addSlugToDb) {
  for (let i = 1; i <= 3; i++) {
    try {
      const slug = nanoid(5);
      await addSlugToDb(slug);

      console.log("returning");
      // if no db error
      return slug;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          const targetFields =
            error.meta?.driverAdapterError?.cause?.constraint?.fields.map((f) =>
              f.replace(/"/g, ""),
            ) as string[];

          // if slug collision happens
          if (targetFields.includes("slug")) {
            continue;
          }
        }
      } else {
        console.log(error);
      }
    }
  }
  // at the end of the loop - that means slug didn't generate
  throw Error("Slug collision happend - time out");
}
