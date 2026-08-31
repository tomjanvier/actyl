"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Globe, Trash2, Users, X, Search, Code2, Tag, Download, Pin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fullName } from "@/components/lists/shared";
import type { ContactLite, ListWithItems } from "@/components/lists/shared";
import {
  createListAction,
  deleteListAction,
  toggleListPublishAction,
  addContactsToListAction,
  removeListItemAction,
  createListFieldAction,
  deleteListFieldAction,
  setListItemAttrAction,
  toggleListShortcutAction,
} from "@/app/actions/lists";
import { ImportListDialog } from "@/components/lists/import-list-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/controls";
import { EntityAvatar } from "@/components/ui/badge";
import { STANCE_META } from "@/lib/constants";
import { approveListChangeProposalAction, rejectListChangeProposalAction } from "@/app/actions/list-proposals";

type ActionRes = { error?: string; ok?: boolean };

export function ListsView({
  lists,
  allContacts,
  canManage,
  canPublish,
  isAdmin,
  proposals,
}: {
  lists: ListWithItems[];
  allContacts: ContactLite[];
  canManage: boolean;
  canPublish: boolean;
  isAdmin: boolean;
  proposals: Array<{ id: string; action: string; listName: string; authorName: string; contactName: string | null; createdAt: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpenFor, setAddOpenFor] = useState<string | null>(null);
  const [importOpenFor, setImportOpenFor] = useState<string | null>(null);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  return (
    <div className="space-y-5 px-6 py-5">
      {isAdmin && proposals.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
          <h2 className="text-[14px] font-semibold text-fg">Propositions à valider ({proposals.length})</h2>
          <div className="mt-3 divide-y divide-line rounded-lg border border-line bg-card">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1 text-[12px] text-mut">
                  <span className="font-medium text-fg">{proposal.action === "ADD" ? "Ajouter" : proposal.action === "REMOVE" ? "Retirer" : "Mettre à jour"}</span>{" "}
                  {proposal.contactName ?? "un contact"} dans « {proposal.listName} »
                  <span className="ml-1 text-faint">— par {proposal.authorName}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void approveListChangeProposalAction(proposal.id).then(refresh).catch((error: Error) => toast.error(error.message))}>Valider</Button>
                  <Button size="sm" variant="outline" onClick={() => void rejectListChangeProposalAction(proposal.id).then(refresh).catch((error: Error) => toast.error(error.message))}>Refuser</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {lists.length === 0 && (
        <div className="col-span-full">
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-6 py-14 text-center">
            <Users className="mb-1 size-8 text-faint" />
            <p className="text-[14px] font-medium text-fg">Aucune liste</p>
            <p className="max-w-md text-[13px] text-faint">
              Créez des listes vérifiées (commission, exécutifs locaux…) pour
              les partager avec vos équipes.
            </p>
            {canManage && (
              <Button size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
                <Plus /> Nouvelle liste
              </Button>
            )}
          </div>
        </div>
      )}

      {lists.map((list) => (
        <article
          key={list.id}
          id={list.sourcePack ? `list-${list.sourcePack}` : undefined}
          className="flex flex-col rounded-xl border border-line bg-card transition-colors hover:border-line"
        >
          <header className="flex items-start gap-2 p-4 pb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-[14px] font-semibold text-fg">
                  {list.name}
                </h3>
                {list.isPublished && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                    <Globe className="size-3" /> Tout le monde
                  </span>
                )}
                {!list.isPublished && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-elev px-1.5 py-0.5 text-[10.5px] font-medium text-mut ring-1 ring-inset ring-line">
                    <Users className="size-3" /> Équipe
                  </span>
                )}
                {list.sourcePack && (
                  <span className="inline-flex shrink-0 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-400">
                    Référentiel partagé
                  </span>
                )}
              </div>
              {list.description && (
                <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-faint">
                  {list.description}
                </p>
              )}
            </div>
            <button
              type="button"
              title={list.pinned ? "Retirer des raccourcis" : "Ajouter aux raccourcis"}
              aria-label={list.pinned ? "Retirer des raccourcis" : "Ajouter aux raccourcis"}
              onClick={() =>
                void toggleListShortcutAction(list.id)
                  .then(refresh)
                  .catch((error: Error) => toast.error(error.message))
              }
              className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-amber-600"
            >
              <Pin className={cn("size-3.5", list.pinned && "fill-current text-amber-600")} />
            </button>
            {(list.canEdit || list.canImport || canPublish) && (
              <Dropdownish
                canDelete={list.canEdit}
                canImport={list.canImport}
                canPublish={canPublish}
                published={list.isPublished}
                onTogglePublish={() =>
                  void toggleListPublishAction(list.id).then(refresh)
                }
                onDelete={() => {
                  if (!confirm(`Supprimer la liste « ${list.name} » ?`)) return;
                  void deleteListAction(list.id).then(refresh);
                }}
                onEmbed={() => {
                  const url = `${window.location.origin}/embed/list/${list.id}`;
                  navigator.clipboard
                    .writeText(`<iframe src="${url}" width="100%" height="480" style="border:0;border-radius:12px" title="${list.name}" loading="lazy"></iframe>`)
                    .then(() => toast.success("Code d'intégration copié !"))
                    .catch(() => toast.error(url));
                }}
                onImport={() => setImportOpenFor(list.id)}
              />
            )}
          </header>

          <ul className="flex flex-col px-2 pb-2">
            {list.items.map(({ itemId, contact }) => (
              <li
                key={itemId}
                className="group flex h-9 items-center gap-2.5 rounded-lg px-2 hover:bg-hover"
              >
                <EntityAvatar
                  name={fullName(contact)}
                  color={contact.avatarColor}
                  size="sm"
                  photoUrl={contact.photoUrl}
                />
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/contacts?list=${encodeURIComponent(list.id)}&contact=${encodeURIComponent(contact.id)}`,
                    )
                  }
                  className="min-w-0 flex-1 truncate text-left text-[12.5px] text-mut hover:text-fg"
                  title="Ouvrir et modifier la fiche contact"
                >
                  {fullName(contact)}
                  <span className="text-faint"> · {contact.title ?? contact.institution ?? "—"}</span>
                </button>
                {/* Valeurs des attributs propres à la liste. */}
                {(list.attributes ?? []).slice(0, 2).map((a) => {
                  const v = list.values?.[`${contact.id}:${a.id}`];
                  return v || list.canContribute ? (
                    <button
                      key={a.id}
                      type="button"
                      title={v ? `${a.label} : ${v}` : `Renseigner ${a.label}`}
                      className="hidden max-w-28 truncate rounded-md bg-elev px-1.5 py-0.5 text-[10.5px] text-mut ring-1 ring-inset ring-line lg:block"
                      onClick={() => {
                        if (!list.canContribute) return;
                        const value = window.prompt(a.label, v ?? "");
                        if (value === null) return;
                        void setListItemAttrAction({
                          listId: list.id,
                          contactId: contact.id,
                          fieldId: a.id,
                          value,
                        }).then(refresh);
                      }}
                    >
                      {v || `+ ${a.label}`}
                    </button>
                  ) : null;
                })}
                <StanceDot stance={contact.stance} />
                {list.canContribute && (
                  <button
                    title="Retirer de la liste"
                    onClick={() => void removeListItemAction(itemId).then(refresh)}
                    className="invisible text-faint hover:text-rose-700 dark:text-rose-400 group-hover:visible"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
            {list.totalItems > 5 && (
              <li className="px-2 pb-1 pt-1">
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-1.5 text-left text-[11.5px] font-medium text-indigo-700 hover:bg-hover dark:text-indigo-400"
                  onClick={() => router.push(`/contacts?list=${encodeURIComponent(list.id)}`)}
                >
                  Voir les {list.totalItems - 5} autres dans le répertoire
                </button>
              </li>
            )}
            {list.items.length === 0 && (
              <li className="px-2 py-3 text-[12.5px] text-faint">Liste vide.</li>
            )}
          </ul>

          {/* Attributs propres à la liste. */}
          {(list.canEdit || (list.attributes?.length ?? 0) > 0) && (
            <div className="border-t border-linesoft px-4 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag className="size-3 text-faint" />
                {(list.attributes ?? []).map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400"
                  >
                    {a.label}
                    {list.canEdit && (
                      <button
                        title="Supprimer l'attribut"
                        onClick={() => {
                          void deleteListFieldAction(a.id).then(refresh);
                        }}
                        className="text-indigo-700/60 hover:text-rose-600 dark:text-indigo-400/60"
                      >
                        <X className="size-2.5" />
                      </button>
                    )}
                  </span>
                ))}
                {(list.attributes?.length ?? 0) === 0 && (
                  <span className="text-[10.5px] text-faint">Aucun attribut dédié</span>
                )}
                {list.canEdit && (
                  <ListAttrCreator listId={list.id} onCreated={refresh} />
                )}
              </div>
            </div>
          )}

          {list.canContribute && (
            <footer className="mt-auto flex items-center justify-between border-t border-line px-4 py-2.5">
              <span className="text-[11px] uppercase tracking-wider text-faint">
                {list.totalItems} contact{list.totalItems > 1 ? "s" : ""}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setAddOpenFor(list.id)}>
                <Plus /> Ajouter
              </Button>
            </footer>
          )}
        </article>
      ))}

      {/* Fenêtre de création. */}
      <CreateListDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />

      {/* Fenêtre d’ajout de contacts. */}
      <AddContactsDialog
        list={lists.find((l) => l.id === addOpenFor) ?? null}
        contacts={allContacts}
        onClose={() => setAddOpenFor(null)}
        onAdded={refresh}
      />

      {/* Import CSV par fusion, sans écrasement de l'existant. */}
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

      {isPending && (
        <div className="fixed bottom-4 right-4 rounded-full bg-white/10 px-3 py-1.5 text-xs text-mut backdrop-blur">
          Mise à jour…
        </div>
      )}
      </div>
    </div>
  );
}

// ── Composants auxiliaires ───────────────────────────────────────────────────

function Dropdownish({
  canDelete,
  canImport,
  canPublish,
  published,
  onTogglePublish,
  onDelete,
  onEmbed,
  onImport,
}: {
  canDelete: boolean;
  canImport: boolean;
  canPublish: boolean;
  published: boolean;
  onTogglePublish: () => void;
  onDelete: () => void;
  onEmbed: () => void;
  onImport: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen((o) => !o)}>
        ⋯
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-44 overflow-hidden rounded-lg border border-line bg-raised p-1 shadow-xl shadow-black/50 animate-fade-up">
            {canPublish && (
              <button
                onClick={() => {
                  setOpen(false);
                  onTogglePublish();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-mut hover:bg-hoverstrong"
              >
                <Globe className="size-4 text-faint" />
                {published ? "Limiter à l’équipe" : "Partager avec tout le monde"}
              </button>
            )}
            {canPublish && published && (
              <button
                onClick={() => {
                  setOpen(false);
                  onEmbed();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-mut hover:bg-hoverstrong"
              >
                <Code2 className="size-4 text-faint" /> Code d&apos;intégration
              </button>
            )}
            {canImport && (
              <button
                onClick={() => {
                  setOpen(false);
                  onImport();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-mut hover:bg-hoverstrong"
              >
                <Download className="size-4 text-faint" /> Importer CSV
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="size-4" /> Supprimer
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StanceDot({ stance }: { stance: string }) {
  const meta = STANCE_META[stance as keyof typeof STANCE_META];
  if (!meta) return null;
  return <span title={meta.label} className={cn("size-2 rounded-full", meta.dot)} />;
}

function CreateListDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [state, action, pending] = useActionState<ActionRes | undefined, FormData>(
    createListAction,
    undefined,
  );
  useEffect(() => {
    if (state?.ok) {
      toast.success("Liste créée");
      onOpenChange(false);
      onCreated();
    }
    if (state?.error) toast.error(state.error);
  }, [state, onCreated, onOpenChange]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle liste partagée</DialogTitle>
          <DialogDescription>
            Regroupez des décideurs vérifiés autour d&apos;un thème ou d&apos;une institution.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label>Nom *</Label>
            <Input name="name" placeholder="Commission des Lois — Sénat" required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea name="description" rows={2} placeholder="Source, date de vérification…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Création…" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddContactsDialog({
  list,
  contacts,
  onClose,
  onAdded,
}: {
  list: ListWithItems | null;
  contacts: ContactLite[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQuery("");
    setSelected([]);
  }, [list?.id]);

  const inList = new Set(list?.memberContactIds ?? []);
  const filtered = contacts.filter((c) => {
    if (inList.has(c.id)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${c.firstName} ${c.lastName} ${c.institution ?? ""} ${c.party ?? ""}`
      .toLowerCase()
      .includes(q);
  });

  async function confirm() {
    if (!list || !selected.length) return;
    setSaving(true);
    const result = await addContactsToListAction({ listId: list.id, contactIds: selected });
    setSaving(false);
    toast.success(result?.proposed ? `${result.proposed} proposition(s) envoyée(s) à l’administrateur` : `${selected.length} contact(s) ajouté(s)`);
    onAdded();
    onClose();
  }

  return (
    <Dialog open={!!list} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter à « {list?.name} »</DialogTitle>
          <DialogDescription>Sélectionnez des décideurs dans l&apos;annuaire.</DialogDescription>
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
              <EntityAvatar name={fullName(c)} color={c.avatarColor} size="sm" photoUrl={c.photoUrl} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-mut">
                {fullName(c)}
                <span className="text-faint"> · {c.party ?? c.institution ?? ""}</span>
              </span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-[12.5px] text-faint">
              Tous les décideurs sont déjà dans la liste.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-faint">{selected.length} sélectionné(s)</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
            <Button size="sm" disabled={!selected.length || saving} onClick={() => void confirm()}>
              {saving ? "Ajout…" : `Ajouter (${selected.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListAttrCreator({
  listId,
  onCreated,
}: {
  listId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!label.trim() || busy) return;
    setBusy(true);
    const res = await createListFieldAction({ listId, label });
    setBusy(false);
    if ("ok" in res && res.ok) {
      setLabel("");
      setOpen(false);
      toast.success("Attribut ajouté");
      onCreated();
    } else if ("error" in res && res.error) {
      toast.error(res.error);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Ajouter un attribut dédié à cette liste"
        className="inline-flex h-5 items-center gap-0.5 rounded-md px-1 text-[10.5px] font-medium text-faint transition-colors hover:bg-elev hover:text-mut"
      >
        <Plus className="size-3" /> attribut
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void create()}
        autoFocus
        maxLength={60}
        placeholder="Ex : Commission, Mandat…"
        className="h-6 w-40 rounded-md border border-line bg-elev px-1.5 text-[11px] text-fg outline-none focus:border-indigo-500/60"
      />
      <button
        onClick={() => void create()}
        disabled={busy || !label.trim()}
        className="text-[11px] font-medium text-indigo-700 hover:text-indigo-600 disabled:opacity-40 dark:text-indigo-400"
      >
        ok
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-[11px] text-faint hover:text-mut"
      >
        ✕
      </button>
    </span>
  );
}
