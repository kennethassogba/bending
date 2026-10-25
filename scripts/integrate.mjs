import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const host = resolve(process.argv[2] || '../keff.uk');
await mkdir(`${host}/public/bending`, { recursive: true });
await cp('dist', `${host}/public/bending`, { recursive: true });
await mkdir(`${host}/worker/bending`, { recursive: true });
await writeFile(`${host}/worker/bending/api.js`, (await readFile('worker/api.js', 'utf8')).replace("'../src/companies.js'", "'./companies.js'"));
await cp('src/companies.js', `${host}/worker/bending/companies.js`);
await cp('migrations/0007_bending.sql', `${host}/migrations/0007_bending.sql`);
console.log(`Copied assets, API and migration to ${host}. See README for the host route and binding.`);
