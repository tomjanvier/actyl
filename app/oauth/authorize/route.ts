import { authorize } from "@/lib/oidc";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return authorize(request); }
