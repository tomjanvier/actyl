"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  KanbanSquare,
  ListChecks,
  Settings,
  Plus,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";

type CampaignOption = { id: string; slug: string; name: string; emoji: string; pinned: boolean };

export function CommandMenu({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Charge les campagnes à la première ouverture de la palette.
  useEffect(() => {
    if (!open || campaigns.length) return;
    void fetch("/api/command/campaigns")
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((d) => setCampaigns(d.campaigns ?? []))
      .catch(() => {});
  }, [open, campaigns.length]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger}
      </span>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Rechercher ou naviguer…" />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => go("/contacts")}>
              <Users />
              Contacts — annuaire des décideurs
            </CommandItem>
            <CommandItem onSelect={() => go("/campaigns")}>
              <KanbanSquare />
              Campagnes
            </CommandItem>
            <CommandItem onSelect={() => go("/lists")}>
              <ListChecks />
              Listes partagées
            </CommandItem>
            <CommandItem onSelect={() => go("/settings")}>
              <Settings />
              Paramètres
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Campagnes épinglées">
            {campaigns.filter((c) => c.pinned).map((c) => (
              <CommandItem key={c.id} onSelect={() => go(`/campaigns/${c.slug}`)}>
                <span>{c.emoji}</span>
                {c.name}
                <CommandShortcut>Kanban</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => go("/contacts?new=1")}>
              <Plus />
              Nouveau contact
            </CommandItem>
            <CommandItem onSelect={() => go("/campaigns?new=1")}>
              <Plus />
              Nouvelle campagne
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
