"use client";

import { useActionState } from "react";
import { acceptWorkspaceInvitationAction } from "@/app/actions/auth";

export function AcceptInvitationForm({ token, needsPassword }: { token: string; needsPassword: boolean }) {
  const [state, action, pending] = useActionState(acceptWorkspaceInvitationAction, undefined);
  return <form action={action} className="mt-6 space-y-4"><input type="hidden" name="token" value={token} />{needsPassword && <label className="block text-sm font-medium text-fg">Créer un mot de passe<input name="password" type="password" minLength={8} autoComplete="new-password" required className="mt-1 h-10 w-full rounded-lg border border-line bg-background px-3" /></label>}{state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}<button disabled={pending} className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Activation…" : "Accepter l’invitation"}</button></form>;
}
