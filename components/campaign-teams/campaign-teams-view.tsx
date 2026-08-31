"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, FileText, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  createPoliticalPositionAction,
  deletePoliticalPositionAction,
  updateCampaignProgramAction,
  type CampaignTeamActionState,
} from "@/app/actions/campaign-teams";
import { EntityAvatar } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";

type Position = {
  id: string;
  topic: string;
  summary: string;
  stance: string;
  groupName: string;
  canDelete: boolean;
};

type Team = {
  id: string;
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
  positions: Position[];
};

const STATUS_LABELS: Record<string, string> = {
  OFFICIAL: "Candidature officielle",
  LIKELY: "Candidature probable",
  WATCH: "À surveiller",
  UNKNOWN: "Statut non vérifié",
};

const STANCE_LABELS: Record<string, string> = {
  FAVORABLE: "Favorable",
  MIXED: "Position mixte",
  OPPOSED: "Opposée",
  UNKNOWN: "À qualifier",
};

export function CampaignTeamsView({
  isAdmin,
  canAddPosition,
  groups,
  teams,
}: {
  isAdmin: boolean;
  canAddPosition: boolean;
  groups: Array<{ id: string; name: string; color: string }>;
  teams: Team[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [isRefreshing, startTransition] = useTransition();
  const [positionState, positionAction, positionPending] = useActionState<
    CampaignTeamActionState | undefined,
    FormData
  >(createPoliticalPositionAction, undefined);

  useEffect(() => {
    if (positionState?.message) {
      toast.success(positionState.message);
      startTransition(() => router.refresh());
    }
    if (positionState?.error) toast.error(positionState.error);
  }, [positionState, router]);

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

  async function deletePosition(positionId: string) {
    if (!window.confirm("Supprimer cette piste de travail ?")) return;
    try {
      await deletePoliticalPositionAction(positionId);
      toast.success("Piste supprimée");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    }
  }

  return (
    <div className="space-y-5 px-6 py-5">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une candidature ou un membre d’équipe…"
          className="pl-9"
        />
      </div>

      {canAddPosition && (
        <form action={positionAction} className="max-w-4xl rounded-xl border border-line bg-card p-4">
          <h2 className="text-[14px] font-semibold text-fg">Ajouter une piste de travail</h2>
          <p className="mt-1 text-[12px] text-mut">
            Cette note sera visible uniquement par les membres de l’équipe choisie.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Équipe interne *</Label>
              <select name="groupId" required className="mt-1 h-9 w-full rounded-md border border-line bg-elev px-2 text-[12px] text-fg">
                <option value="">Choisir une équipe</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Candidature *</Label>
              <select name="teamId" required className="mt-1 h-9 w-full rounded-md border border-line bg-elev px-2 text-[12px] text-fg">
                <option value="">Choisir une candidature</option>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.candidateName}</option>)}
              </select>
            </div>
            <div>
              <Label>Enjeu *</Label>
              <Input name="topic" required placeholder="Aide publique au développement" />
            </div>
            <div>
              <Label>Qualification *</Label>
              <select name="stance" defaultValue="UNKNOWN" className="mt-1 h-9 w-full rounded-md border border-line bg-elev px-2 text-[12px] text-fg">
                <option value="UNKNOWN">À qualifier</option>
                <option value="FAVORABLE">Favorable</option>
                <option value="MIXED">Mixte</option>
                <option value="OPPOSED">Opposée</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Note *</Label>
              <Textarea name="summary" required rows={2} placeholder="Position connue, point d’attention ou prochaine action…" />
            </div>
          </div>
          <Button className="mt-3" size="sm" disabled={positionPending || isRefreshing}>
            {positionPending ? "Enregistrement…" : "Partager avec l’équipe"}
          </Button>
        </form>
      )}

      {!canAddPosition && groups.length === 0 && (
        <div className="rounded-xl border border-line bg-card p-4 text-[12.5px] text-mut">
          Rejoignez ou créez une équipe dans les paramètres pour partager des pistes de travail.
        </div>
      )}

      {filteredTeams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-14 text-center text-[13px] text-faint">
          Aucune candidature ne correspond à la recherche.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredTeams.map((team) => {
            const isExpanded = expanded.has(team.id);
            const visibleMembers = team.members.slice(0, isExpanded ? team.members.length : 5);
            return (
              <article key={team.id} className="rounded-xl border border-line bg-card p-4">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold text-fg">{team.candidateName}</h2>
                    <p className="mt-0.5 text-[12px] text-mut">
                      {[team.party, team.politicalBloc].filter(Boolean).join(" · ") || "Sans étiquette renseignée"}
                    </p>
                  </div>
                  <span className="rounded-md bg-elev px-2 py-1 text-[10.5px] font-medium text-mut ring-1 ring-inset ring-line">
                    {STATUS_LABELS[team.status ?? "UNKNOWN"] ?? "Statut non vérifié"}
                  </span>
                </header>

                <div className="mt-3 flex flex-wrap gap-2">
                  {team.programUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={team.programUrl} target="_blank" rel="noreferrer">
                        <FileText /> Ouvrir le programme <ExternalLink />
                      </a>
                    </Button>
                  )}
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => void updateProgram(team)}>
                      {team.programUrl ? "Modifier le lien" : "Ajouter le programme"}
                    </Button>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-faint">
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
                          className="truncate text-[12.5px] font-medium text-fg hover:underline"
                        >
                          {member.contact.firstName} {member.contact.lastName}
                        </Link>
                        <p className="truncate text-[11.5px] text-faint">
                          {member.role || member.involvement || "Rôle à préciser"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                {team.members.length > 5 && (
                  <button
                    type="button"
                    className="mt-2 text-[11.5px] font-medium text-indigo-700 dark:text-indigo-400"
                    onClick={() => setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(team.id)) next.delete(team.id);
                      else next.add(team.id);
                      return next;
                    })}
                  >
                    {isExpanded ? "Réduire à 5 membres" : `Afficher les ${team.members.length - 5} autres membres`}
                  </button>
                )}

                {team.positions.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-line pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-faint">
                      Positions et pistes de travail
                    </p>
                    {team.positions.map((position) => (
                      <PositionRow
                        key={position.id}
                        position={position}
                        onDelete={() => void deletePosition(position.id)}
                      />
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PositionRow({
  position,
  onDelete,
}: {
  position: Position;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg bg-elev p-2.5 ring-1 ring-inset ring-line">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[11px] font-medium text-fg">{position.topic}</span>
          <span className="ml-2 text-[10px] text-faint">
            {STANCE_LABELS[position.stance] ?? "À qualifier"}
          </span>
        </div>
        {position.canDelete && (
          <button type="button" onClick={onDelete} className="text-faint hover:text-rose-600" aria-label="Supprimer la piste">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-mut">{position.summary}</p>
      <p className="mt-1 text-[10.5px] text-faint">Partagé avec {position.groupName}</p>
    </div>
  );
}
