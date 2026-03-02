-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ENGINEER',
    "assignedHodId" TEXT,
    "signatureUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_assignedHodId_fkey" FOREIGN KEY ("assignedHodId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MasterInstrument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rangeSopReference" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "assetNumber" TEXT,
    "serialNumber" TEXT NOT NULL,
    "calibratedAtLocation" TEXT,
    "calibrationDueDate" DATETIME NOT NULL,
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certificate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "calibratedAt" TEXT NOT NULL,
    "dateOfCalibration" DATETIME NOT NULL,
    "calibrationDueDate" DATETIME NOT NULL,
    "calibrationTenure" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerAddress" TEXT NOT NULL,
    "uucDescription" TEXT NOT NULL,
    "uucMake" TEXT NOT NULL,
    "uucModel" TEXT NOT NULL,
    "uucInstrumentId" TEXT,
    "uucSerialNumber" TEXT NOT NULL,
    "uucLocationName" TEXT,
    "uucMachineName" TEXT,
    "ambientTemperature" REAL NOT NULL,
    "relativeHumidity" REAL NOT NULL,
    "uncertaintyValue" REAL,
    "uncertaintyUnit" TEXT,
    "traceabilityStatement" TEXT,
    "calibrationStatus" TEXT,
    "statusNotes" TEXT,
    "stickerOldRemoved" BOOLEAN NOT NULL DEFAULT false,
    "stickerNewAffixed" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME,
    "submittedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CertificateVersion_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CertificateVersion_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateParameter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "parameterUnit" TEXT NOT NULL,
    "rangeValue" TEXT NOT NULL,
    "rangeUnit" TEXT NOT NULL,
    "operatingRangeValue" TEXT,
    "operatingRangeUnit" TEXT,
    "leastCountValue" TEXT NOT NULL,
    "leastCountUnit" TEXT NOT NULL,
    "accuracyValue" REAL NOT NULL,
    "accuracyUnit" TEXT NOT NULL,
    "errorFormula" TEXT NOT NULL DEFAULT 'A-B',
    "displayOrder" INTEGER NOT NULL,
    CONSTRAINT "CertificateParameter_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CertificateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalibrationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parameterId" TEXT NOT NULL,
    "pointNumber" INTEGER NOT NULL,
    "standardReading" REAL NOT NULL,
    "beforeAdjustment" REAL NOT NULL,
    "afterAdjustment" REAL,
    "errorObserved" REAL NOT NULL,
    "isOutOfLimit" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CalibrationResult_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "CertificateParameter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateMasterInstrument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "parameterId" TEXT,
    "masterInstrumentId" TEXT NOT NULL,
    "sopReference" TEXT NOT NULL,
    CONSTRAINT "CertificateMasterInstrument_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CertificateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificateMasterInstrument_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "CertificateParameter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CertificateMasterInstrument_masterInstrumentId_fkey" FOREIGN KEY ("masterInstrumentId") REFERENCES "MasterInstrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "sectionReference" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewComment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CertificateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "signerType" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,
    CONSTRAINT "Signature_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Signature_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalToken_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "changes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerUser_email_key" ON "CustomerUser"("email");

-- CreateIndex
CREATE INDEX "MasterInstrument_category_idx" ON "MasterInstrument"("category");

-- CreateIndex
CREATE INDEX "MasterInstrument_description_idx" ON "MasterInstrument"("description");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateVersion_certificateId_versionNumber_key" ON "CertificateVersion"("certificateId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationResult_parameterId_pointNumber_key" ON "CalibrationResult"("parameterId", "pointNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalToken_token_key" ON "ApprovalToken"("token");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
