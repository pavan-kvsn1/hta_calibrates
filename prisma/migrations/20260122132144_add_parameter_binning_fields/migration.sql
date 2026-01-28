-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Parameter" (
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
    "accuracyType" TEXT NOT NULL DEFAULT 'ABSOLUTE',
    "errorFormula" TEXT NOT NULL DEFAULT 'A-B',
    "showAfterAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "requiresBinning" BOOLEAN NOT NULL DEFAULT false,
    "bins" TEXT,
    "sopReference" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Parameter_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Parameter" ("accuracyUnit", "accuracyValue", "certificateId", "errorFormula", "id", "leastCountUnit", "leastCountValue", "operatingMax", "operatingMin", "operatingUnit", "parameterName", "parameterUnit", "rangeMax", "rangeMin", "rangeUnit", "showAfterAdjustment", "sortOrder") SELECT "accuracyUnit", "accuracyValue", "certificateId", "errorFormula", "id", "leastCountUnit", "leastCountValue", "operatingMax", "operatingMin", "operatingUnit", "parameterName", "parameterUnit", "rangeMax", "rangeMin", "rangeUnit", "showAfterAdjustment", "sortOrder" FROM "Parameter";
DROP TABLE "Parameter";
ALTER TABLE "new_Parameter" RENAME TO "Parameter";
CREATE INDEX "Parameter_certificateId_idx" ON "Parameter"("certificateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
