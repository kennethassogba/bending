import { companies, byId } from './companies.js';
import { spoon, bendSpoon } from './spoon.js';

const main = document.querySelector('main');
const announcer = document.querySelector('#announcer');
const key = 'get-bent-round-v1';
let round = null;
let pending = false;
let chosen = null;
let view = 'home';
let epoch = 0;
let audio = null;
let sound = false;
let installEvent = null;
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
const shareIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2"/></svg>';
const store = {
  get(name) { try { return localStorage.getItem(name); } catch { return null; } },
  set(name, value) { try { localStorage.setItem(name, value); } catch { /* Private browsing can disable storage. */ } },
  remove(name) { try { localStorage.removeItem(name); } catch { /* The in-memory round still works. */ } },
};
sound = store.get('get-bent-sound') === 'on';

function say(text) { announcer.textContent = text; }
function focusMain() { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

async function api(path, options = {}) {
  if (!navigator.onLine) throw new Error('You are offline. Reconnect to save your vote.');
  let response;
  try {
    response = await fetch(`/bending/api/${path}`, {
      ...options, headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(12000),
    });
  } catch { throw new Error('Could not connect. Check your connection and try again.'); }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('Voting is unavailable. Please try again shortly.'); }
  if (!response.ok) {
    const error = new Error(data.error || 'Could not save your vote. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function updateSound() {
  const button = document.querySelector('#sound');
  button.setAttribute('aria-label', sound ? 'Turn sound off' : 'Turn sound on');
  button.setAttribute('aria-pressed', String(sound));
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z${sound ? 'M15 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14' : 'M16 9l5 6m0-6-5 6'}"/></svg>`;
}
function plink() {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
    for (const [frequency, gain] of [[880, .045], [1830, .025], [2910, .012]]) {
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(frequency, audio.currentTime);
      tone.frequency.exponentialRampToValueAtTime(frequency * .72, audio.currentTime + .25);
      volume.gain.setValueAtTime(gain, audio.currentTime);
      volume.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .4);
      tone.connect(volume).connect(audio.destination);
      tone.start(); tone.stop(audio.currentTime + .42);
    }
  } catch { /* Audio is optional. */ }
}
document.querySelector('#sound').addEventListener('click', () => {
  sound = !sound; store.set('get-bent-sound', sound ? 'on' : 'off'); updateSound(); if (sound) plink();
});
updateSound();

function showHome() {
  epoch++; view = 'home'; pending = false; chosen = null;
  const resume = !!store.get(key);
  main.innerHTML = `<section class="home" aria-labelledby="home-title">
    <h1 id="home-title">Who's getting<br>bent?</h1>
    <p class="intro">Which company will <strong>Bending Spoons</strong> buy next?</p>
    <div class="home-art" aria-hidden="true"><span class="stamp">BENT</span></div>
    <div class="home-actions"><button class="primary" id="start">${resume ? 'Continue round' : 'Pick the next acquisition'}${arrow}</button>
      <p class="action-note">4 duels. Pick one company each time.</p><p id="home-error" class="error" role="alert" hidden></p></div>
  </section>`;
  const art = main.querySelector('.home-art');
  art.prepend(spoon(byId.notion), spoon(byId.discord, 1));
  main.querySelector('#start').addEventListener('click', start);
}

async function start() {
  if (pending) return;
  pending = true;
  const ticket = epoch;
  const button = main.querySelector('#start');
  button.disabled = true; button.textContent = 'Getting the spoons...';
  main.querySelector('#home-error').hidden = true;
  try {
    const saved = store.get(key);
    if (saved) {
      try { round = await api(`round?id=${encodeURIComponent(saved)}`); }
      catch (error) {
        if (![404, 410].includes(error.status)) throw error;
        store.remove(key); round = null;
      }
    }
    if (!saved || !round) round = await api('round', { method: 'POST', body: '{}' });
    if (ticket !== epoch) return;
    store.set(key, round.id); pending = false;
    if (round.votes.length === 4) { store.remove(key); await showResults(); }
    else { showDuel(); focusMain(); }
  } catch (error) {
    if (ticket !== epoch) return;
    pending = false; button.disabled = false; button.innerHTML = `Try again${arrow}`;
    const message = main.querySelector('#home-error');
    message.textContent = error.message; message.hidden = false;
  }
}

