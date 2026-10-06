"use client";

import { useMemo, useState } from "react";
import { Send, CheckCircle2, Loader2, Mail, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { citizenSendAction } from "@/app/actions/emails";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { TurnstileWidget } from "@/components/security/turnstile-widget";

export function CitizenForm({
  campaignSlug,
  workspaceSlug,
  campaignName,
  defaultSubject,
  defaultBody,
  regions = [],
}: {
  campaignSlug: string;
  workspaceSlug: string;
  campaignName: string;
  defaultSubject: string;
  defaultBody: string;
  /** Territoires distincts des cibles, utilisés pour rapprocher les régions. */
  regions?: string[];
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [personalized, setPersonalized] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ count: number; simulated: boolean; failedCount: number } | null>(null);

  const previewName = name.trim() || "votre nom";
  const previewCity = city.trim() || "votre ville";

  const rendered = useMemo(() => {
    const values: Record<string, string> = {
      decision_maker_name: "[nom du destinataire]",
      decision_maker_first_name: "[prénom du destinataire]",
      decision_maker_last_name: "[nom du destinataire]",
      decision_maker_title: "[fonction du destinataire]",
      institution: "[institution du destinataire]",
      campaign_name: campaignName,
      constituent_name: previewName,
      constituent_city: previewCity,
    };
    const render = (value: string) => value.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => values[key] ?? match);
    return { subject: render(subject), body: render(body) };
  }, [subject, body, campaignName, previewName, previewCity]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    const token = new FormData(e.currentTarget).get("cf-turnstile-response")?.toString();
    try {
    const res = await citizenSendAction({
      campaignSlug,
      workspaceSlug,
      name,
      city,
      region: region || undefined,
      email,
      subjectOverride: personalized ? subject : undefined,
      bodyOverride: personalized ? body : undefined,
      turnstileToken: token,
    });
    if ("ok" in res && res.ok) {
      setDone({ count: res.recipientCount, simulated: res.simulated, failedCount: res.failedCount });
    } else if ("error" in res) {
      toast.error(res.error);
    }
    } catch {
      toast.error("Envoi impossible pour le moment. Réessayez dans un instant.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <section role="status" className="mt-10 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-8 text-center animate-fade-up">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-700 dark:text-emerald-400" />
        <h2 className="text-[18px] font-semibold text-fg">
          {done.simulated ? "Simulation terminée" : `Merci ${name.trim().split(" ")[0]}, votre message est parti !`}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-faint">
          {done.simulated ? "Aucun e-mail réel n’a été envoyé." : done.count > 1 ? (
            <>
              Il a été transmis aux <strong className="text-mut">{done.count} décideurs</strong>{" "}
              ciblés par la campagne.
            </>
          ) : (
            <>Il a été transmis au décideur ciblé.</>
          )}
          {done.failedCount > 0 && <span className="mt-2 block">{done.failedCount} destinataire(s) n’ont pas pu être joints.</span>}
          {done.simulated && (
            <span className="mt-1 block text-[12px] text-faint">
              (mode démo : aucun email réel n&apos;a été envoyé)
            </span>
          )}
        </p>
        <p className="mt-4 text-[12.5px] text-faint">
          Partagez cette page autour de vous pour amplifier l&apos;impact :
        </p>
        <div className="mt-3 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Input
            aria-label="Lien de la campagne"
            readOnly
            value={typeof window !== "undefined" ? window.location.href : ""}
            className="w-full min-w-0 text-center sm:w-72"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Lien copié !");
              } catch {
                toast.error("Copie impossible. Copiez le lien affiché.");
              }
            }}
          >
            Copier
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form id="interpeller" onSubmit={submit} aria-busy={sending} className="mt-10 scroll-mt-6">
      <h2 className="mb-4 flex items-center gap-2 text-center text-[15px] font-semibold text-fg">
        <Mail className="size-4 text-accent-text" />
        Ajoutez votre voix en une minute
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          aria-label="Votre nom"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Votre nom *"
          required
          minLength={2}
          maxLength={80}
          className={fieldCls}
        />
        <input
          aria-label="Votre ville"
          autoComplete="address-level2"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Votre ville *"
          required
          maxLength={80}
          className={fieldCls}
        />
        <input
          aria-label="Votre région"
          autoComplete="address-level1"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="Votre région (ex : Bretagne)"
          maxLength={80}
          list="campaign-regions"
          className={fieldCls}
        />
        <datalist id="campaign-regions">
          {regions.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <input
          aria-label="Votre adresse e-mail"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre adresse e-mail *"
          type="email"
          required
          className={fieldCls}
        />
      </div>
      {regions.length > 0 && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
          💡 Renseignez votre région : votre message sera prioritairement envoyé
          aux décideurs de votre territoire.
        </p>
      )}

      {/* Message editor */}
      {!personalized ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-raised">
          <div className="border-b border-line bg-hover px-4 py-2.5">
            <span className="text-[10.5px] uppercase tracking-wider text-faint">Aperçu</span>
            <p className="truncate text-[13px] font-medium text-fg">{rendered.subject}</p>
          </div>
          <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 font-sans text-[13px] leading-relaxed text-mut">
            {rendered.body}
          </pre>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="citizen-subject" className="mb-1 block text-[11px] font-medium text-faint">Objet</label>
            <input id="citizen-subject" maxLength={200} required value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="citizen-body" className="mb-1 block text-[11px] font-medium text-faint">Message</label>
            <Textarea id="citizen-body" maxLength={8000} required value={body} onChange={(e) => setBody(e.target.value)} rows={9} />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setPersonalized((p) => !p)}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[12.5px] text-accent-text transition-colors hover:text-accent-text"
      >
        <PencilLine className="size-3.5" />
        {personalized ? "Revenir au message type" : "Personnaliser le message"}
      </button>

      <TurnstileWidget />

      <Button
        type="submit"
        size="lg"
        disabled={sending || !name || !city || !email}
        className="mt-5 w-full whitespace-normal text-center"
      >
        {sending ? (
          <>
            <Loader2 className="animate-spin" /> Envoi en cours…
          </>
        ) : (
          <>
            <Send /> Envoyer mon message aux décideurs
          </>
        )}
      </Button>
      <p className="mt-3 text-center text-[11.5px] leading-relaxed text-faint">
        En envoyant, vous acceptez que votre nom et votre ville soient joints au
        message. Aucune donnée n&apos;est revendue ni utilisée à des fins commerciales.
      </p>
    </form>
  );
}

const fieldCls =
  "h-11 w-full min-w-0 rounded-lg border border-line bg-elev px-3 text-base text-fg sm:text-[13px] outline-none transition-colors placeholder:text-faint focus:border-accent focus:bg-elev";
