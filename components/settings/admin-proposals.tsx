"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveListChangeProposalAction, rejectListChangeProposalAction } from "@/app/actions/list-proposals";

type Contact = {
  id: string; firstName: string; lastName: string; title: string | null;
  institution: string | null; email: string | null; phone: string | null;
  party: string | null; region: string | null; level: string; stance: string;
  themes: string | null; bio: string | null;
};
type Proposal = {
  id: string; action: string; origin: string; payload: string; reason: string | null;
  createdAt: string; listName: string; sourcePack: string | null; workspaceName: string;
  author: { name: string; email: string } | null; contact: Contact | null;
};

const fieldNames: Record<string, string> = {
  firstName: "Prénom", lastName: "Nom", title: "Fonction", institution: "Organisation",
  email: "Courriel", phone: "Téléphone", party: "Parti", region: "Territoire",
  level: "Niveau", stance: "Position", themes: "Thématiques", bio: "Biographie",
  photoUrl: "Photo", sourceSystem: "Source", sourceId: "Identifiant source",
  facebookUrl: "Facebook", instagramUrl: "Instagram", youtubeUrl: "YouTube",
  mastodonUrl: "Mastodon", commissions: "Commissions", note: "Note de liste",
};
const actionNames: Record<string, string> = { ADD: "Ajout", UPDATE: "Mise à jour", REMOVE: "Retrait", ATTRIBUTE: "Attribut" };

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function fieldChanges(proposal: Proposal) {
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(proposal.payload) as Record<string, unknown>; }
  catch { return [{ label: "Données proposées", before: "—", after: "Charge utile illisible" }]; }
  if (proposal.action === "ATTRIBUTE") {
    return [{ label: `Attribut (${String(payload.fieldId ?? "champ inconnu")})`, before: "—", after: display(payload.value) }];
  }
  return Object.entries(payload)
    .filter(([key]) => key !== "note")
    .map(([key, value]) => ({
      label: fieldNames[key] ?? key,
      before: proposal.contact ? display((proposal.contact as unknown as Record<string, unknown>)[key]) : "Nouveau contact",
      after: display(value),
    }))
    .filter(({ before, after }) => !proposal.contact || before !== after);
}

export function AdminProposals({ proposals }: { proposals: Proposal[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function decide(id: string, approved: boolean) {
    setPendingId(id);
    startTransition(async () => {
      try {
        const result = approved ? await approveListChangeProposalAction(id) : await rejectListChangeProposalAction(id);
        if (result.ok) router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "La proposition n’a pas pu être traitée.");
      } finally { setPendingId(null); }
    });
  }

  if (!proposals.length) return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-7"><div className="rounded-xl border border-dashed border-line px-6 py-14 text-center"><Check className="mx-auto size-7 text-accent-text"/><h2 className="mt-3 text-sm font-semibold text-fg">Aucune proposition en attente</h2><p className="mt-1 text-sm text-faint">Les nouvelles propositions des équipes et des vérifications de sources apparaîtront ici.</p></div></div>;

  return <div className="mx-auto max-w-5xl space-y-3 px-4 py-5 sm:px-7">
    <p className="text-xs text-faint">{proposals.length} proposition{proposals.length > 1 ? "s" : ""} affichée{proposals.length > 1 ? "s" : ""}{proposals.length === 300 ? " · liste limitée aux 300 plus anciennes" : ""}</p>
    {proposals.map((proposal) => {
      const changes = fieldChanges(proposal);
      const isBusy = busy && pendingId === proposal.id;
      return <article key={proposal.id} className="overflow-hidden rounded-xl border border-line bg-raised">
        <header className="flex flex-wrap items-start gap-3 border-b border-line bg-elev/40 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-faint">
              <span className="rounded-full bg-accent-soft px-2 py-1 font-medium text-accent-text">{proposal.origin === "PUBLIC_SOURCE" ? "Veille source publique" : "Proposition membre"}</span>
              <span>{actionNames[proposal.action] ?? proposal.action}</span><span>·</span>
              <time dateTime={proposal.createdAt}>{new Date(proposal.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</time>
            </div>
            <h2 className="mt-2 text-sm font-semibold text-fg">{proposal.contact ? `${proposal.contact.firstName} ${proposal.contact.lastName}` : "Nouveau contact"}</h2>
            <p className="mt-0.5 text-xs text-mut">{proposal.listName} · {proposal.workspaceName} · {proposal.author?.name ?? "Source automatisée"}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" disabled={busy} onClick={() => decide(proposal.id, true)}>{isBusy ? <LoaderCircle className="animate-spin"/> : <Check/>}Appliquer</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(proposal.id, false)}><X/>Refuser</Button>
          </div>
        </header>
        <div className="p-4 sm:px-5">
          {changes.length ? <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-xs"><thead><tr className="text-[10px] uppercase tracking-wide text-faint"><th className="pb-2 pr-4 font-medium">Champ</th><th className="pb-2 pr-4 font-medium">Actuel</th><th className="pb-2 font-medium">Proposé</th></tr></thead><tbody className="divide-y divide-line">{changes.map((change) => <tr key={change.label}><th className="py-2 pr-4 font-medium text-mut">{change.label}</th><td className="py-2 pr-4 text-faint">{change.before}</td><td className="py-2 text-fg">{change.after}</td></tr>)}</tbody></table></div> : <p className="text-xs text-faint">Aucune différence de fiche détectée (action : {proposal.action.toLowerCase()}).</p>}
          {proposal.reason && <p className="mt-3 flex gap-2 rounded-lg bg-elev px-3 py-2 text-xs leading-relaxed text-mut"><CircleHelp className="mt-0.5 size-3.5 shrink-0"/><span><strong className="font-medium text-fg">Motif :</strong> {proposal.reason}</span></p>}
        </div>
      </article>;
    })}
  </div>;
}
