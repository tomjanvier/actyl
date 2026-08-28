"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { importCsvIntoListAction } from "@/app/actions/import";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Import CSV collé ou téléversé dans une seule liste partagée.
 * Les contacts existants sont rattachés sans être modifiés ni supprimés.
 */
export function ImportListDialog({
  listId,
  listName,
  open,
  onClose,
  onImported,
}: {
  listId: string;
  listName: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setCsv("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  async function readFile(file: File) {
    const text = await file.text();
    setCsv(text);
  }

  async function confirm() {
    if (busy || !csv.trim()) return;
    setBusy(true);
    const res = await importCsvIntoListAction({ listId, csv });
    setBusy(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if ("ok" in res && res.ok) {
      const bits = [
        res.created ? `${res.created} créé(s)` : null,
        res.linked ? `${res.linked} rattaché(s)` : null,
        res.already ? `${res.already} déjà présent(s)` : null,
        res.skipped ? `${res.skipped} ignoré(s)` : null,
      ].filter(Boolean);
      toast.success(`Import fusionné : ${bits.join(" · ") || "rien à faire"}`);
      onImported();
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importer dans « {listName} »</DialogTitle>
          <DialogDescription>
            Fusion sans écrasement : les contacts existants sont simplement
            rattachés à la liste — jamais modifiés ni supprimés.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-line bg-elev px-3 py-2 text-[12px] leading-relaxed text-mut">
          Colonnes reconnues (ordre libre) :{" "}
          <code className="text-[11px] text-fg">prénom ; nom ; email ; fonction ; institution ; parti ; région ; niveau ; note</code>
          . La première ligne doit être l&apos;en-tête.
        </div>

        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={"prénom;nom;parti;institution\nJordan;Bardella;Rassemblement national;Présidentielle 2027"}
          className="w-full resize-y rounded-lg border border-line bg-canvas px-2.5 py-2 font-mono text-[12px] text-fg outline-none focus:border-indigo-500/60"
        />

        <div className="flex items-center justify-between">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-faint hover:bg-hover hover:text-mut">
            <FileUp className="size-3.5" /> Choisir un fichier .csv…
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
              }}
            />
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button size="sm" disabled={!csv.trim() || busy} onClick={() => void confirm()}>
              {busy && <Loader2 className="animate-spin" />}
              {busy ? "Import…" : "Importer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
