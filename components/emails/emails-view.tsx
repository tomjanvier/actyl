"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Send,
  Plus,
  Trash2,
  Inbox,
  Users,
  Eye,
  Globe,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn, fullName, formatDateTime, pct } from "@/lib/utils";
import {
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
  launchBlastAction,
} from "@/app/actions/emails";
import { EMAIL_VARIABLES } from "@/lib/constants";
import { StatCard } from "@/components/ui/primitives";
import { EntityAvatar } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/controls";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/controls";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
};
type Target = {
  cardId: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    title: string | null;
    institution: string | null;
    email: string | null;
    avatarColor: string;
  };
  stageName: string;
  emailsReceived: number;
  opens: number;
  uniqueCitizens: number;
};
type Blast = {
  id: string;
  subject: string;
  source: string;
  templateName: string;
  creatorName: string;
  emailCount: number;
  createdAt: string;
};

export function EmailsView({
  campaignId,
  campaignSlug,
  templates: initialTemplates,
  targets,
  unjoinableCount,
  blasts,
  stats,
  canSend,
  canManageTemplates,
}: {
  campaignId: string;
  campaignSlug: string;
  templates: Template[];
  targets: Target[];
  unjoinableCount: number;
  blasts: Blast[];
  stats: { sent: number; openRate: number; uniqueCitizens: number };
  canSend: boolean;
  canManageTemplates: boolean;
}) {
  const [tab, setTab] = useState("envoyer");
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <div className="flex min-h-[calc(100vh-137px)] flex-col">
      <div className="px-6 pt-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="envoyer"><Send /> Envoyer</TabsTrigger>
            <TabsTrigger value="modeles"><Mail /> Modèles ({initialTemplates.length})</TabsTrigger>
            <TabsTrigger value="outbox"><Inbox /> Outbox & impact</TabsTrigger>
          </TabsList>

          {/* ── Send ── */}
          <TabsContent value="envoyer" className="mt-5 outline-none">
            <SendTab
              campaignId={campaignId}
              campaignSlug={campaignSlug}
              templates={initialTemplates}
              targets={targets}
              unjoinableCount={unjoinableCount}
              canSend={canSend}
              onSent={() => startTransition(() => router.refresh())}
            />
          </TabsContent>

          {/* ── Templates ── */}
          <TabsContent value="modeles" className="mt-5 outline-none">
            <TemplatesTab
              campaignId={campaignId}
              templates={initialTemplates}
              canManage={canManageTemplates}
              onChanged={() => startTransition(() => router.refresh())}
            />
          </TabsContent>

          {/* ── Outbox / analytics ── */}
          <TabsContent value="outbox" className="mt-5 outline-none">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Emails délivrés" value={stats.sent} icon={<Send className="size-4" />} hint="toutes sources confondues" />
              <StatCard label="Taux d'ouverture" value={pct(stats.openRate, 100)} icon={<Eye className="size-4" />} hint={`${stats.openRate} % des messages ouverts`} />
              <StatCard label="Citoyens mobilisés" value={stats.uniqueCitizens} icon={<Users className="size-4" />} hint="expéditeurs uniques" />
            </div>

            <h3 className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wider text-faint">
              Envois récents
            </h3>
            <div className="overflow-hidden rounded-xl border border-line">
              {blasts.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-faint">
                  Aucun envoi pour l&apos;instant.
                </p>
              ) : (
                blasts.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-hover"
                  >
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ring-inset",
                        b.source === "PUBLIC_PAGE"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20"
                          : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/20",
                      )}
                    >
                      {b.source === "PUBLIC_PAGE" ? <Users className="size-3" /> : <Send className="size-3" />}
                      {b.source === "PUBLIC_PAGE" ? "Citoyens" : "Équipe"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-fg">{b.subject}</p>
                      <p className="text-[11px] text-faint">
                        {b.templateName} · {formatDateTime(b.createdAt)}
                        {b.creatorName !== "—" && ` · par ${b.creatorName}`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-elev px-2 py-1 text-[12px] tabular-nums text-mut">
                      {b.emailCount} message{b.emailCount > 1 ? "s" : ""}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Per-target responsiveness */}
            <h3 className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wider text-faint">
              Réceptivité des cibles
            </h3>
            <div className="overflow-hidden rounded-xl border border-line">
              {targets
                .slice()
                .sort((a, b) => b.emailsReceived - a.emailsReceived)
                .map((t) => (
                  <div
                    key={t.cardId}
                    className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-0"
                  >
                    <EntityAvatar name={fullName(t.contact)} color={t.contact.avatarColor} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] text-mut">{fullName(t.contact)}</p>
                      <p className="truncate text-[11px] text-faint">{t.stageName}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-right">
                      <Metric label="reçus" value={t.emailsReceived} />
                      <Metric label="citoyens" value={t.uniqueCitizens} />
                      <Metric
                        label="ouverts"
                        value={
                          t.emailsReceived ? `${Math.round((t.opens / t.emailsReceived) * 100)} %` : "—"
                        }
                      />
                    </div>
                  </div>
                ))}
              {targets.length === 0 && (
                <p className="px-4 py-8 text-center text-[13px] text-faint">
                  Ajoutez des cibles au pipeline kanban pour suivre leur réceptivité.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="w-16">
      <p className="text-[13px] font-semibold tabular-nums text-fg">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-faint">{label}</p>
    </div>
  );
}

