import assert from 'node:assert/strict';
// Read-only integration checks against a running build or deployment.
const base = process.argv[2] || 'http://localhost:3099';
let html;
for(let i=0;i<3;i++){
 const start=performance.now();const r=await fetch(base);const ttfb=performance.now()-start;html=await r.text();console.log(JSON.stringify({test:'landing',ttfb:Math.round(ttfb),totalMs:Math.round(performance.now()-start),bytes:Buffer.byteLength(html),status:r.status}));
}
const match=html.match(/\\"listId\\":\\"([^\\]+)\\"/);
assert.ok(match,'public list ID rendered');const id=match[1];
const api=path=>fetch(`${base}/api/public/lists/${id}${path}`);
const r=await api('?page=1');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const a=await r.json();assert.equal(a.rows.length,10);assert.ok(a.total>10);assert.ok(a.parties.length>1);assert.ok(!('email' in a.rows[0]));assert.ok(!('phone' in a.rows[0]));
const b=await (await api('?page=2')).json();assert.equal(b.rows.length,10);assert.ok(!b.rows.some(row=>a.rows.some(first=>row.id===first.id)));
const q=a.rows[0].lastName;const filtered=await (await api(`?q=${encodeURIComponent(q)}`)).json();assert.ok(filtered.rows.some(row=>row.id===a.rows[0].id));
const empty=await (await api('?q=zzzznosuchperson99999')).json();assert.equal(empty.total,0);assert.equal(empty.rows.length,0);
assert.equal((await api('?page=-1')).status,400);assert.equal((await api('?pageSize=10000')).status,400);
assert.equal((await fetch(`${base}/api/public/lists/nonexistent`)).status,404);
const csvResponse=await api('?format=csv');assert.equal(csvResponse.status,200);assert.equal(csvResponse.headers.get('cache-control'),'no-store');const csv=await csvResponse.text();assert.ok(csv.split('\n').length>=a.total+1);
const privatePage=await fetch(`${base}/contacts`,{redirect:'manual'});assert.equal(privatePage.status,307);
console.log(JSON.stringify({test:'pagination, search, empty, validation, missing list, export, private redirect',result:'PASS',total:a.total,exportLines:csv.split('\n').length}));

const privateApi = await fetch(`${base}/api/lists/${id}/available-contacts`);
assert.equal(privateApi.status, 401);
assert.equal(privateApi.headers.get("cache-control"), "private, no-store");
console.log("Private contact lookup: anonymous access refused, no shared cache — PASS");
