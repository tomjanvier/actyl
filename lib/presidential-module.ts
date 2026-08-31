import "server-only";

import { db } from "@/lib/db";

const ELECTION = "Présidentielle 2027";

/**
 * Rattache les données du module à sa liste de référence et garantit que les
 * pistes historiques restent confinées à une équipe interne.
 */
export async function ensurePresidentialModuleScope(
  workspaceId: string,
  adminUserId: string,
) {
  const list = await db.sharedList.findFirst({
    where: { workspaceId, sourcePack: "presidentielle-2027" },
    select: {
      id: true,
      items: {
        select: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              party: true,
              title: true,
            },
          },
        },
      },
    },
  });
  if (!list) return;

  await db.$transaction(async (transaction) => {
    await transaction.campaignTeam.updateMany({
      where: { workspaceId, election: ELECTION },
      data: { listId: list.id },
    });

    const candidateContacts = list.items
      .map((item) => item.contact)
      .filter((contact) =>
        contact.title?.toLocaleLowerCase("fr").startsWith("candidat"),
      );
    for (const contact of candidateContacts) {
      const candidateName = `${contact.firstName} ${contact.lastName}`.trim();
      await transaction.campaignTeam.upsert({
        where: {
          workspaceId_election_candidateName: {
            workspaceId,
            election: ELECTION,
            candidateName,
          },
        },
        create: {
          workspaceId,
          name: `Équipe de ${candidateName}`,
          listId: list.id,
          election: ELECTION,
          candidateName,
          candidateContactId: contact.id,
          party: contact.party,
          status: contact.title?.includes("déclaré") ? "OFFICIAL" : "LIKELY",
        },
        update: {
          listId: list.id,
          candidateContactId: contact.id,
          party: contact.party,
          status: contact.title?.includes("déclaré") ? "OFFICIAL" : "LIKELY",
        },
      });
    }

    let group = await transaction.group.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!group) {
      group = await transaction.group.create({
        data: {
          workspaceId,
          name: "Équipe de plaidoyer",
          description:
            "Équipe interne utilisée pour les pistes de travail de la Présidentielle 2027.",
        },
        select: { id: true },
      });
    }

    const membership = await transaction.membership.findUnique({
      where: { userId_workspaceId: { userId: adminUserId, workspaceId } },
      select: { id: true },
    });
    if (membership) {
      await transaction.groupMember.upsert({
        where: {
          groupId_membershipId: {
            groupId: group.id,
            membershipId: membership.id,
          },
        },
        create: {
          groupId: group.id,
          membershipId: membership.id,
          userId: adminUserId,
        },
        update: { userId: adminUserId },
      });
    }

    await transaction.politicalPosition.updateMany({
      where: {
        workspaceId,
        groupId: null,
        team: { listId: list.id },
      },
      data: { groupId: group.id },
    });
    await transaction.politicalPosition.updateMany({
      where: {
        workspaceId,
        authorId: null,
        team: { listId: list.id },
      },
      data: { authorId: adminUserId },
    });
  });
}
