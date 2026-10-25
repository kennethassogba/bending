import { byId } from './companies.js';
import { spoon, bendSpoon } from './spoon.js';
import { createShareCard, canShareCard, downloadCard, shareText, GAME_URL } from './share-card.js';
import { alreadyBent } from './already-bent.js';

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
let cardUrl = null;
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
const shareIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2"/></svg>';
const downloadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></svg>';
const store = {
  get(name) { try { return localStorage.getItem(name); } catch { return null; } },
  set(name, value) { try { localStorage.setItem(name, value); } catch { /* Private browsing can disable storage. */ } },
  remove(name) { try { localStorage.removeItem(name); } catch { /* The in-memory round still works. */ } },
};
sound = store.get('get-bent-sound') === 'on';

function updateTheme() {
  const dark = document.documentElement.dataset.theme !== 'light';
  const button = document.querySelector('#theme');
  button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  button.innerHTML = dark
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.5A8.8 8.8 0 0 1 9.5 3.5a8.8 8.8 0 1 0 11 11Z"/></svg>';
}
document.querySelector('#theme').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0e0f13' : '#ffffff';
  store.set('get-bent-theme', theme); updateTheme();
});
updateTheme();

function releaseCard() { if (cardUrl) { URL.revokeObjectURL(cardUrl); cardUrl = null; } }

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
  releaseCard();
  const resume = !!store.get(key);
  main.innerHTML = `<section class="home" aria-labelledby="home-title">
    <h1 id="home-title">Who's getting <br>bent?</h1>
    <p class="intro">Which company will <strong>Bending Spoons</strong> buy next?</p>
    <div class="home-art" aria-hidden="true"><span class="stamp">BENT</span></div>
    <div class="home-actions"><button class="primary" id="start">${resume ? 'Continue round' : 'Pick the next acquisition'}${arrow}</button>
      <p id="home-error" class="error" role="alert" hidden></p></div>
  </section>`;
  const art = main.querySelector('.home-art');
  art.prepend(spoon(byId.notion), spoon(byId.discord, 1));
  main.querySelector('#start').addEventListener('click', start);
  main.querySelector('.home').append(alreadyBent());
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
    if (!saved || !round) round = await api('round', { method: 'POST', body: JSON.stringify({ catalog: 2 }) });
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
    <div class="duel-actions"></div>
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
    const duel = round.votes.length;
    round.votes.push(data.vote);
    target.append(node('span', 'vote-label', 'You'));
    main.querySelector('.duel-caption').hidden = true;
    await revealLuna(duel, ticket);
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

async function revealLuna(duel, ticket) {
  if (ticket !== epoch) return;
  pending = true;
  const status = main.querySelector('.game-status');
  const actions = main.querySelector('.duel-actions');
  actions.replaceChildren();
  status.className = 'game-status'; status.textContent = 'Luna is picking...';
  try {
    let data;
    for (let attempt = 0; attempt < 12; attempt++) {
      data = await api('decision', { method: 'POST', body: JSON.stringify({ roundId: round.id, duel }) });
      if (ticket !== epoch) return;
      if (!data.pending) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (ticket !== epoch) return;
    }
    if (!data.vote || !round.pairs[duel].includes(data.vote.winner)) throw new Error('Luna is unavailable. Try again.');
    const pick = main.querySelector(`[data-company="${data.vote.winner}"]`);
    pick.classList.add('luna-selected');
    const label = pick.querySelector('.vote-label');
    if (label) label.textContent = 'You + Luna';
    else pick.append(node('span', 'vote-label', 'Luna'));
    status.textContent = `Luna / Decision picked ${byId[data.vote.winner].name}.`;
    say(status.textContent);
  } catch {
    if (ticket !== epoch) return;
    status.textContent = 'Luna is unavailable.';
    const retry = node('button', 'text-action', 'Retry Luna');
    retry.addEventListener('click', () => revealLuna(duel, ticket));
    actions.append(retry);
  }
  if (ticket !== epoch) return;
  pending = false;
  const next = node('button', 'primary', round.votes.length === 4 ? 'See rankings' : 'Next duel');
  next.innerHTML += arrow;
  next.addEventListener('click', async () => {
    if (round.votes.length === 4) { store.remove(key); await showResults(); }
    else { showDuel(); focusMain(); }
  });
  actions.append(next);
  next.focus({ preventScroll: true });
}

