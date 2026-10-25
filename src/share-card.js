import { byId } from './companies.js';
import { spoon } from './spoon.js';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
export const GAME_URL = 'https://keff.uk/bending/';

export function shareText(ids) {
  const names = ids.map(id => byId[id]?.name).filter(Boolean);
  return `I bent ${names.slice(0, -1).join(', ')} and ${names.at(-1)}. Your turn: ${GAME_URL}`;
}

async function spoonImage(company) {
  const svg = spoon(company, 1);
  svg.setAttribute('width', '220'); svg.setAttribute('height', '450');
  const response = await fetch(`/bending/logos/${company.icon}.svg`);
  if (!response.ok) throw new Error('Could not load a company logo.');
  const logo = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').documentElement;
  if (logo.localName !== 'svg') throw new Error('Invalid company logo.');
  // Inline the paths so the PNG contains the real logo, without external SVG resources.
  for (const [name, value] of Object.entries({ x: '72', y: '60', width: '56', height: '56' })) logo.setAttribute(name, value);
  svg.querySelector('image').replaceWith(logo);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    return image;
  } finally { URL.revokeObjectURL(url); }
}

function label(ctx, text, x, y, size, weight = 650, color = '#f3f3f5', align = 'left') {
  ctx.font = `${weight} ${size}px Inter, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x, y);
}

export async function createShareCard(ids) {
  if (ids.length !== 4 || new Set(ids).size !== 4 || ids.some(id => !byId[id])) throw new Error('A card needs four completed duels.');
  await document.fonts.load('800 88px Inter');
  const images = await Promise.all(ids.map(id => spoonImage(byId[id])));
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH; canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image export is unavailable.');
  ctx.fillStyle = '#0e0f13'; ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  label(ctx, 'GET BENT.', 64, 84, 34, 850);
  label(ctx, 'I BENT THESE.', 64, 205, 88, 800);
  label(ctx, 'Who will Bending Spoons buy next?', 67, 259, 29, 450, '#aeb0bf');

  images.forEach((image, i) => {
    const center = i % 2 ? 770 : 302;
    const top = i < 2 ? 310 : 735;
    ctx.drawImage(image, center - 92, top, 184, 376);
    ctx.save();
    ctx.translate(center + 43, top + 108); ctx.rotate(-.18);
    ctx.fillStyle = '#0e0f13'; ctx.fillRect(-66, -27, 132, 52);
    ctx.strokeStyle = '#ff6b75'; ctx.lineWidth = 4; ctx.strokeRect(-66, -27, 132, 52);
    label(ctx, 'BENT', 0, 13, 37, 850, '#ff6b75', 'center');
    ctx.restore();
    const name = byId[ids[i]].name;
    let size = 37;
    ctx.font = `650 ${size}px Inter, sans-serif`;
    while (ctx.measureText(name).width > 380 && size > 25) { size--; ctx.font = `650 ${size}px Inter, sans-serif`; }
    label(ctx, name, center, top + 399, size, 650, '#f3f3f5', 'center');
  });
  ctx.fillStyle = '#30323d'; ctx.fillRect(64, 1184, 952, 2);
  label(ctx, 'Your turn.', 66, 1245, 28, 500, '#aeb0bf');
  label(ctx, 'keff.uk/bending', 64, 1305, 49, 750, '#b6a7ff');
  // A drawn arrow keeps the invitation legible without depending on a font glyph.
  ctx.strokeStyle = '#b6a7ff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(948, 1289); ctx.lineTo(1012, 1289); ctx.moveTo(990, 1267); ctx.lineTo(1012, 1289); ctx.lineTo(990, 1311); ctx.stroke();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create the image.');
  return new File([blob], `get-bent-${ids.join('-')}.png`, { type: 'image/png' });
}

export function canShareCard(file) {
  try { return !!navigator.share && !!navigator.canShare?.({ files: [file] }); } catch { return false; }
}

export function downloadCard(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url; link.download = file.name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
