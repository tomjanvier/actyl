"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, LoaderCircle, Mail, Plus } from "lucide-react";
import { createFeedbackIssueAction, replyFeedbackReportAction, resolveFeedbackReportAction } from "@/app/actions/feedback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "sonner";

type Report = {
  id: string;
  category: string;
  title: string;
  description: string;
  expected: string | null;
  observed: string | null;
  steps: string | null;
  pagePath: string | null;
  deviceInfo: string | null;
  status: string;
  githubSyncState: string;
  githubSyncNote: string | null;
  githubIssueUrl: string | null;
  lastReplyAt: string | null;
  lastReplyMessage: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
  workspace: { name: string };
};

const categoryLabels: Record<string, string> = {
  BUG: "Bug",
  QUESTION: "Question",
  IDEA: "Amélioration",
  OTHER: "Autre",
};

export function FeedbackInbox({ reports }: { reports: Report[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reply, setReply] = useState<Record<string, string>>({});

  function resolve(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await resolveFeedbackReportAction(id);
      setPendingId(null);
      if (result.ok) router.refresh();
      else toast.error(result.error ?? "Impossible de résoudre le ticket.");
    });
  }

  function createIssue(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await createFeedbackIssueAction(id);
      setPendingId(null);
      if (result.ok) router.refresh();
      else toast.error(result.error ?? "Impossible de créer l’issue GitHub.");
    });
  }

  function sendReply(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await replyFeedbackReportAction(id, reply[id] ?? "");
      setPendingId(null);
      if (result.ok) { setReply((current) => ({ ...current, [id]: "" })); router.refresh(); toast.success("Réponse envoyée par e-mail."); }
      else toast.error(result.error ?? "Impossible d’envoyer la réponse.");
    });
  }

  if (!reports.length) {
    return <div className="px-4 py-10 text-center text-sm text-faint">Aucun signalement pour le moment.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 px-4 py-5 sm:px-7">
      {reports.map((report) => (
        <article key={report.id} className="rounded-xl border border-line bg-raised p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-faint">
                <span className="rounded-full bg-accent-soft px-2 py-1 font-medium text-accent-text">{categoryLabels[report.category] ?? report.category}</span>
                <span>{report.status === "RESOLVED" ? "Résolu" : "Ouvert"}</span>
                <span aria-hidden="true">·</span>
                <span>{new Date(report.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</span>
                <span aria-hidden="true">·</span>
                <span>{report.user?.name ?? "Compte supprimé"}{report.user?.email ? ` · ${report.user.email}` : ""}</span>
                {report.workspace.name && <span>· {report.workspace.name}</span>}
              </div>
              <h2 className="mt-2 text-[15px] font-semibold text-fg">{report.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-mut">{report.description}</p>
              <p className="mt-2 text-xs text-faint">Page : {report.pagePath ?? "non précisée"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {report.githubIssueUrl && (
                <a href={report.githubIssueUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs text-mut hover:bg-elev">
                  Issue <ExternalLink className="size-3.5" />
                </a>
              )}
              {!report.githubIssueUrl && report.category === "BUG" && (
                <Button size="sm" variant="outline" disabled={isPending && pendingId === report.id} onClick={() => createIssue(report.id)}>
                  {isPending && pendingId === report.id ? <LoaderCircle className="animate-spin" /> : <Plus />}
                  {report.githubSyncState === "FAILED" || report.githubSyncState === "PENDING" ? "Réessayer GitHub" : "Créer issue GitHub"}
                </Button>
              )}
              {report.status !== "RESOLVED" && (
                <Button size="sm" variant="outline" disabled={isPending && pendingId === report.id} onClick={() => resolve(report.id)}>
                  {isPending && pendingId === report.id ? <LoaderCircle className="animate-spin" /> : <Check />}
                  Résoudre
                </Button>
              )}
            </div>
          </div>
          <details className="mt-4 border-t border-line pt-3 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-mut">Détails du signalement</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {report.expected && <div><h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Attendu</h3><p className="mt-1 whitespace-pre-wrap text-mut">{report.expected}</p></div>}
              {report.observed && <div><h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Observé</h3><p className="mt-1 whitespace-pre-wrap text-mut">{report.observed}</p></div>}
              {report.steps && <div className="sm:col-span-2"><h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Étapes pour reproduire</h3><p className="mt-1 whitespace-pre-wrap text-mut">{report.steps}</p></div>}
              {!report.githubIssueUrl && report.githubSyncNote && <p className="sm:col-span-2 text-xs text-faint">GitHub : {report.githubSyncNote}</p>}
              <div className="sm:col-span-2 rounded-lg bg-elev/60 p-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-faint">Auteur et appareil</h3>
                <p className="mt-1 text-xs text-mut">{report.user?.name ?? "Compte supprimé"}{report.user?.email ? ` · ${report.user.email}` : ""} · Réf. {report.id.slice(-8).toUpperCase()}</p>
                {report.deviceInfo ? <DeviceDetails value={report.deviceInfo} /> : <p className="mt-1 text-xs text-faint">Aucune information appareil enregistrée.</p>}
              </div>
            </div>
          </details>
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-fg">Répondre par e-mail</h3>
              {report.lastReplyAt && <span className="text-xs text-faint">Dernière réponse · {new Date(report.lastReplyAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</span>}
            </div>
            {report.lastReplyMessage && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-elev/60 p-3 text-xs text-mut">{report.lastReplyMessage}</p>}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <Textarea aria-label="Réponse par e-mail" value={reply[report.id] ?? ""} onChange={(event) => setReply((current) => ({ ...current, [report.id]: event.target.value }))} maxLength={4000} rows={2} placeholder={report.user?.email ? "Écris une réponse…" : "L’auteur n’a pas d’adresse e-mail associée."} disabled={!report.user?.email || (isPending && pendingId === report.id)} />
              <Button size="sm" className="shrink-0" disabled={!report.user?.email || (reply[report.id]?.trim().length ?? 0) < 3 || (isPending && pendingId === report.id)} onClick={() => sendReply(report.id)}>
                {isPending && pendingId === report.id ? <LoaderCircle className="animate-spin" /> : <Mail />}
                Envoyer
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function DeviceDetails({ value }: { value: string }) {
  let details: Record<string, unknown>;
  try { details = JSON.parse(value) as Record<string, unknown>; } catch { return <p className="mt-1 break-all text-xs text-faint">{value}</p>; }
  return <div className="mt-2 space-y-1 text-xs text-faint">
    <p>{[details.platform, details.language, details.timezone, details.screen ? `Écran ${details.screen}` : null, details.viewport ? `Fenêtre ${details.viewport}` : null].filter(Boolean).join(" · ")}</p>
    {typeof details.userAgent === "string" && <p className="break-all">Navigateur : {details.userAgent}</p>}
  </div>;
}
