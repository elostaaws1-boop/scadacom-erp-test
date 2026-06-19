-- CreateEnum
CREATE TYPE "ExcelImportStatus" AS ENUM ('UPLOADED', 'MAPPED', 'ANALYZED', 'APPROVED', 'REJECTED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ExcelImportRowStatus" AS ENUM ('PENDING', 'MATCHED', 'UNMATCHED', 'DUPLICATE', 'APPROVED', 'REJECTED', 'IMPORTED');

-- CreateTable
CREATE TABLE "ExcelImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ExcelImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "notes" TEXT,
    "columnMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcelImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcelImportSheet" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "headers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcelImportSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcelImportRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "mappedData" JSONB,
    "siteId" TEXT,
    "projectName" TEXT,
    "matchedProjectId" TEXT,
    "category" TEXT,
    "amount" DECIMAL(14,2),
    "date" TIMESTAMP(3),
    "status" "ExcelImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "redFlags" JSONB,
    "duplicateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcelImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcelImportSummary" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "duplicateRows" INTEGER NOT NULL,
    "unmatchedRows" INTEGER NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalBySite" JSONB NOT NULL,
    "totalByProject" JSONB NOT NULL,
    "totalByCategory" JSONB NOT NULL,
    "redFlags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcelImportSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExcelImport_uploadedById_idx" ON "ExcelImport"("uploadedById");

-- CreateIndex
CREATE INDEX "ExcelImport_status_idx" ON "ExcelImport"("status");

-- CreateIndex
CREATE INDEX "ExcelImport_uploadedAt_idx" ON "ExcelImport"("uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExcelImportSheet_importId_sheetName_key" ON "ExcelImportSheet"("importId", "sheetName");

-- CreateIndex
CREATE INDEX "ExcelImportSheet_importId_idx" ON "ExcelImportSheet"("importId");

-- CreateIndex
CREATE INDEX "ExcelImportRow_importId_status_idx" ON "ExcelImportRow"("importId", "status");

-- CreateIndex
CREATE INDEX "ExcelImportRow_matchedProjectId_idx" ON "ExcelImportRow"("matchedProjectId");

-- CreateIndex
CREATE INDEX "ExcelImportRow_siteId_idx" ON "ExcelImportRow"("siteId");

-- CreateIndex
CREATE INDEX "ExcelImportRow_date_idx" ON "ExcelImportRow"("date");

-- CreateIndex
CREATE INDEX "ExcelImportRow_duplicateKey_idx" ON "ExcelImportRow"("duplicateKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExcelImportSummary_importId_key" ON "ExcelImportSummary"("importId");

-- AddForeignKey
ALTER TABLE "ExcelImport" ADD CONSTRAINT "ExcelImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcelImportSheet" ADD CONSTRAINT "ExcelImportSheet_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ExcelImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcelImportRow" ADD CONSTRAINT "ExcelImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ExcelImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcelImportRow" ADD CONSTRAINT "ExcelImportRow_matchedProjectId_fkey" FOREIGN KEY ("matchedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcelImportSummary" ADD CONSTRAINT "ExcelImportSummary_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ExcelImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
