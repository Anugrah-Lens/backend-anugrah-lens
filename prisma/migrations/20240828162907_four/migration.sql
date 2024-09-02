/*
  Warnings:

  - You are about to drop the column `userId` on the `glasses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "glasses" DROP COLUMN "userId",
ALTER COLUMN "left" SET DATA TYPE TEXT,
ALTER COLUMN "right" SET DATA TYPE TEXT;
