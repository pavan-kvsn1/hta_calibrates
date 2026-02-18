-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CertificateEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "userRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CertificateEvent_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CertificateEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CertificateEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CertificateEvent" ("certificateId", "createdAt", "eventData", "eventType", "id", "revision", "sequenceNumber", "userId", "userRole") SELECT "certificateId", "createdAt", "eventData", "eventType", "id", "revision", "sequenceNumber", "userId", "userRole" FROM "CertificateEvent";
DROP TABLE "CertificateEvent";
ALTER TABLE "new_CertificateEvent" RENAME TO "CertificateEvent";
CREATE INDEX "CertificateEvent_certificateId_createdAt_idx" ON "CertificateEvent"("certificateId", "createdAt");
CREATE INDEX "CertificateEvent_certificateId_revision_idx" ON "CertificateEvent"("certificateId", "revision");
CREATE UNIQUE INDEX "CertificateEvent_certificateId_sequenceNumber_key" ON "CertificateEvent"("certificateId", "sequenceNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
