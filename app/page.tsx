import { Suspense } from "react";
import Link from "next/link";
import {
  KanbanSquare,
  Megaphone,
  Users,
  ShieldCheck,
  FileSignature,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActylLogo } from "@/components/layout/actyl-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

import { LandingDemoTable } from "@/components/public/landing-demo-table";
import { getLandingSettings } from "@/lib/landing-settings";

// Resolve the live public directory at request time, never freeze a build-time failure.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const settings = await getLandingSettings();
  const primaryButton = (
    <Button asChild size="lg" className="w-full sm:w-auto"><Link href={settings.primaryHref}>
      {settings.primaryCta}
      <ArrowRight />
    </Link></Button>
  );
  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav */}
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/" aria-label="Accueil Actyl">
          <ActylLogo className="h-9 w-[142px]" priority />
        </Link>
        <nav className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/sign-in">Connexion</Link></Button>
          <Button asChild size="sm"><Link href="/sign-up">S’inscrire<ArrowRight /></Link></Button>
        </nav>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-6">
        <section className="animate-fade-up flex flex-col items-center pb-16 pt-20 text-center sm:pt-28">
          <Badge className="mb-5 border-none bg-elev px-2.5 py-1 text-mut ring-line">
            Open source · MIT · Auto-hébergeable · by PLAID·ACT
          </Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-[52px]">
            {settings.heroTitle}{" "}
            <span className="text-accent-text">
              {settings.heroHighlight}
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-balance text-[15px] leading-relaxed text-faint">
            {settings.heroText}
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center">
            {primaryButton}
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto"><Link href="/sign-in">Se connecter</Link></Button>
          </div>
        </section>

        {/* Features */}
        <section className="grid grid-cols-1 gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {[Users, KanbanSquare, Megaphone, ShieldCheck, FileSignature, CalendarDays].map((Icon, i) => (
            <div
              key={i}
              className="group ui-lift rounded-xl border border-line bg-card p-5"
            >
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-elev text-mut ring-1 ring-inset ring-line transition-colors group-hover:text-accent-text">
                <Icon className="size-4.5" />
              </div>
              <h3 className="text-[14px] font-semibold text-fg">
                {settings[`feature${i + 1}Title` as keyof typeof settings]}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
                {settings[`feature${i + 1}Text` as keyof typeof settings]}
              </p>
            </div>
          ))}
        </section>

        {/* Demo directory */}
        <section id="annuaire" className="animate-fade-up pb-16">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-fg">
                {settings.directoryTitle}
              </h2>
              <p className="mt-1 text-[13px] text-mut">
                {settings.directoryText}
              </p>
            </div>
          </div>
          <Suspense fallback={<div className="crm-surface rounded-xl p-6 text-sm text-mut" role="status">Chargement de l’annuaire public…</div>}>
            <LandingDemoTable />
          </Suspense>
        </section>

        {/* Footer */}
        <footer className="flex flex-col items-center gap-2 border-t border-line py-10 text-center text-[12.5px] text-mut">
          <p>{settings.footerText}</p>
          <p>
            Actyl, tous droits réservés · CRM de plaidoyer développé par l’association{" "}
            <a href="https://plaidact.org" target="_blank" rel="noopener noreferrer" className="font-medium text-coral-800 underline-offset-4 hover:underline dark:text-coral-300">
              PLAID·ACT
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
