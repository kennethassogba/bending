import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { makePairs, handleBending } from '../worker/api.js';
import { companies } from '../src/companies.js';

let mf, db;
before(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: ['worker/dev.js', 'worker/api.js', 'src/companies.js'].map(path => ({ type: 'ESModule', path })), modulesRoot: '.', compatibilityDate: '2026-10-08', d1Databases: ['UPDATES_DB'], assets: { directory: 'dist', binding: 'ASSETS', routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true } } }));
  db = await mf.getD1Database('UPDATES_DB');
  const sql = await readFile('migrations/0007_bending.sql', 'utf8');
  const at = sql.indexOf('CREATE TRIGGER');
  await db.exec(sql.slice(0, at).replace(/--[^\n]*/g, '').replace(/\n/g, ' '));
  await db.prepare(sql.slice(at)).run();
  await db.exec((await readFile('migrations/0008_bending_startups.sql', 'utf8')).replace(/--[^\n]*/g, '').replace(/\n/g, ' '));
});
after(async () => { await mf?.dispose(); });
const request = async (path, data, headers = {}) => {
  // The local bridge may close a rejected upload; do not reuse its HTTP socket.
  const response = await mf.dispatchFetch(`http://localhost/bending/api/${path}`, data === undefined ? { headers: { Connection: 'close' } } : { method: 'POST', headers: { Connection: 'close', Origin: 'http://localhost', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
  // Fully consume the local HTTP response even in tests that only inspect status.
  return new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers });
};
const create = async () => (await request('round', { catalog: 2 })).json();
const vote = (round, duel, winner = round.pairs[duel][0]) => request('vote', { roundId: round.id, duel, winner });

test('a round has four distinct matchups and eight unique companies', () => {
  for (let i = 0; i < 100; i++) {
    const pairs = makePairs();
    assert.equal(pairs.length, 4);
    assert.equal(new Set(pairs.flat()).size, 8);
  }
});

test('expanded catalog has logos and preserves compatibility with installed clients', async () => {
  assert.equal(companies.length, 40);
  assert.equal(new Set(companies.map(company => company.id)).size, 40);
  for (const company of companies) assert.ok((await readFile(`src/logos/${company.icon}.svg`, 'utf8')).includes('<svg'));
  const old = await (await request('round', {})).json();
  const legacy = new Set(companies.slice(0, 12).map(company => company.id));
  assert.ok(old.pairs.flat().every(id => legacy.has(id)));
  const before = await db.prepare('SELECT SUM(rating) AS rating,SUM(matches) AS matches FROM bending_companies').first();
  await db.exec((await readFile('migrations/0008_bending_startups.sql', 'utf8')).replace(/--[^\n]*/g, '').replace(/\n/g, ' '));
  assert.deepEqual(await db.prepare('SELECT SUM(rating) AS rating,SUM(matches) AS matches FROM bending_companies').first(), before);
});

test('four votes persist, resume correctly, and conserve Elo', async () => {
  const round = await create();
  assert.equal((await vote(round, 1)).status, 409);
  for (let i = 0; i < 4; i++) {
    const response = await vote(round, i);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).saved, true);
  }
  const resumed = await (await request(`round?id=${round.id}`)).json();
  assert.deepEqual(resumed.pairs, round.pairs);
  assert.equal(resumed.votes.length, 4);
  const board = await (await request('leaderboard')).json();
  assert.equal(board.votes, 4);
  assert.equal(board.companies.reduce((sum, item) => sum + item.matches, 0), 8);
  assert.equal(board.companies.length, companies.length);
  assert.equal(board.companies.reduce((sum, item) => sum + item.rating, 0), companies.length * 1500);
  const winner = board.companies.find(item => item.id === round.pairs[0][0]);
  assert.equal(winner.rating, 1516);
});

test('concurrent retries apply a vote once and conflicting retries are rejected', async () => {
  const round = await create();
  const responses = await Promise.all(Array.from({ length: 8 }, () => vote(round, 0)));
  assert.ok(responses.every(response => response.status === 200));
  const resumed = await (await request(`round?id=${round.id}`)).json();
  assert.equal(resumed.votes.length, 1);
  assert.equal((await vote(round, 0, round.pairs[0][1])).status, 409);
});

