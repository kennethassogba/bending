import { companies } from '../src/companies.js';

const ids = new Set(companies.map(company => company.id));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (value, status = 200, headers = {}) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});

export function makePairs(random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32, catalog = 2) {
  const pool = catalog === 2 ? [...ids] : [...ids].slice(0, 12);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: 4 }, (_, i) => pool.slice(i * 2, i * 2 + 2));
}

async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Error('json');
  if (Number(request.headers.get('Content-Length')) > 1024) throw new Error('size');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('json');
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1024) throw new Error('size');
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(data));
}

export async function handleBending(request, env) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/\/$/, '');
  const db = env.UPDATES_DB;
  if (!db) return reply({ error: 'Voting is unavailable. Please try again shortly.' }, 503);

  if (request.method === 'POST') {
    if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      return reply({ error: 'Please vote from the game.' }, 403);
    }
  }

  if (route === '/bending/api/round' && request.method === 'POST') {
    let input;
    try { input = await body(request); }
    catch { return reply({ error: 'Could not start a round. Please try again.' }, 400); }
    const id = crypto.randomUUID();
    // Existing installed clients only know the original 12 logos and names.
    const pairs = makePairs(undefined, input?.catalog === 2 ? 2 : 1);
    await db.prepare('INSERT INTO bending_rounds(id,pairs,created_at) VALUES(?,?,?)')
      .bind(id, JSON.stringify(pairs), Date.now()).run();
    return reply({ id, pairs, votes: [] }, 201);
  }

  if (route === '/bending/api/round' && request.method === 'GET') {
    const id = url.searchParams.get('id');
    if (!uuid.test(id || '')) return reply({ error: 'Round not found. Start a new round.' }, 404);
    const round = await db.prepare('SELECT id,pairs,created_at FROM bending_rounds WHERE id=?').bind(id).first();
    if (!round || round.created_at < Date.now() - 86400000) return reply({ error: 'This round expired. Start a new round.' }, 410);
    const votes = await db.prepare('SELECT duel,winner,loser,delta FROM bending_votes WHERE round_id=? ORDER BY duel').bind(id).all();
    return reply({ id, pairs: JSON.parse(round.pairs), votes: votes.results });
  }

  if (route === '/bending/api/vote' && request.method === 'POST') {
    let input;
    try { input = await body(request); }
    catch { return reply({ error: 'Invalid vote. Please try again.' }, 400); }
    const { roundId, duel, winner } = input || {};
    if (!uuid.test(roundId || '') || !Number.isInteger(duel) || duel < 0 || duel > 3 || !ids.has(winner)) {
      return reply({ error: 'Invalid vote. Please try again.' }, 400);
    }
    const round = await db.prepare('SELECT pairs,created_at FROM bending_rounds WHERE id=?').bind(roundId).first();
    if (!round || round.created_at < Date.now() - 86400000) return reply({ error: 'This round expired. Start a new round.' }, 410);
    const pair = JSON.parse(round.pairs)[duel];
    if (!pair.includes(winner)) return reply({ error: 'Choose one of the two companies shown.' }, 400);
    const loser = pair.find(id => id !== winner);
    await db.prepare(`INSERT INTO bending_votes(round_id,duel,winner,loser,created_at)
      SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM bending_votes WHERE round_id=?)=?
      ON CONFLICT(round_id,duel) DO NOTHING`)
      .bind(roundId, duel, winner, loser, Date.now(), roundId, duel).run();
    const vote = await db.prepare('SELECT duel,winner,loser,delta FROM bending_votes WHERE round_id=? AND duel=?').bind(roundId, duel).first();
    if (!vote) return reply({ error: 'Finish the previous duel first.' }, 409);
    if (vote.winner !== winner) return reply({ error: 'This duel already has a different vote. Reload to continue.' }, 409);
    return reply({ saved: true, vote });
  }

  if (route === '/bending/api/decision' && request.method === 'POST') {
    let input;
    try { input = await body(request); }
    catch { return reply({ error: 'Invalid duel.' }, 400); }
    const { roundId, duel } = input || {};
    if (!uuid.test(roundId || '') || !Number.isInteger(duel) || duel < 0 || duel > 3) return reply({ error: 'Invalid duel.' }, 400);
    const round = await db.prepare('SELECT pairs,created_at FROM bending_rounds WHERE id=?').bind(roundId).first();
    if (!round || round.created_at < Date.now() - 86400000) return reply({ error: 'This round expired. Start a new round.' }, 410);
    const human = await db.prepare('SELECT 1 FROM bending_votes WHERE round_id=? AND duel=?').bind(roundId, duel).first();
    if (!human) return reply({ error: 'Vote first to reveal Luna\'s pick.' }, 409);
    const previous = await db.prepare('SELECT winner,loser,delta FROM bending_luna_votes WHERE round_id=? AND duel=?').bind(roundId, duel).first();
    if (previous) return reply({ vote: previous });
    if (!env.OPENAI_API_KEY) return reply({ error: 'Luna is unavailable. Try again.' }, 503);

    // One in-flight call per duel. A failed request releases its lease for retry.
    const token = crypto.randomUUID();
    const now = Date.now();
    const lease = await db.prepare(`INSERT INTO bending_luna_requests(round_id,duel,token,expires_at) VALUES(?,?,?,?)
      ON CONFLICT(round_id,duel) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at
      WHERE bending_luna_requests.expires_at<? RETURNING token`)
      .bind(roundId, duel, token, now + 20000, now).first();
    if (!lease) return reply({ pending: true }, 202, { 'Retry-After': '1' });
    try {
      // A concurrent caller may have completed between our first read and lease.
      const saved = await db.prepare('SELECT winner,loser,delta FROM bending_luna_votes WHERE round_id=? AND duel=?').bind(roundId, duel).first();
      if (saved) return reply({ vote: saved });
      const pair = JSON.parse(round.pairs)[duel];
      const candidates = pair.map(id => companies.find(company => company.id === id));
      const response = await fetch('https://api.openai.com/v1/decisions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-6-luna',
          input: `Date: ${new Date().toISOString().slice(0, 10)}. Candidates: ${candidates.map(company => company.name).join(' vs ')}. Bending Spoons buys established software businesses. Past acquisitions include Evernote, Meetup, WeTransfer, StreamYard, Brightcove, Komoot, Vimeo and AOL.`,
          questions: [{ type: 'choice', name: 'acquisition',
            instructions: 'Which candidate is more likely to be acquired by Bending Spoons next? Make a speculative game pick using business fit, product maturity, recurring revenue and acquisition feasibility. Choose exactly one of the two candidates. You have no live news or private deal information.',
            choices: candidates.map(company => ({ value: company.id, description: company.name })),
          }],
        }),
        signal: AbortSignal.timeout(9000),
      });
      if (!response.ok) throw new Error('provider');
      const data = await response.json();
      const answer = data.answers?.find(item => item.name === 'acquisition' && item.type === 'choice');
      if (!pair.includes(answer?.choice)) throw new Error('answer');
      const winner = answer.choice;
      const loser = pair.find(id => id !== winner);
      await db.prepare(`INSERT INTO bending_luna_votes(round_id,duel,winner,loser,model,provider_id,created_at)
        SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM bending_luna_requests WHERE round_id=? AND duel=? AND token=?)
        ON CONFLICT(round_id,duel) DO NOTHING`)
        .bind(roundId, duel, winner, loser, 'gpt-6-luna', typeof data.id === 'string' ? data.id : null, Date.now(), roundId, duel, token).run();
      const vote = await db.prepare('SELECT winner,loser,delta FROM bending_luna_votes WHERE round_id=? AND duel=?').bind(roundId, duel).first();
      if (!vote) throw new Error('lease');
      return reply({ vote });
    } catch {
      return reply({ error: 'Luna is unavailable. Try again.' }, 503);
    } finally {
      await db.prepare('DELETE FROM bending_luna_requests WHERE round_id=? AND duel=? AND token=?').bind(roundId, duel, token).run();
    }
  }

  if (route === '/bending/api/leaderboard' && request.method === 'GET') {
    const board = await db.prepare('SELECT id,rating,matches,wins FROM bending_companies ORDER BY rating DESC,wins DESC,id').all();
    const luna = await db.prepare('SELECT id,rating,matches,wins FROM bending_luna_companies ORDER BY rating DESC,wins DESC,id').all();
    return reply({ companies: board.results, votes: board.results.reduce((sum, item) => sum + item.matches, 0) / 2,
      luna: { companies: luna.results, votes: luna.results.reduce((sum, item) => sum + item.matches, 0) / 2 } });
  }
  return reply({ error: 'Route not found.' }, 404);
}