// ── Send tab ─────────────────────────────────────────────────────────────────

function SendTab({
  campaignId,
  campaignSlug,
  templates,
  targets,
  unjoinableCount,
  canSend,
  onSent,
}: {
  campaignId: string;
  campaignSlug: string;
  templates: Template[];
  targets: Target[];
  unjoinableCount: number;
  canSend: boolean;
  onSent: () => void;
}) {
  const [selectedTpl, setSelectedTpl] = useState(templates[0]?.id ?? "");
  const [selectedTargets, setSelectedTargets] = useState<string[]>(
    targets.map((t) => t.contact.id),
  );
  const [sending, setSending] = useState(false);
  const preview = templates.find((t) => t.id === selectedTpl);

  async function launch() {
    if (!preview || !selectedTargets.length || !canSend) return;
    setSending(true);
    const res = await launchBlastAction({
      campaignId,
      templateId: selectedTpl,
      targetContactIds: selectedTargets,
    });
    setSending(false);
    if (res.ok) {
      toast.success(
        `Envoi terminé — ${res.sent ?? 0} message(s) délivré(s)` +
          (res.failed ? `, ${res.failed} échec(s)` : ""),
      );
      onSent();
    } else toast.error(res.error ?? "Erreur");
  }

  if (!templates.length) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
        <Mail className="mx-auto mb-2 size-7 text-faint" />
        <p className="text-[14px] font-medium text-fg">Aucun modèle</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-faint">
          Créez d&apos;abord un modèle d&apos;email dans l&apos;onglet « Modèles » pour lancer
          une interpellation.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* Config */}
      <div className="flex flex-col gap-4">
        <section className="rounded-xl border border-line bg-card p-4">
          <Label className="mb-1.5 block">Modèle d&apos;email</Label>
          <select
            value={selectedTpl}
            onChange={(e) => setSelectedTpl(e.target.value)}
            className="h-9 w-full rounded-lg border border-line bg-elev px-2.5 text-[12.5px] text-fg outline-none [&>option]:bg-raised"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.isDefault ? "★ " : ""}{t.name}
              </option>
            ))}
          </select>

          <div className="mt-4 flex items-baseline justify-between">
            <Label>Cibles avec email ({selectedTargets.length}/{targets.length})</Label>
            <button
              className="text-[11px] text-indigo-700 dark:text-indigo-400 hover:text-indigo-700 dark:text-indigo-300"
              onClick={() =>
                setSelectedTargets((s) =>
                  s.length === targets.length ? [] : targets.map((t) => t.contact.id),
                )
              }
            >
              {selectedTargets.length === targets.length ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
          </div>
          {unjoinableCount > 0 && (
            <p className="mt-1 text-[11px] text-faint">
              ⚠ {unjoinableCount} cible(s) sans email sont exclues automatiquement.
            </p>
          )}
        </section>

        {canSend && (
          <Button onClick={() => void launch()} disabled={sending || !selectedTargets.length}>
            {sending ? (
              <>
                <Loader2 className="animate-spin" /> Envoi en cours…
              </>
            ) : (
              <>
                <Send /> Lancer l&apos;interpellation ({selectedTargets.length})
              </>
            )}
          </Button>
        )}

        <a
          href={`/p/${campaignSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 transition-colors hover:border-emerald-500/30"
        >
          <Globe className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-fg">
              Page publique de mobilisation
            </p>
            <p className="truncate text-[11.5px] text-faint">
              /p/{campaignSlug} — vos soutiens envoient en 1 clic
            </p>
          </div>
          <ExternalLink className="size-4 shrink-0 text-faint group-hover:text-emerald-700 dark:text-emerald-400" />
        </a>
      </div>

      {/* Preview + target list */}
      <div className="flex min-w-0 flex-col gap-4">
        <section className="rounded-xl border border-line bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-faint">
              Aperçu du modèle
            </h3>
            <span className="text-[11px] text-faint">
              variables {"{{…}}"} remplacées à l&apos;envoi
            </span>
          </div>
          {preview && (
            <div className="overflow-hidden rounded-lg border border-line bg-raised">
              <div className="border-b border-line bg-hover px-4 py-2.5">
                <span className="text-[10.5px] uppercase tracking-wider text-faint">Objet</span>
                <p className="truncate text-[13px] font-medium text-fg">{preview.subject}</p>
              </div>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap px-4 py-3 font-sans text-[12.5px] leading-relaxed text-mut">
                {preview.body}
              </pre>
            </div>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-[11.5px] text-faint hover:text-mut">
              Variables disponibles
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {EMAIL_VARIABLES.map((v) => (
                <p key={v.key} className="text-[11px] text-faint">
                  <code className="text-indigo-700 dark:text-indigo-400/80">{v.key}</code> — {v.desc}
                </p>
              ))}
            </div>
          </details>
        </section>

        <section className="rounded-xl border border-line">
          <header className="flex h-10 items-center justify-between border-b border-line px-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-faint">
              Cibles joignables
            </h3>
          </header>
          <ul className="grid max-h-56 grid-cols-1 overflow-y-auto sm:grid-cols-2">
            {targets.map((t) => (
              <li key={t.cardId}>
                <label className="flex h-10 cursor-pointer items-center gap-2.5 border-b border-line px-3 hover:bg-hover">
                  <input
                    type="checkbox"
                    checked={selectedTargets.includes(t.contact.id)}
                    onChange={(e) =>
                      setSelectedTargets((s) =>
                        e.target.checked
                          ? [...s, t.contact.id]
                          : s.filter((id) => id !== t.contact.id),
                      )
                    }
                    className="size-3.5 accent-indigo-500"
                  />
                  <EntityAvatar name={fullName(t.contact)} color={t.contact.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-mut">
                    {fullName(t.contact)}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-faint">
                    ✉️ {t.emailsReceived}
                  </span>
                </label>
              </li>
            ))}
            {targets.length === 0 && (
              <li className="col-span-full px-4 py-6 text-center text-[12.5px] text-faint">
                Aucune cible avec email dans le pipeline.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

// ── Templates tab ────────────────────────────────────────────────────────────

function TemplatesTab({
  campaignId,
  templates,
  canManage,
  onChanged,
}: {
  campaignId: string;
  templates: Template[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  return (
    <div>
      {canManage && (
        <Button size="sm" className="mb-4" onClick={() => setCreateOpen(true)}>
          <Plus /> Nouveau modèle
        </Button>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <article
            key={t.id}
            className="group flex flex-col rounded-xl border border-line bg-card p-4 transition-colors hover:border-line"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-[13.5px] font-semibold text-fg">
                {t.name}
              </h3>
              {t.isDefault && (
                <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20">
                  Par défaut
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-[12px] text-mut">« {t.subject} »</p>
            <pre className="mt-2 line-clamp-3 whitespace-pre-wrap font-sans text-[11.5px] leading-relaxed text-faint">
              {t.body}
            </pre>
            {canManage && (
              <footer className="mt-3 flex items-center justify-end gap-1 border-t border-line pt-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                  Modifier
                </Button>
                {!t.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300"
                    onClick={() => {
                      if (!confirm(`Supprimer « ${t.name} » ?`)) return;
                      void deleteTemplateAction(t.id).then(onChanged);
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </footer>
            )}
          </article>
        ))}
        {templates.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-line px-6 py-12 text-center text-[13px] text-faint">
            Aucun modèle — créez le premier message type de la campagne.
          </p>
        )}
      </div>

      <TemplateEditorDialog
        campaignId={campaignId}
        template={editing}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
      <CreateTemplateDialog
        campaignId={campaignId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onChanged}
      />
    </div>
  );
}

function CreateTemplateDialog({
  campaignId,
  open,
  onClose,
  onCreated,
}: {
  campaignId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [state, action, pending] = useActionState<
    { error?: string; ok?: boolean; templateId?: string } | undefined,
    FormData
  >(async (_prev, fd) => createTemplateAction(_prev, fd), undefined);

  useEffect(() => {
    // bind campaignId via hidden input instead — handled below
  }, []);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Modèle créé");
      onCreated();
      onClose();
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau modèle d&apos;interpellation</DialogTitle>
          <DialogDescription>
            Utilisez les variables {"{{decision_maker_name}}"}, {"{{constituent_city}}"}…
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3.5">
          <input type="hidden" name="campaignId" value={campaignId} />
          <div className="flex flex-col gap-1.5">
            <Label>Nom *</Label>
            <Input name="name" placeholder="Interpellation standard — citoyens" required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Objet *</Label>
            <Input name="subject" placeholder="{{decision_maker_title}}, soutenez…" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Corps du message *</Label>
            <Textarea name="body" rows={8} required className="font-mono text-[12px]" />
          </div>
          <VariableHelp />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Création…" : "Créer le modèle"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TemplateEditorDialog({
  campaignId: _campaignId,
  template,
  onClose,
  onSaved,
}: {
  campaignId: string;
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSubject(template?.subject ?? "");
    setBody(template?.body ?? "");
  }, [template?.id]);

  async function save() {
    if (!template || !subject.trim()) return;
    setSaving(true);
    const res = await updateTemplateAction({ templateId: template.id, subject, body });
    setSaving(false);
    if (res.ok) {
      toast.success("Modèle mis à jour");
      onSaved();
      onClose();
    } else toast.error(res.error ?? "Erreur");
  }

  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier « {template?.name} »</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label>Objet</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Corps du message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="font-mono text-[12px]" />
          </div>
          <VariableHelp />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VariableHelp() {
  return (
    <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/[0.04] p-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
        Variables disponibles
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {EMAIL_VARIABLES.map((v) => (
          <p key={v.key} className="text-[11px] text-faint">
            <code className="text-indigo-700 dark:text-indigo-400/80">{v.key}</code>
          </p>
        ))}
      </div>
    </div>
  );
}
