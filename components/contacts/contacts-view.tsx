"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Download,
  Search,
  Star,
  MailCheck,
  MailX,
  RefreshCw,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fullName, toCSV, downloadFile } from "@/lib/utils";
import {
  LEVELS,
  LEVEL_META,
  STANCES,
  STANCE_META,
} from "@/lib/constants";
import type { CandidateProfile, ContactRow } from "@/components/contacts/types";
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
import { FilterBar, FilterSelect, SearchField } from "@/components/ui/filter-bar";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
import { PaginationBar } from "@/components/ui/pagination";
import {
  subscribeContactsAction,
  unsubscribeContactsAction,
  syncContactsNewsletterStatusAction,
} from "@/app/actions/newsletter";
import { deleteContactsAction, moveContactsToListAction } from "@/app/actions/contacts";

export const NEWSLETTER_META: Record<string, { label: string; badge: string; dot: string }> = {
  SUBSCRIBED: {
    label: "Inscrit",
    badge: "bg-tone-success text-tone-success-fg ring-tone-success-line",
    dot: "bg-emerald-500",
  },
  PENDING: {
    label: "En attente",
    badge: "bg-tone-warning text-tone-warning-fg ring-tone-warning-line",
    dot: "bg-amber-500",
  },
  UNSUBSCRIBED: {
    label: "Désinscrit",
    badge: "bg-tone-neutral text-tone-neutral-fg ring-tone-neutral-line",
    dot: "bg-faint",
  },
  UNKNOWN: {
    label: "Hors liste",
    badge: "bg-tone-info text-tone-info-fg ring-tone-info-line",
    dot: "bg-violet-500",
  },
};

