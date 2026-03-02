/*
  Warnings:

  - You are about to drop the column `rangeSopReference` on the `MasterInstrument` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `MasterInstrument` table without a default value. This is not possible if the table is not empty.
  - Made the column `assetNumber` on table `MasterInstrument` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "address" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "assignedHodId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerAccount_assignedHodId_fkey" FOREIGN KEY ("assignedHodId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllowedGoogleEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ENGINEER',
    "hodId" TEXT,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CustomerRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerRegistration_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CustomerRegistration_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CustomerUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "companyName" TEXT,
    "customerAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerUser_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CustomerUser" ("companyName", "createdAt", "email", "id", "isActive", "name", "passwordHash") SELECT "companyName", "createdAt", "email", "id", "isActive", "name", "passwordHash" FROM "CustomerUser";
DROP TABLE "CustomerUser";
ALTER TABLE "new_CustomerUser" RENAME TO "CustomerUser";
CREATE UNIQUE INDEX "CustomerUser_email_key" ON "CustomerUser"("email");
CREATE INDEX "CustomerUser_customerAccountId_idx" ON "CustomerUser"("customerAccountId");
CREATE TABLE "new_MasterInstrument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legacyId" INTEGER,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "assetNumber" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "usage" TEXT,
    "calibratedAtLocation" TEXT,
    "reportNo" TEXT,
    "calibrationDueDate" DATETIME,
    "rangeData" TEXT,
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importedFromJson" BOOLEAN NOT NULL DEFAULT false,
    "lastModifiedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterInstrument_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MasterInstrument" ("assetNumber", "calibratedAtLocation", "calibrationDueDate", "category", "description", "id", "isActive", "make", "model", "remarks", "serialNumber") SELECT "assetNumber", "calibratedAtLocation", "calibrationDueDate", "category", "description", "id", "isActive", "make", "model", "remarks", "serialNumber" FROM "MasterInstrument";
DROP TABLE "MasterInstrument";
ALTER TABLE "new_MasterInstrument" RENAME TO "MasterInstrument";
CREATE UNIQUE INDEX "MasterInstrument_legacyId_key" ON "MasterInstrument"("legacyId");
CREATE UNIQUE INDEX "MasterInstrument_assetNumber_key" ON "MasterInstrument"("assetNumber");
CREATE INDEX "MasterInstrument_category_idx" ON "MasterInstrument"("category");
CREATE INDEX "MasterInstrument_description_idx" ON "MasterInstrument"("description");
CREATE INDEX "MasterInstrument_assetNumber_idx" ON "MasterInstrument"("assetNumber");
CREATE INDEX "MasterInstrument_calibrationDueDate_idx" ON "MasterInstrument"("calibrationDueDate");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ENGINEER',
    "assignedHodId" TEXT,
    "signatureUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "googleId" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'PASSWORD',
    "profileImageUrl" TEXT,
    CONSTRAINT "User_assignedHodId_fkey" FOREIGN KEY ("assignedHodId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("assignedHodId", "createdAt", "email", "id", "isActive", "name", "passwordHash", "role", "signatureUrl", "updatedAt") SELECT "assignedHodId", "createdAt", "email", "id", "isActive", "name", "passwordHash", "role", "signatureUrl", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_companyName_key" ON "CustomerAccount"("companyName");

-- CreateIndex
CREATE INDEX "CustomerAccount_companyName_idx" ON "CustomerAccount"("companyName");

-- CreateIndex
CREATE INDEX "CustomerAccount_assignedHodId_idx" ON "CustomerAccount"("assignedHodId");

-- CreateIndex
CREATE UNIQUE INDEX "AllowedGoogleEmail_email_key" ON "AllowedGoogleEmail"("email");

-- CreateIndex
CREATE INDEX "AllowedGoogleEmail_email_idx" ON "AllowedGoogleEmail"("email");

-- CreateIndex
CREATE INDEX "AllowedGoogleEmail_type_idx" ON "AllowedGoogleEmail"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRegistration_email_key" ON "CustomerRegistration"("email");

-- CreateIndex
CREATE INDEX "CustomerRegistration_status_idx" ON "CustomerRegistration"("status");

-- CreateIndex
CREATE INDEX "CustomerRegistration_customerAccountId_idx" ON "CustomerRegistration"("customerAccountId");
