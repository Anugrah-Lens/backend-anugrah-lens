-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Paid', 'Unpaid');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Cash', 'Installments');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "glasses" (
    "id" TEXT NOT NULL,
    "frame" TEXT NOT NULL,
    "lensTyoe" TEXT NOT NULL,
    "left" INTEGER NOT NULL,
    "right" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "deposit" INTEGER NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "PaymentStatus" "PaymentStatus" NOT NULL,
    "PaymentMethod" "PaymentMethod" NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,

    CONSTRAINT "glasses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "glasses" ADD CONSTRAINT "glasses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
