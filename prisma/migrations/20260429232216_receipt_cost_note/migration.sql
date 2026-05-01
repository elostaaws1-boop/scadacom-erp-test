-- AlterTable
ALTER TABLE "ReceiptAttachment" ADD COLUMN     "costMad" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "note" TEXT;
