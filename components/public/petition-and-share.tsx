"use client";

import { useState } from "react";
import { toast } from "sonner";
import { citizenSignAction } from "@/app/actions/mobilization";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Share, Link2, Mail, MessageCircle } from "lucide-react";

export function PetitionSignForm({
  campaignSlug,
  signatureCount,
}: {
  campaignSlug: string;
  signatureCount: number;
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
    const res = await citizenSignAction({ campaignSlug, name, email, city, turnstileToken: token });
    setSending(false);
    if ("ok" in res && res.ok) {
      setSigned(res.count);
      toast.success("Signature enregistrée. Merci !");
    } else if ("error" in res) toast.error(res.error);
  }

  if (signed !== null) {
    return (
      <div className="mt-5 flex flex-col items-center gap-3">
        <p className="w-full rounded-xl bg-emerald-500/10 px-4 py-3 text-center text-[13px] text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
          ✅ Vous êtes le/la {signed}ᵉ signataire. Merci !
        </p>
        {/* ActionButton-style ladder: signature → email → share */}
        <a
          href="#interpeller"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          <Mail className="size-4" />
          Franchisez le pas : écrivez aussi à vos décideurs
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5 sm:flex-row">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom *" required minLength={2} className={fCls} />
      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville" className={fCls} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" type="email" required className={fCls} />
      <TurnstileWidget />
      <Button type="submit" disabled={sending || !name || !email} className="shrink-0">
        {sending ? "…" : "Je signe"}
      </Button>
      <span className="sr-only">{signatureCount}</span>
    </form>
  );
}

export function ShareSection({ title }: { title: string }) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  function share(network: "x" | "fb" | "wa" | "mailto") {
    const text = encodeURIComponent(
      `Agissez avec moi : ${title}`,
    );
    const u = encodeURIComponent(url);
    const links: Record<string, string> = {
      x: `https://twitter.com/intent/tweet?text=${text}&url=${u}`,
      fb: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      wa: `https://wa.me/?text=${text}%20${u}`,
      mailto: `mailto:?subject=${encodeURIComponent(title)}&body=${text}%20→%20${u}`,
    };
    window.open(links[network], "_blank", "width=640,height=480");
  }

  return (
    <section className="mt-10 rounded-2xl border border-white/[0.07] bg-card p-6 text-center">
      <Share className="mx-auto mb-2 size-5 text-indigo-400" />
      <h2 className="text-[15px] font-semibold text-zinc-50">
        Faites circuler — c&apos;est là que tout se joue
      </h2>
      <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-zinc-500">
        Une campagne n&apos;a d&apos;impact que par son nombre de soutiens.
        Envoyez cette page à vos proches en 10 secondes.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button onClick={() => share("x")} className={shareBtn}>𝕏 Partager</button>
        <button onClick={() => share("fb")} className={shareBtn}><span className="font-bold">f</span> Facebook</button>
        <button onClick={() => share("wa")} className={shareBtn}><MessageCircle className="size-3.5" /> WhatsApp</button>
        <button onClick={() => share("mailto")} className={shareBtn}><Mail className="size-3.5" /> Email</button>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(url);
            toast.success("Lien copié !");
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
  "h-10 w-full rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 text-[13px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-500/60 sm:flex-1";

const shareBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3.5 text-[12.5px] font-medium text-zinc-300 transition-colors hover:border-indigo-500/40 hover:text-indigo-300";
