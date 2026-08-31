"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Columns3,
  ExternalLink,
  FileText,
  LayoutGrid,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { updateCampaignProgramAction } from "@/app/actions/campaign-teams";
import { EntityAvatar } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Team = {
  id: string;
  candidateContactId: string | null;
  candidateName: string;
  party: string | null;
  politicalBloc: string | null;
  status: string | null;
  programUrl: string | null;
  members: Array<{
    id: string;
    role: string | null;
    involvement: string | null;
    contact: {
      id: string;
      firstName: string;
      lastName: string;
      title: string | null;
      party: string | null;
      photoUrl: string | null;
      avatarColor: string;
    };
  }>;
};

const STATUS_COLUMNS = [
  { key: "OFFICIAL", label: "Candidatures officielles", accent: "border-emerald-500/40" },
  { key: "LIKELY", label: "Candidatures probables", accent: "border-indigo-500/40" },
  { key: "WATCH", label: "À surveiller", accent: "border-amber-500/40" },
  { key: "UNKNOWN", label: "À qualifier", accent: "border-zinc-500/40" },
] as const;

const STATUS_LABELS = Object.fromEntries(
  STATUS_COLUMNS.map((column) => [column.key, column.label]),
);

export function CampaignTeamsView({
  isAdmin,
  teams,
}: {
  isAdmin: boolean;
  teams: Team[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"kanban" | "cards">("kanban");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [isRefreshing, startTransition] = useTransition();

  const filteredTeams = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter((team) =>
      `${team.candidateName} ${team.party ?? ""} ${team.politicalBloc ?? ""} ${team.members
        .map((member) =>
          `${member.contact.firstName} ${member.contact.lastName} ${member.role ?? ""}`,
        )
        .join(" ")}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query, teams]);

  async function updateProgram(team: Team) {
    const value = window.prompt(
      `Lien vers le programme de ${team.candidateName}`,
      team.programUrl ?? "",
    );
    if (value === null) return;
    try {
      await updateCampaignProgramAction({ teamId: team.id, programUrl: value });
      toast.success(value.trim() ? "Lien du programme enregistré" : "Lien supprimé");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mise à jour impossible");
    }
  }

  return (
    <div className="space-y-5 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-64 max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une candidature ou un membre d’équipe…"
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border border-line bg-card p-1">
          <Button
            type="button"
            size="sm"
            variant={view === "kanban" ? "secondary" : "ghost"}
            onClick={() => setView("kanban")}
          >
            <Columns3 /> Kanban
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "cards" ? "secondary" : "ghost"}
            onClick={() => setView("cards")}
          >
            <LayoutGrid /> Fiches
          </Button>
        </div>
      </div>

      {filteredTeams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-14 text-center text-[13px] text-faint">
          Aucune candidature ne correspond à la recherche.
        </div>
      ) : view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((column) => {
            const columnTeams = filteredTeams.filter(
              (team) => (team.status ?? "UNKNOWN") === column.key,
            );
            return (
              <section
                key={column.key}
                className={cn(
                  "min-w-[280px] flex-1 rounded-xl border-t-2 bg-elev/60 p-3 ring-1 ring-inset ring-line xl:min-w-0",
                  column.accent,
                )}
              >
                <header className="mb-3 flex items-center justify-between gap-2 px-1">
                  <h2 className="text-[12px] font-semibold text-fg">{column.label}</h2>
                  <span className="rounded-full bg-card px-2 py-0.5 text-[10.5px] tabular-nums text-faint ring-1 ring-inset ring-line">
                    {columnTeams.length}
                  </span>
                </header>
                <div className="space-y-2.5">
                  {columnTeams.map((team) => (
                    <CampaignTeamCard
                      key={team.id}
                      team={team}
                      compact
                      isAdmin={isAdmin}
                      expanded={false}
                      onToggle={() => undefined}
                      onUpdateProgram={() => void updateProgram(team)}
                    />
                  ))}
                  {columnTeams.length === 0 && (
                    <p className="rounded-lg border border-dashed border-line p-4 text-center text-[11.5px] text-faint">
                      Aucune candidature
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredTeams.map((team) => (
            <CampaignTeamCard
              key={team.id}
              team={team}
              compact={false}
              isAdmin={isAdmin}
              expanded={expanded.has(team.id)}
              onToggle={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(team.id)) next.delete(team.id);
                  else next.add(team.id);
                  return next;
                })
              }
              onUpdateProgram={() => void updateProgram(team)}
            />
          ))}
        </div>
      )}

      {isRefreshing && (
        <div className="fixed bottom-4 right-4 rounded-full bg-raised px-3 py-1.5 text-xs text-mut shadow-lg">
          Mise à jour…
        </div>
      )}
    </div>
  );
}

function CampaignTeamCard({
  team,
  compact,
  isAdmin,
  expanded,
  onToggle,
  onUpdateProgram,
}: {
  team: Team;
  compact: boolean;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onUpdateProgram: () => void;
}) {
  const visibleMembers = team.members.slice(
    0,
    compact ? 3 : expanded ? team.members.length : 5,
  );
  const candidateHref = team.candidateContactId
    ? `/contacts?contact=${encodeURIComponent(team.candidateContactId)}`
    : null;

  return (
    <article className="rounded-xl border border-line bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {candidateHref ? (
            <Link href={candidateHref} className="truncate text-[14px] font-semibold text-fg hover:underline">
              {team.candidateName}
            </Link>
          ) : (
            <h3 className="truncate text-[14px] font-semibold text-fg">{team.candidateName}</h3>
          )}
          <p className="mt-0.5 truncate text-[11.5px] text-mut">
            {[team.party, team.politicalBloc].filter(Boolean).join(" · ") || "Sans étiquette renseignée"}
          </p>
        </div>
        {!compact && (
          <span className="rounded-md bg-elev px-2 py-1 text-[10px] font-medium text-mut ring-1 ring-inset ring-line">
            {STATUS_LABELS[team.status ?? "UNKNOWN"] ?? "À qualifier"}
          </span>
        )}
      </header>

      <div className="mt-3 flex flex-wrap gap-2">
        {candidateHref && (
          <Button variant="outline" size="sm" asChild>
            <Link href={candidateHref}>Ouvrir la fiche</Link>
          </Button>
        )}
        {team.programUrl && (
          <Button variant="ghost" size="sm" asChild>
            <a href={team.programUrl} target="_blank" rel="noreferrer">
              <FileText /> Programme <ExternalLink />
            </a>
          </Button>
        )}
        {isAdmin && !compact && (
          <Button variant="ghost" size="sm" onClick={onUpdateProgram}>
            {team.programUrl ? "Modifier le programme" : "Ajouter le programme"}
          </Button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-wider text-faint">
        <Users className="size-3.5" /> {team.members.length} membre{team.members.length > 1 ? "s" : ""}
      </div>
      <ul className="mt-2 divide-y divide-linesoft rounded-lg border border-linesoft">
        {visibleMembers.map((member) => (
          <li key={member.id} className="flex items-center gap-2.5 px-3 py-2">
            <EntityAvatar
              name={`${member.contact.firstName} ${member.contact.lastName}`}
              color={member.contact.avatarColor}
              photoUrl={member.contact.photoUrl}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <Link
                href={`/contacts?contact=${encodeURIComponent(member.contact.id)}`}
                className="block truncate text-[12px] font-medium text-fg hover:underline"
              >
                {member.contact.firstName} {member.contact.lastName}
              </Link>
              <p className="truncate text-[11px] text-faint">
                {member.role || member.involvement || "Rôle à préciser"}
              </p>
            </div>
          </li>
        ))}
        {visibleMembers.length === 0 && (
          <li className="px-3 py-3 text-[11.5px] text-faint">Équipe à compléter.</li>
        )}
      </ul>
      {!compact && team.members.length > 5 && (
        <button
          type="button"
          className="mt-2 text-[11.5px] font-medium text-indigo-700 dark:text-indigo-400"
          onClick={onToggle}
        >
          {expanded ? "Réduire à 5 membres" : `Afficher les ${team.members.length - 5} autres membres`}
        </button>
      )}
    </article>
  );
}
