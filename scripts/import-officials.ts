/**
 * Importe les députés (AN), sénateurs et eurodéputés français dans le
 * workspace de démo. Usage : pnpm tsx scripts/import-officials.ts [an|senat|pe]
 */
import { PrismaClient } from "@prisma/client";
import {
  importAssembleeNationale,
  importSenat,
  importParlementEuropeen,
} from "../lib/importers/officials";

const db = new PrismaClient();
const colors = ["slate","indigo","emerald","amber","rose","violet","sky","teal","orange","fuchsia"];
let ci = 0;

async function upsertAll(source: string, contacts: Awaited<ReturnType<typeof importAssembleeNationale>>) {
  const ws = await db.workspace.findUnique({ where: { slug: "plaidoyer-collectif" } });
  if (!ws) throw new Error("Workspace de démo introuvable — lance d'abord pnpm db:seed");
  let created = 0, updated = 0;
  for (const c of contacts) {
    const existing = await db.contact.findFirst({
      where: { workspaceId: ws.id, firstName: c.firstName, lastName: c.lastName, institution: c.institution },
      select: { id: true },
    });
    const data = {
      email: c.email,
      photoUrl: c.photoUrl,
      title: c.title,
      institution: c.institution,
      party: c.party,
      region: c.region,
      level: c.level,
      influenceScore: 3,
    };
    if (existing) {
      await db.contact.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.contact.create({
        data: {
          workspaceId: ws.id,
          firstName: c.firstName || "(?)",
          lastName: c.lastName,
          stance: "UNKNOWN",
          avatarColor: colors[ci++ % colors.length]!,
          ...data,
        },
      });
      created++;
    }
  }
  console.log(`✅ ${source} : ${created} créés, ${updated} mis à jour`);
}

const which = process.argv[2] ?? "all";

(async () => {
  if (which === "an" || which === "all") {
    console.log("⏳ Import Assemblée nationale…");
    await upsertAll("AN", await importAssembleeNationale());
  }
  if (which === "senat" || which === "all") {
    console.log("⏳ Import Sénat…");
    await upsertAll("Sénat", await importSenat());
  }
  if (which === "pe" || which === "all") {
    console.log("⏳ Import Parlement européen (2-3 min)…");
    await upsertAll("PE", await importParlementEuropeen());
  }
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
