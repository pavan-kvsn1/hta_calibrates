-- CreateTable
CREATE TABLE "SigningEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "signatureId" TEXT,
    "sequenceNumber" INTEGER NOT NULL,
    "previousHash" TEXT NOT NULL,
    "recordHash" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SigningEvidence_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SigningEvidence_certificateId_idx" ON "SigningEvidence"("certificateId");

-- CreateIndex
CREATE UNIQUE INDEX "SigningEvidence_certificateId_sequenceNumber_key" ON "SigningEvidence"("certificateId", "sequenceNumber");
