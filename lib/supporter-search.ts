import { Prisma } from "@/generated/prisma/client";

// Prédicat partagé par le compteur et la page, toujours limité à l’espace.
export function supporterSearchWhere(workspaceId: string, { q, source, tag }: Record<"q" | "source" | "tag", string>) {
  const clauses = [Prisma.sql`"workspaceId" = ${workspaceId}`];
  if (source) clauses.push(Prisma.sql`"source" = ${source}`);
  if (tag) clauses.push(Prisma.sql`EXISTS (
    SELECT 1 FROM unnest(string_to_array(coalesce("tags", ''), ',')) AS tag
    WHERE btrim(tag) = ${tag}
  )`);
  for (const term of q.split(/\s+/).filter(Boolean)) {
    // strpos traite aussi les caractères % et _ comme du texte ordinaire.
    clauses.push(Prisma.sql`strpos(lower(concat_ws(' ', "name", "email", "city")), lower(${term})) > 0`);
  }
  return Prisma.join(clauses, " AND ");
}
