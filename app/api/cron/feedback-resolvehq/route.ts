import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createResolveHQTicket } from "@/lib/feedback-resolvehq";

const MAX_REPORTS_PER_RUN = 5;
const CLAIM_DURATION_MS = 15 * 60 * 1000;
const RETRY_DELAYS_MS = [15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];

function retryDelayMs(failedAttempts: number) {
  const index = Math.min(Math.max(failedAttempts - 1, 0), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index] ?? 24 * 60 * 60_000;
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const now = new Date();
  try {
    const reports = await db.feedbackReport.findMany({
      where: {
        resolvehqTicketId: null,
        resolvehqSyncState: { in: ["FAILED", "NOT_CONFIGURED"] },
        OR: [{ resolvehqNextRetryAt: null }, { resolvehqNextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: MAX_REPORTS_PER_RUN,
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
        resolvehqSyncState: true,
        resolvehqRetryCount: true,
        resolvehqNextRetryAt: true,
        user: { select: { name: true, email: true } },
      },
    });

    let claimed = 0;
    let created = 0;
    let deferred = 0;
    for (const report of reports) {
      const claim = await db.feedbackReport.updateMany({
        where: {
          id: report.id,
          resolvehqTicketId: null,
          resolvehqSyncState: report.resolvehqSyncState,
          resolvehqNextRetryAt: report.resolvehqNextRetryAt,
        },
        data: { resolvehqLastAttemptAt: now, resolvehqNextRetryAt: new Date(now.getTime() + CLAIM_DURATION_MS) },
      });
      if (claim.count !== 1) continue;
      claimed += 1;

      if (!report.user?.email) {
        const retryCount = report.resolvehqRetryCount + 1;
        const delay = retryDelayMs(retryCount);
        await db.feedbackReport.updateMany({
          where: { id: report.id, resolvehqTicketId: null },
          data: {
            resolvehqSyncState: "FAILED",
            resolvehqSyncNote: "The report owner has no email address.",
            resolvehqRetryCount: retryCount,
            resolvehqNextRetryAt: new Date(now.getTime() + delay),
          },
        });
        deferred += 1;
        continue;
      }

      const result = await createResolveHQTicket({
        id: report.id,
        category: report.category,
        title: report.title,
        description: report.description,
        expected: report.expected,
        observed: report.observed,
        steps: report.steps,
        pagePath: report.pagePath,
        deviceInfo: report.deviceInfo,
        userName: report.user.name,
        userEmail: report.user.email,
      });

      if (result.state === "CREATED") {
        await db.feedbackReport.updateMany({
          where: { id: report.id, resolvehqTicketId: null },
          data: {
            resolvehqSyncState: "CREATED",
            resolvehqSyncNote: null,
            resolvehqTicketId: result.id,
            resolvehqTicketUrl: result.url,
            resolvehqNextRetryAt: null,
          },
        });
        created += 1;
        continue;
      }

      const retryCount = report.resolvehqRetryCount + 1;
      const delay = retryDelayMs(retryCount);
      await db.feedbackReport.updateMany({
        where: { id: report.id, resolvehqTicketId: null },
        data: {
          resolvehqSyncState: result.state,
          resolvehqSyncNote: result.note,
          resolvehqRetryCount: retryCount,
          resolvehqNextRetryAt: new Date(now.getTime() + delay),
        },
      });
      deferred += 1;
    }

    return NextResponse.json({ ok: true, considered: reports.length, claimed, created, deferred });
  } catch (error) {
    console.error("[feedback] ResolveHQ retry batch failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Échec temporaire de la reprise ResolveHQ." }, { status: 500 });
  }
}
