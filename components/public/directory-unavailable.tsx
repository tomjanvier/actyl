"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DirectoryUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="crm-surface flex flex-wrap items-center justify-between gap-4 rounded-xl p-6" role="status">
      <p className="text-sm text-mut">L’annuaire est temporairement indisponible. Vous pouvez relancer son chargement.</p>
      <Button variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        <RefreshCw className={pending ? "animate-spin" : ""} />
        {pending ? "Chargement…" : "Réessayer"}
      </Button>
    </div>
  );
}
