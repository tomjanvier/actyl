"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  KanbanSquare,
  Mail,
  Plus,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import {
  CAMPAIGN_STATUS_META,
  PRIORITIES,
  PRIORITY_META,
  type CampaignStatus,
  type Priority,
} from "@/lib/constants";
import { createCampaignAction } from "@/app/actions/campaigns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CampaignCard = {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  squads: Array<{ name: string; color: string }>;
  cardCount: number;
  templateCount: number;
  blastCount: number;
  won: number;
  allies: number;
  opponents: number;
  progress: number;
  sharedBy: string | null;
  shareAccess: string | null;
};

export function CampaignsView({
  campaigns,
  canCreate,
}: {
  campaigns: CampaignCard[];
  canCreate: boolean;
}) {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("new") === "1") setOpen(true);
  }, [params]);

  return (
    <div className="px-6 py-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => {
          const statusMeta =
            CAMPAIGN_STATUS_META[c.status as CampaignStatus] ??
            CAMPAIGN_STATUS_META.ACTIVE!;
          const prio =
            PRIORITY_META[c.priority as Priority] ?? PRIORITY_META.MEDIUM!;
          return (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}/kanban`}
              className="group flex flex-col rounded-xl border border-line bg-card p-4 transition-all hover:border-indigo-500/30 hover:bg-hover"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elev text-lg ring-1 ring-inset ring-line">
                  {c.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[14.5px] font-semibold text-fg group-hover:text-white">
                    {c.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {c.sharedBy && (
                      <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300">
                        Partagée par {c.sharedBy} · {c.shareAccess === "CONTRIBUTE" ? "contribution" : "lecture"}
                      </span>
                    )}
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", statusMeta.badge)}>
                      {statusMeta.label}
                    </span>
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", prio.badge)}>
                      {prio.label}
                    </span>
                    {c.dueDate && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-faint">
                        <CalendarDays className="size-3" />
                        {formatDate(c.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {c.description && (
                <p className="mt-3 line-clamp-2 text-[12.5px] leading-relaxed text-faint">
                  {c.description}
                </p>
              )}

              {/* Progression synthétique de la campagne. */}
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elev">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
                    style={{ width: `${Math.max(c.progress, c.progress ? 4 : 0)}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums text-faint">{c.progress}%</span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                {[
                  { icon: Users, label: "Cibles", value: c.cardCount },
                  { icon: Trophy, label: "Gagnées", value: c.won },
                  { icon: Mail, label: "Blasts", value: c.blastCount },
                  { icon: KanbanSquare, label: "Alliés", value: c.allies },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-hover py-1.5">
                    <dd className="text-[14px] font-semibold tabular-nums text-fg">
                      {s.value}
                    </dd>
                    <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-faint">
                      <s.icon className="size-2.5" />
                      {s.label}
                    </dt>
                  </div>
                ))}
              </dl>

              <footer className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <div className="flex min-w-0 items-center gap-1">
                  {c.squads.slice(0, 3).map((g) => (
                    <span
                      key={g.name}
                      title={g.name}
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10.5px] ring-1 ring-inset",
                        SQUAD_TINT[g.color] ?? SQUAD_TINT.indigo,
                      )}
                    >
                      {g.name}
                    </span>
                  ))}
                  {c.squads.length > 3 && (
                    <span className="text-[10.5px] text-faint">+{c.squads.length - 3}</span>
                  )}
                </div>
                <ArrowRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-700 dark:text-indigo-400" />
              </footer>
            </Link>
          );
        })}

        {canCreate && (
          <button
            onClick={() => setOpen(true)}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-faint transition-colors hover:border-indigo-500/50 hover:text-mut"
          >
            <Plus className="size-6" />
            <span className="text-[13px]">Nouvelle campagne</span>
          </button>
        )}
      </div>

      <CreateCampaignDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

const SQUAD_TINT: Record<string, string> = {
  indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/20",
  sky: "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/20",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20",
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20",
};

// ── Fenêtre de création ──────────────────────────────────────────────────────

function CreateCampaignDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [state, action, pending] = useActionState<
    { error?: string; ok?: boolean; campaignId?: string } | undefined,
    FormData
  >(createCampaignAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.campaignId) {
      toast.success("Campagne créée — pipeline initialisé");
      onOpenChange(false);
      router.push(`/campaigns/${state.campaignId}/kanban`);
    }
    if (state?.error) toast.error(state.error);
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle campagne</DialogTitle>
          <DialogDescription>
            Le pipeline kanban par défaut (À contacter → Gagné·e) sera créé
            automatiquement.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3.5">
          <div className="flex gap-3">
            <div className="w-24 shrink-0">
              <Label>Emoji</Label>
              <Input name="emoji" defaultValue="📣" maxLength={4} className="mt-1.5 text-center text-base" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Nom de la campagne *</Label>
              <Input name="name" placeholder="Loi Climat 2027" required autoFocus />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea name="description" rows={3} placeholder="Objectif, texte visé, stratégie…" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Priorité</Label>
              <Select name="priority" defaultValue="MEDIUM">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Échéance</Label>
              <Input name="dueDate" type="date" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Création…" : "Créer la campagne"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
