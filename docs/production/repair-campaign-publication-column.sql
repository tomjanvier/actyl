-- Actyl campaign page production repair
-- Cloudflare logs identified: column campaigns.isPublished does not exist.
-- This additive, idempotent change aligns the production database with prisma/schema.prisma.
-- Apply once to the Actyl PostgreSQL database, then retry /campaigns.
ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;
