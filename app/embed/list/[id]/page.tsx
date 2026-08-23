import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { EmbedListTable } from "@/components/public/embed-list-table";
import { PlaidActCredit } from "@/components/layout/plaidact-credit";

/**
 * Public, iframe-friendly embed of a published shared list.
 * Usage: <iframe src="https://votre-domaine.fr/embed/list/{id}" />
 *
 * Cached with ISR: repeated iframe loads hit the edge/HTTP cache instead of
 * the database; edits propagate within 5 minutes (or instantly via revalidate).
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Liste publique",
  robots: { index: false, follow: false },
};

export default async function EmbedListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const list = await db.sharedList.findFirst({
    where: { id, isPublished: true },
    select: {
      name: true,
      description: true,
      items: {
        orderBy: { contact: { lastName: "asc" } },
        select: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              title: true,
              institution: true,
              party: true,
              region: true,
              level: true,
              stance: true,
              photoUrl: true,
              themes: true,
            },
          },
        },
      },
    },
  });
  if (!list) notFound();

  return (
    <div className="min-h-screen bg-canvas p-3 text-fg">
      <EmbedListTable
        listName={list.name}
        description={list.description}
        rows={list.items.map(({ contact }) => contact)}
      />
      <footer className="mt-2 flex justify-center">
        <PlaidActCredit />
      </footer>
    </div>
  );
}
