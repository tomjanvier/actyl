import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
export async function GET() { await destroySession(); return NextResponse.redirect(new URL("/sign-in", process.env.ACT_OIDC_ISSUER ?? "https://act.plaidact.org")); }