test('concurrent duels update from the latest ratings inside the SQL trigger', async () => {
  const pair = [['notion', 'discord'], ['dropbox', 'medium'], ['figma', 'zoom'], ['strava', 'canva']];
  const a = { id: crypto.randomUUID(), pairs: pair }, b = { id: crypto.randomUUID(), pairs: pair };
  await db.prepare('UPDATE bending_companies SET rating=1500 WHERE id IN (?,?)').bind('notion', 'discord').run();
  for (const round of [a, b]) await db.prepare('INSERT INTO bending_rounds(id,pairs,created_at) VALUES(?,?,?)').bind(round.id, JSON.stringify(pair), Date.now()).run();
  const responses = await Promise.all([vote(a, 0), vote(b, 0)]);
  assert.ok(responses.every(response => response.status === 200));
  const winner = await db.prepare('SELECT rating FROM bending_companies WHERE id=?').bind('notion').first();
  const expected = 1516 + 32 * (1 - 1 / (1 + 10 ** ((1484 - 1516) / 400)));
  assert.ok(Math.abs(winner.rating - expected) < 1e-9);
});

test('forged company, round, origin, invalid and oversized votes do not count', async () => {
  const round = await create();
  assert.equal((await request('vote', { roundId: round.id, duel: 0, winner: 'evernote' })).status, 400);
  const other = makePairs().flat().find(id => !round.pairs[0].includes(id));
  assert.equal((await request('vote', { roundId: round.id, duel: 0, winner: other })).status, 400);
  assert.equal((await request('round', {}, { Origin: 'https://evil.example' })).status, 403);
  // Test early rejection at the handler boundary: Miniflare's HTTP bridge can
  // reset a socket while rejecting a not-yet-finished oversized upload.
  const oversized = JSON.stringify({ data: 'x'.repeat(2000) });
  const rejected = await handleBending(new Request('http://localhost/bending/api/vote', {
    method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', 'Content-Length': String(oversized.length) }, body: oversized,
  }), { UPDATES_DB: db });
  assert.equal(rejected.status, 400);
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('x'.repeat(700)));
    controller.enqueue(new TextEncoder().encode('x'.repeat(700)));
    controller.close();
  } });
  const streamed = await handleBending(new Request('http://localhost/bending/api/vote', {
    method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: stream, duplex: 'half',
  }), { UPDATES_DB: db });
  assert.equal(streamed.status, 400);
  assert.equal((await request('vote', { roundId: crypto.randomUUID(), duel: 0, winner: 'notion' })).status, 410);
  assert.equal((await request('round?id=not-an-id')).status, 404);
  assert.equal((await request('vote', null)).status, 400);
  const resumed = await (await request(`round?id=${round.id}`)).json();
  assert.equal(resumed.votes.length, 0);
});

test('expired rounds reject votes and rate limiting returns a recoverable 429', async () => {
  const round = await create();
  await db.prepare('UPDATE bending_rounds SET created_at=0 WHERE id=?').bind(round.id).run();
  assert.equal((await vote(round, 0)).status, 410);
  assert.equal((await request(`round?id=${round.id}`)).status, 410);
  const response = await handleBending(new Request('http://localhost/bending/api/round', { method: 'POST', headers: { Origin: 'http://localhost' } }), { UPDATES_DB: db, BENDING_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
});

test('PWA assets exist and APIs opt out of caching', async () => {
  const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.scope, '/bending/');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) assert.ok((await readFile(`dist/${icon.src.split('/').at(-1)}`)).length > 500);
  assert.equal((await request('leaderboard')).headers.get('Cache-Control'), 'no-store');
  const sw = await readFile('dist/sw.js', 'utf8');
  assert.ok(!sw.includes('__VERSION__'));
  assert.ok(sw.includes("url.pathname.startsWith('/bending/api/')"));
});
