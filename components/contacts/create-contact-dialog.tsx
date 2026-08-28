"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createContactAction } from "@/app/actions/contacts";
import { LEVELS, LEVEL_META, STANCES, STANCE_META } from "@/lib/constants";
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

type ActionRes = { error?: string; ok?: boolean };

const CATEGORIES = [
  { key: "DECISION_MAKER", label: "Décideur·euse" },
  { key: "MEMBER", label: "Adhérent·e" },
  { key: "VOLUNTEER", label: "Bénévole" },
  { key: "DONOR", label: "Donateur·ice" },
  { key: "SUPPORTER", label: "Soutien" },
] as const;

export function CreateContactDialog({
  open,
  onOpenChange,
  extendedDirectory = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extendedDirectory?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionRes | undefined, FormData>(
    createContactAction,
    undefined,
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Contact créé");
      onOpenChange(false);
      router.refresh();
    }
    if (state?.error && open) toast.error(state.error);
  }, [state, onOpenChange, open, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {extendedDirectory ? "Nouveau contact" : "Nouveau décideur"}
          </DialogTitle>
          <DialogDescription>
            Ajoutez une personne à l&apos;annuaire partagé de l&apos;espace de travail.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2">
          {extendedDirectory && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Catégorie</Label>
              <Select name="category" defaultValue="DECISION_MAKER">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Prénom *</Label>
            <Input name="firstName" required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Nom *</Label>
            <Input name="lastName" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input name="email" type="email" placeholder="depute@assemblee-nationale.fr" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Téléphone</Label>
            <Input name="phone" placeholder="+33 6 …" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Fonction</Label>
            <Input name="title" placeholder="Députée, Maire, Ministre…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Institution</Label>
            <Input name="institution" placeholder="Assemblée nationale…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Parti / Affiliation</Label>
            <Input name="party" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Région / Circonscription</Label>
            <Input name="region" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Niveau</Label>
            <Select name="level" defaultValue="NATIONAL">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{LEVEL_META[l].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Position initiale</Label>
            <Select name="stance" defaultValue="UNKNOWN">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STANCES.map((s) => (
                  <SelectItem key={s} value={s}>{STANCE_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Bio / contexte</Label>
            <Textarea name="bio" rows={2} placeholder="Commissions, dossiers suivis, sensibilités…" />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Création…" : "Créer le contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
