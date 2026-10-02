import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedList, getDirectoryPage } from "@/lib/public-directory";
import { EmbedListTable } from "@/components/public/embed-list-table";
import { PlaidActCredit } from "@/components/layout/plaidact-credit";

/**
 * Intégration publique d'une liste publiée, compatible avec une iframe.
 * Utilisation : <iframe src="https://votre-domaine.fr/embed/list/{id}" />
 *
 * La publication est vérifiée à chaque visite ; les projections publiques sont
 * mises en cache brièvement et invalidées après les modifications.
 */
export const dynamic = "force-dynamic";

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

  const list = await getPublishedList(id);
  if (!list) notFound();

  const initialPage = await getDirectoryPage(id, 1, "", "", "", "", 50);
  return (
    <div className="min-h-screen bg-canvas p-3 text-fg">
      <EmbedListTable
        listName={list.name}
        description={list.description}
        rows={initialPage.rows}
        listId={id}
        pageSize={50}
        initialPage={initialPage}
      />
      <footer className="mt-2 flex justify-center">
        <PlaidActCredit />
      </footer>
    </div>
  );
}
