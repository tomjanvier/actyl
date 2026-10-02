// Pure route checks: no database writes, no network, no credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function loadRoute(path, mocks) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  }, URLSearchParams, Response });
  return exports;
}
const next = { NextResponse: { json: (data, options) => Response.json(data, options) } };
const request = q => ({ nextUrl: { searchParams: new URLSearchParams(q) } });
const params = { params: Promise.resolve({ id: 'list-a' }) };
(async () => {
  let published = true;
  let reads = 0;
  const publicRoute = loadRoute('app/api/public/lists/[id]/route.ts', {
    'next/server': next,
    '@/lib/utils': { toCSV: () => '' },
    '@/lib/public-directory': {
      getPublishedList: async () => published ? { id: 'list-a' } : null,
      getDirectoryPage: async () => { reads++; return { rows: [{ id: 'cached-public-contact' }], total: 1 }; },
      getDirectoryExport: async () => { reads++; return []; },
    },
  });
  assert.equal((await publicRoute.GET(request('page=1'), params)).status, 200);
  published = false;
  const denied = await publicRoute.GET(request('page=1'), params);
  assert.equal(denied.status, 404);
  assert.equal(denied.headers.get('cache-control'), 'no-store');
  assert.equal((await publicRoute.GET(request('format=csv'), params)).status, 404);
  assert.equal(reads, 1, 'Revocation must gate cached rows and exports');
  assert.equal((await publicRoute.GET(request('page=NaN'), params)).status, 400);
  assert.equal((await publicRoute.GET(request('q=' + 'a'.repeat(101)), params)).status, 400);

  let session = null;
  let list = null;
  let allowed = true;
  const privateRoute = loadRoute('app/api/lists/[id]/available-contacts/route.ts', {
    'next/server': next,
    '@/lib/auth': { getSession: async () => session },
    '@/lib/constants': { can: () => allowed },
    '@/lib/db': { db: {
      sharedList: { findFirst: async ({ where }) => { assert.equal(where.workspaceId, 'workspace-a'); return list; } },
      contact: { findMany: async ({ where, take }) => {
        assert.equal(where.workspaceId, 'workspace-a'); assert.equal(where.listItems.none.listId, 'list-a'); assert.equal(take, 51);
        return Array.from({ length: 51 }, (_, i) => ({ id: String(i) }));
      } },
    } },
  });
  const anon = await privateRoute.GET(request(''), params);
  assert.equal(anon.status, 401);
  assert.equal(anon.headers.get('cache-control'), 'private, no-store');
  session = { workspaceId: 'workspace-a', user: { id: 'user-a' }, role: 'ADMIN' };
  assert.equal((await privateRoute.GET(request(''), params)).status, 404);
  list = { createdById: 'user-a', sourcePack: null };
  allowed = false;
  assert.equal((await privateRoute.GET(request(''), params)).status, 403);
  allowed = true;
  const result = await (await privateRoute.GET(request(''), params)).json();
  assert.equal(result.rows.length, 50); assert.equal(result.hasMore, true);
  console.log('PASS: publication revoked after cache hit, CSV gate, invalid input, authentication, workspace scope, permission and private pagination.');
})().catch(error => { console.error(error); process.exitCode = 1; });