function showDuel() {
  epoch++; view = 'game'; pending = false; chosen = null;
  const duel = round.votes.length;
  const pair = round.pairs[duel];
  main.innerHTML = `<section class="game" aria-labelledby="duel-title">
    <div class="round-top"><span class="round-count"><strong>${String(duel + 1).padStart(2, '0')}</strong> / 04</span>
    <div class="progress" role="progressbar" aria-label="Duels completed" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${duel}">${Array.from({ length: 4 }, (_, i) => `<span class="${i < duel ? 'done' : i === duel ? 'current' : ''}"></span>`).join('')}</div></div>
    <h1 id="duel-title">Who's getting bent?</h1>
    <p class="question">More likely to be bought by Bending Spoons?</p>
    <div class="duel"><span class="vs" aria-hidden="true">OR</span></div>
    <p class="duel-caption">Tap a spoon. Seal its fate.</p>
    <div class="game-status" role="status" aria-live="polite"></div>
  </section>`;
  const targets = main.querySelector('.duel');
  pair.forEach((id, i) => {
    const company = byId[id];
    const button = node('button', 'choice');
    button.dataset.company = id;
    button.setAttribute('aria-label', `Vote for ${company.name}`);
    button.setAttribute('aria-keyshortcuts', String(i + 1));
    const stamp = node('span', 'stamp', 'BENT'); stamp.setAttribute('aria-hidden', 'true');
    const shortcut = node('span', 'key', String(i + 1)); shortcut.setAttribute('aria-hidden', 'true');
    button.append(spoon(company), stamp, node('span', 'choice-name', company.name), shortcut);
    button.addEventListener('click', () => vote(id));
    targets.append(button);
  });
  say(`Duel ${duel + 1} of 4. ${byId[pair[0]].name} or ${byId[pair[1]].name}?`);
}

async function vote(winner, retry = false) {
  if (view !== 'game' || pending || chosen && !retry) return;
  pending = true; chosen = winner;
  const ticket = epoch;
  const status = main.querySelector('.game-status');
  status.className = 'game-status'; status.textContent = 'Bending...';
  main.querySelectorAll('.choice').forEach(button => {
    button.disabled = true;
    button.classList.add(button.dataset.company === winner ? 'selected' : 'rejected');
  });
  const target = main.querySelector(`[data-company="${winner}"]`);
  const animation = retry ? Promise.resolve() : bendSpoon(target.querySelector('svg'));
  if (!retry) plink();
  try {
    const [data] = await Promise.all([
      api('vote', { method: 'POST', body: JSON.stringify({ roundId: round.id, duel: round.votes.length, winner }) }),
      animation,
      new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 1050)),
    ]);
    if (ticket !== epoch) return;
    round.votes.push(data.vote); pending = false;
    if (round.votes.length === 4) { store.remove(key); await showResults(); }
    else { showDuel(); focusMain(); }
  } catch (error) {
    await animation;
    if (ticket !== epoch) return;
    pending = false; status.className = 'game-status error'; status.textContent = error.message;
    const retryButton = node('button', 'text-action', error.status === 410 ? 'Start again' : error.status === 409 ? 'Reload round' : 'Retry vote');
    retryButton.addEventListener('click', () => {
      if (error.status === 410) { store.remove(key); round = null; showHome(); focusMain(); }
      else if (error.status === 409) { showHome(); start(); }
      else vote(winner, true);
    });
    status.append(retryButton); retryButton.focus({ preventScroll: true });
  }
}