async function showResults() {
  const ticket = ++epoch; view = 'results'; pending = false;
  releaseCard();
  const ids = round.votes.map(vote => vote.winner);
  main.innerHTML = `<section class="results" aria-labelledby="results-title">
    <h1 id="results-title">You bent these.</h1>
    <div class="card-preview" id="card-preview"><p role="status">Making your card...</p></div>
    <div class="card-actions"><button class="primary" id="share-card" disabled>Making your card...</button><button class="share" id="download-card" aria-label="Download your card" hidden>${downloadIcon}</button></div>
    <p class="results-status" id="share-status" role="status"></p>
    <section class="leaderboard" aria-labelledby="board-title"><h2 id="board-title">Rankings</h2><div id="leaderboard-content"><p class="results-status" role="status">Loading leaderboards...</p></div></section>
    <div class="results-actions"><button class="secondary" id="again">Bend some more${arrow}</button><button class="share" id="share-app" aria-label="Share app">${shareIcon}</button><p class="results-status app-share-status" id="app-share-status" role="status" hidden></p></div>
  </section>`;
  main.querySelector('#again').addEventListener('click', () => { round = null; showHome(); start(); });
  main.querySelector('#share-app').addEventListener('click', async () => {
    const status = main.querySelector('#app-share-status');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Get Bent', text: 'Which company will Bending Spoons buy next?', url: GAME_URL });
      } else {
        await navigator.clipboard.writeText(GAME_URL);
        status.textContent = 'Link copied.'; status.hidden = false;
      }
    } catch (error) {
      if (ticket !== epoch || error.name === 'AbortError') return;
      status.textContent = GAME_URL; status.hidden = false;
    }
  });
  main.querySelector('.leaderboard').after(alreadyBent());
  focusMain();
  say('All four votes saved. Your share card and the community leaderboard are ready below.');
  await Promise.all([prepareCard(ids, ticket), loadLeaderboard(new Set(ids), ticket)]);
}

async function prepareCard(ids, ticket) {
  const button = main.querySelector('#share-card');
  const status = main.querySelector('#share-status');
  button.disabled = true; button.textContent = 'Making your card...';
  status.textContent = '';
  try {
    const file = await createShareCard(ids);
    if (ticket !== epoch) return;
    releaseCard(); cardUrl = URL.createObjectURL(file);
    const image = node('img'); image.src = cardUrl;
    image.alt = `I bent ${ids.map(id => byId[id].name).join(', ')}. Four bent spoons. Play at keff.uk/bending.`;
    image.width = 1080; image.height = 1350;
    main.querySelector('#card-preview').replaceChildren(image);
    const nativeShare = canShareCard(file);
    button.disabled = false;
    button.innerHTML = `Share card${shareIcon}`;
    const download = main.querySelector('#download-card');
    download.hidden = !nativeShare;
    main.querySelector('.card-actions').classList.toggle('single-action', !nativeShare);
    const save = () => { downloadCard(file); status.textContent = 'Download started.'; };
    download.onclick = save;
    button.onclick = async () => {
      if (!nativeShare) { save(); return; }
      try {
        // The PNG is prepared before the tap, preserving native share activation on iOS.
        await navigator.share({ files: [file], title: 'My Get Bent picks', text: shareText(ids) });
      } catch (error) {
        if (ticket !== epoch || error.name === 'AbortError') return;
        status.textContent = 'Sharing is unavailable. Use the download button to save your card.';
      }
    };
  } catch {
    if (ticket !== epoch) return;
    main.querySelector('#card-preview').replaceChildren(node('p', '', 'Could not create your card.'));
    status.textContent = 'Check your connection and try again.';
    button.disabled = false; button.textContent = 'Retry card';
    button.onclick = () => prepareCard(ids, ticket);
  }
}

async function loadLeaderboard(picks, ticket) {
  const target = main.querySelector('#leaderboard-content');
  target.innerHTML = '<p class="results-status" role="status">Loading leaderboard...</p>';
  try {
    const data = await api('leaderboard');
    if (ticket !== epoch) return;
    target.replaceChildren();
    const boards = node('div', 'parallel-boards');
    target.append(boards);
    renderBoard(boards, 'Players', data, picks);
    renderBoard(boards, 'Luna / Decision', data.luna, new Set());
  } catch (error) {
    if (ticket !== epoch) return;
    target.replaceChildren(node('p', 'error', error.message));
    const retry = node('button', 'text-action', 'Retry leaderboards');
    retry.onclick = () => loadLeaderboard(picks, ticket); target.append(retry);
  }
}

function renderBoard(parent, title, data, picks) {
    const section = node('section', 'ranking');
    const heading = node('h3', '', title);
    section.append(heading);
    parent.append(section);
    if (!data?.votes) { section.append(node('p', 'results-status', 'No votes yet.')); return; }
    section.append(node('p', 'board-total', `${data.votes.toLocaleString('en-US')} ${data.votes === 1 ? 'vote' : 'votes'}`));
    const list = node('ol', 'board');
    list.setAttribute('aria-label', `${title} Elo leaderboard`);
    section.append(list);
    const entries = data.companies.filter(item => byId[item.id] && item.matches > 0);
    let rank = 0;
    let previous = null;
    let position = 0;
    for (const item of entries) {
      position++;
      const rating = Math.round(item.rating);
      if (rating !== previous) rank = position;
      previous = rating;
      const company = byId[item.id];
      const row = node('li', `board-row${item.matches ? '' : ' unranked'}`);
      const number = node('span', 'rank', item.matches ? String(rank).padStart(2, '0') : '·');
      const identity = node('span', 'board-company');
      const img = node('img', company.color === '#111111' ? 'monochrome' : ''); img.src = `/bending/logos/${company.icon}.svg`; img.alt = ''; img.width = 23; img.height = 23;
      const name = node('span', 'board-name', company.name);
      if (picks.has(item.id)) name.append(node('span', 'your-pick', 'Your pick'));
      identity.append(img, name);
      const score = node('span', 'rating', item.matches ? rating.toLocaleString('en-US') : 'N/A');
      score.setAttribute('aria-label', item.matches ? `${rating} Elo` : 'Unranked');
      row.append(number, identity, score); list.append(row);
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
