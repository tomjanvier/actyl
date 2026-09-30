import { db } from "@/lib/db";
import { verifyEmailOpenToken } from "@/lib/email-tracking";

const PIXEL = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255,
  33, 249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68,
  1, 0, 59,
]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (id.length > 40 || token.length > 2048 || !(await verifyEmailOpenToken(token, id))) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  await db.sentEmail.updateMany({
    where: { id, openedAt: null },
    data: { openedAt: new Date() },
  });
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.byteLength),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
