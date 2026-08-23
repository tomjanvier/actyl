"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Actyl]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-inset ring-rose-500/20">
        <AlertTriangle className="size-6 text-rose-400" />
      </div>
      <h1 className="text-[18px] font-semibold text-fg">
        Une erreur est survenue
      </h1>
      <p className="max-w-md text-[13px] leading-relaxed text-mut">
        {error.digest ? `Référence : ${error.digest}. ` : ""}
        Vous pouvez réessayer — vos données sont enregistrées en continu.
      </p>
      <button
        onClick={reset}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-indigo-500"
      >
        <RotateCcw className="size-4" />
        Réessayer
      </button>
    </div>
  );
}
