"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ArrowRight, Loader2 } from "lucide-react";
import { enterAdminWorkspaceAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/filter-bar";
import { AccountRequestsSection } from "./settings-access";
import { CreateWorkspaceForm, LandingSettingsForm } from "./settings-forms";
import type { LandingSettings } from "@/lib/landing-settings";
import { toast } from "sonner";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberships: Array<{
    user: { id: string; name: string; email: string };
    role: string;
  }>;
  _count: { contacts: number; campaigns: number; lists: number };
};
type Pending = {
  id: string;
  name: string;
  email: string;
  orgName: string;
  website: string | null;
  phone: string | null;
  monthlyContributionInterest: string | null;
  monthlyContributionAmount: number | null;
  createdAt: string;
};
export function AdminView({
  workspaces,
  pending,
  pendingProposals,
  signupMode,
  landingSettings,
  currentWorkspaceId,
}: {
  workspaces: Workspace[];
  pending: Pending[];
  pendingProposals: number;
  signupMode: "OPEN" | "APPROVAL";
  landingSettings: LandingSettings;
  currentWorkspaceId: string;
}) {
  const [query, setQuery] = useState("");
  const [entering, setEntering] = useState<string | null>(null);
  const router = useRouter();
  const members = new Set(
    workspaces.flatMap((w) => w.memberships.map((m) => m.user.id)),
  ).size;
  async function enter(id: string) {
    setEntering(id);
    const data = new FormData();
    data.set("workspaceId", id);
    try {
      await enterAdminWorkspaceAction(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Accès impossible");
    } finally {
      setEntering(null);
    }
  }
  return (
    <div className="animate-fade-up space-y-8 px-4 pb-12 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Espaces", workspaces.length],
          ["Utilisateurs", members],
          ["Demandes d’accès", pending.length],
          ["Propositions à valider", pendingProposals],
        ].map(([label, count]) => (
          <div key={label} className="crm-surface rounded-xl p-4">
            <p className="text-xs text-mut">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-fg">
              {count}
            </p>
          </div>
        ))}
      </div>
      {pendingProposals > 0 && (
        <p className="text-sm text-mut">
          {pendingProposals} propositions de mise à jour des référentiels
          attendent une décision.{" "}
          <Link
            href="/lists"
            className="text-accent-text underline underline-offset-4"
          >
            Examiner les propositions
          </Link>
        </p>
      )}
      <nav
        aria-label="Sections d’administration"
        className="flex flex-wrap gap-2 text-sm text-accent-text"
      >
        <a
          className="rounded-lg border border-line px-3 py-2 hover:bg-hover"
          href="#espaces"
        >
          Espaces
        </a>
        <a
          className="rounded-lg border border-line px-3 py-2 hover:bg-hover"
          href="#acces"
        >
          Demandes d’accès
        </a>
        <a
          className="rounded-lg border border-line px-3 py-2 hover:bg-hover"
          href="#page-publique"
        >
          Page publique
        </a>
        <Button asChild variant="outline">
          <Link href="/settings?tab=import">Référentiels</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings?tab=api">Intégrations</Link>
        </Button>
      </nav>
      <section
        id="espaces"
        className="grid items-start gap-6 xl:grid-cols-[1fr_340px]"
      >
        <div className="crm-surface min-w-0 overflow-hidden rounded-xl">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
            <h2 className="font-semibold text-fg">Espaces de travail</h2>
            <SearchField
              value={query}
              onValueChange={setQuery}
              placeholder="Rechercher un espace…"
            />
          </header>
          {workspaces
            .filter((w) =>
              `${w.name} ${w.slug} ${w.memberships.map((m) => m.user.email).join(" ")}`
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase()),
            )
            .map((w) => (
              <article
                key={w.id}
                className="border-b border-linesoft p-4 last:border-0"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Building2 className="size-5 text-faint" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-fg">{w.name}</h3>
                    <p className="text-xs text-mut">
                      {w.slug}
                      {w.id === currentWorkspaceId ? " · espace actuel" : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={entering !== null}
                    onClick={() => void enter(w.id)}
                  >
                    {entering === w.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <ArrowRight />
                    )}
                    Administrer
                  </Button>
                </div>
                <p className="mt-3 text-xs text-mut">
                  {w.memberships.length} membre
                  {w.memberships.length > 1 ? "s" : ""} · {w._count.contacts}{" "}
                  contacts · {w._count.campaigns} campagnes · {w._count.lists}{" "}
                  listes
                </p>
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer py-2 text-mut">
                    Voir les membres et les rôles
                  </summary>
                  <ul className="space-y-2 py-2">
                    {w.memberships.map((m) => (
                      <li
                        key={m.user.id}
                        className="flex flex-wrap justify-between gap-2 text-mut"
                      >
                        <span>
                          {m.user.name} · {m.user.email}
                        </span>
                        <span className="font-medium text-fg">{m.role}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          {!workspaces.some((w) =>
            `${w.name} ${w.slug} ${w.memberships.map((m) => m.user.email).join(" ")}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase()),
          ) && (
            <p className="p-6 text-sm text-mut">
              Aucun espace ne correspond à la recherche.
            </p>
          )}
        </div>
        <CreateWorkspaceForm onCreated={() => router.refresh()} />
      </section>
      <section id="acces">
        <AccountRequestsSection
          isAdmin
          signupMode={signupMode}
          pending={pending}
          onChanged={() => router.refresh()}
        />
      </section>
      <section id="page-publique">
        <LandingSettingsForm settings={landingSettings} />
      </section>
    </div>
  );
}
