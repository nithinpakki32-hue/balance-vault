-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AccountRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AccountRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL DEFAULT 'CHECKING',
    "requestedBalance" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reason" TEXT,
    "status" "AccountRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminRemarks" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccountRequest_createdAccountId_fkey" FOREIGN KEY ("createdAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountRequest_userId_idx" ON "AccountRequest"("userId");
CREATE INDEX IF NOT EXISTS "AccountRequest_status_idx" ON "AccountRequest"("status");
CREATE INDEX IF NOT EXISTS "AccountRequest_createdAt_idx" ON "AccountRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "AccountRequest_reviewedById_idx" ON "AccountRequest"("reviewedById");
