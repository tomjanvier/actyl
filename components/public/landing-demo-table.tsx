import { db } from "@/lib/db";
import { EmbedListTable } from "@/components/public/embed-list-table";

const listSelection = {
  name: true,
  description: true,
  items: {
    orderBy: { contact: { lastName: "asc" } },
    take: 12,
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
} as const;

/** Affiche en priorité le référentiel publié des député·e·s. */
export async function LandingDemoTable() {
  const configuredId = process.env.LANDING_DEMO_LIST_ID?.trim();
  try {
    const list = configuredId
      ? await db.sharedList.findFirst({
          where: { id: configuredId, isPublished: true },
          select: listSelection,
        })
      : await Promise.all([
          db.sharedList.findFirst({
            where: { isPublished: true, sourcePack: "deputes" },
            orderBy: { createdAt: "asc" },
            select: listSelection,
          }),
          db.sharedList.findFirst({
            where: { isPublished: true },
            orderBy: { createdAt: "asc" },
            select: listSelection,
          }),
        ]).then(([deputies, fallback]) =>
          deputies?.items.length ? deputies : fallback,
        );
    if (!list?.items.length) return null;
    return (
      <EmbedListTable
        listName={list.name}
        description={list.description}
        rows={list.items.map(({ contact }) => contact)}
      />
    );
  } catch {
    return null;
  }
}
