-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CertificateMasterInstrument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "parameterId" TEXT,
    "masterInstrumentId" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "make" TEXT,
    "model" TEXT,
    "assetNo" TEXT,
    "serialNumber" TEXT,
    "calibratedAt" TEXT,
    "reportNo" TEXT,
    "calibrationDueDate" TEXT,
    "sopReference" TEXT NOT NULL,
    CONSTRAINT "CertificateMasterInstrument_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificateMasterInstrument_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CertificateMasterInstrument" ("certificateId", "id", "masterInstrumentId", "parameterId", "sopReference") SELECT "certificateId", "id", "masterInstrumentId", "parameterId", "sopReference" FROM "CertificateMasterInstrument";
DROP TABLE "CertificateMasterInstrument";
ALTER TABLE "new_CertificateMasterInstrument" RENAME TO "CertificateMasterInstrument";
CREATE INDEX "CertificateMasterInstrument_certificateId_idx" ON "CertificateMasterInstrument"("certificateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
