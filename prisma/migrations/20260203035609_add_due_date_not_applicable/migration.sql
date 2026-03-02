-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastModifiedById" TEXT NOT NULL,
    CONSTRAINT "Certificate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Certificate_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Certificate" ("ambientTemperature", "calibratedAt", "calibrationDueDate", "calibrationStatus", "calibrationTenure", "certificateNumber", "createdAt", "createdById", "currentRevision", "customerAddress", "customerName", "dateOfCalibration", "dueDateAdjustment", "id", "lastModifiedById", "relativeHumidity", "selectedConclusionStatements", "srfDate", "srfNumber", "status", "statusNotes", "stickerNewAffixed", "stickerOldRemoved", "updatedAt", "uucDescription", "uucInstrumentId", "uucLocationName", "uucMachineName", "uucMake", "uucModel", "uucSerialNumber") SELECT "ambientTemperature", "calibratedAt", "calibrationDueDate", "calibrationStatus", "calibrationTenure", "certificateNumber", "createdAt", "createdById", "currentRevision", "customerAddress", "customerName", "dateOfCalibration", "dueDateAdjustment", "id", "lastModifiedById", "relativeHumidity", "selectedConclusionStatements", "srfDate", "srfNumber", "status", "statusNotes", "stickerNewAffixed", "stickerOldRemoved", "updatedAt", "uucDescription", "uucInstrumentId", "uucLocationName", "uucMachineName", "uucMake", "uucModel", "uucSerialNumber" FROM "Certificate";
DROP TABLE "Certificate";
ALTER TABLE "new_Certificate" RENAME TO "Certificate";
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");
CREATE INDEX "Certificate_status_idx" ON "Certificate"("status");
CREATE INDEX "Certificate_createdById_idx" ON "Certificate"("createdById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
