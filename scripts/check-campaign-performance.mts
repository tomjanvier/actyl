import assert from 'node:assert/strict';
import { db } from '../lib/db';
const workspace = await db.workspace.findFirst({ where: { memberships: { some: {} } }, orderBy: { createdAt: 'asc' }, select: { id: true } });
if (!workspace)
    throw new Error('No workspace');
const where = { OR: [{ workspaceId: workspace.id }, { shares: { some: { workspaceId: workspace.id } } }] };
const include = { squads: { include: { group: { select: { name: true, color: true } } } }, _count: { select: { cards: true, blasts: true, templates: true } }, workspace: { select: { id: true, name: true } }, shares: { where: { workspaceId: workspace.id }, select: { access: true, pinned: true } } };
async function before() {
    const campaigns = await db.campaign.findMany({ where, orderBy: { createdAt: 'desc' }, include });
    const groups = campaigns.length ? await db.kanbanCard.groupBy({ by: ['campaignId', 'stageId'], where: { campaignId: { in: campaigns.map(c => c.id) } }, _count: { _all: true } }) : [];
    const stages = groups.length ? await db.pipelineStage.findMany({ where: { id: { in: [...new Set(groups.map(g => g.stageId))] } }, select: { id: true, kind: true } }) : [];
    return campaigns.map(c => ({ id: c.id, stats: groups.filter(g => g.campaignId === c.id).reduce((a, g) => { const k = stages.find(s => s.id === g.stageId)?.kind; a.total += g._count._all; if (k === 'WON')
            a.won += g._count._all; if (k === 'WON' || k === 'POSITIVE')
            a.allies += g._count._all; if (k === 'NEGATIVE')
            a.opponents += g._count._all; return a; }, { total: 0, won: 0, allies: 0, opponents: 0 }) }));
}
async function after() {
    const campaigns = await db.campaign.findMany({ where, orderBy: { createdAt: 'desc' }, include: { ...include, stages: { select: { kind: true, _count: { select: { cards: true } } } } } });
    return campaigns.map(c => ({ id: c.id, stats: c.stages.reduce((a, s) => { const n = s._count.cards; a.total += n; if (s.kind === 'WON')
            a.won += n; if (s.kind === 'WON' || s.kind === 'POSITIVE')
            a.allies += n; if (s.kind === 'NEGATIVE')
            a.opponents += n; return a; }, { total: 0, won: 0, allies: 0, opponents: 0 }) }));
}
const timings = { before: [] as number[], after: [] as number[] };
assert.deepEqual(await before(), await after());
for (let i = 0; i < 5; i++) {
    for (const key of (i % 2 ? ['after', 'before'] : ['before', 'after']) as ('before' | 'after')[]) {
        const start = performance.now();
        await (key === 'before' ? before() : after());
        timings[key].push(Math.round(performance.now() - start));
    }
}
const campaign = await db.campaign.findFirst({ where, select: { id: true, workspaceId: true } });
const contacts = campaign ? await db.contact.findMany({ where: { workspaceId: campaign.workspaceId, NOT: { cards: { some: { campaignId: campaign.id } } } }, orderBy: { lastName: 'asc' }, select: { id: true, firstName: true, lastName: true, title: true, institution: true, party: true, avatarColor: true }, take: 300 }) : [];
console.log(JSON.stringify({ timings, statsEqual: true, initialContactRowsBefore: contacts.length, initialContactJsonBytesBefore: Buffer.byteLength(JSON.stringify(contacts)), initialContactRowsAfter: 0 }));
await db.$disconnect();
