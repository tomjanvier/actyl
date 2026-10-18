"use client";

import { useEffect, useState, useTransition } from "react";
import { EMAIL_BATCH_LIMIT } from "@/lib/email-batch";
import { useRouter } from "next/navigation";
import {
  Download,
  Users,
  Mail,
  PenLine,
  CalendarDays,
  Tag,
  X,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, timeAgo, toCSV, downloadFile } from "@/lib/utils";
import { EntityAvatar } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/primitives";
import { FilterBar, FilterSelect, SearchField } from "@/components/ui/filter-bar";
import { Input, Textarea } from "@/components/ui/input";
import { PaginationBar } from "@/components/ui/pagination";
import { setSupporterTagsAction } from "@/app/actions/mobilization";
import {
  sendBroadcastAction,
  countBroadcastAudienceAction,
} from "@/app/actions/broadcast";

const SOURCE_META: Record<string, { label: string; badge: string; icon: typeof Mail }> = {
  interpellation: {
    label: "Interpellation",
    badge: "bg-tone-accent text-tone-accent-fg ring-tone-accent-line",
    icon: Mail,
  },
  petition: {
    label: "Pétition",
    badge: "bg-tone-success text-tone-success-fg ring-tone-success-line",
    icon: PenLine,
  },
  event: {
    label: "Événement",
    badge: "bg-tone-warning text-tone-warning-fg ring-tone-warning-line",
    icon: CalendarDays,
  },
};

type SupporterRow = {
  id: string;
  name: string;
  email: string;
  city: string | null;
  source: string | null;
  tags: string | null;
  touchCount: number;
  lastSeenAt: string;
};

