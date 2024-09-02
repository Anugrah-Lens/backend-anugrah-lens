-- AlterTable
ALTER TABLE "glasses" ALTER COLUMN "paymentStatus" SET DEFAULT 'Unpaid';

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "paidDate" TIMESTAMP(3),
    "amount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "glassId" TEXT,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_glassId_fkey" FOREIGN KEY ("glassId") REFERENCES "glasses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
