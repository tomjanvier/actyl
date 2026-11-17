"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Bug, CheckCircle2, Lightbulb, LoaderCircle, MessageCircleQuestion, MessageSquarePlus } from "lucide-react";
import { submitFeedbackReport } from "@/app/actions/feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";

type Category = "BUG" | "QUESTION" | "IDEA" | "OTHER";
type Result = { reference: string };

const categories: Array<{ value: Category; label: string; icon: typeof Bug }> = [
  { value: "BUG", label: "Signaler un bug", icon: Bug },
  { value: "QUESTION", label: "Poser une question", icon: MessageCircleQuestion },
  { value: "IDEA", label: "Proposer une amélioration", icon: Lightbulb },
  { value: "OTHER", label: "Autre sujet", icon: MessageSquarePlus },
];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("BUG");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const pathname = window.location.pathname;
    data.set("pagePath", pathname.split("/").map((segment) => segment.length > 24 ? ":id" : segment).join("/"));
    data.set("deviceInfo", JSON.stringify({
      userAgent: navigator.userAgent.slice(0, 500),
      platform: (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "inconnu",
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${window.screen.width}×${window.screen.height}`,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
    }));
    setError(null);
    startTransition(async () => {
      try {
        const response = await submitFeedbackReport(data);
        if (!response.ok) {
          setError(response.error ?? "Le signalement n’a pas pu être envoyé.");
          return;
        }
        setResult({
          reference: response.reference ?? "reçu",
        });
        form.reset();
        setCategory("BUG");
      } catch {
        setError("Un problème temporaire a empêché l’envoi. Réessaie dans un instant.");
      }
    });
  }

  function close(next: boolean) {
    if (!next && pending) return;
    setOpen(next);
    if (!next) {
      setError(null);
      setResult(null);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        className="fixed bottom-4 right-4 z-40 h-11 rounded-full px-4 shadow-lg shadow-black/15 sm:bottom-6 sm:right-6"
        aria-label="Signaler un problème ou envoyer un retour"
      >
        <MessageSquarePlus aria-hidden="true" />
        <span className="hidden sm:inline">Un souci ?</span>
      </Button>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-xl max-md:max-h-[calc(100dvh-1rem)] max-md:w-[calc(100%-1rem)] max-md:p-3 sm:p-5">
          {result ? (
            <div className="py-5 text-center">
              <CheckCircle2 className="mx-auto size-10 text-tone-success-fg" />
              <DialogHeader className="mt-3">
                <DialogTitle>Merci pour ton signalement</DialogTitle>
                <DialogDescription>Référence {result.reference}</DialogDescription>
              </DialogHeader>
              <p className="mx-auto mt-3 max-w-sm text-sm text-faint">Ton retour est enregistré. L’équipe va l’examiner et te recontactera si besoin.</p>
              <Button className="mt-5" onClick={() => close(false)}>Terminer</Button>
            </div>
          ) : (
            <>
              <DialogHeader className="mb-3 pr-7 sm:mb-4">
                <DialogTitle className="text-sm sm:text-[15px]">Comment pouvons-nous t’aider ?</DialogTitle>
                <DialogDescription className="text-xs sm:text-[13px]">Décris le souci sans mot de passe ni données personnelles de contacts.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-3 sm:space-y-4">
                <fieldset disabled={pending} className="space-y-3 disabled:opacity-80 sm:space-y-4">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
                  {categories.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCategory(value)}
                      aria-pressed={category === value}
                      className={`flex min-h-11 items-center gap-1.5 rounded-lg border px-2 text-left text-[11px] leading-tight transition-colors sm:min-h-14 sm:gap-2 sm:px-2.5 sm:text-xs ${category === value ? "border-accent bg-accent-soft text-fg" : "border-line bg-elev text-mut hover:bg-hoverstrong"}`}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <label className="block space-y-1 text-xs font-medium text-mut">
                  Titre
                  <Input name="title" required minLength={8} maxLength={140} placeholder="Ex. Le filtre par rôle ne répond plus" />
                </label>
                <label className="block space-y-1 text-xs font-medium text-mut">
                  {category === "BUG" ? "Que se passe-t-il ?" : "Ton message"}
                  <Textarea name="description" required minLength={category === "BUG" ? 30 : 20} maxLength={3000} rows={3} placeholder="Décris le contexte et ce que tu essayais de faire…" />
                </label>

                <input type="hidden" name="category" value={category} />
                <input type="hidden" name="pagePath" value="" />
                <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                  <label>Site web<input name="website" tabIndex={-1} autoComplete="off" /></label>
                </div>
                </fieldset>
                {error && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
                <div className="sticky bottom-0 z-10 flex flex-col-reverse items-stretch gap-2 border-t border-line bg-raised py-3 sm:static sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-3 sm:pb-0">
                  <p className="max-w-xs text-[10px] leading-relaxed text-faint sm:text-[11px]">La page et quelques informations techniques sont jointes au rapport pour aider au diagnostic.</p>
                  <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                    {pending && <LoaderCircle className="animate-spin" />}
                    {pending ? "Envoi…" : "Envoyer"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
