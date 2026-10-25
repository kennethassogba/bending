import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acquisitions, acquisitionsReviewed } from '../src/acquisitions.js';
import { companies } from '../src/companies.js';
import { shareText, CARD_WIDTH, CARD_HEIGHT } from '../src/share-card.js';

test('completed acquisitions stay out of the candidate catalog and carry sources', () => {
  const candidates = new Set(companies.map(company => company.id));
  assert.ok(acquisitions.length >= 10);
  for (const company of acquisitions) {
    assert.equal(candidates.has(company.id), false, company.name);
    assert.ok(company.closed <= acquisitionsReviewed);
    assert.ok(company.sources.length > 0);
    for (const source of company.sources) assert.equal(new URL(source.url).protocol, 'https:');
    for (const value of [company.peak, company.purchase]) assert.ok(value === null || value.value > 0);
  }
  assert.equal(acquisitions.find(company => company.id === 'meetup').purchase, null);
  assert.equal(acquisitions.find(company => company.id === 'streamyard').purchase, null);
  assert.equal(acquisitions.find(company => company.id === 'komoot').purchase, null);
});

test('share content identifies the actual four choices and the playable link', () => {
  const text = shareText(['notion', 'discord', 'linear', 'supabase']);
  for (const name of ['Notion', 'Discord', 'Linear', 'Supabase', 'https://keff.uk/bending/']) assert.ok(text.includes(name));
  assert.equal(CARD_WIDTH, 1080);
  assert.equal(CARD_HEIGHT, 1350);
});
