-- CreateTable
CREATE TABLE "ShortenUrl" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,

    CONSTRAINT "ShortenUrl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortenUrl_slug_key" ON "ShortenUrl"("slug");
