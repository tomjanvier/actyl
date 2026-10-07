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
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import {
  CAMPAIGN_STATUS_META,
  CAMPAIGN_STATUSES,
  PRIORITIES,
  PRIORITY_META,
  type CampaignStatus,
  type Priority,
} from "@/lib/constants";
import { createCampaignAction } from "@/app/actions/campaigns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/filter-bar";
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
  isPublished: boolean;
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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const filtered = campaigns.filter((campaign) =>
    (!status || campaign.status === status) &&
    (!normalizedQuery || [campaign.name, campaign.description, campaign.sharedBy, ...campaign.squads.map((squad) => squad.name)]
      .some((value) => value?.toLocaleLowerCase("fr").includes(normalizedQuery))),
  );

  useEffect(() => {
    if (canCreate && params.get("new") === "1") setOpen(true);
  }, [params, canCreate]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchField label="Rechercher une campagne" placeholder="Rechercher une campagne…" value={query} onValueChange={setQuery} width="w-full sm:w-96" inputClassName="bg-raised" />
          <span role="status" className="text-[13px] tabular-nums text-faint">
            {filtered.length} campagne{filtered.length > 1 ? "s" : ""}{filtered.length !== campaigns.length ? ` sur ${campaigns.length}` : ""}
          </span>
        </div>
        <div aria-label="Filtrer par statut" className="flex flex-wrap items-center gap-1.5">
          {[{ value: "", label: "Toutes" }, ...CAMPAIGN_STATUSES.filter((value) => campaigns.some((campaign) => campaign.status === value)).map((value) => ({ value, label: CAMPAIGN_STATUS_META[value].label }))].map((filter) => (
            <button key={filter.value} type="button" aria-pressed={status === filter.value} onClick={() => setStatus(filter.value)} className={cn("min-h-11 rounded-lg px-3 text-[13px] font-medium transition-colors sm:min-h-9", status === filter.value ? "bg-raised text-fg shadow-sm ring-1 ring-line" : "text-faint hover:bg-hover hover:text-fg")}>
              {filter.label}
            </button>
          ))}
          {(query || status) && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setStatus(""); }}><X /> Effacer les filtres</Button>}
        </div>
      </div>
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <KanbanSquare aria-hidden className="mx-auto mb-4 size-7 text-faint" />
          <h2 className="text-lg font-semibold">{campaigns.length ? "Aucune campagne ne correspond" : "Votre première campagne commence ici"}</h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-faint">{campaigns.length ? "Essayez un autre nom ou retirez un filtre." : "Rassemblez vos cibles, suivez vos échanges et préparez la mobilisation dans un même espace."}</p>
          {campaigns.length ? <Button variant="outline" className="mt-5" onClick={() => { setQuery(""); setStatus(""); }}>Réinitialiser les filtres</Button> : canCreate && <Button className="mt-5" onClick={() => setOpen(true)}><Plus /> Nouvelle campagne</Button>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((c) => {
          const statusMeta =
            CAMPAIGN_STATUS_META[c.status as CampaignStatus] ??
            CAMPAIGN_STATUS_META.ACTIVE!;
          const prio =
            PRIORITY_META[c.priority as Priority] ?? PRIORITY_META.MEDIUM!;
          return (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}/kanban`}
              className="group flex min-w-0 flex-col rounded-2xl crm-surface p-5 transition-[border-color,background-color] duration-150 hover:border-accent-ring hover:bg-raised"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-canvas text-xl ring-1 ring-inset ring-line">
                  {c.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-[17px] leading-snug font-semibold text-fg group-hover:text-coral-800 dark:group-hover:text-coral-300">
                    {c.name}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {c.sharedBy && (
                      <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300">
                        Partagée par {c.sharedBy} · {c.shareAccess === "CONTRIBUTE" ? "contribution" : "lecture"}
                      </span>
                    )}
                    <span className={cn(
                      "rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                      c.isPublished
                        ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
                        : "bg-elev text-faint ring-line",
                    )}>
                      {c.isPublished ? "Page publique" : "Page privée"}
                    </span>
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
                <p className="mt-4 min-h-10 line-clamp-2 text-[13px] leading-relaxed text-faint">
                  {c.description}
                </p>
              )}

              {/* Progression synthétique de la campagne. */}
              <div className="mt-5 flex items-center gap-3">
                <div role="progressbar" aria-label="Cibles gagnées" aria-valuenow={c.progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 flex-1 overflow-hidden rounded-full bg-elev">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${c.progress}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums text-faint">{c.progress}%</span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-y-3 border-y border-linesoft py-4 sm:grid-cols-4">
                {[
                  { icon: Users, label: "Cibles", value: c.cardCount },
                  { icon: Trophy, label: "Gagnées", value: c.won },
                  { icon: Mail, label: "Envois", value: c.blastCount },
                  { icon: KanbanSquare, label: "Alliés", value: c.allies },
                ].map((s) => (
                  <div key={s.label} className="pl-3 first:pl-0 sm:border-l sm:border-linesoft sm:first:border-0">
                    <dd className="text-[19px] font-semibold tabular-nums text-fg">
                      {s.value}
                    </dd>
                    <dt className="flex items-center gap-1 text-[11px] text-faint">
                      <s.icon className="size-2.5" />
                      {s.label}
                    </dt>
                  </div>
                ))}
              </dl>

              <footer className="mt-auto flex items-center justify-between gap-3 pt-4">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
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
                <ArrowRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text" />
              </footer>
            </Link>
          );
        })}

        {canCreate && filtered.length > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-faint transition-colors hover:border-accent-ring hover:text-mut"
          >
            <Plus className="size-6" />
            <span className="text-[13px]">Nouvelle campagne</span>
          </button>
        )}
      </div>

      {canCreate && open && <CreateCampaignDialog open={open} onOpenChange={setOpen} />}
    </div>
  );
}

const SQUAD_TINT: Record<string, string> = {
  indigo: "bg-tone-accent text-tone-accent-fg ring-tone-accent-line",
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