function parseTags(tags: string | null | undefined): string[] {
  return (tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function SupportersView({
  supporters,
  filters,
  total,
  engaged,
  allTags,
  sources,
  pagination,
}: {
  filters: Record<"q" | "source" | "tag", string>;
  supporters: SupporterRow[];
  total: number;
  engaged: number;
  allTags: string[];
  sources: string[];
  pagination: { page: number; pageCount: number; total: number };
}) {
  const [query, setQuery] = useState(filters.q);
  const [sourceF, setSourceF] = useState(filters.source);
  const [tagF, setTagF] = useState(filters.tag);
  const [editing, setEditing] = useState<SupporterRow | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const filtered = supporters;

  function applyFilters() {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries({ q: query.trim(), source: sourceF, tag: tagF })) {
      if (value) params.set(key, value); else params.delete(key);
    }
    params.delete("page");
    startTransition(() => router.push(params.size ? `/supporters?${params}` : "/supporters", { scroll: false }));
  }

  function exportCsv() {
    downloadFile(
      "\uFEFF" +
        toCSV(
          filtered.map((s) => ({
            nom: s.name,
            email: s.email,
            ville: s.city ?? "",
            origine: SOURCE_META[s.source ?? ""]?.label ?? s.source ?? "",
            tags: parseTags(s.tags).join(" | "),
            interactions: s.touchCount,
            derniere_activite: new Date(s.lastSeenAt).toISOString().slice(0, 10),
          })),
        ),
      `soutiens-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv",
    );
    toast.success(`${filtered.length} soutien(s) exporté(s) (page courante)`);
  }

  return (
    <div className="flex min-h-[calc(100vh-89px)] flex-col">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 px-4 pt-5 sm:grid-cols-3 sm:px-7 lg:max-w-2xl">
        <StatCard
          label="Soutiens"
          value={total.toLocaleString("fr-FR")}
          icon={<Users className="size-3 text-accent-text" />}
        />
        <StatCard
          label="Multi-engagés (3+)"
          value={engaged.toLocaleString("fr-FR")}
        />
        <StatCard
          label="Taux multi-engagés"
          value={total ? Math.round((engaged / total) * 100) : 0}
          suffix="%"
        />
      </div>

      {/* Toolbar */}
      <FilterBar>
        <form onSubmit={(event) => { event.preventDefault(); applyFilters(); }} className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Filtres des soutiens">
        <SearchField
          value={query}
          onValueChange={setQuery}
          placeholder="Rechercher un soutien…"
          width="w-full sm:w-64"
        />
        <FilterSelect
          value={sourceF}
          onChange={(e) => setSourceF(e.target.value)}
          active={!!sourceF}
          aria-label="Filtrer par origine"
        >
          <option value="">Toutes origines</option>
          {sources.map((k) => (
            <option key={k} value={k}>{SOURCE_META[k]?.label ?? k}</option>
          ))}
        </FilterSelect>
        {allTags.length > 0 && (
          <FilterSelect
            value={tagF}
            onChange={(e) => setTagF(e.target.value)}
            active={!!tagF}
            aria-label="Filtrer par tag"
          >
            <option value="">Tous les tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </FilterSelect>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />} Rechercher
        </Button>
        </form>
        <Buttonish onClick={exportCsv} disabled={!filtered.length} />
        <Button size="sm" className="ml-auto sm:ml-0" onClick={() => setBroadcastOpen(true)}>
          <Send /> Emailing
        </Button>
      </FilterBar>

      {/* Table */}
      <div className="px-4 pb-10 sm:px-6" aria-busy={isPending}>
        <p className="py-3 text-[12px] text-faint" role="status">{isPending ? "Recherche en cours…" : `${pagination.total.toLocaleString("fr-FR")} soutien(s) correspondant(s)`}</p>
        <ul className="crm-surface overflow-hidden rounded-xl">
          {filtered.map((s) => {
            const meta = SOURCE_META[s.source ?? ""];
            const Icon = meta?.icon ?? Users;
            return (
              <li
                key={s.id}
                className="flex items-center gap-2 border-b border-linesoft px-3 py-2.5 last:border-0 hover:bg-hover sm:gap-3 sm:px-4"
              >
                <EntityAvatar name={s.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">{s.name}</p>
                  <p className="truncate text-[11.5px] text-faint">{s.email}</p>
                </div>
                {s.city && (
                  <span className="hidden w-28 truncate text-[12px] text-mut sm:block">{s.city}</span>
                )}
                {meta ? (
                  <span
                    title={`Premier contact : ${meta.label}`}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                      meta.badge,
                    )}
                  >
                    <Icon className="size-3" /> {meta.label}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-md bg-elev px-1.5 py-0.5 text-[11px] text-mut ring-1 ring-inset ring-line">
                    Direct
                  </span>
                )}
                <span
                  title={`${s.touchCount} interaction(s)`}
                  className="w-16 shrink-0 text-right text-[12px] tabular-nums text-mut"
                >
                  ×{s.touchCount}
                </span>
                <div className="hidden w-40 shrink-0 items-center justify-end gap-1 overflow-hidden md:flex">
                  {parseTags(s.tags).slice(0, 2).map((t) => (
                    <span
                      key={t}
                      title={t}
                      className="max-w-20 truncate rounded-md bg-tone-accent px-1.5 py-0.5 text-[10.5px] font-medium text-tone-accent-fg ring-1 ring-inset ring-tone-accent-line"
                    >
                      {t}
                    </span>
                  ))}
                  {parseTags(s.tags).length > 2 && (
                    <span className="text-[10.5px] text-faint">
                      +{parseTags(s.tags).length - 2}
                    </span>
                  )}
                </div>
                <span className="hidden w-24 shrink-0 text-right text-[11px] text-faint md:block">
                  {timeAgo(s.lastSeenAt)}
                </span>
                <button
                  title="Modifier les tags"
                  onClick={() => setEditing(s)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-hover hover:text-mut sm:size-9"
                >
                  <Tag className="size-3.5" />
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-[13px] text-mut">
              {filters.q || filters.source || filters.tag
                ? "Aucun soutien ne correspond à ces filtres."
                : "Aucun soutien pour l’instant — ils apparaîtront dès la première signature ou interpellation."}
            </li>
          )}
        </ul>
        <div className="mt-4 border-t border-linesoft pt-3">
          <PaginationBar
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            label="soutiens"
          />
        </div>
      </div>

      {/* Tag editor */}
      <TagEditor
        supporter={editing}
        onClose={() => setEditing(null)}
        onSaved={() => router.refresh()}
      />

      {/* Broadcast emailing */}
      <BroadcastDialog
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        sources={sources}
        tags={allTags}
      />
    </div>
  );
}

function BroadcastDialog({
  open,
  onClose,
  sources,
  tags,
}: {
  open: boolean;
  onClose: () => void;
  sources: string[];
  tags: string[];
}) {
  const [sourceF, setSourceF] = useState("");
  const [tagF, setTagF] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [estimate, setEstimate] = useState<{ key: string; count?: number; error?: string } | null>(null);
  const audienceKey = JSON.stringify([sourceF, tagF]);
  const count = estimate?.key === audienceKey ? estimate.count ?? null : null;
  const countError = estimate?.key === audienceKey ? estimate.error : null;
  const [sending, setSending] = useState(false);

  // Recompte côté serveur, source de vérité, après un changement d'audience.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setEstimate(null);
    void countBroadcastAudienceAction({ source: sourceF || undefined, tag: tagF || undefined }).then((result) => {
      if (!cancelled) setEstimate({ key: audienceKey, ...result });
    }).catch(() => {
      if (!cancelled) setEstimate({ key: audienceKey, error: "Impossible de vérifier les destinataires. Réessayez." });
    });
    return () => {
      cancelled = true;
    };
  }, [open, sourceF, tagF, audienceKey]);

  async function send() {
    if (sending || count === null || count === 0 || count > EMAIL_BATCH_LIMIT || !subject.trim() || !body.trim()) return;
    if (
      !confirm(
        `Envoyer cet email à ${count ?? "?"} soutien(s) ? L'action est immédiate.`,
      )
    )
      return;
    setSending(true);
    try {
      const res = await sendBroadcastAction({
        subject,
        body,
        audience: { source: sourceF || undefined, tag: tagF || undefined },
      });
      if ("ok" in res && res.ok) {
        toast.success(
          `${res.sent} email(s) envoyé(s)` +
            (res.failed ? `, ${res.failed} en échec` : "") +
            (res.simulated ? " — mode démo, aucun envoi réel" : ""),
        );
        onClose();
        setSubject("");
        setBody("");
      } else if ("error" in res && res.error) {
        toast.error(res.error);
      }
    } catch {
      toast.error("L’envoi n’a pas pu être confirmé. Vérifiez son état avant de réessayer.");
    } finally { setSending(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !sending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Emailing aux soutiens</DialogTitle>
          <DialogDescription>
            Annonce, appel à mobilisation ou remerciements — envoyé au segment
            choisi depuis la base de soutiens.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={sourceF}
            disabled={sending}
            onChange={(e) => setSourceF(e.target.value)}
            active={!!sourceF}
            aria-label="Filtrer par origine"
          >
            <option value="">Toutes origines</option>
            {sources.map((s) => <option key={s} value={s}>{SOURCE_META[s]?.label ?? s}</option>)}
          </FilterSelect>
          {tags.length > 0 && (
            <FilterSelect
              value={tagF}
              disabled={sending}
              onChange={(e) => setTagF(e.target.value)}
              active={!!tagF}
              aria-label="Filtrer par tag"
            >
              <option value="">Tous les tags</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </FilterSelect>
          )}
          <span className="ml-auto text-[12px] tabular-nums text-faint">
            {count === null ? "…" : `${count} destinataire(s)`}
          </span>
        </div>
        {countError && <p role="alert" className="text-sm text-rose-600">{countError}</p>}
        {count !== null && count > EMAIL_BATCH_LIMIT && <p role="alert" className="text-sm text-mut">L’audience dépasse {EMAIL_BATCH_LIMIT} destinataires. Affinez l’origine ou le tag avant l’envoi.</p>}
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Objet de votre annonce"
          maxLength={200}
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          maxLength={8000}
          placeholder={"Chère équipe,\n\n…\n\nÀ très vite !"}
        />
        <p className="text-[11px] leading-relaxed text-faint">
          Une signature «&nbsp;— votre organisation · Vous recevez cet email en
          tant que soutien&nbsp;» est ajoutée automatiquement.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={sending} onClick={onClose}>Annuler</Button>
          <Button
            size="sm"
            disabled={sending || count === null || count === 0 || count > EMAIL_BATCH_LIMIT || !!countError || !subject.trim() || !body.trim()}
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

function TagEditor({
  supporter,
  onClose,
  onSaved,
}: {
  supporter: SupporterRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Synchronise le champ lorsqu'un autre soutien est ouvert.
  if (supporter && supporter.id !== loadedFor) {
    setLoadedFor(supporter.id);
    setValue(parseTags(supporter.tags).join(", "));
  }
  if (!supporter && loadedFor !== null) setLoadedFor(null);

  async function save() {
    if (!supporter || saving) return;
    setSaving(true);
    const tags = value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await setSupporterTagsAction({
      supporterId: supporter.id,
      tags,
    });
    setSaving(false);
    if ("ok" in res && res.ok) {
      toast.success("Tags mis à jour");
      onClose();
      onSaved();
    } else if ("error" in res) toast.error(res.error);
  }

  return (
    <Dialog open={!!supporter} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Segmenter — {supporter?.name}</DialogTitle>
          <DialogDescription>
            Tags séparés par des virgules, ex : <em>bénévole, presse, region:Bretagne</em>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {parseTags(supporter?.tags).map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-md bg-tone-accent px-2 py-0.5 text-[11.5px] font-medium text-tone-accent-fg ring-1 ring-inset ring-tone-accent-line"
            >
              {t}
              <button
                onClick={() =>
                  setValue(
                    value
                      .split(",")
                      .map((x) => x.trim())
                      .filter((x) => x && x !== t)
                      .join(", "),
                  )
                }
                className="text-accent-text/60 hover:text-rose-600"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {parseTags(supporter?.tags).length === 0 && (
            <span className="text-[12px] text-faint">Aucun tag pour l&apos;instant.</span>
          )}
        </div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="bénévole, donateur, region:Île-de-France…"
          maxLength={300}
          className="h-10 w-full rounded-lg border border-line bg-elev px-3 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Buttonish({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[12.5px] font-medium text-mut transition-colors hover:border-accent-ring hover:text-accent-text disabled:opacity-40"
    >
      <Download className="size-4" /> CSV · page
    </button>
  );
}
