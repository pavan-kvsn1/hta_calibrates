/*
  Warnings:

  - Added the required column `revision` to the `SigningEvidence` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SigningEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "signatureId" TEXT,
    "revision" INTEGER NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "previousHash" TEXT NOT NULL,
    "recordHash" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SigningEvidence_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SigningEvidence" ("certificateId", "createdAt", "eventType", "evidence", "id", "previousHash", "recordHash", "sequenceNumber", "signatureId") SELECT "certificateId", "createdAt", "eventType", "evidence", "id", "previousHash", "recordHash", "sequenceNumber", "signatureId" FROM "SigningEvidence";
DROP TABLE "SigningEvidence";
ALTER TABLE "new_SigningEvidence" RENAME TO "SigningEvidence";
CREATE INDEX "SigningEvidence_certificateId_idx" ON "SigningEvidence"("certificateId");
CREATE INDEX "SigningEvidence_certificateId_revision_idx" ON "SigningEvidence"("certificateId", "revision");
CREATE UNIQUE INDEX "SigningEvidence_certificateId_sequenceNumber_key" ON "SigningEvidence"("certificateId", "sequenceNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
