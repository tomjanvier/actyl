"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download,
  Search,
  X,
  Trash2,
  UserPlus,
  Send,
  Loader2,
  PenLine,
  ExternalLink,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn, timeAgo, downloadFile } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { PaginationBar } from "@/components/ui/pagination";
import { EntityAvatar } from "@/components/ui/badge";
import {
  deleteSignaturesAction,
  convertSignaturesToContactsAction,
  exportSignaturesCsvAction,
  countPetitionSignersAction,
  emailPetitionSignersAction,
} from "@/app/actions/signatures";

type SignatureRow = {
  id: string;
  name: string;
  email: string;
  city: string | null;
  createdAt: string;
};

export function SignaturesView({
  campaignId,
  campaignSlug,
  canManage,
  petition,
  signatures,
  cities,
  pagination,
}: {
  campaignId: string;
  campaignSlug: string;
  canManage: boolean;
  petition: {
    title: string;
    goal: number;
    isPublished: boolean;
    totalSignatures: number;
  } | null;
  signatures: SignatureRow[];
  cities: string[];
  pagination: { page: number; pageCount: number; total: number };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cityF, setCityF] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  // Affine côté client la page courante ; le serveur gère aussi la recherche.
  // Le paramètre ?q= permet une recherche entre plusieurs pages.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return signatures.filter((s) => {
      if (cityF && s.city !== cityF) return false;
      if (!q) return true;
      return `${s.name} ${s.email} ${s.city ?? ""}`.toLowerCase().includes(q);
    });
  }, [signatures, query, cityF]);

  const allChecked = filtered.length > 0 && filtered.every((s) => checked.has(s.id));

  function toggleAll() {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach((s) => next.delete(s.id));
      else filtered.forEach((s) => next.add(s.id));
      return next;
    });
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function exportCsv() {
    setBusy("export");
    const res = await exportSignaturesCsvAction({ campaignId });
    setBusy(null);
    if ("csv" in res && res.csv !== undefined) {
      downloadFile(
        res.csv,
        `signataires-${campaignSlug}-${new Date().toISOString().slice(0, 10)}.csv`,
        "text/csv",
      );
      toast.success(`${res.count} signature(s) exportée(s)`);
    } else if ("error" in res) toast.error(res.error);
  }

  async function deleteSelected() {
    if (!checked.size || busy) return;
    if (!confirm(`Supprimer définitivement ${checked.size} signature(s) ?`)) return;
    setBusy("delete");
    const res = await deleteSignaturesAction({
      campaignId,
      ids: [...checked],
    });
    setBusy(null);
    if ("ok" in res) {
      toast.success(`${res.deleted} signature(s) supprimée(s)`);
      setChecked(new Set());
      router.refresh();
    } else toast.error(res.error);
  }

  async function convertSelected() {
    if (!checked.size || busy) return;
    setBusy("convert");
    const res = await convertSignaturesToContactsAction({
      campaignId,
      ids: [...checked],
    });
    setBusy(null);
    if ("ok" in res) {
      toast.success(
        `${res.created} contact(s) créé(s), ${res.updated} mis à jour dans le répertoire.`,
      );
    } else toast.error(res.error);
  }

  if (!petition) {
    return (
      <div className="px-6 py-10">
        <div className="mx-auto max-w-lg rounded-xl border border-line bg-card p-6 text-center">
          <PenLine className="mx-auto mb-3 size-6 text-faint" />
          <h2 className="text-[15px] font-semibold text-fg">
            Aucune pétition sur cette campagne
          </h2>
          <p className="mt-1 text-[13px] text-mut">
            Créez d&apos;abord la pétition depuis l&apos;onglet Mobilisation pour
            gérer ses signataires ici.
          </p>
          <Button size="sm" className="mt-4" asChild>
            <Link href={`/campaigns/${campaignId}/mobilization`}>
              Créer la pétition
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-col">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 px-6 pt-5 sm:grid-cols-3 lg:max-w-2xl">
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Signatures</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums text-fg">
            <Users className="size-4.5 text-indigo-700 dark:text-indigo-400" />
            {petition.totalSignatures.toLocaleString("fr-FR")}
            <span className="text-[13px] font-normal text-mut">/ {petition.goal.toLocaleString("fr-FR")}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-hover">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400"
              style={{
                width: `${Math.min(100, Math.round((petition.totalSignatures / Math.max(petition.goal, 1)) * 100))}%`,
              }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Pétition</p>
          <p className="mt-1 truncate text-[14px] font-medium text-fg">{petition.title}</p>
          <span
            className={cn(
              "mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
              petition.isPublished
                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400",
            )}
          >
            {petition.isPublished ? "Publiée" : "Brouillon"}
          </span>
        </div>
        <a
          href={`/p/${campaignSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 transition-colors hover:border-emerald-500/40"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
            Page publique <ExternalLink className="size-3" />
          </p>
          <p className="mt-1 truncate text-[13px] font-medium text-fg">/p/{campaignSlug}</p>
        </a>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un signataire…"
            className="h-9 w-60 rounded-lg border border-line bg-elev pl-8.5 pr-8 text-[13px] text-fg outline-none placeholder:text-faint focus:border-indigo-500/60"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-mut"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {cities.length > 0 && (
          <select
            value={cityF}
            onChange={(e) => setCityF(e.target.value)}
            className={cn(
              "h-9 rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-mut outline-none [&>option]:bg-raised",
              cityF && "border-indigo-500/40",
            )}
          >
            <option value="">Toutes villes</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-2">
          {checked.size > 0 && canManage && (
            <>
              <span className="text-[12px] tabular-nums text-mut">
                {checked.size} sélectionnée(s)
              </span>
              <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void convertSelected()}>
                {busy === "convert" ? <Loader2 className="animate-spin" /> : <UserPlus />}
                Convertir en contacts
              </Button>
              <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void deleteSelected()}>
                {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Supprimer
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" disabled={!!busy || !petition.totalSignatures} onClick={() => void exportCsv()}>
            {busy === "export" ? <Loader2 className="animate-spin" /> : <Download />}
            Exporter CSV
          </Button>
          {canManage && (
            <Button size="sm" disabled={!petition.totalSignatures} onClick={() => setEmailOpen(true)}>
              <Send /> Emailing aux signataires
            </Button>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 px-6 pb-10">
        <ul className="overflow-hidden rounded-xl border border-line">
          <li className="flex items-center gap-3 border-b border-line bg-elev px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="size-3.5 accent-indigo-600"
              aria-label="Tout sélectionner sur la page"
            />
            Signataire
            <span className="ml-auto hidden w-32 sm:block">Ville</span>
            <span className="w-20 text-right">Date</span>
          </li>
          {filtered.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 border-b border-linesoft px-4 py-2.5 last:border-0 hover:bg-hover"
            >
              <input
                type="checkbox"
                checked={checked.has(s.id)}
                onChange={() => toggle(s.id)}
                className="size-3.5 accent-indigo-600"
                aria-label={`Sélectionner ${s.name}`}
              />
              <EntityAvatar name={s.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">{s.name}</p>
                <p className="truncate text-[11.5px] text-faint">{s.email}</p>
              </div>
              <span className="hidden w-32 truncate text-[12px] text-mut sm:block">
                {s.city ?? "—"}
              </span>
              <span className="w-20 shrink-0 text-right text-[11px] text-faint" title={new Date(s.createdAt).toLocaleString("fr-FR")}>
                {timeAgo(s.createdAt)}
              </span>
              {canManage && (
                <button
                  title="Supprimer cette signature"
                  disabled={!!busy}
                  onClick={async () => {
                    if (!confirm(`Supprimer la signature de ${s.name} ?`)) return;
                    setBusy(`del-${s.id}`);
                    const res = await deleteSignaturesAction({ campaignId, ids: [s.id] });
                    setBusy(null);
                    if ("ok" in res) {
                      toast.success("Signature supprimée");
                      router.refresh();
                    } else toast.error(res.error);
                  }}
                  className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-hover hover:text-rose-600 disabled:opacity-40"
                >
                  {busy === `del-${s.id}` ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </button>
              )}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-[13px] text-mut">
              Aucun signataire — les signatures arrivent ici dès que la pétition
              reçoit des soutiens (page publique ou formulaire WordPress).
            </li>
          )}
        </ul>
        <div className="mt-4 border-t border-linesoft pt-3">
          <PaginationBar
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            label="signatures"
          />
        </div>
      </div>

      {/* Emailing dialog */}
      <EmailSignersDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        campaignId={campaignId}
      />
    </div>
  );
}

function EmailSignersDialog({
  open,
  onClose,
  campaignId,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void countPetitionSignersAction({ campaignId }).then((r) => {
      if (!cancelled && "count" in r && r.count !== undefined) setCount(r.count);
    });
    return () => {
      cancelled = true;
    };
  }, [open, campaignId]);

  async function send() {
    if (sending || !subject.trim() || !body.trim()) return;
    if (!confirm(`Envoyer cet email à ${count ?? "?"} signataire(s) ? L'action est immédiate.`))
      return;
    setSending(true);
    const res = await emailPetitionSignersAction({ campaignId, subject, body });
    setSending(false);
    if ("ok" in res && res.ok) {
      toast.success(
        `${res.sent} email(s) envoyé(s)` +
          (res.failed ? `, ${res.failed} en échec` : "") +
          (res.simulated ? " — mode démo, aucun envoi réel" : ""),
      );
      onClose();
      setSubject("");
      setBody("");
    } else if ("error" in res) toast.error(res.error);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Emailing aux signataires</DialogTitle>
          <DialogDescription>
            Merci, relance ou appel à l&apos;action suivante — envoyé à tous les
            signataires distincts de la pétition.
          </DialogDescription>
        </DialogHeader>
        <p className="text-[12px] tabular-nums text-faint">
          {count === null ? "…" : `${count} destinataire(s)`}
        </p>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Objet du message"
          maxLength={200}
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          maxLength={8000}
          placeholder={"Bonjour,\n\nMerci d'avoir signé…\n\nÀ très vite !"}
        />
        <p className="text-[11px] leading-relaxed text-faint">
          Une mention «&nbsp;— votre organisation · Vous recevez cet email en
          tant que signataire&nbsp;» est ajoutée automatiquement.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button
            size="sm"
            disabled={sending || !subject.trim() || !body.trim() || count === 0}
            onClick={() => void send()}
          >
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            {sending ? "Envoi…" : `Envoyer${count ? ` (${count})` : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
