CREATE TYPE "StorageCleanupStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "StorageCleanupTask" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" "StorageCleanupStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageCleanupTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageCleanupTask_bucket_path_key"
ON "StorageCleanupTask"("bucket", "path");

CREATE INDEX "StorageCleanupTask_status_nextAttemptAt_idx"
ON "StorageCleanupTask"("status", "nextAttemptAt");