async function showResults() {
  const ticket = ++epoch; view = 'results'; pending = false;
  main.innerHTML = '<p class="loading" role="status">Counting the bent spoons...</p>';
  focusMain();
  try {
    const data = await api('leaderboard');
    if (ticket !== epoch) return;
    const picks = new Set(round?.votes.map(vote => vote.winner) || []);
    const entries = data.companies.filter(item => byId[item.id]);
    main.innerHTML = `<section class="results" aria-labelledby="results-title">
      <p class="eyebrow">Your 4 votes are in</p>
      <h1 id="results-title">Next to get bent.</h1>
      <p class="intro">The crowd's picks for <strong>Bending Spoons' next acquisition.</strong></p>
      <div class="board-header" aria-hidden="true"><span>#</span><span>Company</span><span>Duels</span><span>Elo</span></div>
      <ol class="board" aria-label="Community Elo leaderboard"></ol>
      <details class="elo-details"><summary>How the ranking works</summary><p>Each vote is a head-to-head win. Beating a higher-rated company earns more Elo. Everyone starts at 1,500, with K = 32. Companies with no duels are unranked. Early rankings can move a lot.</p><p>These are community guesses, not acquisition probabilities. Your picks are marked below each company name.</p></details>
      <p class="results-status">${data.votes.toLocaleString('en-US')} ${data.votes === 1 ? 'vote' : 'votes'} cast</p>
      <div class="results-actions"><button class="primary" id="again">Bend some more${arrow}</button><button class="share" id="share" aria-label="Share Get Bent">${shareIcon}</button></div>
      <p class="results-status" id="share-status" role="status"></p>
    </section>`;
    let rank = 0;
    let previous = null;
    let position = 0;
    for (const item of [...entries.filter(item => item.matches > 0), ...entries.filter(item => item.matches === 0)]) {
      position++;
      const rating = Math.round(item.rating);
      if (rating !== previous) rank = position;
      previous = rating;
      const company = byId[item.id];
      const row = node('li', `board-row${item.matches ? '' : ' unranked'}`);
      const number = node('span', 'rank', item.matches ? String(rank).padStart(2, '0') : '·');
      const identity = node('span', 'board-company');
      const img = node('img'); img.src = `/bending/logos/${company.icon}.svg`; img.alt = ''; img.width = 23; img.height = 23;
      const name = node('span', 'board-name', company.name);
      if (picks.has(item.id)) name.append(node('span', 'your-pick', 'Your pick'));
      identity.append(img, name);
      const matches = node('span', 'match-count', String(item.matches)); matches.setAttribute('aria-label', `${item.matches} duels`);
      const score = node('span', 'rating', item.matches ? rating.toLocaleString('en-US') : 'N/A');
      score.setAttribute('aria-label', item.matches ? `${rating} Elo` : 'Unranked');
      row.append(number, identity, matches, score); main.querySelector('.board').append(row);
    }
    main.querySelector('#again').addEventListener('click', () => { round = null; showHome(); start(); });
    main.querySelector('#share').addEventListener('click', async () => {
      const top = entries.find(item => item.matches > 0);
      const share = { title: 'Get Bent', text: top ? `${byId[top.id].name} is top of the bend list. Who will Bending Spoons buy next?` : 'Who will Bending Spoons buy next?', url: 'https://keff.uk/bending/' };
      try {
        if (navigator.share) await navigator.share(share);
        else { await navigator.clipboard.writeText(`${share.text}\n${share.url}`); main.querySelector('#share-status').textContent = 'Link copied.'; }
      } catch (error) {
        if (error.name !== 'AbortError') main.querySelector('#share-status').textContent = 'Share this link: keff.uk/bending/';
      }
    });
    say('All four votes saved. The community Elo leaderboard is ready.');
  } catch (error) {
    if (ticket !== epoch) return;
    main.innerHTML = '<div class="loading"><p role="alert"></p><button class="text-action">Retry leaderboard</button></div>';
    main.querySelector('p').textContent = error.message;
    main.querySelector('button').addEventListener('click', showResults);
  }
}

document.querySelector('.wordmark').addEventListener('click', event => { event.preventDefault(); showHome(); focusMain(); });
window.addEventListener('keydown', event => {
  if (view === 'game' && !pending && !chosen && ['1', '2'].includes(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey && !event.repeat) {
    event.preventDefault(); vote(round.pairs[round.votes.length][Number(event.key) - 1]);
  }
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installEvent = event; document.querySelector('#install').hidden = false;
});
document.querySelector('#install').addEventListener('click', async () => {
  if (installEvent) {
    const prompt = installEvent; installEvent = null;
    await prompt.prompt(); document.querySelector('#install').hidden = true;
  } else document.querySelector('#install-help').hidden = !document.querySelector('#install-help').hidden;
});
window.addEventListener('appinstalled', () => { document.querySelector('#install').hidden = true; });
if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches) document.querySelector('#install').hidden = false;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/bending/sw.js', { scope: '/bending/' }).catch(() => {});
showHome();
