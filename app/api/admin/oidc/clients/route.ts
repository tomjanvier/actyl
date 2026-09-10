import { registerClient } from "@/lib/oidc";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return registerClient(request); }
