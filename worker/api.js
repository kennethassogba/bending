import { companies } from '../src/companies.js';

const ids = new Set(companies.map(company => company.id));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (value, status = 200, headers = {}) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});

export function makePairs(random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) {
  const pool = [...ids];
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
    if (env.BENDING_LIMITER) {
      const { success } = await env.BENDING_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'local' });
      if (!success) return reply({ error: 'Too many requests. Try again in a minute.' }, 429, { 'Retry-After': '60' });
    }
  }

  if (route === '/bending/api/round' && request.method === 'POST') {
    const id = crypto.randomUUID();
    const pairs = makePairs();
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

  if (route === '/bending/api/leaderboard' && request.method === 'GET') {
    const board = await db.prepare('SELECT id,rating,matches,wins FROM bending_companies ORDER BY rating DESC,wins DESC,id').all();
    return reply({ companies: board.results, votes: board.results.reduce((sum, item) => sum + item.matches, 0) / 2 });
  }
  return reply({ error: 'Route not found.' }, 404);
}
