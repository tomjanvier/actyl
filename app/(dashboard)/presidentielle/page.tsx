import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/constants";
import { PRESIDENTIELLE_PACK_KEY, PRESIDENTIELLE_SETTING_KEY } from "@/lib/datasets/presidentielle-2027";
import { PageHeader } from "@/components/layout/page-header";
import { PresidentielleView } from "@/components/presidentielle/presidentielle-view";

export const metadata = { title: "Présidentielle 2027" };

export default async function PresidentiellePage() {
  const session = await requireSession();

  const flag = await db.appSetting.findUnique({
    where: { key: PRESIDENTIELLE_SETTING_KEY },
  });
  const moduleEnabled = flag?.value === "on";

  // Pack lists live in the workspace as regular SharedLists tagged sourcePack.
  const packLists = moduleEnabled
    ? await db.sharedList.findMany({
        where: {
          workspaceId: session.workspaceId,
          sourcePack: { not: null },
        },
        orderBy: { createdAt: "asc" },
        include: {
          items: {
            orderBy: { contact: { lastName: "asc" } },
            include: {
              contact: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  title: true,
                  institution: true,
                  party: true,
                  level: true,
                  stance: true,
                  email: true,
                  avatarColor: true,
                },
              },
            },
          },
        },
      })
    : [];

  const allContacts = moduleEnabled
    ? await db.contact.findMany({
        where: { workspaceId: session.workspaceId },
        orderBy: [{ lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          institution: true,
          party: true,
          level: true,
          stance: true,
          email: true,
          avatarColor: true,
        },
      })
    : [];

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Actyl" }, { label: "Présidentielle 2027" }]}
        title="Présidentielle 2027"
        description="Suivi des candidat·e·s à l'élection présidentielle (18 avril & 2 mai 2027) — liste de référence publiable en un clic."
      />
      <PresidentielleView
        moduleEnabled={moduleEnabled}
        lists={packLists
          .filter((l) => l.sourcePack === PRESIDENTIELLE_PACK_KEY)
          .map((l) => ({
            id: l.id,
            name: l.name,
            description: l.description,
            isPublished: l.isPublished,
            items: l.items.map((i) => ({
              itemId: i.id,
              note: i.note,
              contact: i.contact,
            })),
          }))}
        allContacts={allContacts}
        canManage={can(session.role, "list:create")}
        canPublish={can(session.role, "list:publish")}
      />
    </>
  );
}
