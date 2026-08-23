/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Deterministic pseudo-random for reproducible seeds
let seedState = 42;
function rand() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

async function main() {
  console.log("🌱 Seeding AdvocacyHQ…");

  // Clean slate (FK-safe order)
  await db.sentEmail.deleteMany();
  await db.emailBlast.deleteMany();
  await db.emailTemplate.deleteMany();
  await db.kanbanCard.deleteMany();
  await db.pipelineStage.deleteMany();
  await db.campaignGroup.deleteMany();
  await db.campaign.deleteMany();
  await db.listItem.deleteMany();
  await db.sharedList.deleteMany();
  await db.customFieldValue.deleteMany();
  await db.customField.deleteMany();
  await db.contactPrivateData.deleteMany();
  await db.privateNote.deleteMany();
  await db.groupMember.deleteMany();
  await db.group.deleteMany();
  await db.membership.deleteMany();
  await db.contact.deleteMany();
  await db.user.deleteMany();
  await db.workspace.deleteMany();

  // ── Workspace ──────────────────────────────────────────────────────────────
  const ws = await db.workspace.create({
    data: { name: "Plaidoyer Collectif", slug: "plaidoyer-collectif", logoEmoji: "🏛️" },
  });

  // ── Users (demo credentials) ───────────────────────────────────────────────
  const password = await bcrypt.hash("password123", 11);
  const seededUsers = (
    await Promise.all(
      [
        { email: "admin@advocacyhq.org", name: "Claire Fontaine", jobTitle: "Directrice" },
        { email: "campagne@advocacyhq.org", name: "Marc Dubois", jobTitle: "Chargé de campagnes" },
        { email: "militant@advocacyhq.org", name: "Aïcha Benali", jobTitle: "Militante" },
        { email: "observateur@advocacyhq.org", name: "Thomas Nguyen", jobTitle: "Analyste" },
      ].map((u) =>
        db.user.create({
          data: {
            email: u.email,
            name: u.name,
            jobTitle: u.jobTitle,
            passwordHash: password,
          },
        }),
      ),
    )
  ) as unknown as [{ id: string }, { id: string }, { id: string }, { id: string }];
  const [admin, campaigner, activist, observer] = seededUsers;

  for (const [user, role] of [
    [admin, "ADMIN"],
    [campaigner, "CAMPAIGNER"],
    [activist, "MEMBER"],
    [observer, "OBSERVER"],
  ] as const) {
    await db.membership.create({
      data: { userId: user.id, workspaceId: ws.id, role },
    });
  }

  // ── Groups / squads ────────────────────────────────────────────────────────
  const groupParis = await db.group.create({
    data: { workspaceId: ws.id, name: "Équipe Lobby Paris", color: "indigo", description: "Assemblée nationale, Sénat et ministères." },
  });
  const groupEU = await db.group.create({
    data: { workspaceId: ws.id, name: "Cellule Européenne", color: "sky", description: "Parlement européen et Commission." },
  });
  const groupVolunteers = await db.group.create({
    data: { workspaceId: ws.id, name: "Taskforce Bénévoles", color: "emerald", description: "Relais locaux et mobilisation citoyenne." },
  });
  const memberships = await db.membership.findMany({ where: { workspaceId: ws.id } });
  for (const m of memberships) {
    await db.groupMember.create({ data: { groupId: groupParis.id, membershipId: m.id } });
  }
  await db.groupMember.createMany({
    data: memberships.slice(0, 3).map((m) => ({ groupId: groupEU.id, membershipId: m.id })),
  });
  await db.groupMember.createMany({
    data: memberships.slice(2).map((m) => ({ groupId: groupVolunteers.id, membershipId: m.id })),
  });

  // ── Contacts: decision-makers directory ────────────────────────────────────
  const contactsInput = [
    { key: "hidalgo", firstName: "Anne", lastName: "Hidalgo", title: "Maire de Paris", institution: "Ville de Paris", party: "Parti Socialiste", region: "Île-de-France", level: "LOCAL", stance: "FAVORABLE", influenceScore: 5, email: "anne.hidalgo@paris.fr", twitter: "Anne_Hidalgo", bio: "Élue à la tête de Paris depuis 2014, engagée sur les questions de mobilité douce et de végétalisation." },
    { key: "rousseau", firstName: "Mathilde", lastName: "Rousseau-Panot", title: "Députée", institution: "Assemblée nationale", party: "Les Écologistes", region: "Paris", level: "NATIONAL", stance: "ALLY", influenceScore: 3, email: "m.rousseau-panot@assemblee-nationale.fr", bio: "Rapporteure de la commission du développement durable." },
    { key: "pompougnac", firstName: "Sacha", lastName: "Pompougnac", title: "Député", institution: "Assemblée nationale", party: "Ensemble pour la République", region: "Gironde", level: "NATIONAL", stance: "UNDECIDED", influenceScore: 3, email: "s.pompougnac@assemblee-nationale.fr", bio: "Membre de la commission des affaires économiques." },
    { key: "lachaud", firstName: "Emmanuelle", lastName: "Lachaud", title: "Sénatrice", institution: "Sénat", party: "Les Républicains", region: "Nouvelle-Aquitaine", level: "NATIONAL", stance: "OPPOSED", influenceScore: 4, email: "e.lachaud@senat.fr", bio: "Vice-présidente de la commission de l'aménagement du territoire." },
    { key: "asselineau", firstName: "François", lastName: "Asselineau-Luciani", title: "Député européen", institution: "Parlement européen", party: "Verts/ALE", region: "France", level: "EU", stance: "ALLY", influenceScore: 4, email: "francois.asselineauluciani@europarl.europa.eu", bio: "Membre de la commission ENVII, spécialiste biodiversité." },
    { key: "graux", firstName: "Philippe", lastName: "Graux", title: "Député", institution: "Assemblée nationale", party: "Horizons", region: "Nord", level: "NATIONAL", stance: "UNDECIDED", influenceScore: 3, email: "p.graux@assemblee-nationale.fr" },
    { key: "bompard", firstName: "Christine", lastName: "Bompard-Valette", title: "Sénatrice", institution: "Sénat", party: "RDSE", region: "Occitanie", level: "NATIONAL", stance: "UNKNOWN", influenceScore: 2, email: "c.bompardvalette@senat.fr" },
    { key: "bellamy", firstName: "Éric", lastName: "Bellamy-Roche", title: "Député", institution: "Assemblée nationale", party: "Gauche démocratique et républicaine", region: "Seine-Saint-Denis", level: "NATIONAL", stance: "FAVORABLE", influenceScore: 3, email: "e.bellamyroche@assemblee-nationale.fr" },
    { key: "lefeuvre", firstName: "Stéphanie", lastName: "Lefeuvre", title: "Conseillère régionale", institution: "Région Île-de-France", party: "Les Écologistes", region: "Île-de-France", level: "REGIONAL", stance: "ALLY", influenceScore: 2, email: "s.lefeuvre@iledefrance.fr" },
    { key: "morano", firstName: "Valérie", lastName: "Morano-Delaunay", title: "Présidente de région", institution: "Région Auvergne-Rhône-Alpes", party: "Les Républicains", region: "Auvergne-Rhône-Alpes", level: "REGIONAL", stance: "OPPOSED", influenceScore: 5, bio: "Opposante historique aux zones à faibles émissions." },
    { key: "dassault", firstName: "Marie-Victoire", lastName: "Dassault-Augier", title: "Députée", institution: "Assemblée nationale", party: "Les Républicains", region: "Oise", level: "NATIONAL", stance: "OPPOSED", influenceScore: 3 },
    { key: "caron", firstName: "Guillaume", lastName: "Caron-Bourbon", title: "Député", institution: "Assemblée nationale", party: "Rassemblement National", region: "Aisne", level: "NATIONAL", stance: "TARGET", influenceScore: 2 },
    { key: "vautrin", firstName: "Céline", lastName: "Vautrin-Corbi", title: "Ministre", institution: "Ministère de la Transition écologique", party: "Ensemble pour la République", region: "France", level: "NATIONAL", stance: "UNDECIDED", influenceScore: 5, email: "cab-mtte@ecologie.gouv.fr", bio: "Arbitre clé du prochain projet de loi énergie-climat." },
    { key: "gattaz", firstName: "Pierre", lastName: "Gattaz-Martin", title: "PDG", institution: "RADIAL SA", party: undefined, region: "Auvergne-Rhône-Alpes", level: "PRIVATE_SECTOR", stance: "OPPOSED", influenceScore: 4, linkedin: "pierregattaz", bio: "Figure patronale, très actif sur la fiscalité environnementale." },
    { key: "burelle", firstName: "Alexandre", lastName: "Burelli-Ollivier", title: "CEO", institution: "Olivier SA", region: "Île-de-France", level: "PRIVATE_SECTOR", stance: "UNDECIDED", influenceScore: 3 },
    { key: "nuzillet", firstName: "Nicolas", lastName: "Nuzillet-Hulot", title: "Journaliste", institution: "France Info", region: "France", level: "MEDIA", stance: "FAVORABLE", influenceScore: 4, email: "nicolas.nuzillet@radiofrance.fr", bio: "Chef du service climat, sensible aux angles « solutions »." },
    { key: "salmon", firstName: "Léa", lastName: "Salame-Garnier", title: "Éditorialiste", institution: "Le Monde", region: "France", level: "MEDIA", stance: "UNKNOWN", influenceScore: 4 },
    { key: "duflos", firstName: "Christian", lastName: "Duflos-Revel", title: "Président d'association", institution: "France Nature Environnement", region: "France", level: "CIVIL_SOCIETY", stance: "ALLY", influenceScore: 3, bio: "Allié de longue date sur les dossiers eau et pesticides." },
    { key: "taubira", firstName: "Camille", lastName: "Taubira-Etienne", title: "Députée européenne", institution: "Parlement européen", party: "Renew Europe", region: "France", level: "EU", stance: "UNDECIDED", influenceScore: 4, email: "camille.taubiraetienne@europarl.europa.eu" },
    { key: "glucksmann", firstName: "Raphaël", lastName: "Glucksman-Portelli", title: "Député européen", institution: "Parlement européen", party: "S&D", region: "France", level: "EU", stance: "FAVORABLE", influenceScore: 5, bio: "Poids lourd de la délégation française, rapporteur ad hoc." },
    { key: "mariani", firstName: "Thierry", lastName: "Mariani-Lorcerie", title: "Député européen", institution: "Parlement européen", party: "ECR", region: "France", level: "EU", stance: "OPPOSED", influenceScore: 3 },
    { key: "estrosi", firstName: "Christian", lastName: "Estrosi-Sassone", title: "Maire", institution: "Nice", party: "Horizons", region: "Provence-Alpes-Côte d'Azur", level: "LOCAL", stance: "FAVORABLE", influenceScore: 4 },
    { key: "darmanin", firstName: "Gérald", lastName: "Darmanin-Versini", title: "Député", institution: "Assemblée nationale", party: "Ensemble pour la République", region: "Nord", level: "NATIONAL", stance: "UNKNOWN", influenceScore: 5 },
    { key: "obono", firstName: "Danielle", lastName: "Obono-Simion", title: "Députée", institution: "Assemblée nationale", party: "La France Insoumise", region: "Gironde", level: "NATIONAL", stance: "FAVORABLE", influenceScore: 3 },
    { key: "panot", firstName: "Emmanuel", lastName: "Panot-Grégoire", title: "Député", institution: "Assemblée nationale", party: "Rassemblement National", region: "Pas-de-Calais", level: "NATIONAL", stance: "OPPOSED", influenceScore: 3 },
    { key: "roussel", firstName: "Fabien", lastName: "Roussel-Lejeune", title: "Député", institution: "Assemblée nationale", party: "Parti Communiste Français", region: "Nord", level: "NATIONAL", stance: "OPPOSED", influenceScore: 4, bio: "Position constante contre les normes environnementales sur l'industrie." },
  ] as Array<{
    key: string;
    firstName: string;
    lastName: string;
    title?: string;
    institution?: string;
    party?: string | undefined;
    region?: string;
    level: string;
    stance: string;
    influenceScore: number;
    email?: string;
    twitter?: string;
    linkedin?: string;
    bio?: string;
  }>;

  const colors = ["slate", "indigo", "emerald", "amber", "rose", "violet", "sky", "teal", "orange", "fuchsia"];
  const contactsByKey: Record<string, { id: string }> = {};
  let ci = 0;
  for (const c of contactsInput) {
    const created = await db.contact.create({
      data: {
        workspaceId: ws.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email ?? null,
        phone: rand() > 0.5 ? `+33 ${1 + Math.floor(rand() * 6)} ${10 + Math.floor(rand() * 89)} ${10 + Math.floor(rand() * 89)} ${10 + Math.floor(rand() * 89)} ${10 + Math.floor(rand() * 89)}` : null,
        title: c.title ?? null,
        institution: c.institution ?? null,
        party: c.party ?? null,
        region: c.region ?? null,
        level: c.level,
        stance: c.stance,
        influenceScore: c.influenceScore,
        bio: c.bio ?? null,
        twitter: c.twitter ?? null,
        linkedin: c.linkedin ?? null,
        avatarColor: colors[ci++ % colors.length],
        createdById: admin.id,
      },
    });
    contactsByKey[c.key] = created;
  }
  console.log(`   ✓ ${contactsInput.length} décideurs`);

  // ── Custom fields (dynamic schema) ─────────────────────────────────────────
  const cfCommission = await db.customField.create({
    data: {
      workspaceId: ws.id,
      name: "commission",
      label: "Commission parlementaire",
      type: "SELECT",
      options: JSON.stringify([
        "Développement durable",
        "Affaires économiques",
        "Lois",
        "Finances",
        "Culture",
        "ENVII (PE)",
        "ITRE (PE)",
      ]),
      description: "Commission permanente d'appartenance.",
      showInTable: true,
      position: 0,
    },
  });
  const cfThemes = await db.customField.create({
    data: {
      workspaceId: ws.id,
      name: "themes_suivis",
      label: "Dossiers suivis",
      type: "MULTI_SELECT",
      options: JSON.stringify(["Climat", "Énergie", "Numérique", "Biodiversité", "Eau", "Transport", "Logement"]),
      position: 1,
    },
  });
  const cfMeeting = await db.customField.create({
    data: {
      workspaceId: ws.id,
      name: "rdv_passee",
      label: "Rendez-vous déjà obtenu",
      type: "BOOLEAN",
      position: 2,
    },
  });

  const commissionByContact: Array<[string, string]> = [
    ["rousseau", "Développement durable"],
    ["pompougnac", "Affaires économiques"],
    ["lachaud", "Lois"],
    ["asselineau", "ENVII (PE)"],
    ["glucksmann", "ENVII (PE)"],
    ["taubira", "ITRE (PE)"],
    ["obono", "Lois"],
  ];
  for (const [key, value] of commissionByContact) {
    await db.customFieldValue.create({
      data: { fieldId: cfCommission.id, contactId: contactsByKey[key]!.id, value },
    });
  }
  const themesByContact: Array<[string, string[]]> = [
    ["rousseau", ["Climat", "Biodiversité"]],
    ["asselineau", ["Biodiversité", "Eau"]],
    ["vautrin", ["Climat", "Énergie", "Transport"]],
    ["gattaz", ["Énergie"]],
    ["glucksmann", ["Numérique", "Climat"]],
    ["hidalgo", ["Transport", "Logement"]],
  ];
  for (const [key, values] of themesByContact) {
    await db.customFieldValue.create({
      data: { fieldId: cfThemes.id, contactId: contactsByKey[key]!.id, value: JSON.stringify(values) },
    });
  }
  for (const key of ["rousseau", "hidalgo", "duflos"]) {
    await db.customFieldValue.create({
      data: { fieldId: cfMeeting.id, contactId: contactsByKey[key]!.id, value: "true" },
    });
  }

  // Private notes (per-user)
  await db.privateNote.createMany({
    data: [
      { contactId: contactsByKey.vautrin!.id, authorId: campaigner.id, pinned: true, body: "Cabinet très protégé. Passer par le conseiller parlementaire Étienne M. plutôt que par la ministre directement.", createdAt: daysAgo(12) },
      { contactId: contactsByKey.pompougnac!.id, authorId: campaigner.id, body: "Réceptif aux arguments emploi/compétitivité verte. Éviter le vocabulaire « contrainte ».", createdAt: daysAgo(6) },
      { contactId: contactsByKey.lachaud!.id, authorId: admin.id, body: "Opposition frontale mais respectueuse. À requalifier si amendement transpartisan.", createdAt: daysAgo(20) },
      { contactId: contactsByKey.hidalgo!.id, authorId: activist.id, body: "Venue au forum des maires : relancer via son directeur de cabinet avant décembre.", createdAt: daysAgo(3) },
    ],
  });

  // Private per-user overlays
  await db.contactPrivateData.create({
    data: { contactId: contactsByKey.vautrin!.id, userId: campaigner.id, rating: 5, tags: "arbitrage-budget,clé-du-vote", status: "À recontacter après le Conseil des ministres" },
  });
  await db.contactPrivateData.create({
    data: { contactId: contactsByKey.pompougnac!.id, userId: activist.id, rating: 3, tags: "gironde,balancing" },
  });

  // ── Shared lists ───────────────────────────────────────────────────────────
  const listCulture = await db.sharedList.create({
    data: {
      workspaceId: ws.id,
      name: "Commission Développement durable — AN",
      description: "Membres de la commission et rapporteurs clés, vérifié en janvier.",
      isPublished: true,
      createdById: admin.id,
    },
  });
  const listMayors = await db.sharedList.create({
    data: {
      workspaceId: ws.id,
      name: "Exécutifs locaux mobilisables",
      description: "Maires et présidents de région favorables ou hésitants.",
      isPublished: true,
      createdById: campaigner.id,
    },
  });
  const listMedia = await db.sharedList.create({
    data: {
      workspaceId: ws.id,
      name: "Contacts presse climat",
      isPublished: false,
      createdById: campaigner.id,
    },
  });
  for (const key of ["rousseau", "bellamy", "darmanin", "obono", "pompougnac"]) {
    await db.listItem.create({ data: { listId: listCulture.id, contactId: contactsByKey[key]!.id } });
  }
  for (const key of ["hidalgo", "estrosi", "lefeuvre", "morano"]) {
    await db.listItem.create({ data: { listId: listMayors.id, contactId: contactsByKey[key]!.id } });
  }
  for (const key of ["nuzillet", "salmon"]) {
    await db.listItem.create({ data: { listId: listMedia.id, contactId: contactsByKey[key]!.id } });
  }

  // ── Campaigns ──────────────────────────────────────────────────────────────
  async function createCampaign(opts: {
    name: string;
    slug: string;
    emoji: string;
    description: string;
    status: string;
    priority: string;
    dueInDays?: number;
    squadIds: string[];
  }) {
    return db.campaign.create({
      data: {
        workspaceId: ws.id,
        name: opts.name,
        slug: opts.slug,
        emoji: opts.emoji,
        description: opts.description,
        status: opts.status,
        priority: opts.priority,
        dueDate: opts.dueInDays ? new Date(Date.now() + opts.dueInDays * 24 * 3600 * 1000) : null,
        createdById: admin.id,
        squads: { create: opts.squadIds.map((groupId) => ({ groupId })) },
      },
    });
  }

  const campClimate = await createCampaign({
    name: "Loi Climat & Résilience 2026",
    slug: "loi-climat-2026",
    emoji: "🌍",
    description:
      "Campagne plaidoyer pour un objectif contraignant de réduction des émissions de 60 % en 2030, avec mécanisme de suivi renforcé et fonds d'adaptation pour les territoires.",
    status: "ACTIVE",
    priority: "URGENT",
    dueInDays: 120,
    squadIds: [groupParis.id, groupVolunteers.id],
  });
  const campDigital = await createCampaign({
    name: "Règlement européen Droits Numériques",
    slug: "droits-numeriques-eu",
    emoji: "🔐",
    description:
      "Amendements sur l'interopérabilité des messageries et la protection des lanceurs d'alerte dans la version ENVI du règlement.",
    status: "ACTIVE",
    priority: "HIGH",
    dueInDays: 45,
    squadIds: [groupEU.id],
  });
  await createCampaign({
    name: "Protection des zones humides",
    slug: "zones-humides",
    emoji: "🦆",
    description: "Classement des 30 dernières grandes zones humides en protection forte. Phase d'identification des relais territoriaux.",
    status: "PLANNING",
    priority: "MEDIUM",
    squadIds: [groupVolunteers.id],
  });

  console.log("   ✓ 3 campagnes");

  // ── Kanban pipelines ───────────────────────────────────────────────────────
  async function buildPipeline(campaignId: string, cards: Array<{ key: string; stageIdx: number; assignee?: string; role?: string; priority?: string; lastTouch?: number }>) {
    const stagesData = [
      { name: "À contacter", kind: "NEUTRAL" },
      { name: "Email envoyé", kind: "ACTIVE" },
      { name: "Rendez-vous programmé", kind: "ACTIVE" },
      { name: "Allié·e confirmé·e", kind: "POSITIVE" },
      { name: "Officiellement gagné·e", kind: "WON" },
      { name: "Opposant·e déclaré·e", kind: "NEGATIVE" },
    ];
    const stages = [];
    for (let i = 0; i < stagesData.length; i++) {
      stages.push(
        await db.pipelineStage.create({
          data: { campaignId, name: stagesData[i]!.name, kind: stagesData[i]!.kind, position: i },
        }),
      );
    }
    let pos = 0;
    for (const card of cards) {
      await db.kanbanCard.create({
        data: {
          campaignId,
          stageId: stages[card.stageIdx]!.id,
          contactId: contactsByKey[card.key]!.id,
          assignedToId: card.assignee ?? campaigner.id,
          role: card.role ?? null,
          priority: card.priority ?? "MEDIUM",
          lastTouchAt: daysAgo(card.lastTouch ?? Math.floor(rand() * 14)),
          position: pos++,
        },
      });
    }
  }

  await buildPipeline(campClimate.id, [
    { key: "vautrin", stageIdx: 1, role: "Arbitre ministériel", priority: "URGENT", lastTouch: 2 },
    { key: "pompougnac", stageIdx: 1, role: "Vote pivot", priority: "HIGH", lastTouch: 4 },
    { key: "graux", stageIdx: 1, priority: "MEDIUM", lastTouch: 9 },
    { key: "bompard", stageIdx: 0, priority: "LOW" },
    { key: "caron", stageIdx: 0, priority: "LOW" },
    { key: "darmanin", stageIdx: 2, role: "Relais majorité", priority: "URGENT", lastTouch: 1 },
    { key: "rousseau", stageIdx: 3, role: "Rapporteure", priority: "HIGH", lastTouch: 3 },
    { key: "hidalgo", stageIdx: 3, role: "Relais territorial", priority: "MEDIUM", lastTouch: 5 },
    { key: "lefeuvre", stageIdx: 3, priority: "LOW", lastTouch: 11 },
    { key: "estrosi", stageIdx: 4, role: "Ambassadeur maires", priority: "MEDIUM", lastTouch: 7 },
    { key: "duflos", stageIdx: 4, role: "Coalition ONG", priority: "LOW", lastTouch: 15 },
    { key: "morano", stageIdx: 5, priority: "LOW", lastTouch: 22 },
    { key: "roussel", stageIdx: 5, priority: "MEDIUM", lastTouch: 18 },
    { key: "gattaz", stageIdx: 5, priority: "LOW", lastTouch: 25 },
  ]);

  await buildPipeline(campDigital.id, [
    { key: "glucksmann", stageIdx: 3, role: "Rapporteur ad hoc", priority: "URGENT", lastTouch: 1 },
    { key: "asselineau", stageIdx: 3, priority: "HIGH", lastTouch: 2 },
    { key: "taubira", stageIdx: 2, role: "Renew pivot", priority: "URGENT", lastTouch: 3 },
    { key: "mariani", stageIdx: 5, priority: "LOW", lastTouch: 10 },
    { key: "salmon", stageIdx: 1, role: "Presse relais", priority: "MEDIUM", lastTouch: 6 },
    { key: "nuzillet", stageIdx: 1, priority: "MEDIUM", lastTouch: 8 },
  ]);

  console.log("   ✓ Pipelines kanban");

  // ── Email templates ────────────────────────────────────────────────────────
  const tplClimate = await db.emailTemplate.create({
    data: {
      campaignId: campClimate.id,
      name: "Interpellation standard — citoyens",
      isDefault: true,
      subject: "{{decision_maker_title}} {{decision_maker_last_name}}, soutenez l'objectif −60 % en 2030",
      body: `Madame, Monsieur {{decision_maker_last_name}},

En tant qu'habitant·e de {{constituent_city}}, je vous demande solennellement de soutenir un objectif contraignant de réduction des émissions de gaz à effet de serre de 60 % d'ici 2030, assorti d'un mécanisme de suivi annuel devant le Parlement.

Le GIEC est formel : chaque dixième de compte. La France dispose des leviers pour agir — bâtiment, transport, industrie — mais ils exigent une loi claire, chiffrée et contrôlable.

{{decision_maker_first_name}}, votre vote comptera : vos électeurs de {{constituent_city}} suivent ce dossier avec attention.

Je vous prie d'agréer l'expression de ma considération distinguée,
{{constituent_name}}`,
    },
  });
  await db.emailTemplate.create({
    data: {
      campaignId: campClimate.id,
      name: "Relance élus locaux",
      subject: "Collectivités : 3 mesures qui changent tout — {{decision_maker_name}}",
      body: `Bonjour,

Nous sommes une coalition d'associations réunies autour de la campagne « {{campaign_name}} ». Trois dispositions concernent directement les collectivités que vous représentez…

Cordialement,
{{constituent_name}}`,
    },
  });
  const tplDigital = await db.emailTemplate.create({
    data: {
      campaignId: campDigital.id,
      name: "Appel interpellation PE",
      isDefault: true,
      subject: "Interopérabilité des messageries : ne cédons pas — {{decision_maker_name}}",
      body: `Chère, cher {{decision_maker_first_name}},

L'amendement 217 sur l'interopérabilité obligatoire des messageries est le cœur du règlement Droits Numériques. Sans lui, les monopoles restent verrouillés.

En tant que représentant de mes concitoyens, votre voix est décisive en séance.

Respectueusement,
{{constituent_name}}`,
    },
  });

  // ── Email blasts + sent history (analytics-ready) ──────────────────────────
  async function makeBlast(campaignId: string, templateId: string, subject: string, body: string, targets: string[], source: "INTERNAL" | "PUBLIC_PAGE", ageDays: number, openedRatio = 0.55) {
    const blast = await db.emailBlast.create({
      data: { campaignId, templateId, subject, body, source, createdById: campaigner.id, createdAt: daysAgo(ageDays) },
    });
    for (const key of targets) {
      const opened = rand() < openedRatio;
      await db.sentEmail.create({
        data: {
          blastId: blast.id,
          contactId: contactsByKey[key]!.id,
          senderName: pick(["Julie Martin", "Karim Haddad", "Sophie Lemoine", "Lucas Petit", "Emma Rousseau", "Nadia Cherif", "Paul Girard", "Inès Fabre"]),
          senderCity: pick(["Paris", "Lyon", "Marseille", "Nantes", "Bordeaux", "Strasbourg", "Rennes"]),
          subject,
          body: "(message personnalisé par le citoyen)",
          status: "SENT",
          providerId: `sim_${crypto.randomUUID()}`,
          openedAt: opened ? daysAgo(ageDays - 1) : null,
          createdAt: daysAgo(ageDays),
        },
      });
    }
    return blast;
  }

  await makeBlast(campClimate.id, tplClimate.id, tplClimate.subject, tplClimate.body, ["vautrin", "pompougnac", "graux", "darmanin", "bompard"], "PUBLIC_PAGE", 21, 0.6);
  await makeBlast(campClimate.id, tplClimate.id, tplClimate.subject, tplClimate.body, ["rousseau", "obono", "hidalgo", "lefeuvre"], "INTERNAL", 9, 0.75);
  await makeBlast(campDigital.id, tplDigital.id, tplDigital.subject, tplDigital.body, ["glucksmann", "taubira", "asselineau", "mariani"], "PUBLIC_PAGE", 14, 0.5);

  // Extra organic citizen emails (no blast) to enrich per-target counters
  for (let i = 0; i < 18; i++) {
    const target = pick(["vautrin", "pompougnac", "graux", "darmanin", "taubira", "glucksmann"]);
    await db.sentEmail.create({
      data: {
        contactId: contactsByKey[target]!.id,
        senderName: pick(["Hélène Vasseur", "Olivier Blanc", "Sarah Cohen", "Mehdi Amrani", "Claire Perrot", "Yanis Boudiaf"]),
        senderCity: pick(["Toulouse", "Lille", "Dijon", "Angers", "Metz"]),
        subject: "(interpellation citoyenne)",
        body: "",
        status: "SENT",
        providerId: `sim_${crypto.randomUUID()}`,
        openedAt: rand() < 0.4 ? daysAgo(Math.floor(rand() * 20)) : null,
        createdAt: daysAgo(Math.floor(rand() * 20)),
      },
    });
  }

  const counts = {
    users: await db.user.count(),
    contacts: await db.contact.count(),
    campaigns: await db.campaign.count(),
    cards: await db.kanbanCard.count(),
    emails: await db.sentEmail.count(),
  };
  console.log("✅ Seed terminé :", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
