"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download,
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
import { Card, StatCard } from "@/components/ui/primitives";
import { FilterBar, FilterSelect, SearchField } from "@/components/ui/filter-bar";
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
  workspaceSlug,
  canManage,
  petition,
  signatures,
  cities,
  pagination,
}: {
  campaignId: string;
  campaignSlug: string;
  workspaceSlug: string;
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
        <div className="mx-auto max-w-lg rounded-xl crm-surface p-6 text-center">
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
      <div className="grid grid-cols-1 gap-3 px-4 pt-5 sm:grid-cols-3 sm:px-7 lg:max-w-2xl">
        <StatCard
          label="Signatures"
          value={petition.totalSignatures.toLocaleString("fr-FR")}
          suffix={<> / {petition.goal.toLocaleString("fr-FR")}</>}
          icon={<Users className="size-3 text-accent-text" />}
          progress={petition.totalSignatures / Math.max(petition.goal, 1)}
        />
        <Card className="p-4">
          <p className="crm-kicker">Pétition</p>
          <p className="mt-1.5 truncate text-[14px] font-medium text-fg">{petition.title}</p>
          <span
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
              petition.isPublished
                ? "bg-tone-success text-tone-success-fg ring-tone-success-line"
                : "bg-tone-warning text-tone-warning-fg ring-tone-warning-line",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                petition.isPublished ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
            {petition.isPublished ? "Publiée" : "Brouillon"}
          </span>
        </Card>
        <a
          href={`/association/${workspaceSlug}/${campaignSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group crm-surface rounded-xl p-4 transition-colors hover:border-tone-success-line"
        >
          <p className="crm-kicker flex items-center gap-1.5">
            Page publique <ExternalLink className="size-3" />
          </p>
          <p className="mt-1 truncate text-[13px] font-medium text-fg">/association/{workspaceSlug}/{campaignSlug}</p>
        </a>
      </div>

      {/* Toolbar */}
      <FilterBar>
        <SearchField
          value={query}
          onValueChange={setQuery}
          placeholder="Rechercher un signataire…"
          width="w-full sm:w-64"
        />
        {cities.length > 0 && (
          <FilterSelect
            value={cityF}
            onChange={(e) => setCityF(e.target.value)}
            active={!!cityF}
            aria-label="Filtrer par ville"
          >
            <option value="">Toutes villes</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </FilterSelect>
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
      </FilterBar>

      {/* Table */}
      <div className="flex-1 px-4 pb-10 sm:px-7">
        <ul className="crm-surface overflow-hidden rounded-xl">
          <li className="flex items-center gap-3 border-b border-line bg-elev px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="size-3.5 accent-coral-500"
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
                className="size-3.5 accent-coral-500"
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
