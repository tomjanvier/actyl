"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Code2,
  Download,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Users,
  Vote,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fullName } from "@/components/lists/shared";
import type { ContactLite } from "@/components/lists/shared";
import { ImportListDialog } from "@/components/lists/import-list-dialog";
import { toggleListPublishAction, removeListItemAction, addContactsToListAction } from "@/app/actions/lists";
import {
  setPresidentielleModuleAction,
  syncPresidentiellePackAction,
} from "@/app/actions/presidentielle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityAvatar } from "@/components/ui/badge";
import { STANCE_META } from "@/lib/constants";

type PackItem = {
  itemId: string;
  note: string | null;
  contact: ContactLite;
};

type PackList = {
  id: string;
  name: string;
  description: string | null;
  isPublished: boolean;
  items: PackItem[];
};

const KEY_DATES = [
  { label: "Primaire social-démocrate", date: "11 & 18 oct. 2026" },
  { label: "1ᵉʳ tour", date: "dim. 18 avril 2027" },
  { label: "2ᵉ tour", date: "dim. 2 mai 2027" },
];

function statusOf(item: PackItem): {
  label: string;
  badge: string;
} | null {
  const t = (item.contact.title ?? "").toLowerCase();
  if (t.includes("déclar")) {
    return {
      label: "Déclaré·e",
      badge: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400",
    };
  }
  if (t.includes("potentiel") || t.includes("pressenti") || item.note?.startsWith("Pressenti")) {
    return {
      label: "Pressenti·e",
      badge: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400",
    };
  }
  return null;
}

