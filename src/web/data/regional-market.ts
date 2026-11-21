export const regionalSource = {
  pageUrl: 'https://statistik.admin.ch/de/asset/36829793',
  workbookUrl: 'https://dam-api.bfs.admin.ch/hub/api/dam/assets/36829793/master',
  publicationDate: '2026-08-27',
};

// BFS BESTA 06.02.00.02.01b, publizierte Werte in Tausend mit einer Dezimalstelle.
export const regionalPeriods = ['2. Quartal 2025', '1. Quartal 2026', '2. Quartal 2026'] as const;
const observations = {
  switzerland: { label: 'Schweiz', coverage: 'Ganze Schweiz', counts: [96.1, 101.7, 98.7] },
  zurich: { label: 'Grossregion Zürich', coverage: 'Kanton Zürich', counts: [21.7, 25.1, 23.7] },
  espaceMittelland: { label: 'Espace Mittelland', coverage: 'Kantone Bern, Freiburg, Jura, Neuenburg und Solothurn', counts: [17.8, 17.9, 16.6] },
  northwestern: { label: 'Nordwestschweiz', coverage: 'Kantone Aargau, Basel-Landschaft und Basel-Stadt', counts: [13.7, 15.3, 14.2] },
  lakeGeneva: { label: 'Genferseeregion', coverage: 'Kantone Genf, Waadt und Wallis', counts: [15.4, 16.2, 15.4] },
  central: { label: 'Zentralschweiz', coverage: 'Kantone Luzern, Nidwalden, Obwalden, Schwyz, Uri und Zug', counts: [11.8, 11.6, 12.2] },
};

export const regionOptions = [
  { id: 'switzerland', label: 'Ganze Schweiz', geography: 'switzerland', jobLocation: null },
  { id: 'zurich', label: 'Zürich', geography: 'zurich', jobLocation: 'Zürich' },
  { id: 'bern', label: 'Bern', geography: 'espaceMittelland', jobLocation: 'Bern' },
  { id: 'basel', label: 'Basel', geography: 'northwestern', jobLocation: 'Basel' },
  { id: 'geneva', label: 'Genf', geography: 'lakeGeneva', jobLocation: 'Genève' },
  { id: 'lausanne', label: 'Lausanne', geography: 'lakeGeneva', jobLocation: 'Lausanne' },
  { id: 'lucerne', label: 'Luzern', geography: 'central', jobLocation: 'Luzern' },
] as const;

export type RegionId = (typeof regionOptions)[number]['id'];

export function getRegionalMarket(id: RegionId) {
  const option = regionOptions.find(region => region.id === id) ?? regionOptions[0];
  const jobsUrl = new URL('https://www.jobs.ch/en/vacancies/');
  if (option.jobLocation) {
    jobsUrl.searchParams.set('location', option.jobLocation.toLocaleLowerCase('de-CH'));
    jobsUrl.searchParams.set('term', '');
  }
  return { option, observation: observations[option.geography], jobsUrl: jobsUrl.toString() };
}
