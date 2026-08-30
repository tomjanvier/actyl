"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ExternalLink, FileUp, Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import {
  createPoliticalPositionAction,
  importCampaignTeamsAction,
  type CampaignTeamActionState,
} from "@/app/actions/campaign-teams";
import { EntityAvatar } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";

type Position = {
  id: string;
  party: string | null;
  topic: string;
  summary: string;
  stance: string;
  evidence: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
};

type Team = {
  id: string;
  name: string;
  candidateName: string;
  party: string | null;
  politicalBloc: string | null;
  status: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  verifiedAt: string | null;
  members: Array<{
    id: string;
    role: string | null;
    involvement: string | null;
    relationship: string | null;
    sourceLabel: string | null;
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
  teams,
  partyPositions,
}: {
  isAdmin: boolean;
  teams: Team[];
  partyPositions: Position[];
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [importState, importAction, importPending] = useActionState<CampaignTeamActionState | undefined, FormData>(
    importCampaignTeamsAction,
    undefined,
  );
  const [positionState, positionAction, positionPending] = useActionState<CampaignTeamActionState | undefined, FormData>(
    createPoliticalPositionAction,
    undefined,
  );

  useEffect(() => {
    if (importState?.message) toast.success(importState.message);
    if (importState?.error) toast.error(importState.error);
  }, [importState]);
  useEffect(() => {
    if (positionState?.message) toast.success(positionState.message);
    if (positionState?.error) toast.error(positionState.error);
  }, [positionState]);

  const filteredTeams = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter((team) =>
      `${team.candidateName} ${team.party ?? ""} ${team.politicalBloc ?? ""} ${team.members
        .map((member) => `${member.contact.firstName} ${member.contact.lastName} ${member.role ?? ""}`)
        .join(" ")}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query, teams]);

  return (
    <div className="space-y-5 px-6 py-5">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une équipe, un parti ou une personne…" className="pl-9" />
      </div>

      {isAdmin && (
        <div className="grid gap-4 xl:grid-cols-2">
          <form action={importAction} className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-start gap-3">
              <FileUp className="mt-0.5 size-5 text-indigo-600" />
              <div>
                <h2 className="text-[14px] font-semibold text-fg">Importer les équipes depuis un CSV</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-mut">
                  Les rattachements, fonctions et angles thématiques sont fusionnés. Le fichier et les notes libres ne sont pas conservés.
                </p>
              </div>
            </div>
            <input name="file" type="file" accept=".csv,text/csv" required className="mt-4 block w-full text-[12px] text-mut file:mr-3 file:rounded-md file:border-0 file:bg-elev file:px-3 file:py-2 file:text-fg" />
            <Button className="mt-3" size="sm" disabled={importPending}>
              {importPending ? "Import en cours…" : "Importer et fusionner"}
            </Button>
          </form>

          <form action={positionAction} className="rounded-xl border border-line bg-card p-4">
            <h2 className="text-[14px] font-semibold text-fg">Ajouter une position sourcée</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><Label>Équipe</Label><select name="teamId" className="mt-1 h-9 w-full rounded-md border border-line bg-elev px-2 text-[12px] text-fg"><option value="">Position d’un parti</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.candidateName}</option>)}</select></div>
              <div><Label>Parti</Label><Input name="party" placeholder="Parti ou coalition" /></div>
              <div><Label>Thème *</Label><Input name="topic" required placeholder="Aide publique au développement" /></div>
              <div><Label>Qualification *</Label><select name="stance" defaultValue="UNKNOWN" className="mt-1 h-9 w-full rounded-md border border-line bg-elev px-2 text-[12px] text-fg"><option value="UNKNOWN">À qualifier</option><option value="FAVORABLE">Favorable</option><option value="MIXED">Mixte</option><option value="OPPOSED">Opposée</option></select></div>
              <div className="sm:col-span-2"><Label>Position *</Label><Textarea name="summary" required rows={2} /></div>
              <div><Label>Source *</Label><Input name="sourceLabel" required placeholder="Programme, entretien, discours…" /></div>
              <div><Label>URL de la source</Label><Input name="sourceUrl" type="url" placeholder="https://…" /></div>
            </div>
            <Button className="mt-3" size="sm" disabled={positionPending}>{positionPending ? "Enregistrement…" : "Ajouter la position"}</Button>
          </form>
        </div>
      )}

      {filteredTeams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-14 text-center text-[13px] text-faint">Aucune équipe ne correspond à la recherche.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredTeams.map((team) => {
            const isExpanded = expanded.has(team.id);
            const visibleMembers = team.members.slice(0, isExpanded ? team.members.length : 5);
            return (
              <article key={team.id} className="rounded-xl border border-line bg-card p-4">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold text-fg">{team.candidateName}</h2>
                    <p className="mt-0.5 text-[12px] text-mut">{[team.party, team.politicalBloc].filter(Boolean).join(" · ") || "Sans étiquette renseignée"}</p>
                  </div>
                  <span className="rounded-md bg-elev px-2 py-1 text-[10.5px] font-medium text-mut ring-1 ring-inset ring-line">{STATUS_LABELS[team.status ?? "UNKNOWN"] ?? "Statut non vérifié"}</span>
                </header>
                <div className="mt-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-faint"><Users className="size-3.5" /> {team.members.length} membre{team.members.length > 1 ? "s" : ""}</div>
                <ul className="mt-2 divide-y divide-linesoft rounded-lg border border-linesoft">
                  {visibleMembers.map((member) => (
                    <li key={member.id} className="flex items-center gap-2.5 px-3 py-2">
                      <EntityAvatar name={`${member.contact.firstName} ${member.contact.lastName}`} color={member.contact.avatarColor} photoUrl={member.contact.photoUrl} size="sm" />
                      <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-medium text-fg">{member.contact.firstName} {member.contact.lastName}</p><p className="truncate text-[11.5px] text-faint">{member.role || member.involvement || "Rôle à préciser"}</p></div>
                    </li>
                  ))}
                </ul>
                {team.members.length > 5 && <button type="button" className="mt-2 text-[11.5px] font-medium text-indigo-700 dark:text-indigo-400" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(team.id)) next.delete(team.id); else next.add(team.id); return next; })}>{isExpanded ? "Réduire à 5 membres" : `Afficher les ${team.members.length - 5} autres membres`}</button>}
                {team.positions.length > 0 && <div className="mt-4 space-y-2 border-t border-line pt-3"><p className="text-[11px] font-medium uppercase tracking-wider text-faint">Positions et pistes de travail</p>{team.positions.slice(0, 4).map((position) => <PositionRow key={position.id} position={position} />)}</div>}
                <footer className="mt-3 flex items-center gap-1.5 text-[10.5px] text-faint"><ShieldCheck className="size-3" />{team.verifiedAt ? "Source publique vérifiée" : team.sourceLabel || "Source à documenter"}{team.sourceUrl && <a href={team.sourceUrl} target="_blank" rel="noreferrer" aria-label="Ouvrir la source"><ExternalLink className="size-3" /></a>}</footer>
              </article>
            );
          })}
        </div>
      )}

      {partyPositions.length > 0 && <section className="rounded-xl border border-line bg-card p-4"><h2 className="text-[14px] font-semibold text-fg">Positions des partis</h2><div className="mt-3 grid gap-2 lg:grid-cols-2">{partyPositions.map((position) => <PositionRow key={position.id} position={position} />)}</div></section>}
    </div>
  );
}

function PositionRow({ position }: { position: Position }) {
  return (
    <div className="rounded-lg bg-elev p-2.5 ring-1 ring-inset ring-line">
      <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium text-fg">{position.party ? `${position.party} · ` : ""}{position.topic}</span><span className="text-[10px] text-faint">{STANCE_LABELS[position.stance] ?? "À qualifier"}</span></div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-mut">{position.summary}</p>
      {position.sourceLabel && <p className="mt-1 text-[10.5px] text-faint">Source : {position.sourceUrl ? <a href={position.sourceUrl} target="_blank" rel="noreferrer" className="underline">{position.sourceLabel}</a> : position.sourceLabel}</p>}
    </div>
  );
}
