import assert from "node:assert/strict";
import { contactFilters, contactSearchWhere, requestedPage } from "../lib/crm-filters";
import { Prisma } from "../generated/prisma/client";
import { supporterSearchWhere } from "../lib/supporter-search";
import { db } from "../lib/db";

for (const value of [undefined, "0", "-1", "1.5", "Infinity", "10001", "nope"]) {
  assert.equal(requestedPage(value), 1);
}
assert.equal(requestedPage("2"), 2);
assert.equal(contactFilters({ q: "  Alice Martin  " }).q, "Alice Martin");
assert.equal(contactFilters({ q: "x".repeat(1000) }).q.length, 300);
assert.deepEqual(contactSearchWhere(contactFilters({ newsletter: "SYNCED" }), false), {});
assert.deepEqual(contactSearchWhere(contactFilters({ newsletter: "SYNCED" }), true), { newsletterStatus: { not: null } });

// Lecture seule : retrouve une fiche au-delà de la première page de cent lignes.
if (process.env.DATABASE_URL) {
  const workspace = await db.contact.groupBy({ by: ["workspaceId"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 1 });
  const workspaceId = workspace[0]?.workspaceId;
  assert.ok(workspaceId, "Une base contenant des contacts est nécessaire au contrôle réel.");
  const rows = await db.contact.findMany({ where: { workspaceId }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }], take: 101, select: { id: true, firstName: true, lastName: true, institution: true, party: true, themes: true } });
  assert.equal(rows.length, 101, "Le contrôle doit porter sur une base paginée.");
  const target = rows[100]!;
  const search = contactSearchWhere(contactFilters({ q: `${target.firstName} ${target.lastName}` }), false);
  const found = await db.contact.findMany({ where: { workspaceId, ...search }, select: { id: true } });
  assert.ok(found.some(row => row.id === target.id), "La recherche retrouve le contact hors première page.");
  const denied = await db.contact.count({ where: { workspaceId: "__crm_unrelated_workspace__", ...search } });
  assert.equal(denied, 0);
  for (const key of ["party", "institution"] as const) {
    if (!target[key]) continue;
    const result = await db.contact.findMany({ where: { workspaceId, ...contactSearchWhere(contactFilters({ [key]: target[key] }), false) }, select: { [key]: true } });
    assert.ok(result.length);
    assert.ok(result.every(row => row[key] === target[key]));
  }
  // Jeu SQL transitoire en mémoire : aucun enregistrement n’est créé en base.
  for (const [filters, expected] of [
    [{ q: "", source: "", tag: "climat" }, ["match"]],
    [{ q: "ALICE Paris", source: "petition", tag: "" }, ["match", "substring"]],
    [{ q: "%", source: "", tag: "" }, []],
    [{ q: "' OR true --", source: "", tag: "" }, []],
  ] as const) {
    const predicate = supporterSearchWhere("allowed", filters);
    const result = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM (VALUES
        ('match', 'allowed', 'Alice Martin', 'a@example.test', 'Paris', 'petition', ' climat , bénévole'),
        ('substring', 'allowed', 'Alice Martin', 'b@example.test', 'Paris', 'petition', 'microclimat'),
        ('foreign', 'other', 'Alice Martin', 'c@example.test', 'Paris', 'petition', 'climat')
      ) AS fixtures("id", "workspaceId", "name", "email", "city", "source", "tags")
      WHERE ${predicate} ORDER BY "id"
    `);
    assert.deepEqual(result.map(row => row.id), expected);
  }
  console.log("PASS: tags exacts, recherche multi-termes, source et isolation des soutiens sans écriture.");
  console.log("PASS: recherche réelle hors première page, filtres et isolation des espaces (lecture seule).");
} else {
  console.log("SKIP: contrôles réels sans DATABASE_URL.");
}
await db.$disconnect();
console.log("PASS: pagination, limites de recherche et newsletter désactivée.");
