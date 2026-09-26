"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, Plug, Copy, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn, timeAgo } from "@/lib/utils";
import {
  setSignupModeAction,
  approveAccountRequestAction,
  rejectAccountRequestAction,
  setNewsletterModuleAction,
  saveNewsletterSettingsAction,
  fetchNewsletterListsAction,
} from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";

export function AccountRequestsSection({
  isAdmin,
  signupMode,
  pending,
  onChanged,
}: {
  isAdmin: boolean;
  signupMode: "OPEN" | "APPROVAL";
  pending: Array<{
    id: string;
    name: string;
    email: string;
    orgName: string;
    website: string | null;
    phone: string | null;
    createdAt: string;
  }>;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState(signupMode);

  async function changeMode(next: "OPEN" | "APPROVAL") {
    setMode(next);
    await setSignupModeAction(next);
    toast.success(
      next === "OPEN"
        ? "Inscriptions ouvertes : création de compte immédiate."
        : "Inscriptions modérées : les demandes doivent être approuvées.",
    );
    onChanged();
  }

  return (
    <section className="mb-5 rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-fg">Accès à la plateforme</h3>
          <p className="mt-0.5 text-[12px] text-mut">
            Contrôlez qui peut créer un espace de travail.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 rounded-lg bg-elev p-1 ring-1 ring-inset ring-line">
            <button
              onClick={() => void changeMode("OPEN")}
              className={cn(
                "rounded-md px-3 py-1 text-[12px] font-medium transition-colors",
                mode === "OPEN" ? "bg-hoverstrong text-fg" : "text-mut hover:text-fg",
              )}
            >
              Ouvert
            </button>
            <button
              onClick={() => void changeMode("APPROVAL")}
              className={cn(
                "rounded-md px-3 py-1 text-[12px] font-medium transition-colors",
                mode === "APPROVAL" ? "bg-hoverstrong text-fg" : "text-mut hover:text-fg",
              )}
            >
              Sur demande
            </button>
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2 border-t border-linesoft pt-3">
          <li className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Demandes en attente ({pending.length})
          </li>
          {pending.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-linesoft bg-hover px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">
                  {r.orgName} — {r.name}
                </p>
                <p className="truncate text-[11.5px] text-mut">
                  {r.email}
                  {r.website ? ` · ${r.website}` : ""}
                  {r.phone ? ` · ${r.phone}` : ""}
                </p>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void approveAccountRequestAction(r.id)
                        .then(() => {
                          toast.success(`Compte créé pour ${r.orgName}`);
                          onChanged();
                        })
                        .catch((e: Error) => toast.error(e.message))
                    }
                  >
                    Approuver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void rejectAccountRequestAction(r.id).then(onChanged)
                    }
                  >
                    Refuser
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Tokens API ───────────────────────────────────────────────────────────────

export function ApiTokensCard({
  tokens,
  isAdmin,
  onChanged,
}: {
  tokens: Array<{
    id: string;
    name: string;
    prefix: string;
    revoked: boolean;
    lastUsedAt: string | null;
    createdAt: string;
  }>;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const { createApiTokenAction } = await import("@/app/actions/settings");
    const res = await createApiTokenAction({ name });
    setBusy(false);
    if ("ok" in res && res.ok && res.plaintext) {
      setFreshToken(res.plaintext);
      setName("");
      onChanged();
    } else if ("error" in res && res.error) {
      toast.error(res.error);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Révoquer ce token ? Les intégrations qui l'utilisent cesseront de fonctionner.")) return;
    const { revokeApiTokenAction } = await import("@/app/actions/settings");
    await revokeApiTokenAction(id);
    toast.success("Token révoqué");
    onChanged();
  }

  return (
    <div className="rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h3 className="text-[13.5px] font-semibold text-fg">Tokens API</h3>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 border-b border-line bg-elev/40 px-4 py-2.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du token"
            maxLength={60}
          />
          <Button size="sm" disabled={busy || name.trim().length < 2} onClick={() => void create()}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />} Créer
          </Button>
        </div>
      )}

      {freshToken && (
        <div className="border-b border-line bg-coral-500/[0.06] px-4 py-3">
          <p className="mb-1.5 text-[12px] font-medium text-coral-700 dark:text-coral-300">
            Copiez ce token maintenant — il ne sera plus jamais affiché :
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-elev px-2.5 py-1.5 font-mono text-[12px] text-fg ring-1 ring-inset ring-line">
              {freshToken}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(freshToken);
                toast.success("Token copié !");
              }}
            >
              <Copy /> Copier
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setFreshToken(null)}>
              OK
            </Button>
          </div>
        </div>
      )}

      <ul>
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center gap-3 border-b border-linesoft px-4 py-2.5 last:border-0">
            <Plug className={cn("size-4 shrink-0", t.revoked ? "text-faint line-through" : "text-coral-700 dark:text-coral-400")} />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[13px] font-medium text-fg", t.revoked && "line-through opacity-50")}>
                {t.name}
              </p>
              <p className="truncate font-mono text-[11px] text-faint">{t.prefix}…</p>
            </div>
            <span className="hidden w-32 shrink-0 text-right text-[11px] text-faint sm:block">
              {t.revoked
                ? "révoqué"
                : t.lastUsedAt
                  ? `utilisé ${timeAgo(t.lastUsedAt)}`
                  : "jamais utilisé"}
            </span>
            {!t.revoked && isAdmin && (
              <button
                onClick={() => void revoke(t.id)}
                title="Révoquer"
                className="shrink-0 rounded-md p-1 text-faint transition-colors hover:bg-rose-500/10 hover:text-rose-600"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
        {tokens.length === 0 && (
          <li className="px-4 py-8 text-center text-[12.5px] text-faint">
            Aucun token pour l&apos;instant.
          </li>
        )}
      </ul>
    </div>
  );
}

