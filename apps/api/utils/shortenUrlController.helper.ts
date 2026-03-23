import { Prisma, prisma } from "@repo/db";
import { nanoid } from "nanoid";

const SHORT_SLUG_LENGTH = 5;
const MAX_SLUG_CREATION_RETRIES = 3;

type CreateShortenUrlResult =
  | { kind: "created"; slug: string }
  | { kind: "existing"; slug: string }
  | { kind: "retry_exhausted" };
/**
we are trying to create a slug

then if we get prisma error - specially duplication error

first we are checking for originalUrl duplication - if that's the case, we are just retrieving the slug of the
same originalUrl and we are fine

but if that's not the case, that means slug collision occured (which is extremely rare case) and we are trying again (for loop)
*/
export async function createShortenUrlWithRetries(
  originalUrl: string,
): Promise<CreateShortenUrlResult> {
  for (let i = 1; i <= MAX_SLUG_CREATION_RETRIES; i++) {
    const slug = nanoid(SHORT_SLUG_LENGTH);

    try {
      await prisma.shortenUrl.create({
        data: {
          slug,
          originalUrl,
        },
      });

      return { kind: "created", slug };
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError)) {
        throw e;
      }

      const prismaError = e as Prisma.PrismaClientKnownRequestError;

      if (prismaError.code !== "P2002") {
        throw prismaError;
      }

      // only when P2002 (duplication) error happen - first checking for originalUrl duplication
      const foundShortenUrlWithSameOriginalUrl =
        await prisma.shortenUrl.findUnique({
          where: {
            originalUrl,
          },
        });

      if (foundShortenUrlWithSameOriginalUrl) {
        return {
          kind: "existing",
          slug: foundShortenUrlWithSameOriginalUrl.slug,
        };
      }
    }
  }

  return { kind: "retry_exhausted" };
}
