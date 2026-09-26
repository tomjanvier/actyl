"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { importOfficialSourceAction, syncAllReferencePacksAction, setReferencePackEnabledAction } from "@/app/actions/import";
import type { ReferencePackKey } from "@/lib/datasets/reference-packs";
import { Button } from "@/components/ui/button";
import type { ReferenceSource } from "./settings-types";

export function ImportOfficials({
  isAdmin,
  isSuperAdmin,
  canImportContacts,
  referencePacks,
}: {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canImportContacts: boolean;
  referencePacks: Array<{
    key: ReferencePackKey;
    name: string;
    description: string;
    expected: string;
    source: ReferenceSource;
    installed: boolean;
    enabled: boolean;
  }>;
}) {
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});
  const router = useRouter();

  async function importIntoDirectory(
    key: ReferencePackKey,
    source: ReferenceSource,
  ) {
    if (!canImportContacts || running) return;
    const operation = `directory:${key}`;
    setRunning(operation);
    setResult((current) => ({ ...current, [operation]: "" }));
    const res = await importOfficialSourceAction(source);
    setRunning(null);
    if (res.ok) {
      setResult((current) => ({
        ...current,
        [operation]: `${res.created ?? 0} créé(s) · ${res.skipped ?? 0} ignoré(s)`,
      }));
      toast.success("Import indépendant terminé");
      router.refresh();
    } else {
      setResult((current) => ({
        ...current,
        [operation]: res.error ?? "Import impossible",
      }));
      toast.error(res.error ?? "Erreur");
    }
  }

  async function updateSharedPack(
    pack: (typeof referencePacks)[number],
    action: "enable" | "sync" | "disable",
  ) {
    if (!isAdmin || running) return;
    if (action === "sync" && !isSuperAdmin) {
      toast.error("La synchronisation globale est réservée au super-administrateur");
      return;
    }
    if (
      action === "disable" &&
      !window.confirm(
        `Désactiver « ${pack.name} » dans cet espace ? Les contacts et la liste seront conservés.`,
      )
    ) return;
    const operation = `shared:${pack.key}`;
    setRunning(operation);
    const res =
      action === "sync"
        ? await syncAllReferencePacksAction(pack.key)
        : await setReferencePackEnabledAction(pack.key, action === "enable");
    setRunning(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (action === "sync") {
      toast.success(res.proposed ? `${res.proposed} modification(s) à valider dans les listes` : "Référentiel à jour");
    } else {
      toast.success(action === "enable" ? "Référentiel activé" : "Référentiel désactivé");
    }
    router.refresh();
  }

  return (
    <div className="max-w-5xl space-y-6">
      {isAdmin && (
        <section>
          <h2 className="text-[15px] font-semibold text-fg">Listes de référence partagées</h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-mut">
            Activez dans cet espace les projections du catalogue global. Chaque référentiel
            conserve les mêmes contacts dans tous les espaces ; une validation du
            super-administrateur est répercutée partout.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {referencePacks.map((pack) => {
              const operation = `shared:${pack.key}`;
              const active = pack.installed && pack.enabled;
              return (
                <article key={pack.key} className="rounded-xl border border-line bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[13.5px] font-semibold text-fg">{pack.name}</h3>
                      <p className="mt-1 text-[12px] text-mut">{pack.description}</p>
                      <p className="mt-1 text-[11px] text-faint">{pack.expected}</p>
                    </div>
                    <span className={cn(
                      "rounded-md px-2 py-1 text-[10.5px] font-medium",
                      active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-elev text-faint",
                    )}>
                      {active ? "Activée" : "Désactivée"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!active ? (
                      <Button size="sm" disabled={running !== null} onClick={() => void updateSharedPack(pack, "enable")}>
                        {running === operation ? <Loader2 className="animate-spin" /> : <Download />}
                        Activer
                      </Button>
                    ) : (
                      <>
                        {isSuperAdmin && (
                          <Button variant="outline" size="sm" disabled={running !== null} onClick={() => void updateSharedPack(pack, "sync")}>
                            {running === operation ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                            Vérifier pour tous les espaces
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" disabled={running !== null} onClick={() => void updateSharedPack(pack, "disable")}>
                          Désactiver
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="border-t border-line pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Import indépendant</h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-mut">
              Ajoutez une copie ponctuelle à votre répertoire si vous ne souhaitez pas utiliser
              une liste partagée. Cet import ne sera pas synchronisé chaque semaine.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {referencePacks.map((pack) => {
            const operation = `directory:${pack.key}`;
            return (
              <article key={pack.key} className="flex items-center gap-3 rounded-xl border border-line bg-card p-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-semibold text-fg">{pack.name}</h3>
                  <p className="mt-0.5 text-[11.5px] text-faint">Copie locale sans synchronisation</p>
                  {result[operation] && (
                    <p className="mt-1 text-[11.5px] text-mut">{result[operation]}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canImportContacts || running !== null}
                  onClick={() => void importIntoDirectory(pack.key, pack.source)}
                >
                  {running === operation ? <Loader2 className="animate-spin" /> : <Download />}
                  Importer
                </Button>
              </article>
            );
          })}
        </div>
        {!canImportContacts && (
          <p className="mt-3 text-[12px] text-faint">Votre rôle est en lecture seule.</p>
        )}
      </section>
    </div>
  );
}


// ── Demandes de compte et mode d'inscription ─────────────────────────────────

