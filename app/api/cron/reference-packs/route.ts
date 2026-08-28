import { NextResponse } from "next/server";
import { syncAllReferenceLists } from "@/lib/reference-sync";

export const maxDuration = 300;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");
  if (!expected || provided !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const result = await syncAllReferenceLists();
    return NextResponse.json(
      { ok: result.errors.length === 0, ...result },
      { status: result.errors.length ? 207 : 200 },
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Synchronisation impossible" }, { status: 500 });
  }
}
