// Exécute les vraies actions avec une base et un transport mail simulés.
// Aucun accès réseau, aucune écriture réelle ni email envoyé.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, mocks) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, process: { env: { RESEND_API_KEY: 'fake-test-key' } }, require: name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  } });
  return exports;
}
const batch = { EMAIL_BATCH_LIMIT: 500, EMAIL_BATCH_ERROR: 'Audience trop grande' };
let session = { workspaceId: 'workspace-a', workspaceName: 'Organisation', role: 'ADMIN' };
let allowed = true;
let sent = 0;
let writes = 0;
let rows = [];
let total = 700;
const common = {
  '@/lib/auth': { getSession: async () => session },
  '@/lib/constants': { can: () => allowed },
  '@/lib/email-batch': batch,
  '@/lib/email': { dispatchEmail: async () => { sent++; return { ok: true }; }, wrapEmailHtml: () => '' },
};
const sql = (parts, ...values) => ({ parts, values });
const broadcast = load('app/actions/broadcast.ts', {
  ...common,
  '@/generated/prisma/client': { Prisma: { sql } },
  '@/lib/supporter-search': { supporterSearchWhere: (workspaceId, filters) => {
    assert.equal(workspaceId, 'workspace-a');
    assert.equal(filters.q, '');
    return { workspaceId, filters };
  } },
  '@/lib/db': { db: { $queryRaw: async query => query.parts.join('').includes('count(*)') ? [{ count: total }] : rows } },
});
const signatures = load('app/actions/signatures.ts', {
  ...common,
  'next/cache': { revalidatePath: () => {} },
  '@/lib/ingest': { upsertContactByEmail: async () => { writes++; return { created: true }; } },
  '@/lib/utils': { toCSV: () => '' },
  '@/lib/db': { db: {
    petition: { findFirst: async ({ where }) => { assert.equal(where.workspaceId, 'workspace-a'); return { id: 'petition-a' }; } },
    petitionSignature: {
      count: async () => total,
      findMany: async ({ where, take }) => { assert.equal(where.petitionId, 'petition-a'); assert.ok(take === undefined || take <= 501 || take === 50001); return rows; },
      deleteMany: async ({ where }) => { assert.ok(where.id.in.length); assert.equal(where.petitionId, 'petition-a'); writes++; return { count: where.id.in.length }; },
    },
  } },
});
const message = { subject: 'Annonce', body: 'Un message suffisamment long.', audience: {} };
assert.equal((await broadcast.countBroadcastAudienceAction({})).count, 700);
assert.equal((await signatures.countPetitionSignersAction({ campaignId: 'campaign-a' })).count, 700);
rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i), email: `${i}@example.test`, name: 'Test' }));
assert.ok((await broadcast.sendBroadcastAction(message)).error);
assert.ok((await signatures.emailPetitionSignersAction({ ...message, campaignId: 'campaign-a' })).error);
assert.equal(sent, 0, 'Une audience trop grande ne doit jamais être partiellement envoyée.');
rows = Array.from({ length: 50001 }, () => ({}));
assert.ok((await signatures.exportSignaturesCsvAction({ campaignId: 'campaign-a' })).error);
rows = [];
assert.ok((await broadcast.sendBroadcastAction(message)).error);
assert.ok((await signatures.emailPetitionSignersAction({ ...message, campaignId: 'campaign-a' })).error);
for (const ids of [undefined, [], [''], Array(501).fill('id')]) {
  assert.ok((await signatures.deleteSignaturesAction({ campaignId: 'campaign-a', ids })).error);
  assert.ok((await signatures.convertSignaturesToContactsAction({ campaignId: 'campaign-a', ids })).error);
}
assert.equal(writes, 0, 'Une sélection absente ou vide ne doit jamais supprimer toutes les signatures.');
rows = Array.from({ length: 500 }, (_, i) => ({ id: String(i), email: `${i}@example.test`, name: 'Test' }));
assert.equal((await broadcast.sendBroadcastAction(message)).sent, 500);
assert.equal((await signatures.emailPetitionSignersAction({ ...message, campaignId: 'campaign-a' })).sent, 500);
assert.equal(sent, 1000);
await signatures.deleteSignaturesAction({ campaignId: 'campaign-a', ids: ['one'] });
assert.equal(writes, 1);
allowed = false;
assert.ok((await broadcast.sendBroadcastAction(message)).error);
assert.ok((await signatures.deleteSignaturesAction({ campaignId: 'campaign-a', ids: ['one'] })).error);
session = null;
assert.ok((await broadcast.countBroadcastAudienceAction({})).error);
assert.ok((await signatures.emailPetitionSignersAction({ ...message, campaignId: 'campaign-a' })).error);
assert.equal(sent, 1000);
assert.equal(writes, 1);
// Rendu serveur contrôlé : la page transmet les critères et recale la pagination.
const signatureRows = Array.from({ length: 125 }, (_, i) => ({
  id: String(i), name: `Signataire ${i}`, email: `${i}@example.test`,
  city: i < 100 ? 'Paris' : 'Lyon', createdAt: new Date('2026-10-18'),
}));
let currentWhere;
function matchesSignature(row, where) {
  return (!where.city || row.city === where.city.equals) && (!where.AND || where.AND.every(clause =>
    clause.OR.some(condition => Object.entries(condition).some(([field, comparison]) =>
      String(row[field] ?? '').toLowerCase().includes(comparison.contains.toLowerCase()),
    )),
  ));
}
const page = load('app/(dashboard)/campaigns/[id]/signatures/page.tsx', {
  'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' },
  'next/navigation': { notFound: () => { throw new Error('404'); } },
  '@/lib/crm-filters': { requestedPage: value => { const p = Number(value); return Number.isSafeInteger(p) && p > 0 && p <= 10000 ? p : 1; } },
  '@/lib/auth': { requireSession: async () => ({ workspaceId: 'workspace-a', role: 'ADMIN' }) },
  '@/lib/constants': { can: () => true },
  '@/lib/campaign-access': { campaignAccessWhere: () => ({}), resolveCampaignAccess: () => ({ owner: true, canContribute: true }) },
  '@/components/campaigns/campaign-header': { CampaignHeader: 'header' },
  '@/components/campaigns/signatures-view': { SignaturesView: 'signatures' },
  '@/lib/db': { db: {
    campaign: { findFirst: async () => ({ id: 'campaign-a', slug: 'campaign', workspace: { slug: 'org' }, squads: [], shares: [], petition: { id: 'petition-a', title: 'Pétition' } }) },
    petitionSignature: {
      findMany: async ({ where, skip, take }) => {
        currentWhere = where;
        return signatureRows.filter(row => matchesSignature(row, where)).slice(skip, skip + take);
      },
      count: async ({ where }) => signatureRows.filter(row => matchesSignature(row, where)).length,
      groupBy: async () => [{ city: 'Paris' }, { city: 'Lyon' }],
    },
  } },
});
const rendered = await page.default({ params: Promise.resolve({ id: 'campaign-a' }), searchParams: Promise.resolve({ q: '  SIGNATAIRE Lyon  ', city: 'Lyon', page: '9999' }) });
const view = rendered.props.children.find(child => child.type === 'signatures').props;
assert.equal(view.signatures.length, 25);
assert.equal(view.pagination.total, 25);
assert.equal(view.pagination.page, 1);
assert.equal(view.filters.q, 'SIGNATAIRE Lyon');
assert.equal(currentWhere.petitionId, 'petition-a');
assert.equal(currentWhere.AND.length, 2);
assert.equal(currentWhere.AND[0].OR[0].name.mode, 'insensitive');
console.log('PASS: recherche serveur des signataires, critères transmis et pagination recalée.');
console.log('PASS: compteurs complets, seuil 500/501 sans envoi partiel, audience vide, sélection explicite et permissions.');
