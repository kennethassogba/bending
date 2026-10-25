import { acquisitions, acquisitionsReviewed } from './acquisitions.js';

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

export function alreadyBent() {
  const section = element('details', 'already-bent');
  const title = element('summary', 'already-bent-title', 'Already bent');
  section.append(title);
  section.append(element('p', 'bent-intro', 'Completed acquisitions by Bending Spoons. Open a company for sources.'));
  const header = element('div', 'bent-columns'); header.setAttribute('aria-hidden', 'true');
  header.append(element('span', '', 'Company'), element('span', '', 'Peak reported'), element('span', '', 'Paid'));
  section.append(header);
  const list = element('ul', 'bent-list');
  for (const item of acquisitions) {
    const row = element('li');
    const details = element('details', 'bent-company');
    const summary = element('summary', 'bent-summary');
    const name = element('span', 'bent-name', item.name);
    name.append(element('span', 'bent-basis', item.closed.slice(0, 4)));
    summary.append(name);
    for (const [kind, value] of [['Peak reported', item.peak], ['Paid', item.purchase]]) {
      const cell = element('span', `bent-value${value ? '' : ' unavailable'}`, value?.label || 'Unavailable');
      cell.setAttribute('aria-label', `${kind}: ${value?.label || 'unavailable'}`);
      if (value) cell.append(element('span', 'bent-basis', value.basis));
      summary.append(cell);
    }
    const info = element('div', 'bent-info');
    info.append(element('p', '', item.note));
    const links = element('div', 'bent-sources');
    for (const source of item.sources) {
      const link = element('a', '', source.label);
      link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
    }
    info.append(links); details.append(summary, info); row.append(details); list.append(row);
  }
  section.append(list, element('p', 'bent-method', "USD. Private funding valuations and public market caps use different bases. Paid means reported consideration, except Airtable's announced equity value. Unavailable means no verified individual figure."), element('p', 'bent-reviewed', `Sources checked ${acquisitionsReviewed}.`));
  return section;
}
