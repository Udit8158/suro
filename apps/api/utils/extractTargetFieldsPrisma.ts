import { Prisma } from "@repo/db";

export default function extractTargetFields(
  e: Prisma.PrismaClientKnownRequestError,
) {
  // @ts-ignore
  return e.meta?.driverAdapterError?.cause?.constraint?.fields.map(
    (f: string) => f.replace(/"/g, ""),
  ) as string[];
}
