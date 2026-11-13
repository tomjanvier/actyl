import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";

export const metadata = { title: "Accepter une invitation" };

export default async function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invite = await db.workspaceInvitation.findUnique({ where: { tokenHash }, include: { workspace: { select: { name: true } } } });
  const valid = !!invite && invite.expiresAt > new Date();
  const session = await getSession();
  const existingUser = invite ? await db.user.findUnique({ where: { email: invite.email }, select: { id: true } }) : null;
  const canAccept = !existingUser || session?.user.id === existingUser.id;
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-12"><section className="w-full rounded-2xl border border-line bg-elev p-7 shadow-sm"><h1 className="text-2xl font-semibold text-fg">Rejoindre Actyl</h1>{valid && invite ? <><p className="mt-3 text-sm text-mut">Bonjour {invite.name}, vous êtes invité·e à rejoindre <strong>{invite.workspace.name}</strong>.</p>{canAccept ? <AcceptInvitationForm token={token} needsPassword={!existingUser} /> : <p className="mt-4 text-sm text-mut">Connectez-vous avec {invite.email}, puis rouvrez ce lien pour accepter. <Link className="text-accent-text underline" href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}>Se connecter</Link></p>}</> : <p className="mt-3 text-sm text-mut">Cette invitation est invalide ou a expiré. Demandez un nouveau lien à l’administrateur de l’espace.</p>}</section></main>;
}
