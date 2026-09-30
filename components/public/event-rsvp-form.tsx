"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { rsvpEventAction } from "@/app/actions/mobilization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";

const responses = [
  { value: "YES", label: "Oui, je viens" },
  { value: "MAYBE", label: "Peut-être" },
  { value: "NO", label: "Je ne peux pas" },
] as const;

export function EventRsvpForm({ eventId, closed = false }: { eventId: string; closed?: boolean }) {
  const [response, setResponse] = useState<(typeof responses)[number]["value"]>("YES");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || closed) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const result = await rsvpEventAction({
        eventId,
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        response,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSubmitted(true);
      toast.success("Votre réponse a bien été enregistrée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi impossible. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-emerald-800 dark:text-emerald-200">
        <Check className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">Réponse enregistrée</p>
          <p className="mt-1 text-sm opacity-80">Merci, votre réponse a été transmise à l’équipe organisatrice.</p>
        </div>
      </div>
    );
  }

  if (closed) {
    return <p role="status" className="rounded-xl border border-line bg-elev px-4 py-3 text-sm text-mut">Les inscriptions à cet événement sont fermées.</p>;
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-fg">Votre réponse</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {responses.map((item) => (
            <label key={item.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm text-mut has-[:checked]:border-coral-500/60 has-[:checked]:bg-coral-500/[0.06] has-[:checked]:text-fg">
              <input
                type="radio"
                name="response"
                value={item.value}
                checked={response === item.value}
                onChange={() => setResponse(item.value)}
                className="accent-coral-600"
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="rsvp-name" className="mb-1 block">Nom</Label>
          <Input id="rsvp-name" name="name" autoComplete="name" minLength={2} maxLength={120} required />
        </div>
        <div>
          <Label htmlFor="rsvp-email" className="mb-1 block">Adresse e-mail</Label>
          <Input id="rsvp-email" name="email" type="email" autoComplete="email" maxLength={200} required />
        </div>
      </div>
      <p className="text-xs leading-relaxed text-faint">Votre adresse e-mail sert à gérer cette inscription et à vous recontacter au sujet de l’événement.</p>
      <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {pending ? "Envoi…" : "Confirmer ma réponse"}
      </Button>
    </form>
  );
}
