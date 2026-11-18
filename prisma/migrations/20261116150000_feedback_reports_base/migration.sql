-- Create the base table before the follow-up migrations add device, reply,
-- and ResolveHQ fields. The app's production database is managed separately
-- from this migration history, so keep creation idempotent.
CREATE TABLE IF NOT EXISTS "feedback_reports" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "expected" TEXT,
  "observed" TEXT,
  "steps" TEXT,
  "pagePath" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "githubSyncState" TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE',
  "githubSyncNote" TEXT,
  "githubIssueNumber" INTEGER,
  "githubIssueUrl" TEXT,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feedback_reports_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "feedback_reports_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "feedback_reports_workspaceId_contentHash_key"
  ON "feedback_reports"("workspaceId", "contentHash");
CREATE INDEX IF NOT EXISTS "feedback_reports_workspaceId_status_createdAt_idx"
  ON "feedback_reports"("workspaceId", "status", "createdAt");