export function ContactsView({
  contacts,
  fields,
  notes,
  orgNotes,
  privateData,
  canEdit,
  canDelete,
  canNewsletter = false,
  extendedDirectory = false,
  newsletterEnabled = false,
  lists = [],
  activeListId = "",
  onlyUnlisted = false,
  formerMandate = false,
  initialContactId = null,
  candidateProfiles = {},
  politicalGroups = [],
  canAddPoliticalPosition = false,
  pagination,
  activeCommission = "",
}: {
  activeCommission?: string;
  contacts: ContactRow[];
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
  lists?: Array<{ id: string; name: string }>;
  activeListId?: string;
  onlyUnlisted?: boolean;
  formerMandate?: boolean;
  initialContactId?: string | null;
  candidateProfiles?: Record<string, CandidateProfile>;
  politicalGroups?: Array<{ id: string; name: string; color: string }>;
  canAddPoliticalPosition?: boolean;
  pagination?: { page: number; pageCount: number; total: number };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [stanceFilter, setStanceFilter] = useState<string>("");
  const [partyFilter, setPartyFilter] = useState<string>("");
  const [institutionFilter, setInstitutionFilter] = useState<string>("");
  const commissionFilter = activeCommission;
  const [themeQuery, setThemeQuery] = useState<string>("");
  const [newsletterFilter, setNewsletterFilter] = useState<string>("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveListId, setMoveListId] = useState("");
  const [nlBusy, setNlBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Ouvre la création depuis ⌘K ou le paramètre ?new=1.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setCreateOpen(true);
      window.history.replaceState(null, "", "/contacts");
    }
  }, []);

  useEffect(() => {
    if (
      initialContactId &&
      contacts.some((contact) => contact.id === initialContactId)
    ) {
      setSelectedId(initialContactId);
    }
  }, [contacts, initialContactId]);

  function changeList(listId: string) {
    const params = new URLSearchParams(window.location.search);
    if (listId) params.set("list", listId);
    else params.delete("list");
    params.delete("page");
    params.delete("contact");
    startTransition(() =>
      router.push(params.size ? `/contacts?${params.toString()}` : "/contacts"),
    );
  }

  function changeDirectoryFilter(key: "unlisted" | "mandate" | "commission", value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value); else params.delete(key);
    params.delete("page"); params.delete("contact");
    startTransition(() => router.push(params.size ? `/contacts?${params}` : "/contacts"));
  }

  async function deleteSelected() {
    const ids = [...checked];
    if (!ids.length || deleteBusy) return;
    if (!window.confirm(`Supprimer définitivement ${ids.length} contact(s) sélectionné(s) ?`)) return;
    setDeleteBusy(true);
    try {
      const result = await deleteContactsAction(ids);
      toast.success(result.proposed ? `${result.deleted} supprimé(s), ${result.proposed} modification(s) proposée(s)` : `${result.deleted} contact(s) supprimé(s)`);
      setChecked(new Set());
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    } finally { setDeleteBusy(false); }
  }

  async function moveSelected() {
    const ids = [...checked];
    if (!ids.length || !moveListId || moveBusy) return;
    setMoveBusy(true);
    try {
      const result = await moveContactsToListAction({ contactIds: ids, targetListId: moveListId, sourceListId: activeListId || undefined });
      toast.success(result.proposed ? `${result.proposed} modification(s) proposée(s) pour validation` : `${result.moved} contact(s) ajouté(s) à la liste`);
      setChecked(new Set()); setMoveListId("");
      startTransition(() => router.refresh());
    } catch (error) { toast.error(error instanceof Error ? error.message : "Déplacement impossible"); }
    finally { setMoveBusy(false); }
  }

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
    (f) => f.name === "commission" && (f.type === "SELECT" || f.type === "MULTI_SELECT"),
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
        // « SYNCED » retient tout statut connu ; sinon la valeur doit être exacte.
        if (
          newsletterFilter === "SYNCED"
            ? !c.newsletterStatus
            : (c.newsletterStatus ?? "") !== newsletterFilter
        )
          return false;
      }
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
    institutionFilter, themeQuery, newsletterFilter,
  ]);

  // ── Actions groupées de newsletter lorsque le module est actif ──
  const selectableIds = filtered.filter((c) => !newsletterEnabled || !!c.email).map((c) => c.id);
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
    const rows = (checked.size ? filtered.filter((c) => checked.has(c.id)) : filtered).map((c) => ({
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
    <div className="flex min-h-[calc(100vh-89px)] min-w-0 flex-col overflow-hidden">
      {/* Barre d'outils */}
      <FilterBar>
        <SearchField
          id="contacts-search"
          value={query}
          onValueChange={setQuery}
          placeholder="Rechercher un décideur…"
          hint="/"
          width="w-full sm:w-80"
        />

        {lists.length > 0 && (
          <FilterSelect
            value={activeListId}
            onChange={(event) => changeList(event.target.value)}
            active={!!activeListId}
            aria-label="Filtrer par liste partagée"
          >
            <option value="">Toutes les listes</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>{list.name}</option>
            ))}
          </FilterSelect>
        )}

        <FilterSelect
          value={onlyUnlisted ? "1" : ""}
          onChange={(e) => changeDirectoryFilter("unlisted", e.target.value)}
          active={onlyUnlisted}
          aria-label="Filtrer les contacts sans liste"
        >
          <option value="">Toutes appartenances</option>
          <option value="1">Contacts sans liste</option>
        </FilterSelect>

        <FilterSelect
          value={formerMandate ? "former" : ""}
          onChange={(e) => changeDirectoryFilter("mandate", e.target.value)}
          active={formerMandate}
          aria-label="Filtrer les anciens mandats"
        >
          <option value="">Mandats : tous</option>
          <option value="former">Anciens élus / mandats</option>
        </FilterSelect>

        <FilterSelect
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          active={!!levelFilter}
          aria-label="Filtrer par niveau d'influence"
        >
          <option value="">Tous niveaux</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{LEVEL_META[l].label}</option>
          ))}
        </FilterSelect>

        <FilterSelect
          value={stanceFilter}
          onChange={(e) => setStanceFilter(e.target.value)}
          active={!!stanceFilter}
          aria-label="Filtrer par position"
        >
          <option value="">Toutes positions</option>
          {STANCES.map((s) => (
            <option key={s} value={s}>{STANCE_META[s].label}</option>
          ))}
        </FilterSelect>

        {parties.length > 1 && (
          <FilterSelect
            value={partyFilter}
            onChange={(e) => setPartyFilter(e.target.value)}
            active={!!partyFilter}
            aria-label="Filtrer par parti"
          >
            <option value="">Tous partis</option>
            {parties.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </FilterSelect>
        )}

        {institutions.length > 1 && (
          <FilterSelect
            value={institutionFilter}
            onChange={(e) => setInstitutionFilter(e.target.value)}
            active={!!institutionFilter}
            aria-label="Filtrer par institution"
          >
            <option value="">Toutes institutions</option>
            {institutions.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </FilterSelect>
        )}

        {commissions.length > 0 && commissionField && (
          <FilterSelect
            value={commissionFilter}
            onChange={(e) => changeDirectoryFilter("commission", e.target.value)}
            disabled={isPending}
            active={!!commissionFilter}
            aria-label="Filtrer par commission"
          >
            <option value="">Toutes commissions</option>
            {commissions.map((c2) => (
              <option key={c2} value={c2}>{c2}</option>
            ))}
          </FilterSelect>
        )}

        <SearchField
          value={themeQuery}
          onValueChange={setThemeQuery}
          placeholder="Thématique…"
          label="Filtrer par thématique"
          width="w-36"
        />

        {newsletterEnabled && (
          <FilterSelect
            value={newsletterFilter}
            onChange={(e) => setNewsletterFilter(e.target.value)}
            active={!!newsletterFilter}
            aria-label="Filtrer par statut newsletter"
          >
            <option value="">Newsletter : tous</option>
            <option value="SUBSCRIBED">Inscrits</option>
            <option value="PENDING">En attente</option>
            <option value="UNSUBSCRIBED">Désinscrits</option>
            <option value="UNKNOWN">Hors liste</option>
            <option value="SYNCED">Non synchronisés</option>
          </FilterSelect>
        )}

        {checked.size > 0 && (
          <span className="flex flex-wrap items-center gap-2 rounded-lg bg-accent-soft px-2 py-1 ring-1 ring-inset ring-accent-ring">
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
            {canDelete && (
              <Button variant="outline" size="sm" disabled={deleteBusy || !!nlBusy} onClick={() => void deleteSelected()}>
                {deleteBusy ? <Loader2 className="animate-spin" /> : <X />}
                Supprimer
              </Button>
            )}
            {lists.length > 0 && (
              <>
                <FilterSelect
                  value={moveListId}
                  onChange={(e) => setMoveListId(e.target.value)}
                  active={!!moveListId}
                  aria-label="Liste cible"
                  className="min-w-[150px]"
                >
                  <option value="">Choisir une liste…</option>
                  {lists.filter((list) => list.id !== activeListId).map((list) => (
                    <option key={list.id} value={list.id}>{list.name}</option>
                  ))}
                </FilterSelect>
                <Button variant="outline" size="sm" disabled={!moveListId || moveBusy || !!nlBusy} onClick={() => void moveSelected()}>
                  {moveBusy ? <Loader2 className="animate-spin" /> : null} Déplacer
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

        <span className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => exportData("csv")}>
            <Download /> CSV{checked.size ? ` (${checked.size})` : ""}
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData("json")}>
            <Download /> JSON{checked.size ? ` (${checked.size})` : ""}
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> Nouveau contact
            </Button>
          )}
        </span>
      </FilterBar>

      {/* Tableau */}
      <div className="flex-1 px-3 pb-10 pt-4 sm:px-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <p className="text-[13px] font-semibold text-fg">{filtered.length.toLocaleString("fr-FR")} fiches visibles</p>
            <p className="mt-0.5 text-[12px] text-faint">
              {pagination?.total.toLocaleString("fr-FR")} au total · cliquez sur une ligne pour ouvrir la fiche
            </p>
          </div>
          {checked.size > 0 && <span className="rounded-md bg-accent-soft px-2 py-1 text-[11px] font-medium text-coral-800 dark:text-coral-200">{checked.size} sélectionnée{checked.size > 1 ? "s" : ""}</span>}
        </div>
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
          <div className="crm-surface overflow-hidden rounded-xl">
          <Table>
            <THead>
              <tr>
                {(newsletterEnabled || canDelete) && (
                  <th className="w-[36px]">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAllNewsletter}
                      className="size-3.5 accent-coral-500"
                      aria-label={newsletterEnabled ? "Tout sélectionner (avec email)" : "Tout sélectionner"}
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
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(c.id);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Ouvrir la fiche de ${fullName(c)}`}
                    className={cn("cursor-pointer focus-visible:bg-hover", checked.has(c.id) && "bg-accent-soft")}
                  >
                    {(newsletterEnabled || canDelete) && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked.has(c.id)}
                          disabled={newsletterEnabled && !canDelete && !c.email}
                          onChange={() =>
                            setChecked((prev) => {
                              const next = new Set(prev);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            })
                          }
                          title={c.email || canDelete ? "" : "Pas d'email sur cette fiche"}
                          aria-label={`Sélectionner ${fullName(c)}`}
                          className="size-3.5 accent-coral-500 disabled:opacity-30"
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
                            <p className="truncate text-[11px] text-accent-text">
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
          </div>
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
        candidateProfile={selectedId ? candidateProfiles[selectedId] : undefined}
        politicalGroups={politicalGroups}
        canAddPoliticalPosition={canAddPoliticalPosition}
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

      {isPending && (
        <div className="fixed bottom-4 right-4 rounded-full bg-white/10 px-3 py-1.5 text-xs text-mut backdrop-blur">
          Mise à jour…
        </div>
      )}
    </div>
  );
}

// ── Composants auxiliaires ───────────────────────────────────────────────────

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
