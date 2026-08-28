"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Check, Trash2, CalendarDays, UserRound, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import {
  createTaskAction,
  toggleTaskDoneAction,
  deleteTaskAction,
} from "@/app/actions/mobilization";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";
import { EntityAvatar } from "@/components/ui/badge";

type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  done: boolean;
  assignee: string | null;
  contact: { id: string; name: string; avatarColor: string } | null;
};

export function TasksView({
  tasks,
  currentUserId,
  members,
  contacts,
}: {
  tasks: TaskRow[];
  currentUserId: string;
  members: Array<{ userId: string; name: string }>;
  contacts: Array<{ id: string; name: string; avatarColor: string }>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<"mine" | "open" | "all">("mine");

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  // Pour « mes tâches », compare l'assignation au nom de l'utilisateur courant.
  const me = members.find((m) => m.userId === currentUserId)?.name;
  const visible =
    filter === "mine"
      ? tasks.filter((t) => !t.done && (!me || t.assignee === me))
      : filter === "open"
        ? tasks.filter((t) => !t.done)
        : tasks;

  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-3 flex items-center gap-1 rounded-lg bg-elev p-1 ring-1 ring-inset ring-line w-fit">
          {(
            [
              ["mine", "Mes tâches"],
              ["open", "Ouvertes"],
              ["all", "Toutes"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors",
                filter === key
                  ? "bg-hoverstrong text-fg shadow-sm"
                  : "text-mut hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto pr-2 text-[11.5px] tabular-nums text-faint">
            {visible.filter((t) => !t.done).length} en cours
          </span>
        </div>

        <ul className="flex flex-col gap-1">
          {visible.map((t) => (
            <li
              key={t.id}
              className="group flex items-start gap-3 rounded-xl border border-linesoft bg-card px-3.5 py-3 transition-colors hover:border-line"
            >
              <button
                onClick={() => void toggleTaskDoneAction(t.id, !t.done).then(refresh)}
                title={t.done ? "Rouvrir" : "Marquer terminée"}
                className={cn(
                  "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-md border transition-all",
                  t.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-line hover:border-emerald-500/60",
                )}
              >
                {t.done && <Check className="size-3" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[13.5px] font-medium",
                    t.done ? "text-faint line-through" : "text-fg",
                  )}
                >
                  {t.title}
                </p>
                {t.notes && (
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-mut">
                    {t.notes}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-faint">
                  {t.contact && (
                    <Link
                      href="/contacts"
                      className="inline-flex items-center gap-1 hover:text-indigo-700 dark:hover:text-indigo-400"
                    >
                      <EntityAvatar name={t.contact.name} color={t.contact.avatarColor} size="sm" />
                      {t.contact.name}
                    </Link>
                  )}
                  {t.dueDate && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        !t.done &&
                          new Date(t.dueDate) < new Date() &&
                          "font-medium text-rose-700 dark:text-rose-400",
                      )}
                    >
                      <CalendarDays className="size-3" />
                      échéance {formatDate(t.dueDate)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="size-3" />
                    {t.assignee ?? "non assignée"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!confirm("Supprimer cette tâche ?")) return;
                  void deleteTaskAction(t.id).then(refresh);
                }}
                className="invisible shrink-0 text-faint hover:text-rose-700 dark:hover:text-rose-400 group-hover:visible"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-6 py-12 text-center">
              <ListTodo className="size-7 text-faint" />
              <p className="text-[13.5px] font-medium text-fg">Aucune tâche</p>
              <p className="max-w-xs text-[12.5px] text-mut">
                Créez des relances (« rappeler le cabinet de Mme X avant vendredi »)
                pour ne rien laisser passer.
              </p>
            </li>
          )}
        </ul>
      </div>

      {/* Quick add */}
      <QuickAddForm contacts={contacts} members={members} currentUserId={currentUserId} onCreated={refresh} />
    </div>
  );
}

function QuickAddForm({
  contacts,
  members,
  currentUserId,
  onCreated,
}: {
  contacts: Array<{ id: string; name: string; avatarColor: string }>;
  members: Array<{ userId: string; name: string }>;
  currentUserId: string;
  onCreated: () => void;
}) {
  const [state, action, pending] = useActionState<
    { error?: string; ok?: boolean } | undefined,
    FormData
  >(createTaskAction, undefined);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Tâche créée");
      onCreated();
    }
    if (state?.error) toast.error(state.error);
  }, [state, onCreated]);

  return (
    <form action={action} className="h-fit rounded-xl border border-dashed border-line bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-fg">
        <Plus className="size-4 text-indigo-700 dark:text-indigo-400" /> Nouvelle tâche
      </h3>
      <Label className="mb-1 block">Intitulé *</Label>
      <Input name="title" placeholder="Relancer le cabinet…" required className="mb-3" />
      <Label className="mb-1 block">Décideur concerné</Label>
      <select
        name="contactId"
        defaultValue=""
        className="mb-3 h-9 w-full rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-fg outline-none [&>option]:bg-raised"
      >
        <option value="">— aucun —</option>
        {contacts.slice(0, 200).map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <Label className="mb-1 block">Assignée à</Label>
      <select
        name="assignedToId"
        defaultValue={currentUserId}
        className="mb-3 h-9 w-full rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-fg outline-none [&>option]:bg-raised"
      >
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>{m.name}</option>
        ))}
      </select>
      <Label className="mb-1 block">Échéance</Label>
      <Input name="dueDate" type="date" className="mb-3" />
      <Label className="mb-1 block">Notes</Label>
      <Textarea name="notes" rows={2} placeholder="Contexte, arguments…" className="mb-3" />
      <Button type="submit" size="sm" disabled={pending} className="w-full">
        {pending ? "Création…" : "Créer la tâche"}
      </Button>
    </form>
  );
}
