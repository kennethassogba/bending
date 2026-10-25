# Get Bent

[Play at keff.uk/bending](https://keff.uk/bending/).

Which company will Bending Spoons buy next? Vote in four head-to-head duels. The selected company's spoon bends, then the next duel appears. The shared Elo leaderboard appears after the fourth saved vote.

English only, mobile first, installable as a standalone PWA. No account, runtime framework, third-party requests or model API. The spoon is an SVG mesh animated with `requestAnimationFrame`; reduced motion shows the final bent shape without movement. Sound is optional and generated locally.

## Local development

Requires Node.js 22 or newer.

```sh
npm ci
npm run build
npm test
npm run dev
```

Open `http://127.0.0.1:8788/bending/`. The local server uses Miniflare with a local D1 database. It never writes to production.

## Voting

- Four randomly sampled pairs, eight unique companies per round. Scores stay hidden during voting.
- Every company starts at 1,500 Elo. The standard logistic Elo update uses K = 32.
- A SQLite trigger calculates and applies the rating change atomically, using the current ratings. Concurrent votes cannot overwrite one another.
- A unique `(round_id, duel)` key makes retries idempotent. A conflicting retry is rejected. Duels must be completed in order.
- Unplayed companies are unranked. The leaderboard shows both Elo and duel count. Scores represent community guesses, not acquisition probabilities.
- Round tokens are random UUIDs, stored on the device to resume an interrupted round, and expire after 24 hours. There are no personal profiles, analytics scripts or advertising identifiers.
- Production limits write requests to 36 per minute per Cloudflare IP key. This is lightweight abuse resistance, not proof of one human per vote. Round tokens are bearer credentials; do not share them.
- Offline, the installed app can open its cached shell. Votes require a connection and remain on the same duel until saved. API responses are never cached. No fake offline leaderboard or unconfirmed vote is displayed.

## Production integration

The public source is independent of the private portfolio repository. The game is mounted in the existing `keff-uk` Worker, at `/bending/`, using its D1 `UPDATES_DB` binding. This avoids a second Worker or a new database.

```sh
npm run build
npm run integrate -- /path/to/keff.uk
```

The integration script copies `dist/` to `public/bending/`, the API and company catalog to `worker/bending/`, and the additive schema to `migrations/0007_bending.sql`. It does not deploy or modify the host's existing routes. The host imports `handleBending` from `./bending/api.js` and delegates `/bending/api/*` to it. `/bending` redirects to `/bending/`. The service worker is scoped to `/bending/`, and does not control the rest of the domain.

Apply only the game schema against the host database with the host's installed Wrangler CLI:

```sh
wrangler d1 execute keff-updates --remote --file migrations/0007_bending.sql
```

This file is idempotent and only adds tables prefixed `bending_`. Do not apply unrelated pending portfolio migrations as part of this deployment. Build, test and deploy the host through its existing workflow. Game assets are tracked in the host, so its usual build preserves them. Subsequent game releases repeat the integration step and commit the copied assets with the host change.

## Checks

`npm test` exercises actual Workers/D1 runtime behavior: four saved duels, resume, Elo conservation, duplicate requests, concurrent Elo updates, forged votes, origin checks, body limits, expiration, rate limiting and PWA configuration. Browser checks cover mobile layout, the full round, animation, keyboard input, offline recovery and reduced motion.

## Companies and assets

The candidate list is a meme, not a report of acquisition talks. Known Bending Spoons acquisitions and announced deals are excluded from the candidate pool. Review `src/companies.js` when ownership changes. Portfolio reference: [Bending Spoons](https://www.bendingspoons.com/), reviewed October 25, 2026. No automatic acquisition feed is claimed.

Company marks come from [Simple Icons](https://simpleicons.org/) (CC0), rendered in a single brand color. Canva uses Simple Icons 11.15.0; the other marks were retrieved from the upstream catalog on October 25, 2026. Brand names and marks belong to their respective owners. Get Bent is not affiliated with Bending Spoons or the featured companies. Inter is licensed under the SIL Open Font License, included in `src/FONT-LICENSE.txt`.

Application source: MIT.
