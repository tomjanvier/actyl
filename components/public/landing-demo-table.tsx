import { db } from "@/lib/db";
import { EmbedListTable } from "@/components/public/embed-list-table";

/** Affiche uniquement une liste explicitement publiée pour la démonstration. */
export async function LandingDemoTable() {
  const configuredId = process.env.LANDING_DEMO_LIST_ID?.trim();
  try {
    const list = await db.sharedList.findFirst({
      where: {
        isPublished: true,
        ...(configuredId ? { id: configuredId } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
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
      },
    });
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