// ── Clients OIDC ────────────────────────────────────────────────────────────

export function OidcClientsCard({
  clients,
  onChanged,
}: {
  clients: Array<{
    id: string;
    clientId: string;
    name: string;
    redirectUris: string[];
    revokedAt: string | null;
    createdAt: string;
    tokenCount: number;
  }>;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function setRevoked(clientId: string, revoked: boolean) {
    const action = revoked ? "révoquer" : "réactiver";
    if (!confirm(`Voulez-vous ${action} ce client OIDC ?`)) return;
    setBusy(clientId);
    const response = await fetch("/api/admin/oidc/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, revoked }),
    }).catch(() => null);
    setBusy(null);
    if (!response?.ok) {
      toast.error("La modification du client OIDC a échoué.");
      return;
    }
    toast.success(revoked ? "Client OIDC révoqué" : "Client OIDC réactivé");
    onChanged();
  }

  return (
    <div className="rounded-xl border border-line bg-card">
      <div className="border-b border-line px-4 py-3">
        <h3 className="text-[13.5px] font-semibold text-fg">Clients « Se connecter avec Act »</h3>
        <p className="mt-1 text-[11.5px] text-faint">
          Révoquer un client invalide également tous ses jetons d&apos;accès existants.
        </p>
      </div>
      <ul>
        {clients.map((client) => {
          const revoked = !!client.revokedAt;
          return (
            <li key={client.id} className="border-b border-linesoft px-4 py-3 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("text-[13px] font-medium text-fg", revoked && "line-through opacity-60")}>
                    {client.name}
                  </p>
                  <p className="truncate font-mono text-[11px] text-faint">{client.clientId}</p>
                </div>
                <Button
                  variant={revoked ? "outline" : "ghost"}
                  size="sm"
                  disabled={busy === client.id}
                  onClick={() => void setRevoked(client.id, !revoked)}
                >
                  {busy === client.id ? <Loader2 className="animate-spin" /> : null}
                  {revoked ? "Réactiver" : "Révoquer"}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-faint">
                {client.redirectUris.join(" · ")} · {client.tokenCount} jeton(s) · créé {timeAgo(client.createdAt)}
                {client.revokedAt ? ` · révoqué ${timeAgo(client.revokedAt)}` : ""}
              </p>
            </li>
          );
        })}
        {clients.length === 0 && (
          <li className="px-4 py-8 text-center text-[12.5px] text-faint">
            Aucun client OIDC enregistré.
          </li>
        )}
      </ul>
    </div>
  );
}

// ── Module newsletter EmailOctopus ───────────────────────────────────────────

