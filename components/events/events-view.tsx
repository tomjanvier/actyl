"use client";

import { useActionState, useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  CalendarDays,
  MapPin,
  Users,
  Trash2,
  Globe,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDateTime } from "@/lib/utils";
import { createEventAction, toggleEventPublishAction, deleteEventAction } from "@/app/actions/mobilization";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  isPublished: boolean;
  campaignName: string | null;
  yesCount: number;
  maybeCount: number;
  rsvps: Array<{ id: string; response: string; name: string }>;
};

export function EventsView({
  events,
  canManage,
  canDelete,
}: {
  events: EventRow[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.startsAt).getTime() >= now);
  const past = events.filter((e) => new Date(e.startsAt).getTime() < now);

  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-5">
        <Section title="À venir" events={upcoming} emptyLabel="Aucun événement à venir." canManage={canManage} canDelete={canDelete} onRefresh={refresh} />
        {past.length > 0 && (
          <Section title="Passés" events={past} emptyLabel="" canManage={false} canDelete={canDelete} onRefresh={refresh} past />
        )}
      </div>
      {canManage && <CreateEventForm onCreated={refresh} />}
    </div>
  );
}

function Section({
  title,
  events,
  emptyLabel,
  canManage,
  canDelete,
  onRefresh,
  past,
}: {
  title: string;
  events: EventRow[];
  emptyLabel: string;
  canManage: boolean;
  canDelete: boolean;
  onRefresh: () => void;
  past?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">
        {title}
      </h2>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-mut">
          {emptyLabel}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {events.map((e) => (
            <li
              key={e.id}
              className={cn("rounded-xl border border-line bg-card p-4", past && "opacity-60")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[14px] font-semibold text-fg">{e.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-mut">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {formatDateTime(e.startsAt)}
                    </span>
                    {e.location && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="size-3.5" />
                        {e.location}
                      </span>
                    )}
                  </div>
                </div>
                {e.isPublished && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400">
                    <Globe className="size-3" /> Publié
                  </span>
                )}
              </div>
              {e.description && (
                <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-mut">
                  {e.description}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-linesoft pt-2.5">
                <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-mut">
                  <Users className="size-3.5" />
                  {e.yesCount} oui · {e.maybeCount} peut-être
                </span>
                <div className="flex items-center gap-1">
                  {(canManage || canDelete) && (
                    <button
                      title="Voir les inscrits"
                      onClick={() =>
                        toast(
                          e.rsvps.length
                            ? e.rsvps
                                .slice(0, 20)
                                .map((r) => `${r.name} (${r.response})`)
                                .join(" · ")
                            : "Aucune inscription pour l'instant.",
                          { duration: 6000 },
                        )
                      }
                      className="rounded-md px-2 py-1 text-[11.5px] text-mut hover:bg-hover hover:text-fg"
                    >
                      Inscrits ({e.rsvps.length})
                    </button>
                  )}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleEventPublishAction(e.id).then(onRefresh)}
                    >
                      {e.isPublished ? "Dépublier" : "Publier"}
                    </Button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        if (!confirm(`Supprimer « ${e.title} » ?`)) return;
                        void deleteEventAction(e.id).then(onRefresh);
                      }}
                      className="text-faint hover:text-rose-700 dark:hover:text-rose-400"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateEventForm({ onCreated }: { onCreated: () => void }) {
  const [state, action, pending] = useActionState<
    { error?: string; ok?: boolean } | undefined,
    FormData
  >(createEventAction, undefined);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Événement créé");
      onCreated();
    }
    if (state?.error) toast.error(state.error);
  }, [state, onCreated]);

  return (
    <form action={action} className="h-fit rounded-xl border border-dashed border-line bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-fg">
        <Plus className="size-4 text-indigo-700 dark:text-indigo-400" /> Nouvel événement
      </h3>
      <Label className="mb-1 block">Titre *</Label>
      <Input name="title" placeholder="Réunion publique — quartier Nord" required className="mb-3" />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <Label className="mb-1 block">Début *</Label>
          <Input name="startsAt" type="datetime-local" required />
        </div>
        <div>
          <Label className="mb-1 block">Durée (h)</Label>
          <Input name="durationHours" type="number" step="0.5" min="0.5" defaultValue="2" />
        </div>
      </div>
      <Label className="mb-1 block">Lieu</Label>
      <Input name="location" placeholder="Maison des associations…" className="mb-3" />
      <Label className="mb-1 block">Description</Label>
      <Textarea name="description" rows={3} placeholder="Ordre du jour, intervenants…" className="mb-3" />
      <Button type="submit" size="sm" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <Plus />}
        Créer l&apos;événement
      </Button>
    </form>
  );
}
