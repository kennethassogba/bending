let serial = 0;

function handlePath(bend) {
  const left = [], right = [];
  for (let i = 0; i <= 70; i++) {
    const t = i / 70;
    const y = 145 + t * 270;
    const x = 100 + bend * 68 * Math.sin(Math.PI * t) ** 2;
    const width = 5 + 6 * Math.sin(t * Math.PI / 2) + 2 * t;
    left.push(`${(x - width).toFixed(2)},${y.toFixed(2)}`);
    right.unshift(`${(x + width).toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${left.join(' L')} Q100,430 ${right[0]} L${right.slice(1).join(' L')} Z`;
}

export function spoon(company, bend = 0) {
  const id = `spoon-${++serial}`;
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 220 450');
  el.setAttribute('class', 'spoon');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<defs>
    <linearGradient id="${id}-metal" x1="0" x2="1"><stop stop-color="#9a9da0"/><stop offset=".16" stop-color="#dadcde"/><stop offset=".4" stop-color="#f7f8f9"/><stop offset=".57" stop-color="#b1b5b8"/><stop offset=".8" stop-color="#e8eaec"/><stop offset="1" stop-color="#92979b"/></linearGradient>
    <radialGradient id="${id}-bowl" cx=".34" cy=".3" r=".85"><stop stop-color="#f6f7f8"/><stop offset=".48" stop-color="#d7dadd"/><stop offset=".78" stop-color="#a5aaae"/><stop offset=".92" stop-color="#e4e7e9"/><stop offset="1" stop-color="#f9fafb"/></radialGradient>
    <linearGradient id="${id}-inner" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#9da3a7" stop-opacity=".5"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".7"/></linearGradient>
  </defs>
  <ellipse cx="108" cy="431" rx="28" ry="3" fill="#131315" opacity=".06"/>
  <path data-handle d="${handlePath(bend)}" fill="url(#${id}-metal)" stroke="#a1a6aa" stroke-width="1"/>
  <g data-bowl transform="rotate(${-24 * bend} 100 151)">
    <path d="M100 7C67 7 43 54 45 99C46 130 66 145 88 153L94 164L106 164L112 153C134 145 154 130 155 99C157 54 133 7 100 7Z" fill="url(#${id}-metal)" stroke="#9ba1a5" stroke-width="1.2"/>
    <path d="M100 13C72 13 49 56 51 99C52 125 70 139 100 148C130 139 148 125 149 99C151 56 128 13 100 13Z" fill="url(#${id}-bowl)" stroke="#fff" stroke-opacity=".75" stroke-width="1.4"/>
    <path d="M100 18C75 18 54 58 56 99C57 121 73 135 100 143C127 135 143 121 144 99C146 58 125 18 100 18Z" fill="url(#${id}-inner)"/>
    ${company ? `<image href="/bending/logos/${company.icon}.svg" x="72" y="60" width="56" height="56"/>` : `<text x="100" y="112" font-family="Inter,Arial,sans-serif" font-size="66" font-weight="800" text-anchor="middle" fill="#171719">?</text>`}
    <path d="M65 55C58 72 57 89 59 100" stroke="#fff" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/>
  </g>`;
  return el;
}

export function bendSpoon(el, duration = 680) {
  const handle = el.querySelector('[data-handle]');
  const bowl = el.querySelector('[data-bowl]');
  const draw = amount => {
    handle.setAttribute('d', handlePath(amount));
    bowl.setAttribute('transform', `rotate(${-24 * amount} 100 151)`);
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(1); return Promise.resolve(); }
  return new Promise(resolve => {
    const start = performance.now();
    const frame = now => {
      const t = Math.min((now - start) / duration, 1);
      draw(1 - (1 - t) ** 3);
      if (t < 1 && el.isConnected) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}