export function PresidentielleView({
  moduleEnabled,
  lists,
  allContacts,
  canManage,
  canPublish,
}: {
  moduleEnabled: boolean;
  lists: PackList[];
  allContacts: ContactLite[];
  canManage: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [importOpenFor, setImportOpenFor] = useState<string | null>(null);
  const [addOpenFor, setAddOpenFor] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function toggleModule() {
    if (!canPublish || busy) return;
    if (
      moduleEnabled &&
      !confirm(
        "Désactiver le module Présidentielle 2027 ? Les listes restent dans votre espace mais ne seront plus publiques.",
      )
    )
      return;
    setBusy("module");
    const res = await setPresidentielleModuleAction(!moduleEnabled);
    setBusy(null);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(moduleEnabled ? "Module désactivé" : "Module activé — liste des candidats chargée");
    refresh();
  }

  async function syncPack() {
    if (busy) return;
    setBusy("sync");
    // Merge-only: adds missing candidates, never overwrites or removes.
    const res = await syncPresidentiellePackAction();
    setBusy(null);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    const bits = [
      res.created ? `${res.created} créé(s)` : null,
      res.linked ? `${res.linked} rattaché(s)` : null,
      res.already ? `${res.already} déjà présent(s)` : null,
    ].filter(Boolean);
    toast.success(`Synchronisation terminée — ${bits.join(" · ") || "rien de nouveau"} (rien n'a été écrasé)`);
    refresh();
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      {/* Module switch card */}
      <div
        className={cn(
          "rounded-xl border bg-card transition-colors",
          moduleEnabled ? "border-indigo-500/40 ring-1 ring-inset ring-indigo-500/20" : "border-line",
        )}
      >
        <div className="flex items-start justify-between gap-4 p-5">
          <div className="max-w-2xl">
            <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-fg">
              <Vote className="size-4.5 text-indigo-700 dark:text-indigo-400" />
              Liste publique « Candidat·e·s »
              {moduleEnabled && (
                <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300">
                  Activée
                </span>
              )}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-mut">
              Activez le pack pour charger la liste de référence des candidat·e·s
              déclaré·e·s et pressenti·e·s, puis publiez-la (page publique +
              code d&apos;intégration). La synchronisation ajoute les nouveaux
              candidats sans jamais écraser vos modifications ni retirer vos
              éléments.
            </p>
            {!moduleEnabled && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-faint">
                <Info className="size-3.5 shrink-0" />
                Désactivé : aucune liste présidentielle n&apos;est visible côté public.
              </p>
            )}
          </div>
          {/* Big switch */}
          <button
            role="switch"
            aria-checked={moduleEnabled}
            disabled={!canPublish || busy === "module"}
            onClick={() => void toggleModule()}
            title={canPublish ? "Activer / désactiver le module" : "Réservé aux gestionnaires"}
            className={cn(
              "relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
              moduleEnabled ? "bg-indigo-600" : "bg-elev ring-1 ring-inset ring-line",
            )}
          >
            <span
              className={cn(
                "absolute top-1 size-5 rounded-full bg-white shadow transition-all",
                moduleEnabled ? "left-6" : "left-1",
              )}
            />
          </button>
        </div>

        {/* Key dates */}
        <div className="grid grid-cols-1 gap-3 border-t border-line p-5 sm:grid-cols-3">
          {KEY_DATES.map((d) => (
            <div key={d.label} className="flex items-center gap-2.5 rounded-lg border border-line bg-elev px-3 py-2.5">
              <CalendarClock className="size-4 shrink-0 text-faint" />
              <div>
                <p className="text-[12.5px] font-medium text-fg">{d.label}</p>
                <p className="text-[11.5px] text-faint">{d.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {moduleEnabled && (
        <>
          {lists.map((list) => (
            <article key={list.id} className="overflow-hidden rounded-xl border border-line bg-card">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[14px] font-semibold text-fg">{list.name}</h3>
                    {list.isPublished ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400">
                        <Globe className="size-3" /> Publique
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:text-zinc-400">
                        Non publiée
                      </span>
                    )}
                    <span className="rounded-md bg-elev px-1.5 py-0.5 text-[10.5px] tabular-nums text-faint">
                      {list.items.length} candidat·e·s
                    </span>
                  </div>
                  {list.description && (
                    <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-faint">
                      {list.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {canPublish && (
                    <Button
                      variant={list.isPublished ? "outline" : "default"}
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void toggleListPublishAction(list.id).then(refresh)}
                    >
                      <Globe />
                      {list.isPublished ? "Dépublier" : "Publier"}
                    </Button>
                  )}
                  {canManage && (
                    <>
                      <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => void syncPack()}>
                        {busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                        Synchroniser le pack
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setAddOpenFor(list.id)}>
                        <Plus /> Ajouter
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setImportOpenFor(list.id)}>
                        <Download /> Importer CSV
                      </Button>
                    </>
                  )}
                  {list.isPublished && (
                    <ListPublicButtons listId={list.id} listName={list.name} />
                  )}
                </div>
              </header>

              <ul className="divide-y divide-linesoft">
                {list.items.map((item) => {
                  const status = statusOf(item);
                  const stanceMeta =
                    STANCE_META[item.contact.stance as keyof typeof STANCE_META];
                  return (
                    <li key={item.itemId} className="group flex h-11 items-center gap-3 px-5 hover:bg-hover">
                      <EntityAvatar
                        name={fullName(item.contact)}
                        color={item.contact.avatarColor}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-mut">
                        {fullName(item.contact)}
                      </span>
                      {item.contact.party && (
                        <span className="hidden max-w-52 truncate rounded-md bg-elev px-1.5 py-0.5 text-[11px] text-mut ring-1 ring-inset ring-line md:block">
                          {item.contact.party}
                        </span>
                      )}
                      {status && (
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ring-inset",
                            status.badge,
                          )}
                        >
                          {status.label}
                        </span>
                      )}
                      {item.note && (
                        <span
                          title={item.note}
                          className="hidden max-w-64 truncate text-[11.5px] text-faint lg:block"
                        >
                          {item.note}
                        </span>
                      )}
                      {stanceMeta && (
                        <span title={stanceMeta.label} className={cn("size-2 shrink-0 rounded-full", stanceMeta.dot)} />
                      )}
                      {canManage && (
                        <button
                          title="Retirer de la liste"
                          onClick={() => void removeListItemAction(item.itemId).then(refresh)}
                          className="invisible text-faint hover:text-rose-700 dark:text-rose-400 group-hover:visible"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
                {list.items.length === 0 && (
                  <li className="px-5 py-6 text-center text-[12.5px] text-faint">
                    Liste vide — utilisez « Synchroniser le pack » ou « Importer CSV ».
                  </li>
                )}
              </ul>
            </article>
          ))}

          {lists.length === 0 && canManage && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-6 py-14 text-center">
              <Users className="mb-1 size-8 text-faint" />
              <p className="text-[14px] font-medium text-fg">Aucune liste du pack</p>
              <p className="max-w-md text-[13px] text-faint">
                Réactivez le module ci-dessus pour charger la liste de référence.
              </p>
            </div>
          )}

          {isPending && (
            <div className="pointer-events-none fixed bottom-4 right-4 rounded-full bg-white/10 px-3 py-1.5 text-xs text-mut backdrop-blur">
              Mise à jour…
            </div>
          )}
        </>
      )}

      {/* CSV import (merge-only) */}
      {lists.filter((l) => l.id === importOpenFor).map((l) => (
        <ImportListDialog
          key={l.id}
          listId={l.id}
          listName={l.name}
          open
          onClose={() => setImportOpenFor(null)}
          onImported={refresh}
        />
      ))}

      {/* Add from directory */}
      <AddFromDirectoryDialog
        list={lists.find((l) => l.id === addOpenFor) ?? null}
        contacts={allContacts}
        onClose={() => setAddOpenFor(null)}
        onAdded={refresh}
      />
    </div>
  );
}

function ListPublicButtons({ listId, listName }: { listId: string; listName: string }) {
  function copyEmbed() {
    const url = `${window.location.origin}/embed/list/${listId}`;
    navigator.clipboard
      .writeText(
        `<iframe src="${url}" width="100%" height="480" style="border:0;border-radius:12px" title="${listName}" loading="lazy"></iframe>`,
      )
      .then(() => toast.success("Code d'intégration copié !"))
      .catch(() => toast.error(url));
  }
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={copyEmbed}
        title="Copier le code d'intégration iframe"
      >
        <Code2 /> Intégrer
      </Button>
      <a
        href={`/embed/list/${listId}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-card px-3 text-[12.5px] font-medium text-mut transition-colors hover:border-line hover:bg-hover"
        title="Ouvrir la page publique"
      >
        <ExternalLink className="size-3.5" /> Voir
      </a>
    </>
  );
}

function AddFromDirectoryDialog({
  list,
  contacts,
  onClose,
  onAdded,
}: {
  list: PackList | null;
  contacts: ContactLite[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const inList = useMemo(
    () => new Set(list?.items.map((i) => i.contact.id) ?? []),
    [list],
  );

  const filtered = contacts.filter((c) => {
    if (inList.has(c.id)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${c.firstName} ${c.lastName} ${c.institution ?? ""} ${c.party ?? ""}`
      .toLowerCase()
      .includes(q);
  });

  async function confirm() {
    if (!list || !selected.length || saving) return;
    setSaving(true);
    await addContactsToListAction({ listId: list.id, contactIds: selected });
    setSaving(false);
    toast.success(`${selected.length} contact(s) ajouté(s)`);
    onAdded();
    onClose();
  }

  function resetOnClose() {
    setQuery("");
    setSelected([]);
    onClose();
  }

  return (
    <Dialog open={!!list} onOpenChange={(o) => !o && resetOnClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter à « {list?.name} »</DialogTitle>
          <DialogDescription>
            Sélectionnez des personnes déjà présentes dans votre annuaire.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer…"
            className="pl-8"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
          {filtered.map((c) => (
            <label
              key={c.id}
              className="flex h-10 cursor-pointer items-center gap-2.5 border-b border-line px-3 last:border-0 hover:bg-hover"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked ? [...s, c.id] : s.filter((id) => id !== c.id),
                  )
                }
                className="size-3.5 accent-indigo-500"
              />
              <EntityAvatar name={fullName(c)} color={c.avatarColor} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-mut">
                {fullName(c)}
                <span className="text-faint"> · {c.party ?? c.institution ?? ""}</span>
              </span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-[12.5px] text-faint">
              Tous les contacts de l&apos;annuaire sont déjà dans la liste.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-faint">{selected.length} sélectionné(s)</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resetOnClose}>
              Annuler
            </Button>
            <Button size="sm" disabled={!selected.length || saving} onClick={() => void confirm()}>
              {saving ? "Ajout…" : `Ajouter (${selected.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
