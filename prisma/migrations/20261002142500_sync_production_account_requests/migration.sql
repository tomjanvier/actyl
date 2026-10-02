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

CREATE TABLE IF NOT EXISTS "oidc_clients" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "redirectUris" TEXT NOT NULL,
  "clientSecretHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "oidc_clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oidc_clients_clientId_key"
  ON "oidc_clients"("clientId");

CREATE TABLE IF NOT EXISTS "oidc_authorization_codes" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "codeChallenge" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oidc_authorization_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oidc_authorization_codes_codeHash_key"
  ON "oidc_authorization_codes"("codeHash");
CREATE INDEX IF NOT EXISTS "oidc_authorization_codes_expiresAt_idx"
  ON "oidc_authorization_codes"("expiresAt");

CREATE TABLE IF NOT EXISTS "oidc_access_tokens" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oidc_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oidc_access_tokens_tokenHash_key"
  ON "oidc_access_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "oidc_access_tokens_expiresAt_idx"
  ON "oidc_access_tokens"("expiresAt");
