import { DirectoryUnavailable } from "./directory-unavailable";
import { db } from "@/lib/db";
import { getDirectoryPage } from "@/lib/public-directory";
import { EmbedListTable } from "@/components/public/embed-list-table";

export async function LandingDemoTable() {
  try {
    const configuredId = process.env.LANDING_DEMO_LIST_ID?.trim();
    const selection = { id: true, name: true, description: true } as const;
    const list = configuredId
      ? await db.sharedList.findFirst({ where: { id: configuredId, isPublished: true }, select: selection })
      : await db.sharedList.findFirst({ where: { isPublished: true, sourcePack: "deputes", items: { some: {} } }, orderBy: { createdAt: "asc" }, select: selection })
        ?? await db.sharedList.findFirst({ where: { isPublished: true, items: { some: {} } }, orderBy: { createdAt: "asc" }, select: selection });
    if (!list) return <p className="crm-surface rounded-xl p-6 text-sm text-mut">Aucun annuaire public n’est disponible pour le moment.</p>;
    const initialPage = await getDirectoryPage(list.id, 1, "", "", "", "", 10);
    return <EmbedListTable listName={list.name} description={list.description} rows={initialPage.rows} pageSize={10} listId={list.id} initialPage={initialPage} />;
  } catch (error) {
    console.error("[landing-directory] Loading failed", error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" });
    return <DirectoryUnavailable />;
  }
}
