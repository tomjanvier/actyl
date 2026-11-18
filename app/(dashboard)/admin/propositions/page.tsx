import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { AdminProposals } from "@/components/settings/admin-proposals";

export const metadata = { title: "Propositions de fiches" };

export default async function AdminProposalsPage() {
  const session = await requireSession();
  if (!session.user.isSuperAdmin) notFound();

  const proposals = await db.listChangeProposal.findMany({
    where: { status: "PENDING", list: { sourcePack: { not: null } } },
    orderBy: { createdAt: "asc" },
    take: 300,
    include: {
      list: { select: { name: true, sourcePack: true } },
      author: { select: { name: true, email: true } },
      workspace: { select: { name: true } },
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          institution: true,
          email: true,
          phone: true,
          party: true,
          region: true,
          level: true,
          stance: true,
          themes: true,
          bio: true,
        },
      },
    },
  });

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Super administration", href: "/admin" }, { label: "Propositions de fiches" }]}
        title="Propositions de fiches"
        description="Examinez les changements proposés par les membres et la veille des sources publiques avant leur diffusion dans les référentiels."
      />
      <AdminProposals proposals={proposals.map((proposal) => ({
        id: proposal.id,
        action: proposal.action,
        origin: proposal.origin,
        payload: proposal.payload,
        reason: proposal.reason,
        createdAt: proposal.createdAt.toISOString(),
        listName: proposal.list.name,
        sourcePack: proposal.list.sourcePack,
        workspaceName: proposal.workspace.name,
        author: proposal.author,
        contact: proposal.contact,
      }))} />
    </>
  );
}
