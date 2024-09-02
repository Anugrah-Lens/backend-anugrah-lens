/*
  Warnings:

  - You are about to drop the column `userId` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `PaymentMethod` on the `glasses` table. All the data in the column will be lost.
  - You are about to drop the column `PaymentStatus` on the `glasses` table. All the data in the column will be lost.
  - You are about to drop the column `lensTyoe` on the `glasses` table. All the data in the column will be lost.
  - Added the required column `phone` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lensType` to the `glasses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentMethod` to the `glasses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentStatus` to the `glasses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "customers" DROP COLUMN "userId",
ADD COLUMN     "phone" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "glasses" DROP COLUMN "PaymentMethod",
DROP COLUMN "PaymentStatus",
DROP COLUMN "lensTyoe",
ADD COLUMN     "lensType" TEXT NOT NULL,
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL;
