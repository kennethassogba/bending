import { acquisitions } from './acquisitions.js';

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

export function alreadyBent() {
  const section = element('details', 'already-bent');
  section.append(element('summary', 'already-bent-title', 'Already bent'));
  const table = element('table', 'bent-table');
  const head = element('thead');
  const headings = element('tr');
  for (const title of ['Company', 'Peak', 'Paid']) {
    const heading = element('th', '', title); heading.scope = 'col'; headings.append(heading);
  }
  head.append(headings);
  const body = element('tbody');
  for (const item of acquisitions) {
    const row = element('tr');
    const name = element('th', '', item.name); name.scope = 'row';
    row.append(name);
    for (const value of [item.peak, item.purchase]) {
      row.append(element('td', value ? '' : 'unavailable', value?.label || 'N/A'));
    }
    body.append(row);
  }
  table.append(head, body); section.append(table);
  return section;
}
