import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function GET(request: Request) {
  await destroySession();
  // L'émetteur OIDC peut différer de l'application : on repart de l'origine réelle.
  return NextResponse.redirect(new URL("/sign-in", request.url));
}
