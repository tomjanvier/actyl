"use client";

import { usePathname } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Globe, Settings2, Pin, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_META,
  PRIORITY_META,
  type CampaignStatus,
  type Priority,
} from "@/lib/constants";
import {
  shareCampaignAction,
  removeCampaignShareAction,
  toggleCampaignPinAction,
  updateCampaignStatusAction,
} from "@/app/actions/campaigns";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function CampaignHeader({
  campaign,
  canEdit,
  canShare = false,
}: {
  campaign: {
    id: string;
    name: string;
    slug: string;
    emoji: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: string | null;
    pinned: boolean;
    shares?: Array<{ id: string; workspaceName: string; access: string }>;
    squads: Array<{ name: string; color: string }>;
  };
  canEdit: boolean;
  canShare?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const meta =
    CAMPAIGN_STATUS_META[campaign.status as CampaignStatus] ??
    CAMPAIGN_STATUS_META.ACTIVE!;

  return (
    <div className="border-b border-line px-6 pb-4 pt-5">
      <nav className="mb-1 flex items-center gap-1 text-[12px] text-faint">
        <span>Actyl</span>
        <span>/</span>
        <Link href="/campaigns" className="transition-colors hover:text-mut">
          Campagnes
        </Link>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-elev text-xl ring-1 ring-inset ring-line">
            {campaign.emoji}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[19px] font-semibold tracking-tight text-fg">
                {campaign.name}
              </h1>
              <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", meta.badge)}>
                {meta.label}
              </span>
              <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", (PRIORITY_META[campaign.priority as Priority] ?? PRIORITY_META.MEDIUM!).badge)}>
                {(PRIORITY_META[campaign.priority as Priority] ?? PRIORITY_META.MEDIUM!).label}
              </span>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" title="Modifier le statut">
                      <Settings2 />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Statut de la campagne</DropdownMenuLabel>
                    {CAMPAIGN_STATUSES.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => {
                          void updateCampaignStatusAction(campaign.id, s).then(() =>
                            startTransition(() => router.refresh()),
                          );
                        }}
                      >
                        <span className={cn("size-2 rounded-full", CAMPAIGN_STATUS_META[s].dot)} />
                        {CAMPAIGN_STATUS_META[s].label}
                        {s === campaign.status && <span className="ml-auto text-indigo-700 dark:text-indigo-400">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {canShare && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Partager avec une organisation"
                  onClick={() => {
                    const workspaceSlug = window.prompt(
                      "Slug de l’organisation destinataire (visible dans son URL) :",
                    )?.trim();
                    if (!workspaceSlug) return;
                    const contribute = window.confirm(
                      "Autoriser cette organisation à contribuer au kanban ?\n\nAnnuler = lecture seule.",
                    );
                    void shareCampaignAction({
                      campaignId: campaign.id,
                      workspaceSlug,
                      access: contribute ? "CONTRIBUTE" : "VIEW",
                    })
                      .then((result) => {
                        toast.success(`Campagne partagée avec ${result.workspaceName}`);
                        startTransition(() => router.refresh());
                      })
                      .catch((error: Error) => toast.error(error.message));
                  }}
                >
                  <Share2 />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                title={campaign.pinned ? "Désépingler la campagne" : "Épingler la campagne"}
                onClick={() => void toggleCampaignPinAction(campaign.id, !campaign.pinned).then(() => startTransition(() => router.refresh()))}
              >
                <Pin className={cn(campaign.pinned && "fill-current text-amber-600")} />
              </Button>
            </div>
            {campaign.description && (
              <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-faint line-clamp-2">
                {campaign.description}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px] text-faint">
              {campaign.dueDate && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" /> Échéance : {formatDate(campaign.dueDate)}
                </span>
              )}
              <a
                href={`/p/${campaign.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-indigo-700 dark:text-indigo-400"
                title={`Page publique : /p/${campaign.slug}`}
              >
                <Globe className="size-3" /> /p/{campaign.slug} ↗
              </a>
              {campaign.squads.map((g) => (
                <span
                  key={g.name}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10.5px] ring-1 ring-inset",
                    SQUAD_TINTS[g.color] ?? SQUAD_TINTS.indigo,
                  )}
                >
                  {g.name}
                </span>
              ))}
              {canShare && campaign.shares?.map((share) => (
                <span
                  key={share.id}
                  className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10.5px] text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300"
                >
                  {share.workspaceName} · {share.access === "CONTRIBUTE" ? "contribution" : "lecture"}
                  <button
                    type="button"
                    title="Retirer le partage"
                    onClick={() => {
                      if (!window.confirm(`Retirer le partage avec ${share.workspaceName} ?`)) return;
                      void removeCampaignShareAction(share.id)
                        .then(() => startTransition(() => router.refresh()))
                        .catch((error: Error) => toast.error(error.message));
                    }}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation interne de la campagne. */}
        <nav className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-elev p-1 ring-1 ring-inset ring-line">
          <TabLink href={`/campaigns/${campaign.id}/kanban`} label="Kanban" />
          <TabLink href={`/campaigns/${campaign.id}/emails`} label="Interpellation" />
          <TabLink href={`/campaigns/${campaign.id}/mobilization`} label="Mobilisation" />
          <TabLink href={`/campaigns/${campaign.id}/signatures`} label="Signataires" />
        </nav>
      </div>
    </div>
  );
}

function TabLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  // Reste actif dans les sous-routes du même onglet.
  const active =
    pathname === href ||
    (pathname.startsWith(`${href}/`) && !pathname.slice(href.length + 1).includes("/"));
  return (
    <a
      href={href}
      className={cn(
        "rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors",
        active
          ? "bg-hoverstrong text-fg shadow-sm"
          : "text-faint hover:text-mut",
      )}
    >
      {label}
    </a>
  );
}

const SQUAD_TINTS: Record<string, string> = {
  indigo: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/20",
  sky: "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/20",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20",
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20",
};
