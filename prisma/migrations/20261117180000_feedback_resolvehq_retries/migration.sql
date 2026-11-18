ALTER TABLE "feedback_reports"
  ADD COLUMN IF NOT EXISTS "resolvehqRetryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "resolvehqLastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvehqNextRetryAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "feedback_reports_resolvehqSyncState_resolvehqNextRetryAt_idx"
  ON "feedback_reports"("resolvehqSyncState", "resolvehqNextRetryAt");
