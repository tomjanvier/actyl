import { NextRequest, NextResponse } from "next/server";
import { getPublishedList, getDirectoryPage, getDirectoryExport } from "@/lib/public-directory";
import { toCSV } from "@/lib/utils";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = request.nextUrl.searchParams;
  const page = Number(p.get("page") || 1);
  const pageSize = Number(p.get("pageSize") || 10);
  const filters = ["q", "level", "party", "institution"].map(k => p.get(k) || "");
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || ![10, 50].includes(pageSize) || filters.some(v => v.length > 100)) return NextResponse.json({ error: "Filtres invalides." }, { status: 400, headers });
  const list = await getPublishedList(id);
  if (!list) return NextResponse.json({ error: "Liste indisponible." }, { status: 404, headers });
  if (p.get("format") === "csv") {
    // Export fetched on demand; do not serialize the full directory into the page.
    const rows = await getDirectoryExport(id, ...filters as [string, string, string, string]);
    return new NextResponse("\uFEFF" + toCSV(rows.map(r => ({ prenom: r.firstName, nom: r.lastName, fonction: r.title || "", institution: r.institution || "", parti: r.party || "", region: r.region || "" }))), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=annuaire.csv" } });
  }
  return NextResponse.json(await getDirectoryPage(id, page, ...filters as [string, string, string, string], pageSize), { headers });
}
