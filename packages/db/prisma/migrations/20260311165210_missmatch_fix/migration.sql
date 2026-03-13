/*
  Warnings:

  - A unique constraint covering the columns `[originalUrl]` on the table `ShortenUrl` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ShortenUrl_originalUrl_key" ON "ShortenUrl"("originalUrl");
