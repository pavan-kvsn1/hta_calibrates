/*
  Warnings:

  - You are about to drop the column `assignedHodId` on the `CustomerAccount` table. All the data in the column will be lost.
  - You are about to drop the column `lastModifiedById` on the `MasterInstrument` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `MasterInstrument` table. All the data in the column will be lost.
  - You are about to drop the column `assignedHodId` on the `User` table. All the data in the column will be lost.
  - Added the required column `instrumentId` to the `MasterInstrument` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "CustomerRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "customerAccountId" TEXT NOT NULL,
    "requestedById" TEXT,
    "data" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerRequest_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CustomerRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "CustomerUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "threadType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatThread_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT,
    "customerId" TEXT,
    "senderType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UUCImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UUCImage_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UUCImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "scheduledFor" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateTable
CREATE TABLE "RealtimeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "customerId" TEXT,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InternalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "certificateId" TEXT,
    "data" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InternalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InternalRequest_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InternalRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "userType" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "revokedReason" TEXT,
    "replacedById" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "reviewerId" TEXT,
    "customerApprovedAt" DATETIME,
    "calibratedAt" TEXT,
    "srfNumber" TEXT,
    "srfDate" DATETIME,
    "dateOfCalibration" DATETIME,
    "calibrationTenure" INTEGER NOT NULL DEFAULT 12,
    "dueDateAdjustment" INTEGER NOT NULL DEFAULT 0,
    "calibrationDueDate" DATETIME,
    "dueDateNotApplicable" BOOLEAN NOT NULL DEFAULT false,
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
    "additionalConclusionStatement" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastModifiedById" TEXT NOT NULL,
    "signedPdfPath" TEXT,
    CONSTRAINT "Certificate_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Certificate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Certificate_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Certificate" ("ambientTemperature", "calibratedAt", "calibrationDueDate", "calibrationStatus", "calibrationTenure", "certificateNumber", "createdAt", "createdById", "currentRevision", "customerAddress", "customerName", "dateOfCalibration", "dueDateAdjustment", "dueDateNotApplicable", "id", "lastModifiedById", "relativeHumidity", "selectedConclusionStatements", "signedPdfPath", "srfDate", "srfNumber", "status", "statusNotes", "stickerNewAffixed", "stickerOldRemoved", "updatedAt", "uucDescription", "uucInstrumentId", "uucLocationName", "uucMachineName", "uucMake", "uucModel", "uucSerialNumber") SELECT "ambientTemperature", "calibratedAt", "calibrationDueDate", "calibrationStatus", "calibrationTenure", "certificateNumber", "createdAt", "createdById", "currentRevision", "customerAddress", "customerName", "dateOfCalibration", "dueDateAdjustment", "dueDateNotApplicable", "id", "lastModifiedById", "relativeHumidity", "selectedConclusionStatements", "signedPdfPath", "srfDate", "srfNumber", "status", "statusNotes", "stickerNewAffixed", "stickerOldRemoved", "updatedAt", "uucDescription", "uucInstrumentId", "uucLocationName", "uucMachineName", "uucMake", "uucModel", "uucSerialNumber" FROM "Certificate";
DROP TABLE "Certificate";
ALTER TABLE "new_Certificate" RENAME TO "Certificate";
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");
CREATE INDEX "Certificate_status_idx" ON "Certificate"("status");
CREATE INDEX "Certificate_createdById_idx" ON "Certificate"("createdById");
CREATE INDEX "Certificate_reviewerId_idx" ON "Certificate"("reviewerId");
CREATE TABLE "new_CustomerAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "address" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "assignedAdminId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "primaryPocId" TEXT,
    CONSTRAINT "CustomerAccount_primaryPocId_fkey" FOREIGN KEY ("primaryPocId") REFERENCES "CustomerUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerAccount_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CustomerAccount" ("address", "companyName", "contactEmail", "contactPhone", "createdAt", "id", "isActive", "updatedAt") SELECT "address", "companyName", "contactEmail", "contactPhone", "createdAt", "id", "isActive", "updatedAt" FROM "CustomerAccount";
DROP TABLE "CustomerAccount";
ALTER TABLE "new_CustomerAccount" RENAME TO "CustomerAccount";
CREATE UNIQUE INDEX "CustomerAccount_companyName_key" ON "CustomerAccount"("companyName");
CREATE UNIQUE INDEX "CustomerAccount_primaryPocId_key" ON "CustomerAccount"("primaryPocId");
CREATE INDEX "CustomerAccount_companyName_idx" ON "CustomerAccount"("companyName");
CREATE INDEX "CustomerAccount_assignedAdminId_idx" ON "CustomerAccount"("assignedAdminId");
CREATE TABLE "new_CustomerUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "companyName" TEXT,
    "customerAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPoc" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" DATETIME,
    "activationToken" TEXT,
    "activationExpiry" DATETIME,
    CONSTRAINT "CustomerUser_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CustomerUser" ("companyName", "createdAt", "customerAccountId", "email", "id", "isActive", "name", "passwordHash") SELECT "companyName", "createdAt", "customerAccountId", "email", "id", "isActive", "name", "passwordHash" FROM "CustomerUser";
DROP TABLE "CustomerUser";
ALTER TABLE "new_CustomerUser" RENAME TO "CustomerUser";
CREATE UNIQUE INDEX "CustomerUser_email_key" ON "CustomerUser"("email");
CREATE UNIQUE INDEX "CustomerUser_activationToken_key" ON "CustomerUser"("activationToken");
CREATE INDEX "CustomerUser_customerAccountId_idx" ON "CustomerUser"("customerAccountId");
CREATE INDEX "CustomerUser_activationToken_idx" ON "CustomerUser"("activationToken");
CREATE TABLE "new_MasterInstrument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrumentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
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
    "status" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "changeReason" TEXT,
    "importedFromJson" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MasterInstrument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MasterInstrument" ("assetNumber", "calibratedAtLocation", "calibrationDueDate", "category", "createdAt", "description", "id", "importedFromJson", "isActive", "legacyId", "make", "model", "rangeData", "remarks", "reportNo", "serialNumber", "usage") SELECT "assetNumber", "calibratedAtLocation", "calibrationDueDate", "category", "createdAt", "description", "id", "importedFromJson", "isActive", "legacyId", "make", "model", "rangeData", "remarks", "reportNo", "serialNumber", "usage" FROM "MasterInstrument";
DROP TABLE "MasterInstrument";
ALTER TABLE "new_MasterInstrument" RENAME TO "MasterInstrument";
CREATE INDEX "MasterInstrument_instrumentId_isLatest_idx" ON "MasterInstrument"("instrumentId", "isLatest");
CREATE INDEX "MasterInstrument_category_idx" ON "MasterInstrument"("category");
CREATE INDEX "MasterInstrument_description_idx" ON "MasterInstrument"("description");
CREATE INDEX "MasterInstrument_assetNumber_idx" ON "MasterInstrument"("assetNumber");
CREATE INDEX "MasterInstrument_calibrationDueDate_idx" ON "MasterInstrument"("calibrationDueDate");
CREATE UNIQUE INDEX "MasterInstrument_instrumentId_version_key" ON "MasterInstrument"("instrumentId", "version");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ENGINEER',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "adminType" TEXT,
    "assignedAdminId" TEXT,
    "signatureUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "googleId" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'PASSWORD',
    "profileImageUrl" TEXT,
    CONSTRAINT "User_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("authProvider", "createdAt", "email", "googleId", "id", "isActive", "name", "passwordHash", "profileImageUrl", "role", "signatureUrl", "updatedAt") SELECT "authProvider", "createdAt", "email", "googleId", "id", "isActive", "name", "passwordHash", "profileImageUrl", "role", "signatureUrl", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CustomerRequest_customerAccountId_idx" ON "CustomerRequest"("customerAccountId");

-- CreateIndex
CREATE INDEX "CustomerRequest_status_idx" ON "CustomerRequest"("status");

-- CreateIndex
CREATE INDEX "CustomerRequest_type_idx" ON "CustomerRequest"("type");

-- CreateIndex
CREATE INDEX "ChatThread_certificateId_idx" ON "ChatThread"("certificateId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThread_certificateId_threadType_key" ON "ChatThread"("certificateId", "threadType");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "ChatMessage_customerId_idx" ON "ChatMessage"("customerId");

-- CreateIndex
CREATE INDEX "ChatAttachment_messageId_idx" ON "ChatAttachment"("messageId");

-- CreateIndex
CREATE INDEX "UUCImage_certificateId_sortOrder_idx" ON "UUCImage"("certificateId", "sortOrder");

-- CreateIndex
CREATE INDEX "JobQueue_status_scheduledFor_priority_idx" ON "JobQueue"("status", "scheduledFor", "priority");

-- CreateIndex
CREATE INDEX "JobQueue_type_idx" ON "JobQueue"("type");

-- CreateIndex
CREATE INDEX "RealtimeEvent_userId_delivered_createdAt_idx" ON "RealtimeEvent"("userId", "delivered", "createdAt");

-- CreateIndex
CREATE INDEX "RealtimeEvent_customerId_delivered_createdAt_idx" ON "RealtimeEvent"("customerId", "delivered", "createdAt");

-- CreateIndex
CREATE INDEX "RealtimeEvent_channel_createdAt_idx" ON "RealtimeEvent"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "InternalRequest_certificateId_idx" ON "InternalRequest"("certificateId");

-- CreateIndex
CREATE INDEX "InternalRequest_status_idx" ON "InternalRequest"("status");

-- CreateIndex
CREATE INDEX "InternalRequest_type_idx" ON "InternalRequest"("type");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_customerId_idx" ON "RefreshToken"("customerId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
