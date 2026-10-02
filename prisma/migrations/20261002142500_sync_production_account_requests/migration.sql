-- Synchronise le schéma de production utilisé par la page Paramètres.
-- Les clauses IF NOT EXISTS rendent la migration sûre après le correctif live
-- déjà appliqué sur Neon.

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "monthlyContributionInterest" TEXT,
  ADD COLUMN IF NOT EXISTS "monthlyContributionAmount" INTEGER;

CREATE TABLE IF NOT EXISTS "account_requests" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "orgName" TEXT NOT NULL,
  "website" TEXT,
  "phone" TEXT,
  "monthlyContributionInterest" TEXT,
  "monthlyContributionAmount" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "account_requests"
  ADD COLUMN IF NOT EXISTS "monthlyContributionInterest" TEXT,
  ADD COLUMN IF NOT EXISTS "monthlyContributionAmount" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "account_requests_email_key"
  ON "account_requests"("email");