export function NewsletterCard({
  enabled,
  apiKeyMasked,
  listId,
  isAdmin,
  onChanged,
}: {
  enabled: boolean;
  apiKeyMasked: string | null;
  listId: string;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [selectedListId, setSelectedListId] = useState(listId);
  const [lists, setLists] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (busy || !isAdmin) return;
    if (!enabled && (!apiKeyMasked || !listId)) {
      toast.error("Renseignez d'abord la clé API et la liste, puis enregistrez.");
      return;
    }
    setBusy(true);
    await setNewsletterModuleAction(!enabled);
    setBusy(false);
    toast.success(enabled ? "Module newsletter désactivé" : "Module newsletter activé");
    onChanged();
  }

  async function loadLists() {
    if (loadingLists) return;
    setLoadingLists(true);
    const res = await fetchNewsletterListsAction({ apiKey });
    setLoadingLists(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    if (res.lists) {
      setLists(res.lists);
      if (res.lists.length === 0) toast.info("Aucune liste sur ce compte EmailOctopus.");
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    const res = await saveNewsletterSettingsAction({
      apiKey: apiKey || undefined,
      listId: selectedListId || undefined,
    });
    setSaving(false);
    if ("ok" in res && res.ok) {
      toast.success(
        res.listName
          ? `Connexion enregistrée — liste « ${res.listName} »`
          : "Connexion EmailOctopus enregistrée",
      );
      setApiKey("");
      onChanged();
    } else if ("error" in res && res.error) {
      toast.error(res.error);
    }
  }

  return (
    <div className={cn(
      "max-w-3xl rounded-xl border bg-card transition-colors",
      enabled ? "border-coral-500/40 ring-1 ring-inset ring-coral-500/20" : "border-line",
    )}>
      <div className="flex items-start justify-between gap-4 border-b border-line p-5">
        <div className="max-w-xl">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <Mail className="size-4.5 text-sky-600 dark:text-sky-400" />
            Module newsletter — EmailOctopus
            {enabled && (
              <span className="rounded-md bg-coral-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-coral-700 ring-1 ring-inset ring-coral-500/20 dark:text-coral-300">
                Actif
              </span>
            )}
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mut">
            Suivez l&apos;inscription à la newsletter directement sur les fiches
            contacts et inscrivez plusieurs contacts en un clic depuis le
            répertoire. La synchronisation utilise l&apos;API v2 d&apos;EmailOctopus.
          </p>
        </div>
        {/* Interrupteur principal. */}
        <button
          role="switch"
          aria-checked={enabled}
          disabled={!isAdmin || busy}
          onClick={() => void toggle()}
          title={
            !apiKeyMasked
              ? "Enregistrez d'abord la clé API et la liste"
              : undefined
          }
          className={cn(
            "relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
            enabled ? "bg-coral-600" : "bg-elev ring-1 ring-inset ring-line",
          )}
        >
          <span
            className={cn(
              "absolute top-1 size-5 rounded-full bg-white shadow transition-all",
              enabled ? "left-6" : "left-1",
            )}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_240px]">
        <div>
          <Label className="mb-1 block">Clé API EmailOctopus</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={apiKeyMasked ? `Clé enregistrée (${apiKeyMasked}) — laisser vide pour conserver` : "eo_…"}
            autoComplete="off"
          />
          <p className="mt-1 text-[11px] text-faint">
            Créez-la sur emailoctopus.com → Account → Developer → API keys (API v2).
          </p>
        </div>
        <div>
          <Label className="mb-1 block">Liste de diffusion</Label>
          <select
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="h-9 w-full rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-fg outline-none [&>option]:bg-raised"
          >
            <option value="">{lists.length ? "Choisir une liste…" : "— charger les listes —"}</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
        <Button variant="outline" size="sm" disabled={!isAdmin || loadingLists} onClick={() => void loadLists()}>
          {loadingLists ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Charger les listes
        </Button>
        <Button size="sm" disabled={!isAdmin || saving || !apiKey.trim() && !!apiKeyMasked && !selectedListId} onClick={() => void save()}>
          {saving ? <Loader2 className="animate-spin" /> : <Plug />}
          Tester & enregistrer
        </Button>
        <span className="ml-auto text-[11px] text-faint">
          Le test valide la clé et la liste avant enregistrement.
        </span>
      </div>

      {!isAdmin && (
        <p className="border-t border-line px-5 py-3 text-[12px] text-faint">
          Seuls les administrateurs peuvent modifier cette intégration.
        </p>
      )}
    </div>
  );
}
