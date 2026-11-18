CREATE TABLE IF NOT EXISTS "job_titles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_titles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "job_titles_name_key" ON "job_titles"("name");
INSERT INTO "job_titles" ("id", "name") VALUES
  ('jobtitle-deputee', 'Député·e'),
  ('jobtitle-senator', 'Sénateur·ice')
ON CONFLICT ("name") DO NOTHING;

CREATE TABLE IF NOT EXISTS "workspace_invitations" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workspace_invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invitations_tokenHash_key" ON "workspace_invitations"("tokenHash");
CREATE INDEX IF NOT EXISTS "workspace_invitations_workspaceId_email_idx" ON "workspace_invitations"("workspaceId", "email");
