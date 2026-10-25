// Checked against company disclosures and the cited financial records on 2026-10-25.
// Null is unavailable, never zero. A funding round or listing price is not an all-time peak.
const prospectus = 'https://www.sec.gov/Archives/edgar/data/2004711/000110465926079884/tm2613674-14_424b4.htm';
const source = (label, url) => ({ label, url });
export const acquisitionsReviewed = '2026-10-25';
export const acquisitions = [
  {
    id: 'airtable', name: 'Airtable', closed: '2026-09-04',
    peak: { value: 11735000000, label: '~$11.7B', basis: '2021 funding' },
    purchase: { value: 2250000000, label: '~$2.25B', basis: 'Equity value' },
    note: 'The 2021 round valued Airtable at $11B before $735M of new capital, approximately $11.7B after funding. The announced acquisition equity value was about $2.25B; enterprise value was $1.285B. This is the announced value, not a final closing adjustment.',
    sources: [source('2021 funding', 'https://www.airtable.com/newsroom/series-f'), source('Deal terms', 'https://investors.bendingspoons.com/newsroom/bending-spoons-agrees-to-acquire-airtable'), source('Closing', 'https://investors.bendingspoons.com/newsroom/bending-spoons-completes-acquisition-of-airtable')],
  },
  {
    id: 'eventbrite', name: 'Eventbrite', closed: '2026-03-10', peak: null,
    purchase: { value: 505000000, label: '~$505M', basis: 'Consideration' },
    note: 'The prospectus reports total consideration of about $505M. The $500M headline deal value and the IPO valuation are different measurements. A verified all-time market-cap peak is unavailable here.',
    sources: [source('SEC prospectus, Note 5', prospectus)],
  },
  {
    id: 'aol', name: 'AOL', closed: '2026-01-02',
    peak: { value: 200000000000, label: '>$200B', basis: '1999 market cap', lowerBound: true },
    purchase: { value: 1454432000, label: '~$1.45B', basis: 'Consideration' },
    note: 'Oakmark documented a market capitalization above $200B in late 1999. This is a reported lower bound, not an exact daily high. The SEC consideration concerns the AOL business acquired in 2026; the business perimeter changed over the intervening decades.',
    sources: [source('Historical market cap', 'https://oakmark.com/wp-content/uploads/sites/3/2019/10/3rdQtr_063002.pdf'), source('SEC prospectus, Note 5', prospectus)],
  },
  {
    id: 'vimeo', name: 'Vimeo', closed: '2025-11-24', peak: null,
    purchase: { value: 1358688000, label: '~$1.36B', basis: 'Consideration' },
    note: 'The SEC purchase-price allocation records about $1.359B of consideration; the announcement headline was $1.38B. The 2021 private funding round is not a verified all-time public-market peak.',
    sources: [source('SEC prospectus, Note 5', prospectus), source('Deal announcement', 'https://vimeo.com/press/media-release/vimeo-enters-definitive-agreement-be-acquired-bending-spoons-138')],
  },
  {
    id: 'komoot', name: 'Komoot', closed: '2025-03-20', peak: null, purchase: null,
    note: 'The SEC filing groups Komoot, Loomly, MileIQ and Harvest into a combined $701M consideration. It does not disclose an individual Komoot price. No verified peak valuation is available.',
    sources: [source('SEC prospectus, Note 5', prospectus)],
  },
  {
    id: 'brightcove', name: 'Brightcove', closed: '2025-02-04', peak: null,
    purchase: { value: 218000000, label: '~$218M', basis: 'Consideration' },
    note: 'The SEC filing reports about $218M of consideration, distinct from the $233M announced headline. A verified all-time market-cap peak is unavailable here.',
    sources: [source('SEC prospectus, Note 5', prospectus), source('Deal announcement', 'https://www.brightcove.com/pressroom/brightcove-enters-definitive-agreement-to-be-acquired-by-bending-spoons/')],
  },
  {
    id: 'wetransfer', name: 'WeTransfer', closed: '2024-07-31', peak: null,
    purchase: { value: 476300000, label: '$476.3M', basis: 'Consideration' },
    note: 'The SEC filing reports $476.3M of total consideration. A proposed IPO target is not a completed funding valuation or verified peak.',
    sources: [source('SEC prospectus, Note 5', prospectus)],
  },
  {
    id: 'streamyard', name: 'StreamYard', closed: '2024-04-23', peak: null, purchase: null,
    note: 'The SEC filing groups StreamYard, Meetup and Issuu into a combined $280.7M consideration. An individual purchase price and verified peak valuation are unavailable. Hopin valuations are not StreamYard valuations.',
    sources: [source('SEC prospectus, Note 5', prospectus)],
  },
  {
    id: 'meetup', name: 'Meetup', closed: '2024-01-23', peak: null, purchase: null,
    note: 'The SEC filing groups Meetup, StreamYard and Issuu into a combined $280.7M consideration. It does not disclose an individual Meetup price. No verified peak valuation is available.',
    sources: [source('SEC prospectus, Note 5', prospectus)],
  },
  {
    id: 'evernote', name: 'Evernote', closed: '2023-01-03', peak: null,
    purchase: { value: 199700000, label: '$199.7M', basis: 'Consideration' },
    note: 'The SEC filing reports $199.7M of consideration. Published private valuation records conflict, including $1.53B and $1.7B in 2015 on the same provider page, so an unverified peak is not displayed.',
    sources: [source('SEC prospectus, Note 5', prospectus), source('Valuation records', 'https://forgeglobal.com/evernote_ipo/')],
  },
];
