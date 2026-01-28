/*
  Warnings:

  - You are about to drop the `CertificateParameter` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CertificateVersion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReviewComment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `currentVersion` on the `Certificate` table. All the data in the column will be lost.
  - You are about to drop the column `versionId` on the `CertificateMasterInstrument` table. All the data in the column will be lost.
  - Added the required column `lastModifiedById` to the `Certificate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `certificateId` to the `CertificateMasterInstrument` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CertificateVersion_certificateId_versionNumber_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CertificateParameter";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CertificateVersion";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ReviewComment";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CertificateEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CertificateEvent_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificateEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "snapshotData" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "submittedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewedById" TEXT,
    "reviewOutcome" TEXT,
    "reviewNotes" TEXT,
    "fromEventSeq" INTEGER NOT NULL,
    "toEventSeq" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CertificateRevision_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificateRevision_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CertificateRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "eventId" TEXT,
    "feedbackType" TEXT NOT NULL,
    "targetField" TEXT,
    "targetSection" TEXT,
    "comment" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewFeedback_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CertificateEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReviewFeedback_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Parameter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "parameterUnit" TEXT NOT NULL,
    "rangeMin" TEXT,
    "rangeMax" TEXT,
    "rangeUnit" TEXT,
    "operatingMin" TEXT,
    "operatingMax" TEXT,
    "operatingUnit" TEXT,
    "leastCountValue" TEXT,
    "leastCountUnit" TEXT,
    "accuracyValue" TEXT,
    "accuracyUnit" TEXT,
    "errorFormula" TEXT NOT NULL DEFAULT 'A-B',
    "showAfterAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Parameter_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApprovalToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalToken_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ApprovalToken" ("certificateId", "createdAt", "customerId", "expiresAt", "id", "token", "usedAt") SELECT "certificateId", "createdAt", "customerId", "expiresAt", "id", "token", "usedAt" FROM "ApprovalToken";
DROP TABLE "ApprovalToken";
ALTER TABLE "new_ApprovalToken" RENAME TO "ApprovalToken";
CREATE UNIQUE INDEX "ApprovalToken_token_key" ON "ApprovalToken"("token");
CREATE TABLE "new_CalibrationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parameterId" TEXT NOT NULL,
    "pointNumber" INTEGER NOT NULL,
    "standardReading" TEXT,
    "beforeAdjustment" TEXT,
    "afterAdjustment" TEXT,
    "errorObserved" REAL,
    "isOutOfLimit" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CalibrationResult_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CalibrationResult" ("afterAdjustment", "beforeAdjustment", "errorObserved", "id", "isOutOfLimit", "parameterId", "pointNumber", "standardReading") SELECT "afterAdjustment", "beforeAdjustment", "errorObserved", "id", "isOutOfLimit", "parameterId", "pointNumber", "standardReading" FROM "CalibrationResult";
DROP TABLE "CalibrationResult";
ALTER TABLE "new_CalibrationResult" RENAME TO "CalibrationResult";
CREATE INDEX "CalibrationResult_parameterId_idx" ON "CalibrationResult"("parameterId");
CREATE TABLE "new_Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "calibratedAt" TEXT,
    "srfNumber" TEXT,
    "srfDate" DATETIME,
    "dateOfCalibration" DATETIME,
    "calibrationTenure" INTEGER NOT NULL DEFAULT 12,
    "dueDateAdjustment" INTEGER NOT NULL DEFAULT 0,
    "calibrationDueDate" DATETIME,
    "customerName" TEXT,
    "customerAddress" TEXT,
    "uucDescription" TEXT,
    "uucMake" TEXT,
    "uucModel" TEXT,
    "uucSerialNumber" TEXT,
    "uucInstrumentId" TEXT,
    "uucLocationName" TEXT,
    "uucMachineName" TEXT,
    "ambientTemperature" TEXT,
    "relativeHumidity" TEXT,
    "calibrationStatus" TEXT,
    "stickerOldRemoved" TEXT,
    "stickerNewAffixed" TEXT,
    "statusNotes" TEXT,
    "selectedConclusionStatements" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastModifiedById" TEXT NOT NULL,
    CONSTRAINT "Certificate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Certificate_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Certificate" ("certificateNumber", "createdAt", "createdById", "id", "status", "updatedAt") SELECT "certificateNumber", "createdAt", "createdById", "id", "status", "updatedAt" FROM "Certificate";
DROP TABLE "Certificate";
ALTER TABLE "new_Certificate" RENAME TO "Certificate";
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");
CREATE INDEX "Certificate_status_idx" ON "Certificate"("status");
CREATE INDEX "Certificate_createdById_idx" ON "Certificate"("createdById");
CREATE TABLE "new_CertificateMasterInstrument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "parameterId" TEXT,
    "masterInstrumentId" TEXT NOT NULL,
    "sopReference" TEXT NOT NULL,
    CONSTRAINT "CertificateMasterInstrument_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificateMasterInstrument_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CertificateMasterInstrument_masterInstrumentId_fkey" FOREIGN KEY ("masterInstrumentId") REFERENCES "MasterInstrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CertificateMasterInstrument" ("id", "masterInstrumentId", "parameterId", "sopReference") SELECT "id", "masterInstrumentId", "parameterId", "sopReference" FROM "CertificateMasterInstrument";
DROP TABLE "CertificateMasterInstrument";
ALTER TABLE "new_CertificateMasterInstrument" RENAME TO "CertificateMasterInstrument";
CREATE INDEX "CertificateMasterInstrument_certificateId_idx" ON "CertificateMasterInstrument"("certificateId");
CREATE TABLE "new_Signature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "signerType" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,
    "signerId" TEXT,
    CONSTRAINT "Signature_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signature_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Signature_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Signature" ("certificateId", "customerId", "id", "signatureData", "signedAt", "signerEmail", "signerName", "signerType") SELECT "certificateId", "customerId", "id", "signatureData", "signedAt", "signerEmail", "signerName", "signerType" FROM "Signature";
DROP TABLE "Signature";
ALTER TABLE "new_Signature" RENAME TO "Signature";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CertificateEvent_certificateId_createdAt_idx" ON "CertificateEvent"("certificateId", "createdAt");

-- CreateIndex
CREATE INDEX "CertificateEvent_certificateId_revision_idx" ON "CertificateEvent"("certificateId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateEvent_certificateId_sequenceNumber_key" ON "CertificateEvent"("certificateId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "CertificateRevision_certificateId_createdAt_idx" ON "CertificateRevision"("certificateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateRevision_certificateId_revisionNumber_key" ON "CertificateRevision"("certificateId", "revisionNumber");

-- CreateIndex
CREATE INDEX "ReviewFeedback_certificateId_revisionNumber_idx" ON "ReviewFeedback"("certificateId", "revisionNumber");

-- CreateIndex
CREATE INDEX "ReviewFeedback_certificateId_isResolved_idx" ON "ReviewFeedback"("certificateId", "isResolved");

-- CreateIndex
CREATE INDEX "Parameter_certificateId_idx" ON "Parameter"("certificateId");
