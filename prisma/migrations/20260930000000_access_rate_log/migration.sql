CREATE TABLE "AccessRateLog" (
  "id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessRateLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessRateLog_endpoint_requestFingerprint_createdAt_idx"
  ON "AccessRateLog"("endpoint", "requestFingerprint", "createdAt");
