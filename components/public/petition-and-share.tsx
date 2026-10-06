"use client";

import { useState } from "react";
import { toast } from "sonner";
import { citizenSignAction } from "@/app/actions/mobilization";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Share, Link2, Mail, MessageCircle } from "lucide-react";

export function PetitionSignForm({
  campaignSlug,
  workspaceSlug,
  signatureCount,
  canInterpellate = true,
}: {
  campaignSlug: string;
  workspaceSlug: string;
  signatureCount: number;
  canInterpellate?: boolean;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [signed, setSigned] = useState<number | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    const token = new FormData(e.currentTarget).get("cf-turnstile-response")?.toString();
    try {
      const res = await citizenSignAction({ campaignSlug, workspaceSlug, name, email, city, turnstileToken: token });
      if ("ok" in res && res.ok) {
        setSigned(res.count);
        toast.success("Signature enregistrée. Merci !");
      } else if ("error" in res) toast.error(res.error);
    } catch {
      toast.error("Signature impossible pour le moment. Réessayez dans un instant.");
    } finally {
      setSending(false);
    }
  }

  if (signed !== null) {
    return (
      <div role="status" className="mt-5 flex flex-col items-center gap-3">
        <p className="w-full rounded-xl bg-emerald-500/10 px-4 py-3 text-center text-[13px] text-emerald-800 dark:text-emerald-200 ring-1 ring-inset ring-emerald-500/20">
          ✅ Vous êtes le/la {signed}ᵉ signataire. Merci !
        </p>
        {/* ActionButton-style ladder: signature → email → share */}
        {canInterpellate && <a
          href="#interpeller"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-center text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <Mail className="size-4" />
          Écrivez aussi à vos décideurs
        </a>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} aria-busy={sending} className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-mut">
          <span>Votre nom *</span>
          <input name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} className={fCls} />
        </label>
        <label className="space-y-1 text-sm text-mut">
          <span>Ville</span>
          <input name="city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className={fCls} />
        </label>
        <label className="space-y-1 text-sm text-mut sm:col-span-2">
          <span>Adresse e-mail *</span>
          <input name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required maxLength={200} className={fCls} />
        </label>
      </div>
      <TurnstileWidget />
      <Button type="submit" disabled={sending || !name.trim() || !email.trim()} className="w-full sm:w-auto">
        {sending ? "Signature en cours…" : "Je signe"}
      </Button>
      <span className="sr-only">{signatureCount} signatures enregistrées</span>
    </form>
  );
}

export function ShareSection({ title }: { title: string }) {

  function share(network: "x" | "fb" | "wa" | "mailto") {
    const text = encodeURIComponent(
      `Agissez avec moi : ${title}`,
    );
    const u = encodeURIComponent(window.location.href);
    const links: Record<string, string> = {
      x: `https://twitter.com/intent/tweet?text=${text}&url=${u}`,
      fb: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      wa: `https://wa.me/?text=${text}%20${u}`,
      mailto: `mailto:?subject=${encodeURIComponent(title)}&body=${text}%20→%20${u}`,
    };
    window.open(links[network], "_blank", "noopener,noreferrer,width=640,height=480");
  }

  return (
    <section className="mt-10 rounded-2xl crm-surface p-6 text-center">
      <Share className="mx-auto mb-2 size-5 text-accent-text" />
      <h2 className="text-[15px] font-semibold text-fg">
        Faites circuler — c&apos;est là que tout se joue
      </h2>
      <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-mut">
        Une campagne n&apos;a d&apos;impact que par son nombre de soutiens.
        Envoyez cette page à vos proches en 10 secondes.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button onClick={() => share("x")} className={shareBtn}>𝕏 Partager</button>
        <button onClick={() => share("fb")} className={shareBtn}><span className="font-bold">f</span> Facebook</button>
        <button onClick={() => share("wa")} className={shareBtn}><MessageCircle className="size-3.5" /> WhatsApp</button>
        <button onClick={() => share("mailto")} className={shareBtn}><Mail className="size-3.5" /> Email</button>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              toast.success("Lien copié !");
            } catch {
              toast.error("Copie impossible. Copiez l’adresse de la page depuis votre navigateur.");
            }
          }}
          className={shareBtn}
        >
          <Link2 className="size-3.5" /> Copier le lien
        </button>
      </div>
    </section>
  );
}

const fCls =
  "h-11 w-full min-w-0 rounded-lg border border-line bg-elev px-3 text-base text-fg sm:text-[13px] outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent-ring sm:flex-1";

const shareBtn =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-elev px-3.5 text-[12.5px] font-medium text-mut transition-colors hover:border-accent-ring hover:text-accent-text";
