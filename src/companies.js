export const companies = [
  { id: 'notion', name: 'Notion', color: '#111111', icon: 'notion' },
  { id: 'discord', name: 'Discord', color: '#5865f2', icon: 'discord' },
  { id: 'dropbox', name: 'Dropbox', color: '#0061ff', icon: 'dropbox' },
  { id: 'medium', name: 'Medium', color: '#111111', icon: 'medium' },
  { id: 'canva', name: 'Canva', color: '#7638fa', icon: 'canva' },
  { id: 'figma', name: 'Figma', color: '#111111', icon: 'figma' },
  { id: 'zoom', name: 'Zoom', color: '#0b5cff', icon: 'zoom' },
  { id: 'soundcloud', name: 'SoundCloud', color: '#e84c00', icon: 'soundcloud' },
  { id: 'pinterest', name: 'Pinterest', color: '#bd081c', icon: 'pinterest' },
  { id: 'calendly', name: 'Calendly', color: '#006bff', icon: 'calendly' },
  { id: 'todoist', name: 'Todoist', color: '#d63225', icon: 'todoist' },
  { id: 'strava', name: 'Strava', color: '#e74400', icon: 'strava' },
];

export const byId = Object.fromEntries(companies.map(company => [company.id, company]));
