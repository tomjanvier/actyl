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

        {/* Demo directory */}
        <section id="annuaire" className="animate-fade-up pb-16">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-fg">
                Un annuaire des décideurs, en accès direct
              </h2>
              <p className="mt-1 text-[13px] text-mut">
                Recherchez et filtrez les contacts d’une liste publique, sans créer de compte.
              </p>
            </div>
          </div>
          <Suspense fallback={<div className="crm-surface rounded-xl p-6 text-sm text-mut" role="status">Chargement de l’annuaire public…</div>}>
            <LandingDemoTable />
          </Suspense>
        </section>

        {/* Features */}
        <section className="grid grid-cols-1 gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Users,
              title: "Annuaire des décideurs",
              desc: "Députés, sénateurs, eurodéputés, maires, patrons, presse : une base centralisée avec champs personnalisés, positions et scores d'influence.",
            },
            {
              icon: KanbanSquare,
              title: "Pipeline kanban",
              desc: "Glissez-déposez chaque cible de « À contacter » à « Officiellement gagné·e ». Chaque mouvement est horodaté dans l'historique.",
            },
            {
              icon: Megaphone,
              title: "Interpellation citoyenne",
              desc: "Une page publique par campagne : vos soutiens envoient en un clic des messages personnalisés aux décideurs cibles.",
            },
            {
              icon: ShieldCheck,
              title: "Rôles granulaires",
              desc: "Admins, responsables campagne, militant·e·s, observateur·rice·s — chacun voit et fait exactement ce qu'il faut.",
            },
            {
              icon: FileSignature,
              title: "Pétitions publiques",
              desc: "Une page de signature par campagne avec objectif, barre de progression et liste des derniers signataires.",
            },
            {
              icon: CalendarDays,
              title: "Événements & RSVP",
              desc: "Réunions publiques, porte-à-porte, formations : publiez, suivez les inscriptions et mobilisez vos équipes.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group ui-lift rounded-xl border border-line bg-card p-5"
            >
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-elev text-mut ring-1 ring-inset ring-line transition-colors group-hover:text-accent-text">
                <f.icon className="size-4.5" />
              </div>
              <h3 className="text-[14px] font-semibold text-fg">
                {f.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
                {f.desc}
              </p>
            </div>
          ))}
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
