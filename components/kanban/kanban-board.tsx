"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  GripVertical,
  Plus,
  Clock,
  History,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn, fullName, timeAgo, initials } from "@/lib/utils";
import { PRIORITY_META, STAGE_KIND_META, type Priority, type StageKind } from "@/lib/constants";
import {
  moveCardAction,
  createCardAction,
  removeCardAction,
  setCardPriorityAction,
} from "@/app/actions/campaigns";

export type Stage = { id: string; name: string; kind: string };
export type CardData = {
  id: string;
  stageId: string;
  priority: string;
  role: string | null;
  position: number;
  lastTouchAt: string;
  eventCount: number;
  assignee: string | null;
  contact: {
    firstName: string;
    lastName: string;
    party: string | null;
    institution: string | null;
    avatarColor: string;
  };
};
export type ActivityItem = {
  id: string;
  kind: string;
  detail: string;
  actorName: string;
  createdAt: string;
};
export type ContactLite = {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  institution: string | null;
  party: string | null;
  avatarColor: string;
};

export function KanbanBoard({
  campaignId,
  stages,
  cards: initialCards,
  activity,
  availableContacts,
  canMove,
  canCreate,
  canDelete,
}: {
  campaignId: string;
  stages: Stage[];
  cards: CardData[];
  activity: ActivityItem[];
  availableContacts: ContactLite[];
  canMove: boolean;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [cards, setCards] = useState(initialCards);
  const [activeCard, setActiveCard] = useState<CardData | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function refresh() {
    startTransition(() => router.refresh());
  }

  function onDragStart(e: DragStartEvent) {
    setActiveCard(cards.find((c) => c.id === e.active.id) ?? null);
  }
  function onDragOver(_e: DragOverEvent) {}
  async function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const cardId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const active = cards.find((c) => c.id === cardId);
    if (!active) return;

    // Dropped on a column?
    let targetStageId = overId.startsWith("stage:") ? overId.slice(6) : null;
    let insertIndex = -1;

    if (!targetStageId) {
      // Dropped on a card
      const overCard = cards.find((c) => c.id === overId);
      if (!overCard) return;
      targetStageId = overCard.stageId;
      const siblings = cards
        .filter((c) => c.stageId === targetStageId && c.id !== cardId)
        .sort((a, b) => a.position - b.position);
      insertIndex = siblings.findIndex((c) => c.id === overId);
      if (insertIndex === -1) insertIndex = siblings.length;
    }

    if (targetStageId === active.stageId && insertIndex === active.position) return;

    // Optimistic update
    setCards((prev) => {
      const others = prev.filter((c) => c.id !== cardId);
      const columnCards = others.filter((c) => c.stageId === targetStageId).sort((a, b) => a.position - b.position);
      const moved = { ...active, stageId: targetStageId! };
      if (insertIndex === -1 || insertIndex >= columnCards.length) {
        columnCards.push(moved);
      } else {
        columnCards.splice(insertIndex, 0, moved);
      }
      const repositioned = columnCards.map((c, i) => ({ ...c, position: i }));
      const restMap = new Map(others.filter((c) => c.stageId !== targetStageId).map((c) => [c.id, c]));
      repositioned.forEach((c) => restMap.set(c.id, c));
      return [...restMap.values()];
    });

    const res = await moveCardAction({
      cardId,
      toStageId: targetStageId!,
      position: Math.max(insertIndex, 0),
    });
    if (res.error) {
      toast.error(res.error);
      setCards(initialCards);
    } else {
      const fromStage = stages.find((s) => s.id === active.stageId)?.name;
      const toStageName = stages.find((s) => s.id === targetStageId)?.name;
      if (fromStage !== toStageName)
        toast.success(`${fullName(active.contact)} → ${toStageName}`);
      refresh();
    }
  }

  const byStage = useMemo(() => {
    const map = new Map<string, CardData[]>();
    for (const s of stages) map.set(s.id, []);
    for (const c of [...cards].sort((a, b) => a.position - b.position)) {
      map.get(c.stageId)?.push(c);
    }
    return map;
  }, [cards, stages]);

  return (
    <div className="relative flex min-h-[calc(100vh-137px)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-3">
        <span className="text-[12.5px] text-faint">
          {cards.length} cible{cards.length > 1 ? "s" : ""} dans le pipeline
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen((h) => !h)}>
            <History /> Activité
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Ajouter une cible
            </Button>
          )}
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        modifiers={[restrictToWindowEdges]}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 gap-3 overflow-x-auto px-6 pb-8">
          {stages.map((stage) => {
            const meta =
              STAGE_KIND_META[stage.kind as StageKind] ?? STAGE_KIND_META.NEUTRAL!;
            const stageCards = byStage.get(stage.id) ?? [];
            return (
              <Column
                key={stage.id}
                stage={stage}
                meta={meta}
                cards={stageCards}
                canMove={canMove}
                canDelete={canDelete}
                onDelete={(cardId) => {
                  void removeCardAction(cardId).then(refresh);
                }}
                onPriority={(cardId, p) => {
                  void setCardPriorityAction(cardId, p).then(refresh);
                }}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="w-[260px] rotate-1 scale-[1.02] opacity-95">
              <KanbanCardView card={activeCard} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Activity panel */}
      {historyOpen && (
        <aside className="sticky bottom-0 ml-auto w-80 shrink-0 border-l border-line bg-sidebar">
          <ActivityPanel items={activity} onClose={() => setHistoryOpen(false)} />
        </aside>
      )}

      {/* Add target dialog */}
      {addOpen && (
        <AddTargetDialog
          contacts={availableContacts}
          onClose={() => setAddOpen(false)}
          onAdd={(contactIds) => {
            Promise.all(
              contactIds.map((contactId) => createCardAction({ campaignId, contactId })),
            ).then(() => {
              toast.success(
                contactIds.length > 1
                  ? `${contactIds.length} cibles ajoutées`
                  : "Cible ajoutée au pipeline",
              );
              setAddOpen(false);
              refresh();
            });
          }}
        />
      )}
    </div>
  );
}

// ── Column ───────────────────────────────────────────────────────────────────

function Column({
  stage,
  meta,
  cards,
  canMove,
  canDelete,
  onDelete,
  onPriority,
}: {
  stage: Stage;
  meta: { headerDot: string; headerText: string };
  cards: CardData[];
  canMove: boolean;
  canDelete: boolean;
  onDelete: (cardId: string) => void;
  onPriority: (cardId: string, priority: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}` });
  return (
    <section className="flex w-[272px] shrink-0 flex-col rounded-xl border border-line bg-hover">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className={cn("size-2 rounded-full", meta.headerDot)} />
        <h2 className={cn("truncate text-[12px] font-semibold uppercase tracking-wider", meta.headerText)}>
          {stage.name}
        </h2>
        <span className="ml-auto rounded-full bg-elev px-1.5 text-[11px] tabular-nums text-faint">
          {cards.length}
        </span>
      </header>
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-[120px] flex-col gap-2 p-2 transition-colors",
            isOver && "rounded-b-xl bg-indigo-500/[0.05]",
          )}
        >
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              canMove={canMove}
              canDelete={canDelete}
              onDelete={onDelete}
              onPriority={onPriority}
            />
          ))}
          {cards.length === 0 && (
            <p className="py-6 text-center text-[12px] text-faint">
              {canMove ? "Déposez une carte ici" : "—"}
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

// ── Sortable card ────────────────────────────────────────────────────────────

function SortableCard({
  card,
  canMove,
  canDelete,
  onDelete,
  onPriority,
}: {
  card: CardData;
  canMove: boolean;
  canDelete: boolean;
  onDelete: (cardId: string) => void;
  onPriority: (cardId: string, priority: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    disabled: !canMove,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <div className="group relative">
        <div
          {...attributes}
          {...listeners}
          className={cn(!canMove && "cursor-default", canMove && "cursor-grab active:cursor-grabbing")}
        >
          <KanbanCardView card={card} />
        </div>
        {(canMove || canDelete) && (
          <CardMenu
            card={card}
            canDelete={canDelete}
            onDelete={onDelete}
            onPriority={onPriority}
          />
        )}
      </div>
    </div>
  );
}

function KanbanCardView({
  card,
  dragging,
}: {
  card: CardData;
  dragging?: boolean;
}) {
  const prio = PRIORITY_META[card.priority as Priority] ?? PRIORITY_META.MEDIUM!;
  const name = fullName(card.contact);
  return (
    <article
      className={cn(
        "rounded-lg border border-line bg-raised p-3 shadow-sm transition-colors hover:border-line",
        dragging && "kanban-dragging",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "inline-flex size-7 shrink-0 select-none items-center justify-center rounded-md text-[9.5px] font-medium text-white ring-1 ring-inset ring-white/10",
            AVATAR_BG[card.contact.avatarColor] ?? AVATAR_BG.indigo,
          )}
        >
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight text-fg">
            {name}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-faint">
            {[card.contact.party, card.contact.institution].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <GripVertical className="size-3.5 shrink-0 text-faint" />
      </div>

      {card.role && (
        <p className="mt-2 inline-block rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-500/20">
          {card.role}
        </p>
      )}

      <footer className="mt-2.5 flex items-center gap-2 text-[10.5px] text-faint">
        <span className={cn("rounded px-1 py-0.5 font-medium ring-1 ring-inset", prio.badge)}>
          {prio.label}
        </span>
        {card.assignee && (
          <span className="inline-flex items-center gap-1 truncate">
            <UserRound className="size-2.5" />
            {card.assignee.split(" ")[0]}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap">
          <Clock className="size-2.5" />
          {timeAgo(card.lastTouchAt)}
        </span>
      </footer>
    </article>
  );
}

function CardMenu({
  card,
  canDelete,
  onDelete,
  onPriority,
}: {
  card: CardData;
  canDelete: boolean;
  onDelete: (id: string) => void;
  onPriority: (id: string, p: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute right-1.5 top-1.5 z-10">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          "flex size-6 items-center justify-center rounded-md text-faint hover:bg-hoverstrong hover:text-mut",
          open ? "visible bg-hoverstrong" : "invisible group-hover:visible",
        )}
        title="Options"
      >
        ⋯
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute right-0 top-7 z-50 w-40 overflow-hidden rounded-lg border border-line bg-raised p-1 shadow-xl shadow-black/50 animate-fade-up">
            {!canDelete ? null : (
              <>
                <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-faint">
                  Priorité
                </p>
                {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onPriority(card.id, p);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-mut hover:bg-hoverstrong"
                  >
                    <span className={cn("size-2 rounded-full", PRIORITY_DOT[p])} />
                    {PRIORITY_META[p].label}
                    {card.priority === p && <span className="ml-auto text-indigo-700 dark:text-indigo-400">✓</span>}
                  </button>
                ))}
                <div className="my-1 h-px bg-elev" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    if (confirm("Retirer cette cible du pipeline ?")) onDelete(card.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 className="size-3.5" /> Retirer du pipeline
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
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

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-rose-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-sky-500",
  LOW: "bg-zinc-500",
};

// ── Activity side panel ──────────────────────────────────────────────────────

function ActivityPanel({
  items,
  onClose,
}: {
  items: ActivityItem[];
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-0 right-0 top-0 z-30 flex w-80 flex-col border-l border-line bg-sidebar pt-4 shadow-2xl shadow-black/60">
      <header className="flex items-center justify-between border-b border-line px-4 pb-3">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-fg">
          <History className="size-4 text-indigo-700 dark:text-indigo-400" /> Activité récente
        </h3>
        <button onClick={onClose} className="text-faint hover:text-mut">
          ✕
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-faint">
            Aucun mouvement enregistré.
          </p>
        ) : (
          <ol className="flex flex-col gap-1">
            {items.map((e) => (
              <li key={e.id} className="rounded-lg px-2 py-2 hover:bg-hover">
                <p className="text-[12px] leading-relaxed text-mut">{e.detail}</p>
                <p className="mt-0.5 text-[10.5px] text-faint">
                  {e.actorName} · {timeAgo(e.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ── Add targets dialog ───────────────────────────────────────────────────────

function AddTargetDialog({
  contacts,
  onClose,
  onAdd,
}: {
  contacts: ContactLite[];
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const filtered = contacts.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${c.firstName} ${c.lastName} ${c.institution ?? ""} ${c.party ?? ""}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <Dialogish title="Ajouter des cibles au pipeline" onClose={onClose}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un décideur…"
        autoFocus
        className="h-9 w-full rounded-lg border border-line bg-elev px-3 text-[13px] text-fg outline-none placeholder:text-faint focus:border-indigo-500/60"
      />
      <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
        {filtered.slice(0, 60).map((c) => (
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
            <span
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-md text-[9px] font-medium text-white ring-1 ring-inset ring-white/10",
                AVATAR_BG[c.avatarColor] ?? AVATAR_BG.indigo,
              )}
            >
              {initials(fullName(c))}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-mut">
              {fullName(c)}
              <span className="text-faint"> · {c.party ?? c.institution ?? ""}</span>
            </span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="py-6 text-center text-[12.5px] text-faint">
            Aucun décideur disponible — tous les contacts sont déjà ciblés ou l&apos;annuaire est vide.
          </p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-faint">{selected.length} sélectionné(s)</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" disabled={!selected.length} onClick={() => onAdd(selected)}>
            Ajouter ({selected.length})
          </Button>
        </div>
      </div>
    </Dialogish>
  );
}

// Minimal local modal shell (avoids extra Radix wiring here)
function Dialogish({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-lg overflow-hidden rounded-xl border border-line bg-raised p-5 shadow-2xl shadow-black/60 animate-fade-up">
        <h2 className="mb-4 text-[15px] font-semibold text-fg">{title}</h2>
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}
