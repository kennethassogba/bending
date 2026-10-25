import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { companies } from '../src/companies.js';

await mkdir('dist', { recursive: true });
await cp('src', 'dist', { recursive: true });
const paths = ['index.html', 'app.js', 'style.css', 'spoon.js', 'companies.js'];
const version = createHash('sha256');
for (const path of paths) version.update(await readFile(`src/${path}`));
const hash = version.digest('hex').slice(0, 12);
const sw = (await readFile('src/sw.js', 'utf8')).replace('__VERSION__', hash)
  .replace('__LOGOS__', JSON.stringify(companies.map(company => `/bending/logos/${company.icon}.svg`)));
await writeFile('dist/sw.js', sw);
console.log(`Built Get Bent (${hash}).`);
