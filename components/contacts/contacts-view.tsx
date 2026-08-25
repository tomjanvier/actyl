"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Download,
  Search,
  Star,
  StickyNote,
  Mail,
  MailCheck,
  MailX,
  RefreshCw,
  Phone,
  Globe,
  Twitter,
  Linkedin,
  X,
  Pencil,
  Vote,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fullName, toCSV, downloadFile, timeAgo } from "@/lib/utils";
import {
  LEVELS,
  LEVEL_META,
  STANCES,
  STANCE_META,
} from "@/lib/constants";
import type { ContactRow } from "@/components/contacts/types";
import type { CustomFieldLite } from "@/components/contacts/types";
import {
  Table,
  THead,
  TBody,
  EmptyState,
  Button,
} from "@/components/contacts/table-parts";
import { ContactDrawer } from "@/components/contacts/contact-drawer";
import { EntityAvatar } from "@/components/ui/badge";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
import { ImportTeamDialog } from "@/components/contacts/import-team-dialog";
import { PaginationBar } from "@/components/ui/pagination";
import {
  subscribeContactsAction,
  unsubscribeContactsAction,
  syncContactsNewsletterStatusAction,
} from "@/app/actions/newsletter";

export const NEWSLETTER_META: Record<string, { label: string; badge: string; dot: string }> = {
  SUBSCRIBED: {
    label: "Inscrit",
    badge:
      "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  PENDING: {
    label: "En attente",
    badge: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  UNSUBSCRIBED: {
    label: "Désinscrit",
    badge: "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
  UNKNOWN: {
    label: "Hors liste",
    badge: "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-400",
    dot: "bg-violet-500",
  },
};

export function ContactsView({
  contacts,
  total,
  fields,
  notes,
  orgNotes,
  privateData,
  canEdit,
  canDelete,
  canNewsletter = false,
  extendedDirectory = false,
  newsletterEnabled = false,
  pagination,
}: {
  contacts: ContactRow[];
  total: number;
  fields: CustomFieldLite[];
  notes: Array<{
    id: string;
    contactId: string;
    body: string;
    pinned: boolean;
    createdAt: string;
  }>;
  orgNotes: Array<{
    id: string;
    contactId: string;
    authorName: string;
    body: string;
    pinned: boolean;
    createdAt: string;
  }>;
  privateData: Record<
    string,
    { rating: number | null; tags: string; status: string }
  >;
  canEdit: boolean;
  canDelete: boolean;
  canNewsletter?: boolean;
  extendedDirectory?: boolean;
  newsletterEnabled?: boolean;
  pagination?: { page: number; pageCount: number; total: number };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [stanceFilter, setStanceFilter] = useState<string>("");
  const [partyFilter, setPartyFilter] = useState<string>("");
  const [institutionFilter, setInstitutionFilter] = useState<string>("");
  const [commissionFilter, setCommissionFilter] = useState<string>("");
  const [themeQuery, setThemeQuery] = useState<string>("");
  const [newsletterFilter, setNewsletterFilter] = useState<string>("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [nlBusy, setNlBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Open create dialog via ⌘K action or ?new=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setCreateOpen(true);
      window.history.replaceState(null, "", "/contacts");
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") return;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        document.getElementById("contacts-search")?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const commissionField = fields.find(
    (f) => f.type === "SELECT" || f.type === "MULTI_SELECT",
  );
  const commissions = useMemo(() => {
    if (!commissionField?.options) return [];
    try {
      return JSON.parse(commissionField.options) as string[];
    } catch {
      return [];
    }
  }, [commissionField]);

  const institutions = useMemo(
    () =>
      [...new Set(contacts.map((c) => c.institution).filter(Boolean))].sort() as string[],
    [contacts],
  );

  const parties = useMemo(
    () =>
      [...new Set(contacts.map((c) => c.party).filter(Boolean))].sort() as string[],
    [contacts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (levelFilter && c.level !== levelFilter) return false;
      if (stanceFilter && c.stance !== stanceFilter) return false;
      if (partyFilter && c.party !== partyFilter) return false;
      if (institutionFilter && c.institution !== institutionFilter) return false;
      if (newsletterFilter) {
        // "SYNCED" matches any known status; otherwise exact match.
        if (
          newsletterFilter === "SYNCED"
            ? !c.newsletterStatus
            : (c.newsletterStatus ?? "") !== newsletterFilter
        )
          return false;
      }
      if (
        commissionFilter &&
        commissionField &&
        (() => {
          try {
            const v = JSON.parse(c.customValues[commissionField.id] ?? "[]");
            return Array.isArray(v)
              ? !v.includes(commissionFilter)
              : v !== commissionFilter;
          } catch {
            return c.customValues[commissionField.id ?? ""] !== commissionFilter;
          }
        })()
      )
        return false;
      if (themeQuery.trim()) {
        const themes = (c.themes ?? "").toLowerCase();
        if (!themes.includes(themeQuery.trim().toLowerCase())) return false;
      }
      if (!q) return true;
      const hay = [
        c.firstName, c.lastName, c.title, c.institution, c.party, c.region,
        c.email, c.bio,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    contacts, query, levelFilter, stanceFilter, partyFilter,
    institutionFilter, commissionFilter, themeQuery, newsletterFilter,
    commissionField,
  ]);

  // ── Newsletter bulk actions (module actif) ──
  const selectableIds = filtered.filter((c) => !!c.email).map((c) => c.id);
  const allChecked = selectableIds.length > 0 && selectableIds.every((id) => checked.has(id));

  function toggleAllNewsletter() {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) selectableIds.forEach((id) => next.delete(id));
      else selectableIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function runNewsletter(
    kind: "subscribe" | "unsubscribe" | "sync",
    ids?: string[],
  ) {
    const targetIds = ids ?? [...checked];
    if (!targetIds.length || nlBusy) return;
    if (
      kind !== "sync" &&
      !confirm(
        `${kind === "subscribe" ? "Inscrire" : "Désinscrire"} ${targetIds.length} contact(s) ${kind === "subscribe" ? "à" : "de"} la newsletter sur EmailOctopus ?`,
      )
    )
      return;
    setNlBusy(kind);
    const res =
      kind === "subscribe"
        ? await subscribeContactsAction({ contactIds: targetIds })
        : kind === "unsubscribe"
          ? await unsubscribeContactsAction({ contactIds: targetIds })
          : await syncContactsNewsletterStatusAction({ contactIds: targetIds });
    setNlBusy(null);
    if ("ok" in res && res.ok) {
      const done =
        "subscribed" in res
          ? res.subscribed
          : "unsubscribed" in res
            ? res.unsubscribed
            : res.synced;
      toast.success(`${done} contact(s) traité(s)` + ("missing" in res && res.missing ? ` · ${res.missing} absent(s) de la liste` : ""));
      setChecked(new Set());
      startTransition(() => router.refresh());
    } else if ("errors" in res && res.errors?.length) {
      toast.error(res.errors[0]!);
    }
  }

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  function exportData(format: "csv" | "json") {
    const rows = filtered.map((c) => ({
      prenom: c.firstName,
      nom: c.lastName,
      fonction: c.title ?? "",
      institution: c.institution ?? "",
      parti: c.party ?? "",
      region: c.region ?? "",
      niveau: LEVEL_META[c.level as keyof typeof LEVEL_META]?.label ?? c.level,
      position: STANCE_META[c.stance as keyof typeof STANCE_META]?.label ?? c.stance,
      influence: c.influenceScore,
      email: c.email ?? "",
      telephone: c.phone ?? "",
      ...Object.fromEntries(
        fields.map((f) => [
          f.name,
          (() => {
            const v = c.customValues[f.id] ?? "";
            try {
              const parsed = JSON.parse(v);
              return Array.isArray(parsed) ? parsed.join(" | ") : v;
            } catch {
              return v;
            }
          })(),
        ]),
      ),
    }));
    downloadFile(
      format === "csv"
        ? "\uFEFF" + toCSV(rows)
        : JSON.stringify(rows, null, 2),
      `actyl-contacts-${new Date().toISOString().slice(0, 10)}.${format}`,
      format === "csv" ? "text/csv" : "application/json",
    );
    toast.success(`${rows.length} contacts exportés (${format.toUpperCase()})`);
  }

  return (
    <div className="flex min-h-[calc(100vh-89px)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            id="contacts-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un décideur…"
            className="h-9 w-64 rounded-lg border border-line bg-elev pl-8.5 pr-8 text-[13px] text-fg outline-none transition-colors placeholder:text-faint focus:border-indigo-500/60"
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

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className={cn(filterCls, levelFilter && activeCls)}
        >
          <option value="">Tous niveaux</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{LEVEL_META[l].label}</option>
          ))}
        </select>

        <select
          value={stanceFilter}
          onChange={(e) => setStanceFilter(e.target.value)}
          className={cn(filterCls, stanceFilter && activeCls)}
        >
          <option value="">Toutes positions</option>
          {STANCES.map((s) => (
            <option key={s} value={s}>{STANCE_META[s].label}</option>
          ))}
        </select>

        {parties.length > 1 && (
          <select
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            className={cn(filterCls, partyFilter && activeCls)}
          >
            <option value="">Tous partis</option>
            {parties.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        {institutions.length > 1 && (
          <select
            value={institutionFilter}
            onChange={(e) => setInstitutionFilter(e.target.value)}
            className={cn(filterCls, institutionFilter && activeCls)}
          >
            <option value="">Toutes institutions</option>
            {institutions.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        )}

        {commissions.length > 0 && commissionField && (
          <select
            value={commissionFilter}
            onChange={(e) => setCommissionFilter(e.target.value)}
            className={cn(filterCls, commissionFilter && activeCls)}
          >
            <option value="">Toutes commissions</option>
            {commissions.map((c2) => (
              <option key={c2} value={c2}>{c2}</option>
            ))}
          </select>
        )}

        <input
          value={themeQuery}
          onChange={(e) => setThemeQuery(e.target.value)}
          placeholder="Thématique…"
          className="h-9 w-32 rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-mut outline-none focus:border-indigo-500/60"
        />

        {newsletterEnabled && (
          <select
            value={newsletterFilter}
            onChange={(e) => setNewsletterFilter(e.target.value)}
            className={cn(filterCls, newsletterFilter && activeCls)}
          >
            <option value="">Newsletter : tous</option>
            <option value="SUBSCRIBED">Inscrits</option>
            <option value="PENDING">En attente</option>
            <option value="UNSUBSCRIBED">Désinscrits</option>
            <option value="UNKNOWN">Hors liste</option>
            <option value="SYNCED">Non synchronisés</option>
          </select>
        )}

        {newsletterEnabled && checked.size > 0 && (
          <span className="flex flex-wrap items-center gap-2 rounded-lg bg-indigo-500/[0.06] px-2 py-1 ring-1 ring-inset ring-indigo-500/20">
            <span className="text-[12px] tabular-nums text-mut">
              {checked.size} sélection
            </span>
            {canNewsletter && (
              <>
                <Button size="sm" disabled={!!nlBusy} onClick={() => void runNewsletter("subscribe")}>
                  {nlBusy === "subscribe" ? <Loader2 className="animate-spin" /> : <MailCheck />}
                  Inscrire
                </Button>
                <Button variant="outline" size="sm" disabled={!!nlBusy} onClick={() => void runNewsletter("unsubscribe")}>
                  {nlBusy === "unsubscribe" ? <Loader2 className="animate-spin" /> : <MailX />}
                  Désinscrire
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" disabled={!!nlBusy} onClick={() => void runNewsletter("sync")}>
              {nlBusy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Rafraîchir
            </Button>
            <button
              onClick={() => setChecked(new Set())}
              title="Vider la sélection"
              className="text-faint hover:text-mut"
            >
              <X className="size-3.5" />
            </button>
          </span>
        )}

        <span className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportData("csv")}>
            <Download /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData("json")}>
            <Download /> JSON
          </Button>
          {canEdit && extendedDirectory && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Vote /> Équipe de campagne
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> Nouveau contact
            </Button>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 px-6 pb-10">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title="Aucun décideur trouvé"
            description="Ajustez vos filtres ou créez le premier contact de l'annuaire."
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus /> Nouveau contact
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                {newsletterEnabled && (
                  <th className="w-[36px]">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAllNewsletter}
                      className="size-3.5 accent-indigo-600"
                      aria-label="Tout sélectionner (avec email)"
                    />
                  </th>
                )}
                <th className="w-[240px]">Décideur</th>
                <th>Fonction / Institution</th>
                <th className="w-[150px]">Parti</th>
                <th className="w-[110px]">Niveau</th>
                <th className="w-[140px]">Position</th>
                <th className="w-[90px]">Influence</th>
                {newsletterEnabled && <th className="w-[110px]">Newsletter</th>}
                <th className="w-[70px]">✉️ reçus</th>
                {fields.filter((f) => f.id).slice(0, 1).map((f) => (
                  <th key={f.id} className="w-[160px]">{f.label}</th>
                ))}
              </tr>
            </THead>
            <TBody>
              {filtered.map((c) => {
                const stance = STANCE_META[c.stance as keyof typeof STANCE_META];
                const level = LEVEL_META[c.level as keyof typeof LEVEL_META];
                const priv = privateData[c.id];
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn("cursor-pointer", checked.has(c.id) && "bg-indigo-500/[0.04]")}
                  >
                    {newsletterEnabled && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked.has(c.id)}
                          disabled={!c.email}
                          onChange={() =>
                            setChecked((prev) => {
                              const next = new Set(prev);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            })
                          }
                          title={c.email ? "" : "Pas d'email sur cette fiche"}
                          className="size-3.5 accent-indigo-600 disabled:opacity-30"
                        />
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-2.5">
                        <EntityAvatar name={fullName(c)} color={c.avatarColor} size="sm" photoUrl={c.photoUrl} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">
                            {fullName(c)}
                          </p>
                          {priv?.tags && (
                            <p className="truncate text-[11px] text-indigo-700 dark:text-indigo-400/80">
                              🔖 {priv.tags.split(",")[0]}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="truncate text-mut">
                        {c.title ?? "—"}
                        {c.institution && (
                          <span className="text-faint"> · {c.institution}</span>
                        )}
                      </p>
                    </td>
                    <td><span className="truncate">{c.party ?? "—"}</span></td>
                    <td>
                      <span className="rounded-md bg-elev px-1.5 py-0.5 text-[11px] text-mut ring-1 ring-inset ring-line">
                        {level?.short ?? c.level}
                      </span>
                    </td>
                    <td>
                      {stance && (
                        <span className={cn("inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", stance.badge)}>
                          <span className={cn("size-1.5 rounded-full", stance.dot)} />
                          {stance.label}
                        </span>
                      )}
                    </td>
                    <td>
                      <InfluenceDots score={c.influenceScore} />
                    </td>
                    {newsletterEnabled && (
                      <td>
                        <NewsletterBadge status={c.newsletterStatus ?? null} />
                      </td>
                    )}
                    <td>
                      <span className="tabular-nums text-faint">{c.emailsReceived || "—"}</span>
                    </td>
                    {fields.slice(0, 1).map((f) => (
                      <td key={f.id}>
                        <CustomCell field={f} value={c.customValues[f.id] ?? ""} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </TBody>
          </Table>
        )}
        {pagination && (
          <div className="mt-4 border-t border-linesoft pt-3">
            <PaginationBar
              page={pagination.page}
              pageCount={pagination.pageCount}
              total={pagination.total}
              label="fiches"
            />
          </div>
        )}
      </div>

      <ContactDrawer
        contact={selected}
        fields={fields}
        myNotes={notes.filter((n) => n.contactId === selectedId)}
        orgNotes={orgNotes.filter((n) => n.contactId === selectedId)}
        myPrivateData={selectedId ? privateData[selectedId] : undefined}
        canEdit={canEdit}
        canDelete={canDelete}
        open={!!selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
        onDeleted={() => {
          setSelectedId(null);
          startTransition(() => router.refresh());
        }}
      />

      <CreateContactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        extendedDirectory={extendedDirectory}
      />

      {extendedDirectory && (
        <ImportTeamDialog open={importOpen} onOpenChange={setImportOpen} />
      )}

      {isPending && (
        <div className="fixed bottom-4 right-4 rounded-full bg-white/10 px-3 py-1.5 text-xs text-mut backdrop-blur">
          Mise à jour…
        </div>
      )}
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function NewsletterBadge({ status }: { status: string | null }) {
  if (!status)
    return (
      <span className="text-[11px] text-faint" title="Jamais synchronisé avec EmailOctopus">
        —
      </span>
    );
  const meta = NEWSLETTER_META[status];
  return (
    <span
      title={meta?.label ?? status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        meta?.badge,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta?.dot)} />
      {meta?.label ?? status}
    </span>
  );
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 select-none items-center justify-center rounded-lg text-[10px] font-medium text-white ring-1 ring-inset ring-white/10",
        AVATAR_BG[color] ?? AVATAR_BG.indigo!,
      )}
    >
      {name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
    </span>
  );
}

const AVATAR_BG: Record<string, string> = {
  slate: "bg-slate-600",
  indigo: "bg-indigo-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-600",
  rose: "bg-rose-600",
  violet: "bg-violet-600",
  sky: "bg-sky-600",
  teal: "bg-teal-600",
  orange: "bg-orange-600",
  fuchsia: "bg-fuchsia-600",
};

function InfluenceDots({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-0.5" title={`Influence ${score}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "size-2.5",
            i <= score ? "fill-amber-400 text-amber-700 dark:text-amber-400" : "text-faint",
          )}
        />
      ))}
    </span>
  );
}

function CustomCell({
  field,
  value,
}: {
  field: CustomFieldLite;
  value: string;
}) {
  if (!value) return <span className="text-faint">—</span>;
  if (field.type === "BOOLEAN")
    return <span className="text-emerald-700 dark:text-emerald-400">✓ Oui</span>;
  if (field.type === "MULTI_SELECT") {
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr))
        return (
          <span className="flex flex-wrap gap-1">
            {arr.slice(0, 2).map((v: string) => (
              <span key={v} className="rounded bg-elev px-1 py-0.5 text-[10.5px] text-mut ring-1 ring-inset ring-line">
                {v}
              </span>
            ))}
            {arr.length > 2 && (
              <span className="text-[10.5px] text-faint">+{arr.length - 2}</span>
            )}
          </span>
        );
    } catch { /* fall through */ }
  }
  if (field.type === "RATING") {
    return <InfluenceDots score={Number(value) || 0} />;
  }
  return <span className="truncate">{value}</span>;
}

const filterCls =
  "h-9 rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-mut outline-none focus:border-indigo-500/60 [&>option]:bg-raised";
const activeCls = "border-indigo-500/40 text-indigo-700 dark:text-indigo-300";
