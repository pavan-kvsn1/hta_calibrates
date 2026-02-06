-- CreateTable
CREATE TABLE "OpenSignDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "openSignDocumentId" TEXT NOT NULL,
    "signerType" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signingUrl" TEXT,
    "signedPdfUrl" TEXT,
    "auditTrailUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpenSignDocument_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenSignDocument_openSignDocumentId_key" ON "OpenSignDocument"("openSignDocumentId");

-- CreateIndex
CREATE INDEX "OpenSignDocument_certificateId_idx" ON "OpenSignDocument"("certificateId");

-- CreateIndex
CREATE INDEX "OpenSignDocument_status_idx" ON "OpenSignDocument"("status");
