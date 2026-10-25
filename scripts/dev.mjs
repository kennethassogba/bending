import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: ['worker/dev.js', 'worker/api.js', 'src/companies.js'].map(path => ({ type: 'ESModule', path })), modulesRoot: '.',
  compatibilityDate: '2026-10-08', port: 8788, host: '127.0.0.1',
  bindings: process.env.OPENAI_API_KEY ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY } : {},
  d1Databases: ['UPDATES_DB'], d1Persist: '.wrangler/state/d1',
  assets: { directory: 'dist', binding: 'ASSETS', routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true } },
}));
const db = await mf.getD1Database('UPDATES_DB');
const sql = await readFile('migrations/0007_bending.sql', 'utf8');
// D1 exec splits multi-line triggers; prepare each complete SQL statement instead.
const triggerAt = sql.indexOf('CREATE TRIGGER');
await db.exec(sql.slice(0, triggerAt).replace(/--[^\n]*/g, '').replace(/\n/g, ' '));
await db.prepare(sql.slice(triggerAt)).run();
await db.exec((await readFile('migrations/0008_bending_startups.sql', 'utf8')).replace(/--[^\n]*/g, '').replace(/\n/g, ' '));
const luna = await readFile('migrations/0009_bending_luna.sql', 'utf8');
const lunaTrigger = luna.indexOf('CREATE TRIGGER');
await db.exec(luna.slice(0, lunaTrigger).replace(/--[^\n]*/g, '').replace(/\n/g, ' '));
await db.prepare(luna.slice(lunaTrigger)).run();
console.log(`Get Bent: ${await mf.ready}/bending/`);
process.on('SIGINT', async () => { await mf.dispose(); process.exit(0); });
