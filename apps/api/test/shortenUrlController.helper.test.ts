import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, prisma } from "@repo/db";
import { nanoid } from "nanoid";

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");

  return {
    ...actual,
    prisma: {
      shortenUrl: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock("nanoid", () => ({
  nanoid: vi.fn(),
}));

const mockedPrisma = vi.mocked(prisma, { deep: true });
const mockedNanoid = vi.mocked(nanoid);
let createShortenUrlWithRetries: (originalUrl: string) => Promise<unknown>;

function createPrismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("test prisma error", {
    code,
    clientVersion: "test",
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  ({ createShortenUrlWithRetries } = await import(
    "../utils/shortenUrlController.helper.js"
  ));
});

describe("createShortenUrlWithRetries", () => {
  it("creates a shorten url on the first attempt", async () => {
    mockedNanoid.mockReturnValueOnce("abcde");
    mockedPrisma.shortenUrl.create.mockResolvedValueOnce({
      id: "1",
      slug: "abcde",
      originalUrl: "https://example.com",
    } as never);

    const result = await createShortenUrlWithRetries("https://example.com");

    expect(result).toStrictEqual({
      kind: "created",
      slug: "abcde",
    });
    expect(mockedNanoid).toHaveBeenCalledWith(5);
    expect(mockedPrisma.shortenUrl.create).toHaveBeenCalledWith({
      data: {
        slug: "abcde",
        originalUrl: "https://example.com",
      },
    });
    expect(mockedPrisma.shortenUrl.findUnique).not.toHaveBeenCalled();
  });

  it("returns the existing shorten url when originalUrl already exists", async () => {
    mockedNanoid.mockReturnValueOnce("taken");
    mockedPrisma.shortenUrl.create.mockRejectedValueOnce(
      createPrismaError("P2002"),
    );
    mockedPrisma.shortenUrl.findUnique.mockResolvedValueOnce({
      id: "1",
      slug: "saved",
      originalUrl: "https://example.com",
    } as never);

    const result = await createShortenUrlWithRetries("https://example.com");

    expect(result).toStrictEqual({
      kind: "existing",
      slug: "saved",
    });
    expect(mockedPrisma.shortenUrl.findUnique).toHaveBeenCalledWith({
      where: {
        originalUrl: "https://example.com",
      },
    });
  });

  it("retries when the generated slug collides but originalUrl is new", async () => {
    mockedNanoid.mockReturnValueOnce("first").mockReturnValueOnce("second");
    mockedPrisma.shortenUrl.create
      .mockRejectedValueOnce(createPrismaError("P2002"))
      .mockResolvedValueOnce({
        id: "2",
        slug: "second",
        originalUrl: "https://example.com",
      } as never);
    mockedPrisma.shortenUrl.findUnique.mockResolvedValueOnce(null);

    const result = await createShortenUrlWithRetries("https://example.com");

    expect(result).toStrictEqual({
      kind: "created",
      slug: "second",
    });
    expect(mockedPrisma.shortenUrl.create).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.shortenUrl.findUnique).toHaveBeenCalledTimes(1);
  });

  it("returns retry_exhausted after 3 slug collisions", async () => {
    mockedNanoid
      .mockReturnValueOnce("first")
      .mockReturnValueOnce("second")
      .mockReturnValueOnce("third");
    mockedPrisma.shortenUrl.create
      .mockRejectedValueOnce(createPrismaError("P2002"))
      .mockRejectedValueOnce(createPrismaError("P2002"))
      .mockRejectedValueOnce(createPrismaError("P2002"));
    mockedPrisma.shortenUrl.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await createShortenUrlWithRetries("https://example.com");

    expect(result).toStrictEqual({
      kind: "retry_exhausted",
    });
    expect(mockedPrisma.shortenUrl.create).toHaveBeenCalledTimes(3);
    expect(mockedPrisma.shortenUrl.findUnique).toHaveBeenCalledTimes(3);
  });

  it("rethrows non prisma errors", async () => {
    mockedNanoid.mockReturnValueOnce("abcde");
    mockedPrisma.shortenUrl.create.mockRejectedValueOnce(new Error("boom"));

    await expect(
      createShortenUrlWithRetries("https://example.com"),
    ).rejects.toThrow("boom");
  });

  it("rethrows prisma errors other than P2002", async () => {
    mockedNanoid.mockReturnValueOnce("abcde");
    mockedPrisma.shortenUrl.create.mockRejectedValueOnce(
      createPrismaError("P2025"),
    );

    await expect(
      createShortenUrlWithRetries("https://example.com"),
    ).rejects.toMatchObject({
      code: "P2025",
    });
  });
});
