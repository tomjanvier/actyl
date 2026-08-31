"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  Globe,
  Twitter,
  Linkedin,
  StickyNote,
  Trash2,
  Pin,
  Star,
  Loader2,
  ExternalLink,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn, fullName, timeAgo } from "@/lib/utils";
import { LEVELS, LEVEL_META, STANCES, STANCE_META } from "@/lib/constants";
import type { CandidateProfile, ContactRow, CustomFieldLite, MyNote, OrgNote } from "@/components/contacts/types";
import {
  updateContactAction,
  deleteContactAction,
  addPrivateNoteAction,
  savePrivateDataAction,
  addOrgNoteAction,
  deleteOrgNoteAction,
} from "@/app/actions/contacts";
import {
  createPoliticalPositionAction,
  deletePoliticalPositionAction,
  type CampaignTeamActionState,
} from "@/app/actions/campaign-teams";
import { SlideOver } from "@/components/ui/dialog";
import { EntityAvatar } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/controls";

type ActionRes = { error?: string; ok?: boolean };

export function ContactDrawer({
  contact,
  fields,
  myNotes,
  orgNotes,
  myPrivateData,
  canEdit,
  canDelete,
  candidateProfile,
  politicalGroups,
  canAddPoliticalPosition,
  open,
  onOpenChange,
  onDeleted,
}: {
  contact: ContactRow | null;
  fields: CustomFieldLite[];
  myNotes: MyNote[];
  orgNotes: OrgNote[];
  myPrivateData?: { rating: number | null; tags: string; status: string };
  canEdit: boolean;
  canDelete: boolean;
  candidateProfile?: CandidateProfile;
  politicalGroups: Array<{ id: string; name: string; color: string }>;
  canAddPoliticalPosition: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = useState("infos");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  // Revient à la fiche lorsqu'un nouveau contact est ouvert.
  useEffect(() => {
    if (open) setTab("infos");
  }, [contact?.id, open]);

  if (!contact) return <SlideOver open={false} onOpenChange={onOpenChange}><span /></SlideOver>;

  return (
    <SlideOver open={open} onOpenChange={onOpenChange}>
      {/* En-tête */}
      <div className="border-b border-line px-6 pb-4 pt-5">
        <div className="flex items-start gap-3.5">
          <EntityAvatar name={fullName(contact)} color={contact.avatarColor} size="xl" photoUrl={contact.photoUrl} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold tracking-tight text-fg">
              {fullName(contact)}
            </h2>
            <p className="mt-0.5 truncate text-[13px] text-faint">
              {[contact.title, contact.institution].filter(Boolean).join(" · ") || "—"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StanceBadge stance={contact.stance} />
              <LevelBadge level={contact.level} />
              {myPrivateData?.rating ? (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20">
                  <Star className="size-2.5 fill-amber-400" /> {myPrivateData.rating}/5 — moi
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="infos">Fiche</TabsTrigger>
            <TabsTrigger value="equipe">Notes d&apos;équipe ({orgNotes.length})</TabsTrigger>
            <TabsTrigger value="notes">Mes notes ({myNotes.length})</TabsTrigger>
            {candidateProfile && (
              <TabsTrigger value="presidentielle">Présidentielle 2027</TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <Tabs value={tab} onValueChange={setTab}>
          {/* ── Fiche ── */}
          <TabsContent value="infos" className="mt-0 outline-none">
            {canEdit ? (
              <EditForm
                key={contact.id}
                contact={contact}
                onSaved={refresh}
              />
            ) : (
              <ReadonlyInfo contact={contact} fields={fields} />
            )}
          </TabsContent>

          {/* ── Notes d'équipe (workspace) ── */}
          <TabsContent value="equipe" className="mt-0 flex flex-col gap-4 outline-none">
            <OrgNotesLayer
              contactId={contact.id}
              notes={orgNotes}
              onSaved={refresh}
              isAdmin={canDelete}
            />
          </TabsContent>

          {/* ── Notes privées ── */}
          <TabsContent value="notes" className="mt-0 flex flex-col gap-4 outline-none">
            <PrivateLayer
              contactId={contact.id}
              notes={myNotes}
              privateData={myPrivateData}
              onSaved={refresh}
            />
          </TabsContent>

          {candidateProfile && (
            <TabsContent value="presidentielle" className="mt-0 outline-none">
              <CandidatePoliticalLayer
                profile={candidateProfile}
                groups={politicalGroups}
                canAdd={canAddPoliticalPosition}
                onSaved={refresh}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Actions de bas de fiche */}
      {(canDelete || canEdit) && (
        <div className="flex items-center justify-between border-t border-line px-6 py-3">
          <span className="text-[11px] text-faint">
            Mis à jour {timeAgo(contact.updatedAt)}
          </span>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300"
              disabled={isPending}
              onClick={() => {
                if (!confirm(`Supprimer ${fullName(contact)} ? Cette action est irréversible.`)) return;
                void deleteContactAction(contact.id).then(() => {
                  toast.success("Contact supprimé");
                  onDeleted();
                });
              }}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Supprimer
            </Button>
          )}
        </div>
      )}
    </SlideOver>
  );
}

const POLITICAL_STANCE_LABELS: Record<string, string> = {
  FAVORABLE: "Favorable",
  MIXED: "Position mixte",
  OPPOSED: "Opposée",
  UNKNOWN: "À qualifier",
};

function CandidatePoliticalLayer({
  profile,
  groups,
  canAdd,
  onSaved,
}: {
  profile: CandidateProfile;
  groups: Array<{ id: string; name: string; color: string }>;
  canAdd: boolean;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState<
    CampaignTeamActionState | undefined,
    FormData
  >(createPoliticalPositionAction, undefined);

  useEffect(() => {
    if (state?.message) {
      toast.success(state.message);
      onSaved();
    }
    if (state?.error) toast.error(state.error);
  }, [state, onSaved]);

  async function remove(positionId: string) {
    if (!confirm("Supprimer cette piste de travail ?")) return;
    try {
      await deletePoliticalPositionAction(positionId);
      toast.success("Piste supprimée");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-card p-4">
        <h3 className="text-[13.5px] font-semibold text-fg">{profile.candidateName}</h3>
        {profile.programUrl ? (
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <a href={profile.programUrl} target="_blank" rel="noreferrer">
              <FileText /> Ouvrir le programme <ExternalLink />
            </a>
          </Button>
        ) : (
          <p className="mt-2 text-[12px] text-faint">Aucun programme en ligne renseigné.</p>
        )}
      </section>

      {canAdd && (
        <form action={action} className="rounded-xl border border-line bg-card p-4">
          <input type="hidden" name="teamId" value={profile.teamId} />
          <h3 className="text-[13.5px] font-semibold text-fg">Ajouter une piste de travail</h3>
          <p className="mt-1 text-[11.5px] text-mut">
            Cette note reste visible uniquement par l’équipe interne choisie.
          </p>
          <div className="mt-3 space-y-3">
            <Field label="Équipe interne">
              <select name="groupId" required className="h-9 w-full rounded-md border border-line bg-elev px-2 text-[12px] text-fg">
                <option value="">Choisir une équipe</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Enjeu">
              <Input name="topic" required placeholder="Aide publique au développement" />
            </Field>
            <Field label="Qualification">
              <select name="stance" defaultValue="UNKNOWN" className="h-9 w-full rounded-md border border-line bg-elev px-2 text-[12px] text-fg">
                <option value="UNKNOWN">À qualifier</option>
                <option value="FAVORABLE">Favorable</option>
                <option value="MIXED">Mixte</option>
                <option value="OPPOSED">Opposée</option>
              </select>
            </Field>
            <Field label="Note">
              <Textarea name="summary" required rows={3} placeholder="Position connue, point d’attention ou prochaine action…" />
            </Field>
          </div>
          <Button type="submit" size="sm" className="mt-3" disabled={pending}>
            {pending ? "Enregistrement…" : "Partager avec l’équipe"}
          </Button>
        </form>
      )}

      <section className="space-y-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-faint">
          Positions et pistes ({profile.positions.length})
        </h3>
        {profile.positions.map((position) => (
          <article key={position.id} className="rounded-lg bg-elev p-3 ring-1 ring-inset ring-line">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12.5px] font-medium text-fg">{position.topic}</p>
                <p className="mt-0.5 text-[10.5px] text-faint">
                  {POLITICAL_STANCE_LABELS[position.stance] ?? "À qualifier"} · {position.groupName}
                </p>
              </div>
              {position.canDelete && (
                <button type="button" onClick={() => void remove(position.id)} className="text-faint hover:text-rose-600" aria-label="Supprimer la piste">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-mut">{position.summary}</p>
          </article>
        ))}
        {profile.positions.length === 0 && (
          <p className="rounded-lg border border-dashed border-line p-4 text-center text-[12px] text-faint">
            Aucune piste partagée avec vos équipes.
          </p>
        )}
      </section>
    </div>
  );
}

// ── Formulaire de modification ───────────────────────────────────────────────

function EditForm({
  contact,
  onSaved,
}: {
  contact: ContactRow;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState<ActionRes | undefined, FormData>(
    updateContactAction.bind(null, contact.id),
    undefined,
  );
  useEffect(() => {
    if (state?.ok) {
      toast.success("Fiche mise à jour");
      onSaved();
    }
    if (state?.error) toast.error(state.error);
  }, [state, onSaved]);
  return (
    <form action={action} className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2">
      <Field label="Prénom"><Input name="firstName" defaultValue={contact.firstName} required /></Field>
      <Field label="Nom"><Input name="lastName" defaultValue={contact.lastName} required /></Field>
      <Field label="Email"><Input name="email" type="email" defaultValue={contact.email ?? ""} /></Field>
      <Field label="Téléphone"><Input name="phone" defaultValue={contact.phone ?? ""} /></Field>
      <Field label="Fonction"><Input name="title" defaultValue={contact.title ?? ""} /></Field>
      <Field label="Institution"><Input name="institution" defaultValue={contact.institution ?? ""} /></Field>
      <Field label="Parti / Affiliation"><Input name="party" defaultValue={contact.party ?? ""} /></Field>
      <Field label="Région / Circonscription"><Input name="region" defaultValue={contact.region ?? ""} /></Field>
      <Field label="Niveau">
        <Select name="level" defaultValue={contact.level}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LEVELS.map((l) => (
              <SelectItem key={l} value={l}>{LEVEL_META[l].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Position">
        <Select name="stance" defaultValue={contact.stance}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STANCES.map((s) => (
              <SelectItem key={s} value={s}>{STANCE_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Score d'influence (1–5)">
        <Input name="influenceScore" type="number" min={1} max={5} defaultValue={contact.influenceScore} />
      </Field>
      <div className="sm:col-span-2 flex flex-col gap-1.5">
        <Label>Bio / contexte</Label>
        <Textarea name="bio" defaultValue={contact.bio ?? ""} rows={3} />
      </div>
      <div className="sm:col-span-2 flex flex-col gap-1.5">
        <Label>Thématiques d&apos;intérêt (séparées par des virgules)</Label>
        <Input name="themes" defaultValue={contact.themes ?? ""} placeholder="Climat, Énergie, Numérique…" />
      </div>
      <div className="sm:col-span-2 flex flex-col gap-1.5">
        <Label>Photo (URL)</Label>
        <Input name="photoUrl" defaultValue={contact.photoUrl ?? ""} placeholder="https://…" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 sm:flex-nowrap">
        <SocialLinks contact={contact} />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ReadonlyInfo({
  contact,
  fields,
}: {
  contact: ContactRow;
  fields: CustomFieldLite[];
}) {
  const rows: Array<[string, string]> = [
    ["Email", contact.email ?? ""],
    ["Téléphone", contact.phone ?? ""],
    ["Parti", contact.party ?? ""],
    ["Région", contact.region ?? ""],
    ...fields.map((f): [string, string] => [
      f.label,
      (() => {
        const v = contact.customValues[f.id] ?? "";
        try {
          const p = JSON.parse(v);
          return Array.isArray(p) ? p.join(", ") : v;
        } catch { return v; }
      })(),
    ]),
  ];
  return (
    <div className="flex flex-col gap-4">
      <SocialLinks contact={contact} large />
      {contact.bio && (
        <p className="text-[13px] leading-relaxed text-mut">{contact.bio}</p>
      )}
      <dl className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase tracking-wider text-faint">{k}</dt>
            <dd className="mt-0.5 truncate text-[13px] text-mut">{v}</dd>
          </div>
        ))}
        {!rows.some(([, v]) => v) && (
          <p className="text-[13px] text-faint sm:col-span-2">Aucune coordonnée renseignée.</p>
        )}
      </dl>
    </div>
  );
}

function SocialLinks({ contact, large }: { contact: ContactRow; large?: boolean }) {
  const links = [
    { href: contact.email ? `mailto:${contact.email}` : null, icon: Mail, label: "Email" },
    { href: contact.phone ? `tel:${contact.phone}` : null, icon: Phone, label: "Tél." },
    { href: contact.website, icon: Globe, label: "Site web" },
    { href: contact.twitter ? `https://twitter.com/${contact.twitter}` : null, icon: Twitter, label: "X/Twitter" },
    { href: contact.linkedin ? `https://linkedin.com/in/${contact.linkedin}` : null, icon: Linkedin, label: "LinkedIn" },
  ].filter((l) => l.href);
  if (!links.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      {links.map(({ href, icon: Icon, label }) => (
        <a
          key={label}
          href={href!}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          className={cn(
            "inline-flex items-center justify-center rounded-lg border border-line text-faint transition-colors hover:border-indigo-500/50 hover:text-indigo-700 dark:text-indigo-300",
            large ? "size-9" : "size-7",
          )}
        >
          <Icon className={large ? "size-4" : "size-3.5"} />
        </a>
      ))}
    </div>
  );
}

// ── Couche privée : notes, évaluation et étiquettes personnelles ─────────────

function PrivateLayer({
  contactId,
  notes,
  privateData,
  onSaved,
}: {
  contactId: string;
  notes: MyNote[];
  privateData?: { rating: number | null; tags: string; status: string };
  onSaved: () => void;
}) {
  const [noteState, noteAction, notePending] = useActionState<ActionRes | undefined, FormData>(
    addPrivateNoteAction,
    undefined,
  );
  const [rating, setRating] = useState(privateData?.rating ?? 0);
  const [tags, setTags] = useState(privateData?.tags ?? "");
  const [savingPriv, setSavingPriv] = useState(false);

  useEffect(() => {
    setRating(privateData?.rating ?? 0);
    setTags(privateData?.tags ?? "");
  }, [contactId, privateData?.rating, privateData?.tags]);

  useEffect(() => {
    if (noteState?.ok) onSaved();
    if (noteState?.error) toast.error(noteState.error);
  }, [noteState, onSaved]);

  async function savePrivate() {
    setSavingPriv(true);
    const res = await savePrivateDataAction({
      contactId,
      rating: rating || null,
      tags,
    });
    setSavingPriv(false);
    if (res.ok) {
      toast.success("Données privées enregistrées");
      onSaved();
    } else toast.error(res.error ?? "Erreur");
  }

  return (
    <>
      {/* Couche personnelle. */}
      <section className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.04] p-4">
        <header className="mb-3 flex items-center gap-2">
          <Star className="size-3.5 text-indigo-700 dark:text-indigo-400" />
          <h3 className="text-[12.5px] font-semibold text-fg">
            Mon espace privé
          </h3>
          <span className="rounded-full bg-elev px-1.5 py-0.5 text-[10px] text-faint">
            visible uniquement par vous
          </span>
        </header>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setRating(i)} title={`${i}/5`}>
              <Star
                className={cn(
                  "size-5 transition-transform hover:scale-110",
                  i <= rating ? "fill-amber-400 text-amber-700 dark:text-amber-400" : "text-faint",
                )}
              />
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Label>Mots-clés personnels (séparés par des virgules)</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ex : arbitrage-budget, relance-janvier" />
        </div>
        <Button size="sm" variant="secondary" className="mt-3" disabled={savingPriv} onClick={() => void savePrivate()}>
          {savingPriv ? "Enregistrement…" : "Enregistrer mes données"}
        </Button>
      </section>

      {/* Ajout d’une note. */}
      <form action={noteAction} className="flex flex-col gap-2">
        <input type="hidden" name="contactId" value={contactId} />
        <Label className="flex items-center gap-1.5">
          <StickyNote className="size-3.5" /> Nouvelle note privée
        </Label>
        <Textarea name="body" rows={3} placeholder="Contexte, ressenti, stratégie de relance…" required />
        <Button type="submit" size="sm" className="self-start" disabled={notePending}>
          {notePending ? "Ajout…" : "Ajouter la note"}
        </Button>
      </form>

      {/* Notes list */}
      <div className="flex flex-col gap-2">
        {notes.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-faint">
            Vos notes sur ce décideur apparaîtront ici.
          </p>
        ) : (
          notes.map((n) => (
            <article
              key={n.id}
              className="rounded-lg border border-line bg-hover p-3"
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] text-faint">
                {n.pinned && <Pin className="size-3 text-amber-700 dark:text-amber-400" />}
                <span>{timeAgo(n.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-mut">
                {n.body}
              </p>
            </article>
          ))
        )}
      </div>
    </>
  );
}

function StanceBadge({ stance }: { stance: string }) {
  const meta = STANCE_META[stance as keyof typeof STANCE_META];
  if (!meta) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", meta.badge)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function LevelBadge({ level }: { level: string }) {
  const meta = LEVEL_META[level as keyof typeof LEVEL_META];
  return (
    <span className="rounded-md bg-elev px-1.5 py-0.5 text-[11px] text-mut ring-1 ring-inset ring-line">
      {meta?.label ?? level}
    </span>
  );
}

// ── Notes collectives de l'espace ────────────────────────────────────────────

function OrgNotesLayer({
  contactId,
  notes,
  onSaved,
  isAdmin,
}: {
  contactId: string;
  notes: OrgNote[];
  onSaved: () => void;
  isAdmin: boolean;
}) {
  const [state, action, pending] = useActionState<ActionRes | undefined, FormData>(
    addOrgNoteAction,
    undefined,
  );
  useEffect(() => {
    if (state?.ok) onSaved();
    if (state?.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      <p className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.05] px-3 py-2 text-[12px] leading-relaxed text-mut">
        🤝 Ces notes sont partagées avec toute votre organisation : chacun peut
        enrichir la connaissance collective sur ce décideur.
      </p>
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="contactId" value={contactId} />
        <Label className="flex items-center gap-1.5">
          <StickyNote className="size-3.5" /> Contribuer à la fiche collective
        </Label>
        <Textarea name="body" rows={3} placeholder="Compte-rendu de rendez-vous, position annoncée publiquement…" required />
        <Button type="submit" size="sm" className="self-start" disabled={pending}>
          {pending ? "Ajout…" : "Partager avec l'équipe"}
        </Button>
      </form>
      <div className="flex flex-col gap-2">
        {notes.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-faint">
            Aucune note d&apos;équipe — soyez le premier à contribuer.
          </p>
        ) : (
          notes.map((n) => (
            <article key={n.id} className="group rounded-lg border border-line bg-hover p-3">
              <div className="mb-1 flex items-center gap-2 text-[11px] text-faint">
                <span className="font-medium text-mut">{n.authorName}</span>
                <span>{timeAgo(n.createdAt)}</span>
                {(isAdmin || n.authorName) && (
                  <button
                    title="Supprimer"
                    onClick={() => {
                      void deleteOrgNoteAction(n.id).then(onSaved);
                    }}
                    className="ml-auto invisible hover:text-rose-700 dark:hover:text-rose-400 group-hover:visible"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-fg">{n.body}</p>
            </article>
          ))
        )}
      </div>
    </>
  );
}
