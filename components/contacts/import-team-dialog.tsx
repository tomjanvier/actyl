"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { importCampaignTeamAction } from "@/app/actions/contacts";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ELECTIONS = [
  { key: "PRESIDENTIELLE", label: "Présidentielle" },
  { key: "LEGISLATIVES", label: "Législatives" },
  { key: "MUNICIPALES", label: "Municipales" },
  { key: "DEPARTEMENTALES", label: "Départementales" },
  { key: "REGIONALES", label: "Régionales" },
  { key: "EUROPEENNES", label: "Européennes" },
  { key: "CANTONALES", label: "Cantonales" },
  { key: "AUTRE", label: "Autre scrutin" },
] as const;

/**
 * Importe en lot l'équipe électorale d'une candidature depuis une liste collée,
 * issue d'un document ou tableur, à raison d'une personne par ligne.
 *   Marie Dupont — Directrice de campagne — marie@exemple.fr
 *   Paul Martin; Porte-parole; paul@exemple.fr; +33 6 12 34 56 78
 */
export function ImportTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [candidate, setCandidate] = useState("");
  const [party, setParty] = useState("");
  const [election, setElection] = useState("LEGISLATIVES");
  const [region, setRegion] = useState("");
  const [roster, setRoster] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    const res = await importCampaignTeamAction({
      candidate,
      party: party || undefined,
      election,
      region: region || undefined,
      roster,
    });
    setSaving(false);
    if ("ok" in res && res.ok) {
      toast.success(
        `${res.created ?? 0} membre(s) importé(s)` +
          (res.skipped ? `, ${res.skipped} ignoré(s) (doublon ou ligne illisible)` : ""),
      );
      onOpenChange(false);
      setCandidate("");
      setParty("");
      setRegion("");
      setRoster("");
      router.refresh();
    } else if ("error" in res && res.error) {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importer une équipe de campagne</DialogTitle>
          <DialogDescription>
            Réservé aux administrateurs : intégrez une équipe électorale en un
            copier-coller. Une personne par ligne, champs séparés par
            <code className="mx-1 rounded bg-elev px-1">;</code>,
            <code className="mx-1 rounded bg-elev px-1">—</code>ou tabulation :
            <em> Prénom Nom — Fonction — email — téléphone</em>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Candidature / tête de liste *</Label>
            <Input
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
              placeholder="Camille Durand"
              autoFocus
            />
            <p className="text-[11px] leading-relaxed text-faint">
              Ce nom regroupe les personnes sous la même institution, par exemple « Équipe Camille Durand ».
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Parti / nuance</Label>
            <Input value={party} onChange={(e) => setParty(e.target.value)} placeholder="Vert·e·s…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Scrutin *</Label>
            <Select value={election} onValueChange={setElection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ELECTIONS.map((e) => (
                  <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Circonscription / territoire</Label>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="3ᵉ circo du Rhône…" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Équipe ({roster.split(/\r?\n/).filter((l) => l.trim()).length} ligne(s))</Label>
          <Textarea
            value={roster}
            onChange={(e) => setRoster(e.target.value)}
            rows={7}
            placeholder={"Marie Dupont — Directrice de campagne — marie@exemple.fr\nPaul Martin; Porte-parole; paul@exemple.fr\nSonia Reyes — Responsable bénévoles"}
            className="font-mono text-[12px]"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={saving || !candidate.trim() || !roster.trim()}
            onClick={() => void submit()}
          >
            {saving ? "Import en cours…" : "Importer l'équipe"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
