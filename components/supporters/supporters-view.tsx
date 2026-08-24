"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Search,
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
import { Input, Textarea } from "@/components/ui/input";
import { setSupporterTagsAction } from "@/app/actions/mobilization";
import {
  sendBroadcastAction,
  countBroadcastAudienceAction,
} from "@/app/actions/broadcast";

const SOURCE_META: Record<string, { label: string; badge: string; icon: typeof Mail }> = {
  interpellation: {
    label: "Interpellation",
    badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 ring-indigo-500/20",
    icon: Mail,
  },
  petition: {
    label: "Pétition",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
    icon: PenLine,
  },
  event: {
    label: "Événement",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20",
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
  globalCount,
}: {
  supporters: SupporterRow[];
  globalCount: number;
}) {
  const [query, setQuery] = useState("");
  const [sourceF, setSourceF] = useState("");
  const [tagF, setTagF] = useState("");
  const [editing, setEditing] = useState<SupporterRow | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const router = useRouter();

  const allTags = useMemo(
    () =>
      [
        ...new Set(supporters.flatMap((s) => parseTags(s.tags))),
      ].sort(),
    [supporters],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return supporters.filter((s) => {
      if (sourceF && s.source !== sourceF) return false;
      if (tagF && !parseTags(s.tags).includes(tagF)) return false;
      if (!q) return true;
      return `${s.name} ${s.email} ${s.city ?? ""}`.toLowerCase().includes(q);
    });
  }, [supporters, query, sourceF, tagF]);

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
  }

  // Engagement segments (NationBuilder-style)
  const engaged = supporters.filter((s) => s.touchCount >= 3).length;

  return (
    <div className="flex min-h-[calc(100vh-89px)] flex-col">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 px-6 pt-5 sm:grid-cols-3 lg:max-w-2xl">
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Soutiens</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums text-fg">
            <Users className="size-4.5 text-indigo-700 dark:text-indigo-400" />
            {supporters.length}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Multi-engagés (3+)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{engaged}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Plateforme entière</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{globalCount + supporters.length}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un soutien…"
            className="h-9 w-64 rounded-lg border border-line bg-elev pl-8.5 pr-3 text-[13px] text-fg outline-none placeholder:text-faint focus:border-indigo-500/60"
          />
        </div>
        <select
          value={sourceF}
          onChange={(e) => setSourceF(e.target.value)}
          className={cn(
            "h-9 rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-mut outline-none [&>option]:bg-raised",
            sourceF && "border-indigo-500/40",
          )}
        >
          <option value="">Toutes origines</option>
          {Object.entries(SOURCE_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select
            value={tagF}
            onChange={(e) => setTagF(e.target.value)}
            className={cn(
              "h-9 rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-mut outline-none [&>option]:bg-raised",
              tagF && "border-indigo-500/40",
            )}
          >
            <option value="">Tous les tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        <Buttonish onClick={exportCsv} disabled={!filtered.length} />
        <button
          onClick={() => setBroadcastOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-indigo-500"
        >
          <Send className="size-3.5" /> Emailing
        </button>
      </div>

      {/* Table */}
      <div className="px-6 pb-10">
        <ul className="overflow-hidden rounded-xl border border-line">
          {filtered.map((s) => {
            const meta = SOURCE_META[s.source ?? ""];
            const Icon = meta?.icon ?? Users;
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 border-b border-linesoft px-4 py-2.5 last:border-0 hover:bg-hover"
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
                      className="max-w-20 truncate rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400"
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
                  className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-hover hover:text-mut"
                >
                  <Tag className="size-3.5" />
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-[13px] text-mut">
              Aucun soutien pour l&apos;instant — ils apparaîtront dès la première
              signature ou interpellation.
            </li>
          )}
        </ul>
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
        supporters={supporters.map((s) => ({
          email: s.email,
          source: s.source,
          tags: parseTags(s.tags),
        }))}
      />
    </div>
  );
}

function BroadcastDialog({
  open,
  onClose,
  supporters,
}: {
  open: boolean;
  onClose: () => void;
  supporters: Array<{ email: string; source: string | null; tags: string[] }>;
}) {
  const [sourceF, setSourceF] = useState("");
  const [tagF, setTagF] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const sources = useMemo(
    () => [...new Set(supporters.map((s) => s.source).filter(Boolean))] as string[],
    [supporters],
  );
  const tags = useMemo(
    () => [...new Set(supporters.flatMap((s) => s.tags))].sort(),
    [supporters],
  );

  // Server-side count (source of truth) whenever the audience changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void countBroadcastAudienceAction({
      source: sourceF || undefined,
      tag: tagF || undefined,
    }).then((r) => {
      if (!cancelled && "count" in r && r.count !== undefined) setCount(r.count);
    });
    return () => {
      cancelled = true;
    };
  }, [open, sourceF, tagF]);

  async function send() {
    if (sending || !subject.trim() || !body.trim()) return;
    if (
      !confirm(
        `Envoyer cet email à ${count ?? "?"} soutien(s) ? L'action est immédiate.`,
      )
    )
      return;
    setSending(true);
    const res = await sendBroadcastAction({
      subject,
      body,
      audience: { source: sourceF || undefined, tag: tagF || undefined },
    });
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
    } else if ("error" in res && res.error) {
      toast.error(res.error);
    }
  }

  const selCls =
    "h-9 rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-mut outline-none [&>option]:bg-raised";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Emailing aux soutiens</DialogTitle>
          <DialogDescription>
            Annonce, appel à mobilisation ou remerciements — envoyé au segment
            choisi depuis la base de soutiens.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <select value={sourceF} onChange={(e) => setSourceF(e.target.value)} className={cn(selCls, sourceF && "border-indigo-500/40")}>
            <option value="">Toutes origines</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {tags.length > 0 && (
            <select value={tagF} onChange={(e) => setTagF(e.target.value)} className={cn(selCls, tagF && "border-indigo-500/40")}>
              <option value="">Tous les tags</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <span className="ml-auto text-[12px] tabular-nums text-faint">
            {count === null ? "…" : `${count} destinataire(s)`}
          </span>
        </div>
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

  // Sync the input when a different supporter is opened.
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
              className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11.5px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400"
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
                className="text-indigo-700/60 hover:text-rose-600 dark:text-indigo-400/60"
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
          className="h-10 w-full rounded-lg border border-line bg-elev px-3 text-[13px] text-fg outline-none placeholder:text-faint focus:border-indigo-500/60"
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
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[12.5px] font-medium text-mut transition-colors hover:border-indigo-500/50 hover:text-indigo-700 dark:hover:text-indigo-400 disabled:opacity-40"
    >
      <Download className="size-4" /> Exporter CSV
    </button>
  );
}
