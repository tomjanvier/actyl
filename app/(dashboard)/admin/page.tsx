import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLandingSettings } from "@/lib/landing-settings";
import { getSignupMode } from "@/lib/signup-mode";
import { PageHeader } from "@/components/layout/page-header";
import { AdminView } from "@/components/settings/admin-view";

export const metadata = {
  title: "Super administration",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await requireSession();
  if (!session.user.isSuperAdmin) notFound();
  const [workspaces, requests, pendingProposals, signupMode, landingSettings] =
    await Promise.all([
      db.workspace.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          memberships: {
            select: {
              user: { select: { id: true, name: true, email: true } },
              role: true,
            },
          },
          _count: { select: { contacts: true, campaigns: true, lists: true } },
        },
      }),
      db.accountRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          orgName: true,
          website: true,
          phone: true,
          monthlyContributionInterest: true,
          monthlyContributionAmount: true,
          createdAt: true,
        },
      }),
      db.listChangeProposal.count({ where: { status: "PENDING" } }),
      getSignupMode(),
      getLandingSettings(),
    ]);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Administration" }]}
        title="Super administration"
        description="Espaces, demandes d’accès et configuration de la plateforme."
      />
      <AdminView
        workspaces={workspaces.map((w) => ({
          ...w,
          createdAt: w.createdAt.toISOString(),
        }))}
        pending={requests.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
        pendingProposals={pendingProposals}
        signupMode={signupMode}
        landingSettings={landingSettings}
        currentWorkspaceId={session.workspaceId}
      />
    </>
  );
}
