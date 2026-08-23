import { db } from "@/lib/db";
import { EntityAvatar } from "@/components/ui/badge";
import { STANCE_META, type Stance } from "@/lib/constants";
import { fullName } from "@/lib/utils";

/**
 * Live demo of the contacts directory on the landing page.
 * Reads only from the seeded demo workspace (never user data).
 */
export async function LandingDemoTable() {
  let rows: Array<{
    id: string;
    firstName: string;
    lastName: string;
    title: string | null;
    institution: string | null;
    party: string | null;
    stance: string;
    photoUrl: string | null;
  }> = [];

  try {
    const demo = await db.workspace.findFirst({
      where: { slug: "plaidoyer-collectif" },
      select: { id: true },
    });
    if (demo) {
      rows = await db.contact.findMany({
        where: {
          workspaceId: demo.id,
          institution: { in: ["Assemblée nationale", "Sénat", "Parlement européen"] },
        },
        orderBy: [{ influenceScore: "desc" }, { lastName: "asc" }],
        take: 6,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          institution: true,
          party: true,
          stance: true,
          photoUrl: true,
        },
      });
    }
  } catch {
    // DB not reachable — hide the block
  }

  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-raised shadow-xl shadow-black/5 dark:shadow-black/40">
      <div className="flex h-10 items-center gap-2 border-b border-line px-4">
        <span className="size-2.5 rounded-full bg-rose-400/70" />
        <span className="size-2.5 rounded-full bg-amber-400/70" />
        <span className="size-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 text-[11.5px] text-faint">
          AdvocacyHQ — Annuaire des décideurs (démo)
        </span>
      </div>
      <table className="w-full text-[13px]">
        <tbody>
          {rows.map((c) => {
            const stance = STANCE_META[c.stance as Stance];
            return (
              <tr
                key={c.id}
                className="border-b border-linesoft transition-colors last:border-0 hover:bg-hover"
              >
                <td className="w-[260px] px-4 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <EntityAvatar
                      name={fullName(c)}
                      color="indigo"
                      size="sm"
                      photoUrl={c.photoUrl}
                    />
                    <span className="truncate font-medium text-fg">
                      {fullName(c)}
                    </span>
                  </span>
                </td>
                <td className="max-w-[220px] truncate px-3 py-2.5 text-mut">
                  {[c.title, c.institution].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="hidden max-w-[160px] truncate px-3 py-2.5 text-faint sm:table-cell">
                  {c.party ?? "—"}
                </td>
                <td className="w-[150px] px-3 py-2.5">
                  {stance && (
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${stance.badge}`}>
                      <span className={`size-1.5 rounded-full ${stance.dot}`} />
                      {stance.label}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
