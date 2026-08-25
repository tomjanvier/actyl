"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Megaphone, Globe, Users, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import { savePetitionAction, togglePetitionPublishAction } from "@/app/actions/mobilization";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";

type PetitionData = {
  id: string;
  title: string;
  description: string;
  goal: number;
  isPublished: boolean;
  signatureCount: number;
  recentSigners: Array<{ id: string; name: string; city: string | null; createdAt: string }>;
};

export function MobilizationView({
  campaignId,
  campaignSlug,
  canManage,
  petition,
}: {
  campaignId: string;
  campaignSlug: string;
  canManage: boolean;
  petition: PetitionData | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-[1fr_340px]">
      <div>
        {canManage ? (
          <PetitionEditor
            key={petition?.id ?? "new"}
            campaignId={campaignId}
            petition={petition}
            onSaved={() => startTransition(() => router.refresh())}
          />
        ) : (
          <p className="text-[13px] text-mut">
            Consultation seule — demandez à un responsable campagne pour modifier la pétition.
          </p>
        )}
      </div>

      {/* Side stats */}
      <aside className="flex flex-col gap-4">
        {petition && (
          <>
            <section className="rounded-xl border border-line bg-card p-4">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">
                Impact
              </h3>
              <p className="flex items-center gap-2 text-[26px] font-semibold tabular-nums text-fg">
                <Users className="size-5 text-indigo-700 dark:text-indigo-400" />
                {petition.signatureCount}
                <span className="text-[13px] font-normal text-mut">/ {petition.goal} signatures</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-hover">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                  style={{
                    width: `${Math.min(100, Math.round((petition.signatureCount / Math.max(petition.goal, 1)) * 100))}%`,
                  }}
                />
              </div>
            </section>

            <section className="rounded-xl border border-line bg-card p-4">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">
                Derniers signataires
              </h3>
              {petition.recentSigners.length === 0 ? (
                <p className="text-[12px] text-faint">Aucune signature pour l&apos;instant.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {petition.recentSigners.map((s) => (
                    <li key={s.id} className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="truncate text-mut">
                        <strong className="font-medium text-fg">{s.name}</strong>
                        {s.city ? ` · ${s.city}` : ""}
                      </span>
                      <span className="shrink-0 text-faint">{timeAgo(s.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {canManage && (
                <Link
                  href={`/campaigns/${campaignId}/signatures`}
                  className="mt-3 flex items-center justify-between rounded-lg bg-elev px-2.5 py-2 text-[12.5px] font-medium text-mut transition-colors hover:text-indigo-700 dark:hover:text-indigo-400"
                >
                  Gérer les signataires
                  <Users className="size-3.5" />
                </Link>
              )}
            </section>
          </>
        )}

        <a
          href={`/p/${campaignSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 transition-colors hover:border-emerald-500/40"
        >
          <ExternalLink className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-fg">Voir la page publique</p>
            <p className="truncate text-[11.5px] text-mut">/p/{campaignSlug}</p>
          </div>
        </a>
      </aside>
    </div>
  );
}

function PetitionEditor({
  campaignId,
  petition,
  onSaved,
}: {
  campaignId: string;
  petition: PetitionData | null;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState<
    { error?: string; ok?: boolean } | undefined,
    FormData
  >(savePetitionAction, undefined);
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Pétition enregistrée");
      onSaved();
    }
    if (state?.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="max-w-2xl rounded-xl border border-line bg-card p-5">
      <input type="hidden" name="campaignId" value={campaignId} />
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-fg">
        <Megaphone className="size-4 text-indigo-700 dark:text-indigo-400" />
        Pétition publique de la campagne
      </h2>

      <Label className="mb-1 block">Titre *</Label>
      <Input name="title" defaultValue={petition?.title} placeholder="Non au déclassement des zones humides" required className="mb-3" />

      <Label className="mb-1 block">Texte de la pétition *</Label>
      <Textarea
        name="description"
        rows={7}
        defaultValue={petition?.description}
        placeholder="Expliquez l'enjeu, ce que vous demandez aux décideurs et pourquoi chaque signature compte…"
        required
        className="mb-3"
      />

      <div className="grid grid-cols-2 items-end gap-3">
        <div>
          <Label className="mb-1 block">Objectif de signatures</Label>
          <Input name="goal" type="number" min={10} defaultValue={petition?.goal ?? 1000} />
        </div>
      </div>

      <Button type="submit" size="sm" disabled={pending} className="mt-4">
        {pending ? "Enregistrement…" : petition ? "Mettre à jour" : "Créer la pétition"}
      </Button>
      <button
        type="button"
        onClick={() => {
          void togglePetitionPublishAction(petition!.id).then(() =>
            startTransition(() => router.refresh()),
          );
        }}
        hidden={!petition}
        className={cn("ml-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ring-1 ring-inset",
          petition?.isPublished
            ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400"
            : "bg-elev text-mut ring-line")}
      >
        <Globe className="size-3.5" />
        {petition?.isPublished ? "Publiée — cliquer pour dépublier" : "Brouillon — cliquer pour publier"}
      </button>
    </form>
  );
}
