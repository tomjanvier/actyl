import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncAllReferenceLists } from "@/lib/reference-sync";

export const maxDuration = 300;

function isAuthorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  const provided = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");
  if (!expected || !isAuthorized(provided, expected)) {
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
