import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { FeedbackInbox } from "@/components/feedback/feedback-inbox";

export const metadata = { title: "Signalements" };

export default async function FeedbackSupportPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN" && !session.user.isSuperAdmin) notFound();

  const reports = await db.feedbackReport.findMany({
    where: session.user.isSuperAdmin ? {} : { workspaceId: session.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      category: true,
      title: true,
      description: true,
      expected: true,
      observed: true,
      steps: true,
      pagePath: true,
      deviceInfo: true,
      status: true,
      githubSyncState: true,
      githubSyncNote: true,
      githubIssueUrl: true,
      lastReplyAt: true,
      lastReplyMessage: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      workspace: { select: { name: true } },
    },
  });

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Support" }]}
        title="Signalements"
        description="Bugs, questions et idées envoyés depuis l’application. Les tickets complets créent une issue GitHub automatiquement."
      />
      <FeedbackInbox reports={reports.map((report) => ({
        ...report,
        createdAt: report.createdAt.toISOString(),
        lastReplyAt: report.lastReplyAt?.toISOString() ?? null,
      }))} />
    </>
  );
}
