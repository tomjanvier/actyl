ALTER TABLE "feedback_reports" ADD COLUMN "resolvehqTicketId" TEXT;
ALTER TABLE "feedback_reports" ADD COLUMN "resolvehqTicketUrl" TEXT;
ALTER TABLE "feedback_reports" ADD COLUMN "resolvehqSyncState" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED';
ALTER TABLE "feedback_reports" ADD COLUMN "resolvehqSyncNote" TEXT;

CREATE UNIQUE INDEX "feedback_reports_resolvehqTicketId_key" ON "feedback_reports"("resolvehqTicketId");
